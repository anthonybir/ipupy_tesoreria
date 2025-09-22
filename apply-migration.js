const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });
const { execute } = require('./lib/db');

async function applyMigration() {
  try {
    // List of migrations to apply in order
    const migrations = [
      '013_donor_registry_enhancement.sql',
      '014_fix_national_fund_allocation.sql',
      '015_recalculate_fund_balances.sql'
    ];

    for (const migrationFile of migrations) {
      console.log(`\nApplying migration ${migrationFile}...`);

      const migrationPath = path.join(__dirname, 'migrations', migrationFile);

      // Check if file exists
      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️ Migration ${migrationFile} not found, skipping...`);
        continue;
      }

      const migration = fs.readFileSync(migrationPath, 'utf8');

      // Execute the entire migration as one statement (needed for functions with $$)
      console.log('Executing migration...');
      await execute(migration);

      console.log(`✅ Migration ${migrationFile} applied successfully!`);
    }

    console.log('\n✅ All migrations applied successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();