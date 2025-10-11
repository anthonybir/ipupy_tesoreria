#!/usr/bin/env tsx

/**
 * Migration helper that replays the Supabase profile export against the
 * Convex Auth-powered profile store. This is a friendly wrapper around the
 * shared migration utilities so we can call it explicitly during WS-4 Phase 5.
 *
 * Usage:
 *   tsx scripts/migrate-profiles-to-convex-auth.ts --dry-run
 *   tsx scripts/migrate-profiles-to-convex-auth.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import process from "node:process";
import {
  migrateProfiles,
  printSummary,
  resolveEnv,
} from "./migrate-profiles-to-convex";

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  const convexUrl =
    resolveEnv(["CONVEX_URL", "NEXT_PUBLIC_CONVEX_URL", "CONVEX_DEPLOYMENT_URL"]) ??
    (() => {
      throw new Error("Missing CONVEX_URL (or NEXT_PUBLIC_CONVEX_URL / CONVEX_DEPLOYMENT_URL)");
    })();

  const adminKey =
    resolveEnv(["CONVEX_ADMIN_KEY", "CONVEX_DEPLOYMENT_ADMIN_KEY", "CONVEX_DEPLOY_KEY"]) ??
    (() => {
      throw new Error("Missing Convex admin key (set CONVEX_ADMIN_KEY or CONVEX_DEPLOYMENT_ADMIN_KEY)");
    })();

  const adminEmail = resolveEnv(["CONVEX_ADMIN_EMAIL"]) ?? "administracion@ipupy.org.py";
  const sourceFile = resolveEnv(["PROFILE_SOURCE_FILE"]) ?? "convex-data/profiles.json";

  console.log("🚀 Starting Convex Auth profile migration");
  console.log(`   Convex URL:     ${convexUrl}`);
  console.log(`   Admin identity: ${adminEmail}`);
  console.log(`   Source file:    ${sourceFile}`);
  console.log(`   Mode:           ${dryRun ? "DRY RUN" : "EXECUTE"}`);

  const stats = await migrateProfiles({
    dryRun,
    convexUrl,
    adminKey,
    adminEmail,
    sourceFile,
  });

  printSummary(stats, dryRun);
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
