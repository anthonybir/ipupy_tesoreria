#!/usr/bin/env tsx

/**
 * Simple database connection test
 * Tests if we can connect to Supabase PostgreSQL
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

async function testConnection() {
  const connectionString = process.env['DATABASE_URL'];

  if (!connectionString) {
    console.error("❌ DATABASE_URL not found in .env.local");
    process.exit(1);
  }

  console.log("🔍 Testing connection with:", connectionString.replace(/:[^:@]+@/, ':***@'));

  const pool = new Pool({ connectionString });

  try {
    console.log("📡 Attempting to connect...");
    const result = await pool.query("SELECT current_database(), current_user, version()");
    console.log("✅ Connection successful!");
    console.log("Database:", result.rows[0]?.current_database);
    console.log("User:", result.rows[0]?.current_user);
    console.log("Version:", result.rows[0]?.version?.substring(0, 50) + "...");

    // Test if church_transaction_categories table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'church_transaction_categories'
      ) as exists
    `);
    console.log("Table church_transaction_categories exists:", tableCheck.rows[0]?.exists);

  } catch (error) {
    console.error("❌ Connection failed:", error);
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
    }
  } finally {
    await pool.end();
  }
}

testConnection();
