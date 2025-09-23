#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  console.log('🚀 Starting Supabase Auth Migration...\n');

  // Use the PostgreSQL connection directly
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error('❌ Missing DATABASE_URL in environment variables');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check current state
    console.log('🔍 Checking current database state...');

    const profilesCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'profiles'
      ) as exists
    `);

    if (profilesCheck.rows[0].exists) {
      console.log('⚠️  Profiles table already exists');

      // Check if we need to drop and recreate
      const profileCount = await client.query('SELECT COUNT(*) as count FROM public.profiles');
      console.log(`   Found ${profileCount.rows[0].count} existing profiles`);

      // Drop the table to start fresh
      console.log('   Dropping existing profiles table...');
      await client.query('DROP TABLE IF EXISTS public.profiles CASCADE');
      console.log('   ✅ Dropped existing table\n');
    }

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '016_create_profiles_and_auth_sync.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Read migration file: 016_create_profiles_and_auth_sync.sql\n');

    // Execute the entire migration as a transaction
    await client.query('BEGIN');
    console.log('🔄 Executing migration...\n');

    try {
      // Execute the migration
      await client.query(migrationSQL);

      // Commit the transaction
      await client.query('COMMIT');
      console.log('✅ Migration executed successfully\n');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    // Verify the results
    console.log('🔍 Verifying migration results...\n');

    const verifications = [
      {
        name: 'Profiles table',
        query: `SELECT COUNT(*) as count FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'profiles'`
      },
      {
        name: 'Auth trigger',
        query: `SELECT COUNT(*) as count FROM information_schema.triggers
                WHERE trigger_name = 'on_auth_user_created'`
      },
      {
        name: 'Total profiles',
        query: 'SELECT COUNT(*) as count FROM public.profiles'
      },
      {
        name: 'Admin profiles',
        query: `SELECT COUNT(*) as count FROM public.profiles WHERE role = 'admin'`
      },
      {
        name: 'Legacy users (need activation)',
        query: `SELECT COUNT(*) as count FROM public.profiles WHERE is_authenticated = false`
      }
    ];

    for (const check of verifications) {
      const result = await client.query(check.query);
      const count = result.rows[0].count;
      const symbol = count > 0 ? '✅' : '⚠️';
      console.log(`${symbol} ${check.name}: ${count}`);
    }

    // Show migrated users
    console.log('\n👥 Migrated users:');
    const users = await client.query(`
      SELECT email, role, is_authenticated
      FROM public.profiles
      ORDER BY role, email
    `);

    users.rows.forEach(user => {
      const status = user.is_authenticated ? '✅' : '⏳';
      console.log(`   ${status} ${user.email} (${user.role})`);
    });

    console.log('\n✨ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Start dev server: npm run dev');
    console.log('2. Test login at http://localhost:3000/login');
    console.log('3. Sign in with administracion@ipupy.org.py');
    console.log('4. Verify profile is created/linked automatically');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.detail) {
      console.error('   Details:', error.detail);
    }
    if (error.hint) {
      console.error('   Hint:', error.hint);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the migration
runMigration().catch(console.error);