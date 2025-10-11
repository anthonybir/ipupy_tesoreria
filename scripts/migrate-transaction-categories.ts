#!/usr/bin/env tsx

/**
 * Transaction Category Migration (Postgres ➜ Convex)
 *
 * Usage:
 *   npm run migrate-categories -- --dry-run   # Preview without writes
 *   npm run migrate-categories                # Execute migration
 *
 * Required environment variables:
 *   DATABASE_URL       - Supabase/Postgres connection string
 *   CONVEX_URL         - Convex deployment URL
 *   CONVEX_ADMIN_KEY   - Convex admin key (for internal mutations)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";
import process from "node:process";
import { ConvexHttpClient } from "convex/browser";
import { internal } from "../convex/_generated/api";

type RawCategory = {
  id: number;
  category_name: string;
  category_type: "income" | "expense";
  parent_category_id: number | null;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
};

type MigrationStats = {
  total: number;
  created: number;
  parentLinked: number;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value.trim();
}

function parseTimestamp(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid timestamp value: ${value}`);
  }
  return parsed;
}

async function fetchCategories(pool: Pool): Promise<RawCategory[]> {
  const { rows } = await pool.query<RawCategory>(`
    SELECT
      id,
      category_name,
      category_type,
      parent_category_id,
      description,
      is_system,
      is_active,
      created_at
    FROM church_transaction_categories
    ORDER BY id ASC
  `);

  return rows;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const databaseUrl = requireEnv("DATABASE_URL");
  const convexUrl = requireEnv("CONVEX_URL");
  const adminKey = requireEnv("CONVEX_ADMIN_KEY");

  const pool = new Pool({ connectionString: databaseUrl });
  const client = new ConvexHttpClient(convexUrl);

  (client as unknown as { setAdminAuth: (token: string, identity?: unknown) => void }).setAdminAuth(
    adminKey,
    {
      tokenIdentifier: "transaction-category-migration",
      subject: "transaction-category-migration",
      name: "Transaction Category Migration Script",
    }
  );

  console.log(dryRun ? "Running in DRY-RUN mode" : "Running migration (writes enabled)");

  const categories = await fetchCategories(pool);
  console.log(`Found ${categories.length} categories in Postgres`);

  const stats: MigrationStats = {
    total: categories.length,
    created: 0,
    parentLinked: 0,
  };

  const idMap = new Map<number, string>();

  const createCategoryRef =
    internal.accounting.createCategory as unknown as Parameters<(typeof client)["mutation"]>[0];
  const updateParentRef =
    internal.accounting.updateCategoryParent as unknown as Parameters<(typeof client)["mutation"]>[0];

  // First pass: insert all categories without parents
  for (const row of categories) {
    const payload = {
      category_name: row.category_name,
      category_type: row.category_type,
      description: row.description ?? undefined,
      is_system: row.is_system,
      is_active: row.is_active,
      supabase_id: row.id,
      created_at: parseTimestamp(row.created_at),
    };

    if (dryRun) {
      console.log(`DRY-RUN createCategory`, payload);
      continue;
    }

    const convexId = await client.mutation(
      createCategoryRef,
      payload as unknown as Parameters<(typeof client)["mutation"]>[1]
    );

    idMap.set(row.id, convexId as unknown as string);
    stats.created += 1;
  }

  // Second pass: link parent relationships
  if (!dryRun) {
    for (const row of categories) {
      if (!row.parent_category_id) {
        continue;
      }

      const categoryId = idMap.get(row.id);
      const parentId = idMap.get(row.parent_category_id);

      if (!categoryId || !parentId) {
        console.warn(
          `⚠️  Skipping parent link for category ${row.id} (${row.category_name}) - missing mapping.`
        );
        continue;
      }

      await client.mutation(
        updateParentRef,
        {
          id: categoryId,
          parent_category_id: parentId,
        } as unknown as Parameters<(typeof client)["mutation"]>[1]
      );

      stats.parentLinked += 1;
    }
  } else {
    console.log("DRY-RUN: skipping parent linkage phase.");
  }

  console.log("\nMigration summary");
  console.log("-----------------");
  console.log(`Total categories:   ${stats.total}`);
  console.log(`Inserted:           ${stats.created}`);
  console.log(`Parents linked:     ${stats.parentLinked}`);

  await pool.end();
  console.log("\nDone.");
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});

