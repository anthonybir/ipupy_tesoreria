#!/usr/bin/env node

/**
 * Script to apply migration 034 - Fix pastor views schema
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🔧 Applying migration 034: Fix pastor views schema\n');

  const migrationPath = path.join(__dirname, '..', 'migrations', '034_fix_pastor_views_schema.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  try {
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('execute_sql', { query: sql });

    if (error) {
      console.error('❌ Migration failed:', error.message);
      console.error('Details:', error);
      process.exit(1);
    }

    console.log('✅ Migration 034 applied successfully!');
    console.log('\nFixed views:');
    console.log('  - church_primary_pastors');
    console.log('  - pastor_user_access');
    console.log('\n✨ Database views now match API route expectations');
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  }
}

applyMigration();
