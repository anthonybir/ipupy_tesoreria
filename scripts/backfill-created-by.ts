/**
 * Backfill script for converting legacy `created_by` email strings to Convex user IDs.
 *
 * Usage:
 *   npm run migrate:created-by -- --dry-run   # preview
 *   npm run migrate:created-by                 # execute
 *
 * Required environment variables:
 *   CONVEX_URL         - Convex deployment URL (e.g. https://my-app.convex.cloud)
 *   CONVEX_ADMIN_KEY   - Convex admin key with access to internal mutations
 */

import process from "node:process";

import { ConvexHttpClient } from "convex/browser";
import { internal } from "../convex/_generated/api";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value.trim();
}

async function main() {
  const convexUrl = requireEnv("CONVEX_URL");
  const adminKey = requireEnv("CONVEX_ADMIN_KEY");
  const dryRun = process.argv.includes("--dry-run");

  const client = new ConvexHttpClient(convexUrl);

  (client as unknown as { setAdminAuth: (token: string, identity?: unknown) => void }).setAdminAuth(
    adminKey,
    {
      tokenIdentifier: "audit-backfill-script",
      subject: "audit-backfill-script",
      name: "Audit Backfill Script",
    }
  );

  console.log(dryRun ? "Running in DRY-RUN mode" : "Running backfill (writes enabled)");

  const mutationRef = internal.migrations.backfillCreatedBy as unknown as Parameters<(typeof client)["mutation"]>[0];
  const result = await client.mutation(mutationRef, {
    dry_run: dryRun,
  } as unknown as Parameters<(typeof client)["mutation"]>[1]);

  console.log("\nBackfill summary");
  console.log("----------------");
  for (const table of result.tables) {
    console.log(`Table: ${table.table}`);
    console.log(`  Updated:   ${table.updated}`);
    console.log(`  Skipped:   ${table.skipped}`);
    if (table.unresolved.length > 0) {
      console.log("  Unresolved:");
      for (const entry of table.unresolved) {
        console.log(`    - ${entry.id}: ${entry.actor}`);
      }
    }
  }

  if (dryRun) {
    console.log("\nDry-run complete. Rerun without --dry-run to apply changes.");
  } else {
    console.log("\nBackfill complete.");
  }
}

main().catch((error) => {
  console.error("Backfill script failed:", error);
  process.exitCode = 1;
});
