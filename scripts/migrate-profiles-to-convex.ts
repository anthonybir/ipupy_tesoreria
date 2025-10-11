#!/usr/bin/env tsx

/**
 * Bulk profile migration script (Supabase → Convex).
 *
 * Usage:
 *   npm run migrate:profiles -- --dry-run
 *   npm run migrate:profiles
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { ConvexHttpClient } from "convex/browser";
import { internal } from "../convex/_generated/api";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

export type NormalizedProfile = {
  userId?: string;
  email: string;
  role: "admin" | "fund_director" | "pastor" | "treasurer" | "church_manager" | "secretary";
  active: boolean;
  churchSupabaseId?: number;
  fundSupabaseId?: number;
  fullName?: string;
  createdAt?: number;
  updatedAt?: number;
};

const ALLOWED_ROLES = new Set<NormalizedProfile["role"]>([
  "admin",
  "fund_director",
  "pastor",
  "treasurer",
  "church_manager",
  "secretary",
]);

type RawProfile = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
  church_id?: number | null;
  fund_id?: number | null;
  full_name?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function parseTimestamp(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeProfile(raw: RawProfile): NormalizedProfile | null {
  const email = raw.email?.trim().toLowerCase();
  if (!email || !email.endsWith("@ipupy.org.py")) {
    return null;
  }

  const role = raw.role?.trim().toLowerCase();
  if (!role || !ALLOWED_ROLES.has(role as NormalizedProfile["role"])) {
    return null;
  }

  const fullName = raw.full_name?.trim();
  const createdAt = parseTimestamp(raw.created_at ?? undefined);
  const updatedAt = parseTimestamp(raw.updated_at ?? undefined);

  const normalized: NormalizedProfile = {
    email,
    role: role as NormalizedProfile["role"],
    active: raw.is_active ?? true,
  };

  if (raw.id) {
    normalized.userId = raw.id;
  }
  if (raw.church_id !== null && raw.church_id !== undefined) {
    normalized.churchSupabaseId = raw.church_id;
  }
  if (raw.fund_id !== null && raw.fund_id !== undefined) {
    normalized.fundSupabaseId = raw.fund_id;
  }
  if (fullName && fullName.length > 0) {
    normalized.fullName = fullName;
  }
  if (createdAt !== undefined) {
    normalized.createdAt = createdAt;
  }
  if (updatedAt !== undefined) {
    normalized.updatedAt = updatedAt;
  }

  return normalized;
}

function pickLatestProfile(a: NormalizedProfile | undefined, b: NormalizedProfile): NormalizedProfile {
  if (!a) {
    return b;
  }

  if (a.active && !b.active) {
    return a;
  }
  if (!a.active && b.active) {
    return b;
  }

  const aUpdated = a.updatedAt ?? 0;
  const bUpdated = b.updatedAt ?? 0;
  return bUpdated > aUpdated ? b : a;
}

export async function loadProfiles(sourcePath: string): Promise<Map<string, NormalizedProfile>> {
  const absolute = resolve(sourcePath);
  const content = await readFile(absolute, "utf8");
  const rawProfiles = JSON.parse(content) as RawProfile[];

  const deduped = new Map<string, NormalizedProfile>();

  for (const raw of rawProfiles) {
    const normalized = normalizeProfile(raw);
    if (!normalized) {
      continue;
    }
    const existing = deduped.get(normalized.email);
    deduped.set(normalized.email, pickLatestProfile(existing, normalized));
  }

  return deduped;
}

export function resolveEnv(names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

export type MigrationStats = {
  total: number;
  migrated: number;
  updated: number;
  skipped: number;
  errors: number;
};

function logDryRun(action: string, details: Record<string, unknown>) {
  console.log(`DRY-RUN: ${action}`, JSON.stringify(details, null, 2));
}

async function migrateProfile(
  client: ConvexHttpClient,
  profile: NormalizedProfile,
  options: { dryRun: boolean }
): Promise<"created" | "updated" | "skipped"> {
  const payload = {
    email: profile.email,
    role: profile.role,
    active: profile.active,
  };
  const migrationArgs: {
    email: string;
    role: NormalizedProfile["role"];
    active: boolean;
    full_name?: string;
    church_supabase_id?: number;
    fund_supabase_id?: number;
    created_at?: number;
    updated_at?: number;
  } = { ...payload };

  if (profile.fullName) {
    migrationArgs.full_name = profile.fullName;
  }
  if (profile.churchSupabaseId !== undefined) {
    migrationArgs.church_supabase_id = profile.churchSupabaseId;
  }
  if (profile.fundSupabaseId !== undefined) {
    migrationArgs.fund_supabase_id = profile.fundSupabaseId;
  }
  if (profile.createdAt !== undefined) {
    migrationArgs.created_at = profile.createdAt;
  }
  if (profile.updatedAt !== undefined) {
    migrationArgs.updated_at = profile.updatedAt;
  }

  if (options.dryRun) {
    logDryRun("upsertProfile", migrationArgs);
    return "skipped";
  }

  const upsertRef = internal.migrations.upsertProfile as unknown as Parameters<(typeof client)["mutation"]>[0];
  const result = await client.mutation(
    upsertRef,
    migrationArgs as Parameters<(typeof client)["mutation"]>[1]
  );
  return result.created ? "created" : "updated";
}

export function printSummary(stats: MigrationStats, dryRun: boolean) {
  console.log("\nMigration Summary");
  console.log("-----------------");
  console.log(`Total profiles: ${stats.total}`);
  console.log(`Created:        ${stats.migrated}`);
  console.log(`Updated:        ${stats.updated}`);
  console.log(`Skipped:        ${stats.skipped}`);
  console.log(`Errors:         ${stats.errors}`);

  if (!dryRun && stats.errors === 0) {
    console.log("\n✅ Migration completed without errors.");
  } else if (!dryRun && stats.errors > 0) {
    console.warn("\n⚠️  Migration completed with errors. Review the log above.");
  } else {
    console.log("\nℹ️  Dry-run mode: no data was modified.");
  }
}

export async function migrateProfiles(options: {
  dryRun: boolean;
  convexUrl: string;
  adminKey: string;
  adminEmail: string;
  sourceFile: string;
}): Promise<MigrationStats> {
  const profiles = await loadProfiles(options.sourceFile);
  if (profiles.size === 0) {
    console.warn("No profiles found in export. Nothing to migrate.");
    return {
      total: 0,
      migrated: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };
  }

  const client = new ConvexHttpClient(options.convexUrl);

  (client as unknown as { setAdminAuth: (token: string, identity?: unknown) => void }).setAdminAuth(
    options.adminKey,
    {
      tokenIdentifier: `migration-script:${options.adminEmail}`,
      subject: "profile-migration-script",
      name: "Profile Migration Script",
      email: options.adminEmail,
    }
  );

  const stats: MigrationStats = {
    total: profiles.size,
    migrated: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  for (const profile of profiles.values()) {
    try {
      const action = await migrateProfile(client, profile, { dryRun: options.dryRun });

      if (action === "created") {
        stats.migrated += 1;
      } else if (action === "updated") {
        stats.updated += 1;
      } else {
        stats.skipped += 1;
      }
    } catch (error) {
      stats.errors += 1;
      console.error(`Failed to migrate ${profile.email}:`, error);
    }
  }

  return stats;
}

async function runCli() {
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

  const stats = await migrateProfiles({
    dryRun,
    convexUrl,
    adminKey,
    adminEmail,
    sourceFile,
  });

  printSummary(stats, dryRun);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runCli().catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  });
}
