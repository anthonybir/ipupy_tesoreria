#!/usr/bin/env node

/**
 * Script to apply migration 034 - Fix pastor views schema
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Missing DATABASE_URL in .env.local');
  process.exit(1);
}

async function applyMigration() {
  console.log('🔧 Applying migration 034: Fix pastor views schema\n');

  const migrationPath = path.join(__dirname, '..', 'migrations', '034_fix_pastor_views_schema.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const client = new pg.Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    await client.query(sql);
    console.log('✅ Migration 034 applied successfully!');
    console.log('\nFixed views:');
    console.log('  - church_primary_pastors');
    console.log('  - pastor_user_access');
    console.log('\n✨ Database views now match API route expectations');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error('Details:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
