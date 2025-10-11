#!/usr/bin/env tsx

import { config } from "dotenv";
config({ path: ".env.local" });

import { ConvexHttpClient } from "convex/browser";
import { internal, api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { Pool } from "pg";

type AccountingEntryRow = {
  id: number;
  church_id: number;
  date: string;
  account_code: string;
  account_name: string;
  debit: number | string | null;
  credit: number | string | null;
  balance: number | string | null;
  reference: string | null;
  description: string;
  expense_record_id: number | null;
  report_id: number | null;
  created_by: string | null;
  created_at: string | null;
};

type MigrationStats = {
  total: number;
  migrated: number;
  missingChurch: number;
  missingExpense: number;
  missingReport: number;
  skipped: number;
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

function toOptionalNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const convexUrl = requireEnv("CONVEX_URL");
  const adminKey = requireEnv("CONVEX_ADMIN_KEY");

  const client = new ConvexHttpClient(convexUrl);
  (client as unknown as { setAdminAuth: (token: string, identity?: unknown) => void }).setAdminAuth(
    adminKey,
    {
      tokenIdentifier: "accounting-entry-migration",
      subject: "accounting-entry-migration",
      name: "Accounting Entry Migration Script",
      email: ADMIN_EMAIL,
    }
  );

  await ensureAdminProfile(client);

  console.log(dryRun ? "Running accounting entry migration in DRY-RUN mode" : "Migrating accounting entries...");

  const pool = createDirectPool();
  const tableCheck = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'accounting_entries') AS exists"
  );

  if (!tableCheck.rows[0]?.exists) {
    await pool.end();
    console.log("⚠️  Supabase table 'accounting_entries' not found. Nothing to migrate.");
    return;
  }

  const { rows } = await pool.query<AccountingEntryRow>(
    `SELECT id, church_id, date, account_code, account_name, debit, credit,
            balance, reference, description, expense_record_id, report_id,
            created_by, created_at
       FROM public.accounting_entries
       ORDER BY id ASC`
  );
  await pool.end();

  console.log(`Found ${rows.length} entries in Supabase`);

  const churches = await client.query(api.churches.list, {});
  const churchMap = new Map<number, Id<"churches">>();
  for (const church of churches) {
    if (typeof church.supabase_id === "number") {
      churchMap.set(church.supabase_id, church._id);
    }
  }

  const expenses = await client.query(api.expenseRecords.listExpenses, {});
  const expenseMap = new Map<number, Id<"expense_records">>();
  for (const expense of expenses) {
    if (typeof expense.id === "number") {
      expenseMap.set(expense.id, expense.convex_id);
    }
  }

  const reports = await client.query(api.reports.list, {});
  const reportMap = new Map<number, Id<"reports">>();
  for (const report of reports) {
    if (typeof report.supabase_id === "number") {
      reportMap.set(report.supabase_id, report._id);
    }
  }

  const stats: MigrationStats = {
    total: rows.length,
    migrated: 0,
    missingChurch: 0,
    missingExpense: 0,
    missingReport: 0,
    skipped: 0,
    errors: 0,
  };

  for (const row of rows) {
    const churchConvexId = churchMap.get(row.church_id);
    if (!churchConvexId) {
      console.error(`❌ Missing Convex church for entry ${row.id} (church_id=${row.church_id})`);
      stats.missingChurch += 1;
      continue;
    }

    const expenseConvexId = row.expense_record_id ? expenseMap.get(row.expense_record_id) : undefined;
    if (row.expense_record_id && !expenseConvexId) {
      stats.missingExpense += 1;
    }

    const reportConvexId = row.report_id ? reportMap.get(row.report_id) : undefined;
    if (row.report_id && !reportConvexId) {
      stats.missingReport += 1;
    }

    const balance = toOptionalNumber(row.balance);
    const reference = row.reference;
    const createdBy = row.created_by;

    const payload = {
      church_id: churchConvexId,
      date: toTimestamp(row.date),
      account_code: row.account_code,
      account_name: row.account_name,
      debit: toNumber(row.debit),
      credit: toNumber(row.credit),
      ...(balance !== undefined ? { balance } : {}),
      ...(reference ? { reference } : {}),
      description: row.description,
      ...(expenseConvexId ? { expense_record_id: expenseConvexId } : {}),
      ...(reportConvexId ? { report_id: reportConvexId } : {}),
      ...(createdBy ? { created_by: createdBy } : {}),
      created_at: toTimestamp(row.created_at),
      supabase_id: row.id,
    };

    if (dryRun) {
      console.log(`DRY-RUN: would migrate accounting entry ${row.id}`);
      stats.skipped += 1;
      continue;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.mutation(internal.accountingEntries.createEntryFromMigration as any, payload);
      stats.migrated += 1;
      if (stats.migrated % 200 === 0) {
        console.log(`...migrated ${stats.migrated} entries so far`);
      }
    } catch (error) {
      stats.errors += 1;
      console.error(`❌ Failed to migrate entry ${row.id}:`, error);
    }
  }

  console.log("\n📊 Accounting Entry Migration Summary");
  console.log("--------------------------------------");
  console.log(`Total rows:         ${stats.total}`);
  console.log(`Migrated:           ${stats.migrated}`);
  console.log(`Dry-run skips:      ${stats.skipped}`);
  console.log(`Missing churches:   ${stats.missingChurch}`);
  console.log(`Missing expenses:   ${stats.missingExpense}`);
  console.log(`Missing reports:    ${stats.missingReport}`);
  console.log(`Errors:             ${stats.errors}`);

  if (!dryRun && stats.errors === 0 && stats.missingChurch === 0) {
    console.log("\n✅ Accounting entries migrated successfully!");
  } else if (dryRun) {
    console.log("\n✅ Dry-run complete. Re-run without --dry-run to apply changes.");
  } else {
    console.log("\n⚠️  Migration completed with warnings. Review logs above.");
  }
}

main().catch((error) => {
  console.error("Accounting entry migration failed:", error);
  process.exitCode = 1;
});

