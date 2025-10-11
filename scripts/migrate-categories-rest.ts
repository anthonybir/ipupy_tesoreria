#!/usr/bin/env tsx

/**
 * WS-7 Phase 2: Transaction Categories Migration (REST API Version)
 *
 * Migrates church_transaction_categories from Supabase to Convex using REST API.
 * This version uses the Supabase REST API instead of PostgreSQL connection pool
 * to work around pooler authentication issues.
 *
 * Usage:
 *   npm run migrate-categories:rest -- --dry-run   # Preview changes
 *   npm run migrate-categories:rest                # Execute migration
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { ConvexHttpClient } from "convex/browser";
import { internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

// =============================================================================
// Type Definitions
// =============================================================================

interface CategoryRow {
  id: number;
  category_name: string;
  category_type: "income" | "expense";
  parent_category_id: number | null;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string | null;
}

interface MigrationStats {
  created: number;
  parentLinked: number;
  errors: number;
}

// =============================================================================
// Environment Variable Validation
// =============================================================================

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value.trim();
}

// =============================================================================
// Supabase REST API Client
// =============================================================================

async function fetchCategoriesFromREST(supabaseUrl: string, serviceRoleKey: string): Promise<CategoryRow[]> {
  const url = `${supabaseUrl}/rest/v1/church_transaction_categories?select=*&order=id.asc`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase REST API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as CategoryRow[];
  return data;
}

// =============================================================================
// Main Migration Logic
// =============================================================================

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // 1. Environment validation
  const convexUrl = requireEnv("CONVEX_URL");
  const adminKey = requireEnv("CONVEX_ADMIN_KEY");
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  // 2. Initialize Convex client with admin auth
  const client = new ConvexHttpClient(convexUrl);

  (client as unknown as { setAdminAuth: (token: string, identity?: unknown) => void }).setAdminAuth(
    adminKey,
    {
      tokenIdentifier: "transaction-category-migration-rest",
      subject: "transaction-category-migration-rest",
      name: "Transaction Category Migration Script (REST API)",
    }
  );

  console.log(dryRun ? "Running in DRY-RUN mode" : "Running migration (writes enabled)");

  // 3. Fetch categories from Supabase REST API
  const categories = await fetchCategoriesFromREST(supabaseUrl, serviceRoleKey);
  console.log(`Found ${categories.length} categories in Supabase`);

  const stats: MigrationStats = {
    created: 0,
    parentLinked: 0,
    errors: 0,
  };

  // 4. Map to track Supabase ID → Convex ID
  const idMap = new Map<number, Id<"transactionCategories">>();

  // 5. First pass: Create all categories without parent relationships
  console.log("\n📊 Phase 1: Creating categories...");

  for (const row of categories) {
    try {
      const parsedCreatedAt = row.created_at ? Date.parse(row.created_at) : Number.NaN;
      const payload = {
        category_name: row.category_name.trim(),
        category_type: row.category_type,
        description: row.description?.trim() || undefined,
        is_system: row.is_system,
        is_active: row.is_active,
        supabase_id: row.id,
        created_at: Number.isFinite(parsedCreatedAt) ? parsedCreatedAt : Date.now(),
      };

      if (dryRun) {
        console.log(`  [DRY-RUN] Would create: ${payload.category_name} (${payload.category_type})`);
        idMap.set(row.id, `dummy-${row.id}` as Id<"transactionCategories">);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const convexId = await client.mutation(internal.accounting.createCategory as any, payload);
        idMap.set(row.id, convexId);
        console.log(`  ✅ Created: ${payload.category_name} (Supabase ID ${row.id} → Convex ID ${convexId})`);
      }

      stats.created += 1;
    } catch (error) {
      stats.errors += 1;
      console.error(`  ❌ Error creating category ${row.category_name}:`, error);
    }
  }

  // 6. Second pass: Link parent relationships
  console.log("\n🔗 Phase 2: Linking parent relationships...");

  const categoriesWithParents = categories.filter(row => row.parent_category_id !== null);

  if (categoriesWithParents.length === 0) {
    console.log("  ℹ️  No parent relationships to link");
  } else {
    for (const row of categoriesWithParents) {
      try {
        const categoryId = idMap.get(row.id);
        const parentCategoryId = row.parent_category_id;
        if (!parentCategoryId) {
          console.warn(`  ⚠️  Skipping parent link for ${row.category_name}: No parent ID`);
          continue;
        }
        const parentId = idMap.get(parentCategoryId);

        if (!categoryId || !parentId) {
          console.warn(`  ⚠️  Skipping parent link for ${row.category_name}: Missing ID mapping`);
          continue;
        }

        if (dryRun) {
          console.log(`  [DRY-RUN] Would link: ${row.category_name} → parent (Supabase ID ${row.parent_category_id})`);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await client.mutation(internal.accounting.updateCategoryParent as any, {
            id: categoryId,
            parent_category_id: parentId,
          });
          console.log(`  ✅ Linked: ${row.category_name} → parent category`);
        }

        stats.parentLinked += 1;
      } catch (error) {
        stats.errors += 1;
        console.error(`  ❌ Error linking parent for ${row.category_name}:`, error);
      }
    }
  }

  // 7. Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Migration Summary:");
  console.log("=".repeat(60));
  console.log(`Categories created:      ${stats.created}`);
  console.log(`Parent links created:    ${stats.parentLinked}`);
  console.log(`Errors encountered:      ${stats.errors}`);
  console.log("=".repeat(60));

  if (dryRun) {
    console.log("\n✅ Dry-run completed successfully. Run without --dry-run to apply changes.");
  } else {
    if (stats.errors > 0) {
      console.log("\n⚠️  Migration completed with errors. Review logs above.");
      process.exit(1);
    } else {
      console.log("\n✅ Migration completed successfully!");
      console.log("\n📝 Next steps:");
      console.log("   1. Verify categories in Convex dashboard: https://dashboard.convex.dev");
      console.log("   2. Check transactionCategories table");
      console.log("   3. Proceed to WS-7 Phase 3 (read-only queries)");
    }
  }
}

// =============================================================================
// Error Handling
// =============================================================================

main().catch((error) => {
  console.error("\n❌ Migration failed:", error);
  process.exit(1);
});
