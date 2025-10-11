#!/usr/bin/env tsx

import { config } from "dotenv";
config({ path: ".env.local" });

import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "../convex/_generated/api";
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
  status?: "open" | "closed" | "reconciled" | string;
};

type AccountingEntryRow = {
  id: number;
  church_id: number;
  debit: number | string | null;
  credit: number | string | null;
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

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function ensureAdminProfile(client: ConvexHttpClient): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await client.mutation(internal.migrations.upsertProfile as any, {
    email: ADMIN_EMAIL,
    role: "admin",
    active: true,
  });
}

async function main() {
  const convexUrl = requireEnv("CONVEX_URL");
  const adminKey = requireEnv("CONVEX_ADMIN_KEY");

  const client = new ConvexHttpClient(convexUrl);
  (client as unknown as { setAdminAuth: (token: string, identity?: unknown) => void }).setAdminAuth(
    adminKey,
    {
      tokenIdentifier: "accounting-migration-validate",
      subject: "accounting-migration-validate",
      name: "Accounting Migration Validation",
      email: ADMIN_EMAIL,
    }
  );

  await ensureAdminProfile(client);

  console.log("🔍 Validating accounting migration...\n");

  const pool = createDirectPool();
  const ledgerExists = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'monthly_ledger') AS exists"
  );
  const entryExists = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'accounting_entries') AS exists"
  );

  let supLedgers: MonthlyLedgerRow[] = [];
  let supEntries: AccountingEntryRow[] = [];

  if (ledgerExists.rows[0]?.exists) {
    const result = await pool.query<MonthlyLedgerRow>(
      `SELECT id, church_id, month, year, opening_balance, closing_balance,
              total_income, total_expenses
         FROM public.monthly_ledger`
    );
    supLedgers = result.rows;
  } else {
    console.log("⚠️  Supabase table 'monthly_ledger' not found; treating as zero ledgers.");
  }

  if (entryExists.rows[0]?.exists) {
    const result = await pool.query<AccountingEntryRow>(
      `SELECT id, church_id, debit, credit
         FROM public.accounting_entries`
    );
    supEntries = result.rows;
  } else {
    console.log("⚠️  Supabase table 'accounting_entries' not found; treating as zero entries.");
  }

  await pool.end();

  const [convexLedgers, convexEntries] = await Promise.all([
    client.query(api.monthlyLedgers.listLedgers, {}),
    client.query(api.accountingEntries.listEntries, {}),
  ]);

  console.log("📊 Record counts:");
  console.log(`  Ledgers  → Supabase: ${supLedgers.length}, Convex: ${convexLedgers.length}`);
  console.log(`  Entries  → Supabase: ${supEntries.length}, Convex: ${convexEntries.length}`);

  const supLedgerTotals = supLedgers.reduce(
    (acc, row) => {
      acc.opening += toNumber(row.opening_balance);
      acc.closing += toNumber(row.closing_balance);
      acc.income += toNumber(row.total_income);
      acc.expenses += toNumber(row.total_expenses);
      return acc;
    },
    { opening: 0, closing: 0, income: 0, expenses: 0 }
  );

  const convexLedgerTotals = convexLedgers.reduce(
    (acc, row) => {
      acc.opening += row.opening_balance;
      acc.closing += row.closing_balance;
      acc.income += row.total_income;
      acc.expenses += row.total_expenses;
      return acc;
    },
    { opening: 0, closing: 0, income: 0, expenses: 0 }
  );

  console.log("\n📈 Ledger aggregates (Supabase vs Convex):");
  console.log(`  Opening balance total → ${supLedgerTotals.opening.toFixed(2)} | ${convexLedgerTotals.opening.toFixed(2)}`);
  console.log(`  Closing balance total → ${supLedgerTotals.closing.toFixed(2)} | ${convexLedgerTotals.closing.toFixed(2)}`);
  console.log(`  Total income          → ${supLedgerTotals.income.toFixed(2)} | ${convexLedgerTotals.income.toFixed(2)}`);
  console.log(`  Total expenses        → ${supLedgerTotals.expenses.toFixed(2)} | ${convexLedgerTotals.expenses.toFixed(2)}`);

  const supDebitTotal = supEntries.reduce((sum, row) => sum + toNumber(row.debit), 0);
  const supCreditTotal = supEntries.reduce((sum, row) => sum + toNumber(row.credit), 0);

  const convexDebitTotal = convexEntries.reduce((sum, row) => sum + row.debit, 0);
  const convexCreditTotal = convexEntries.reduce((sum, row) => sum + row.credit, 0);

  console.log("\n💰 Accounting entry aggregates:");
  console.log(`  Total debits  → Supabase: ${supDebitTotal.toFixed(2)}, Convex: ${convexDebitTotal.toFixed(2)}`);
  console.log(`  Total credits → Supabase: ${supCreditTotal.toFixed(2)}, Convex: ${convexCreditTotal.toFixed(2)}`);

  const convexBalanceDiff = Math.abs(convexDebitTotal - convexCreditTotal);
  console.log(`  Convex double-entry difference: ${convexBalanceDiff.toFixed(4)} (should be < 1.00)`);

  const latestSupLedger = supLedgers[supLedgers.length - 1];
  const latestConvexLedger = [...convexLedgers].sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];

  if (latestSupLedger && latestConvexLedger) {
    console.log("\n🔎 Latest ledger comparison:");
    console.log(`  Supabase ID ${latestSupLedger.id} → status ${latestSupLedger.status ?? "n/a"}`);
    console.log(`  Convex ID ${latestConvexLedger.id ?? "n/a"} → status ${latestConvexLedger.status}`);
    console.log(
      `  Closing balance Supabase=${toNumber(latestSupLedger.closing_balance).toFixed(2)} | Convex=${latestConvexLedger.closing_balance.toFixed(2)}`
    );
  }

  const ledgerCountMatch = supLedgers.length === convexLedgers.length;
  const entryCountMatch = supEntries.length === convexEntries.length;
  const debitMatch = Math.abs(supDebitTotal - convexDebitTotal) < 1;
  const creditMatch = Math.abs(supCreditTotal - convexCreditTotal) < 1;

  const passed = ledgerCountMatch && entryCountMatch && debitMatch && creditMatch && convexBalanceDiff < 1;

  console.log("\n==============================");
  if (passed) {
    console.log("✅ Validation PASSED: Convex data matches Supabase aggregates.");
  } else {
    console.log("❌ Validation FAILED: Differences detected. Review the metrics above.");
  }
  console.log("==============================");
}

main().catch((error) => {
  console.error("Validation failed:", error);
  process.exitCode = 1;
});

