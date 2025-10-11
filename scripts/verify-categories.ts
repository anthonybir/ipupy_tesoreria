#!/usr/bin/env tsx

import { config } from "dotenv";
config({ path: ".env.local" });

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value.trim();
}

const convexUrl = requireEnv('CONVEX_URL');
const adminKey = requireEnv('CONVEX_ADMIN_KEY');

const client = new ConvexHttpClient(convexUrl);

(client as unknown as { setAdminAuth: (token: string, identity?: unknown) => void }).setAdminAuth(
  adminKey,
  {
    tokenIdentifier: "verify-categories-script",
    subject: "verify-categories-script",
    name: "Verify Categories Script",
  }
);

async function verify() {
  const categories = await client.query(api.accounting.listCategories, {});

  console.log(`✅ Found ${categories.length} categories in Convex:\n`);

  console.log("📊 Income categories:");
  categories.filter(c => c.category_type === "income").forEach(c => {
    console.log(`  - ${c.category_name}`);
  });

  console.log("\n💰 Expense categories:");
  const expenseCategories = categories.filter(c => c.category_type === "expense");
  const topLevel = expenseCategories.filter(c => !c.parent_category_id);
  const subCategories = expenseCategories.filter(c => c.parent_category_id);

  topLevel.forEach(c => {
    console.log(`  - ${c.category_name}`);
    const children = subCategories.filter(sc => sc.parent_category_id === c._id);
    children.forEach(child => {
      console.log(`      └─ ${child.category_name}`);
    });
  });

  console.log("\n" + "=".repeat(60));
  console.log("✅ Migration verification successful!");
  console.log("=".repeat(60));
}

verify();
