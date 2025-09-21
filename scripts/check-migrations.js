require('dotenv').config({ path: '.env.local' });
const { execute } = require('../lib/db');

async function checkMigrations() {
  try {
    console.log('Checking migration history...');

    const result = await execute(`
      SELECT migration_file, applied_at, execution_time_ms
      FROM migration_history
      ORDER BY migration_file;
    `);

    console.log('\n=== ALL APPLIED MIGRATIONS ===');
    console.table(result.rows);

    // Check specifically for our recent migrations
    const recent = result.rows.filter(row =>
      row.migration_file.includes('008') ||
      row.migration_file.includes('009') ||
      row.migration_file.includes('010') ||
      row.migration_file.includes('011') ||
      row.migration_file.includes('012')
    );

    console.log('\n=== RECENT MIGRATIONS (008-012) STATUS ===');
    if (recent.length > 0) {
      console.table(recent);
    } else {
      console.log('❌ No recent migrations (008-012) found');
    }

    // Count total migrations
    console.log(`\n📊 Total applied migrations: ${result.rows.length}`);

    // Check what files exist vs what's applied
    console.log('\n=== AVAILABLE MIGRATION FILES ===');
    const fs = require('fs');
    const path = require('path');
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log('Available files:', files.length);
    files.forEach(file => {
      const applied = result.rows.find(row => row.migration_file === file);
      console.log(`${applied ? '✅' : '❌'} ${file}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

checkMigrations();