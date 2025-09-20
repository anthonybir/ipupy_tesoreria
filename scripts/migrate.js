/**
 * Migration script for IPUPY Tesorería
 * Executes ordered SQL files against Supabase Postgres
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createConnection, execute } = require('../src/lib/db');

let pool;

function getPool() {
  if (!pool) {
    pool = createConnection();
  }
  return pool;
}

async function createMigrationTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS migration_history (
      id SERIAL PRIMARY KEY,
      migration_file TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW(),
      checksum TEXT,
      execution_time_ms INTEGER
    );
  `);

  console.log('✅ Migration history table ready');
}

function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({
      filename: file,
      content: fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    }));
}

function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function getAppliedMigrations() {
  try {
    const result = await execute('SELECT migration_file, checksum FROM migration_history ORDER BY migration_file');
    return new Map(result.rows.map((row) => [row.migration_file, row.checksum]));
  } catch (error) {
    // Table may not exist on first run
    return new Map();
  }
}

async function runMigration(migration) {
  console.log(`⏳ Running migration: ${migration.filename}`);
  const startTime = Date.now();

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(migration.content);
    await client.query('COMMIT');

    const executionTime = Date.now() - startTime;
    const checksum = calculateChecksum(migration.content);

    await execute(
      `INSERT INTO migration_history (migration_file, checksum, execution_time_ms)
       VALUES ($1, $2, $3)
       ON CONFLICT (migration_file)
       DO UPDATE SET checksum = EXCLUDED.checksum,
                     execution_time_ms = EXCLUDED.execution_time_ms,
                     applied_at = NOW()`,
      [migration.filename, checksum, executionTime]
    );

    console.log(`✅ Migration completed: ${migration.filename} (${executionTime}ms)`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Migration failed: ${migration.filename}`);
    console.error(error);
    throw error;
  } finally {
    client.release();
  }
}

async function runMigrations() {
  console.log('🚀 Starting database migrations...');

  try {
    await createMigrationTable();

    const migrations = getMigrationFiles();
    console.log(`📋 Found ${migrations.length} migration files`);

    const appliedMigrations = await getAppliedMigrations();
    let migrationsRun = 0;

    for (const migration of migrations) {
      const currentChecksum = calculateChecksum(migration.content);
      const appliedChecksum = appliedMigrations.get(migration.filename);

      if (!appliedChecksum) {
        await runMigration(migration);
        migrationsRun++;
      } else if (appliedChecksum !== currentChecksum) {
        console.warn(`⚠️  Migration ${migration.filename} has been modified`);
        console.warn('Applied checksum:', appliedChecksum);
        console.warn('Current checksum:', currentChecksum);

        if (process.env.FORCE_MIGRATION === 'true') {
          console.warn('🔄 FORCE_MIGRATION enabled, re-running migration...');
          await runMigration(migration);
          migrationsRun++;
        } else {
          throw new Error(`Migration ${migration.filename} differs from applied version. Use FORCE_MIGRATION=true to override.`);
        }
      } else {
        console.log(`⏭️  Skipping already applied migration: ${migration.filename}`);
      }
    }

    if (migrationsRun === 0) {
      console.log('✅ Database is up to date - no migrations needed');
    } else {
      console.log(`✅ Successfully applied ${migrationsRun} migrations`);
    }

    const result = await execute('SELECT COUNT(*) AS count FROM churches');
    console.log(`📊 Database ready - ${result.rows[0].count} churches configured`);
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('🎉 Migration process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runMigrations
};
