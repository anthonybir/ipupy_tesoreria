#!/usr/bin/env node
/**
 * Health Check Script for IPUPY Tesorería
 * Verifies system health and readiness for production (Supabase Postgres)
 */

const { validateEnvironment } = require('./validate-env');
const { execute } = require('../src/lib/db');

const healthStatus = {
  status: 'healthy',
  checks: {},
  timestamp: new Date().toISOString(),
  version: process.env.npm_package_version || 'unknown'
};

async function checkDatabase() {
  try {
    console.log('🔍 Checking database connectivity...');
    const start = Date.now();
    const result = await execute('SELECT version()');

    healthStatus.checks.database = {
      status: 'healthy',
      message: 'Database connection successful',
      responseTimeMs: Date.now() - start,
      version: result.rows[0].version
    };
    console.log('✅ Database connection: OK');
    return true;
  } catch (error) {
    healthStatus.checks.database = {
      status: 'unhealthy',
      message: `Database connection failed: ${error.message}`,
      error: error.message
    };
    console.error('❌ Database connection: FAILED');
    console.error('   Error:', error.message);
    return false;
  }
}

async function checkMigrations() {
  try {
    console.log('🔍 Checking migration status...');

    const tableExists = await execute(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'migration_history'
       ) AS exists`
    );

    if (!tableExists.rows[0].exists) {
      healthStatus.checks.migrations = {
        status: 'warning',
        message: 'Migration history not found. Run: npm run migrate'
      };
      console.log('⚠️  Migrations: NOT INITIALIZED');
      return false;
    }

    const migrations = await execute('SELECT COUNT(*) AS count FROM migration_history');
    const migrationCount = Number(migrations.rows[0].count);

    healthStatus.checks.migrations = {
      status: 'healthy',
      message: `${migrationCount} migrations recorded`,
      migrationCount
    };
    console.log(`✅ Migrations: ${migrationCount} applied`);
    return true;
  } catch (error) {
    healthStatus.checks.migrations = {
      status: 'unhealthy',
      message: `Migration check failed: ${error.message}`,
      error: error.message
    };
    console.error('❌ Migration check: FAILED');
    console.error('   Error:', error.message);
    return false;
  }
}

async function checkTables() {
  try {
    console.log('🔍 Checking essential tables...');

    const requiredTables = ['churches', 'reports', 'users', 'fund_categories'];
    const missingTables = [];

    for (const table of requiredTables) {
      const existsResult = await execute(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public'
             AND table_name = $1
         ) AS exists`,
        [table]
      );

      if (!existsResult.rows[0].exists) {
        missingTables.push(table);
      }
    }

    if (missingTables.length === 0) {
      healthStatus.checks.tables = {
        status: 'healthy',
        message: 'All essential tables exist'
      };
      console.log('✅ Essential tables: OK');
      return true;
    } else {
      healthStatus.checks.tables = {
        status: 'unhealthy',
        message: `Missing tables: ${missingTables.join(', ')}`,
        missingTables
      };
      console.error('❌ Essential tables: MISSING');
      console.error('   Missing:', missingTables.join(', '));
      return false;
    }
  } catch (error) {
    healthStatus.checks.tables = {
      status: 'unhealthy',
      message: `Table check failed: ${error.message}`,
      error: error.message
    };
    console.error('❌ Table check: FAILED');
    console.error('   Error:', error.message);
    return false;
  }
}

async function checkAdminUser() {
  try {
    console.log('🔍 Checking admin user...');

    const result = await execute(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE role = 'admin'
    `);

    const adminCount = Number(result.rows[0].count);

    if (adminCount > 0) {
      healthStatus.checks.admin = {
        status: 'healthy',
        message: `${adminCount} admin user(s) configured`
      };
      console.log('✅ Admin user: CONFIGURED');
      return true;
    } else {
      healthStatus.checks.admin = {
        status: 'warning',
        message: 'No admin users found. Run: npm run setup:admin'
      };
      console.log('⚠️  Admin user: NOT CONFIGURED');
      return false;
    }
  } catch (error) {
    healthStatus.checks.admin = {
      status: 'warning',
      message: `Admin check failed: ${error.message}`,
      error: error.message
    };
    console.log('⚠️  Admin user: CHECK FAILED');
    console.log('   Error:', error.message);
    return false;
  }
}

async function runHealthCheck() {
  console.log('\n🏥 IPUPY Tesorería Health Check\n');
  console.log('=====================================\n');

  let allHealthy = true;

  console.log('🔍 Validating environment...');
  const envResult = validateEnvironment();
  if (!envResult.valid) {
    healthStatus.checks.environment = {
      status: 'unhealthy',
      message: 'Environment variables missing',
      missing: envResult.missing
    };
    allHealthy = false;
  } else {
    healthStatus.checks.environment = {
      status: envResult.warnings.length > 0 ? 'warning' : 'healthy',
      message: envResult.warnings.length > 0 ? envResult.warnings.join('; ') : 'Environment variables OK'
    };
  }

  const dbHealthy = await checkDatabase();
  if (!dbHealthy) allHealthy = false;

  const migrationsHealthy = await checkMigrations();
  if (!migrationsHealthy) allHealthy = false;

  const tablesHealthy = await checkTables();
  if (!tablesHealthy) allHealthy = false;

  const adminHealthy = await checkAdminUser();
  if (!adminHealthy) allHealthy = false;

  healthStatus.status = allHealthy ? 'healthy' : 'attention_required';

  console.log('\n=====================================');
  console.log(`Overall status: ${healthStatus.status.toUpperCase()}`);
  console.log('=====================================\n');

  if (process.env.JSON_OUTPUT === 'true') {
    console.log(JSON.stringify(healthStatus, null, 2));
  }

  if (!allHealthy) {
    process.exit(1);
  }
}

runHealthCheck().catch((error) => {
  console.error('\n❌ Health check failed unexpectedly:', error);
  process.exit(1);
});
