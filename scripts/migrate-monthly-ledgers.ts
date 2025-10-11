#!/usr/bin/env tsx

import { config } from "dotenv";
config({ path: ".env.local" });

import { ConvexHttpClient } from "convex/browser";
import { internal, api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { Pool } from "pg";

type MonthlyLedgerRow = {
  id: number;
  church_id: number;
  month: number;
  year: number;
  opening_balance: number | string | null;
  closing_balance: number | string | null;
  total_income: number | string | null;
  total_expenses: number | string | null;
  status: "open" | "closed" | "reconciled" | string;
  closed_at: string | null;
  closed_by: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type MigrationStats = {
  total: number;
  migrated: number;
  skipped: number;
  missingChurch: number;
  errors: number;
};

const ADMIN_EMAIL = "migration-accounting@ipupy.org.py";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value.trim();
}

function createDirectPool(): Pool {
  const databaseUrl = requireEnv("DATABASE_URL");
  const url = new URL(databaseUrl);
  const username = url.username;
  const projectRef = username.includes(".")
    ? username.substring(username.lastIndexOf(".") + 1)
    : username;

  return new Pool({
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    user: "postgres",
    password: url.password,
    database: url.pathname.replace("/", ""),
    ssl: { rejectUnauthorized: false },
  });
}

async function ensureAdminProfile(client: ConvexHttpClient): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await client.mutation(internal.migrations.upsertProfile as any, {
    email: ADMIN_EMAIL,
    role: "admin",
    active: true,
  });
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toTimestamp(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const convexUrl = requireEnv("CONVEX_URL");
  const adminKey = requireEnv("CONVEX_ADMIN_KEY");

  const client = new ConvexHttpClient(convexUrl);
  (client as unknown as { setAdminAuth: (token: string, identity?: unknown) => void }).setAdminAuth(
    adminKey,
    {
      tokenIdentifier: "monthly-ledger-migration",
      subject: "monthly-ledger-migration",
      name: "Monthly Ledger Migration Script",
      email: ADMIN_EMAIL,
    }
  );

  await ensureAdminProfile(client);

  console.log(dryRun ? "Running monthly ledger migration in DRY-RUN mode" : "Migrating monthly ledgers...");

  const pool = createDirectPool();
  const tableCheck = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'monthly_ledger') AS exists"
  );

  if (!tableCheck.rows[0]?.exists) {
    await pool.end();
    console.log("⚠️  Supabase table 'monthly_ledger' not found. Nothing to migrate.");
    return;
  }

  const { rows: ledgers } = await pool.query<MonthlyLedgerRow>(
    `SELECT id, church_id, month, year, opening_balance, closing_balance,
            total_income, total_expenses, status, closed_at, closed_by,
            notes, created_by, created_at, updated_at
       FROM public.monthly_ledger
       ORDER BY id ASC`
  );
  await pool.end();

  console.log(`Found ${ledgers.length} ledgers in Supabase`);

  const churches = await client.query(api.churches.list, {});
  const churchMap = new Map<number, Id<"churches">>();
  for (const church of churches) {
    if (typeof church.supabase_id === "number") {
      churchMap.set(church.supabase_id, church._id);
    }
  }

  const stats: MigrationStats = {
    total: ledgers.length,
    migrated: 0,
    skipped: 0,
    missingChurch: 0,
    errors: 0,
  };

  for (const ledger of ledgers) {
    const churchConvexId = churchMap.get(ledger.church_id);
    if (!churchConvexId) {
      console.error(`❌ Missing Convex church for ledger ${ledger.id} (church_id=${ledger.church_id})`);
      stats.missingChurch += 1;
      continue;
    }

    const closedAt = toTimestamp(ledger.closed_at);
    const closedBy = ledger.closed_by;
    const notes = ledger.notes;
    const createdBy = ledger.created_by;

    const payload = {
      church_id: churchConvexId,
      month: ledger.month,
      year: ledger.year,
      opening_balance: toNumber(ledger.opening_balance),
      closing_balance: toNumber(ledger.closing_balance),
      total_income: toNumber(ledger.total_income),
      total_expenses: toNumber(ledger.total_expenses),
      status: (ledger.status as "open" | "closed" | "reconciled") ?? "open",
      ...(closedAt !== undefined ? { closed_at: closedAt } : {}),
      ...(closedBy ? { closed_by: closedBy } : {}),
      ...(notes ? { notes } : {}),
      ...(createdBy ? { created_by: createdBy } : {}),
      created_at: toTimestamp(ledger.created_at) ?? Date.now(),
      updated_at: toTimestamp(ledger.updated_at) ?? Date.now(),
      supabase_id: ledger.id,
    };

    if (dryRun) {
      console.log(
        `DRY-RUN: would migrate ledger ID ${ledger.id} (${ledger.year}-${ledger.month}) for church ${ledger.church_id}`
      );
      stats.skipped += 1;
      continue;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.mutation(internal.monthlyLedgers.createLedgerFromMigration as any, payload);
      stats.migrated += 1;
      if (stats.migrated % 50 === 0) {
        console.log(`...migrated ${stats.migrated} ledgers so far`);
      }
    } catch (error) {
      stats.errors += 1;
      console.error(`❌ Failed to migrate ledger ${ledger.id}:`, error);
    }
  }

  console.log("\n📊 Monthly Ledger Migration Summary");
  console.log("------------------------------------");
  console.log(`Total rows:     ${stats.total}`);
  console.log(`Migrated:       ${stats.migrated}`);
  console.log(`Dry-run skips:  ${stats.skipped}`);
  console.log(`Missing church: ${stats.missingChurch}`);
  console.log(`Errors:         ${stats.errors}`);

  if (!dryRun && stats.errors === 0 && stats.missingChurch === 0) {
    console.log("\n✅ Monthly ledgers migrated successfully!");
  } else if (dryRun) {
    console.log("\n✅ Dry-run complete. Re-run without --dry-run to apply changes.");
  } else {
    console.log("\n⚠️  Migration completed with warnings. Review logs above.");
  }
}

main().catch((error) => {
  console.error("Monthly ledger migration failed:", error);
  process.exitCode = 1;
});

