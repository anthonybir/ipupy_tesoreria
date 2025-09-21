require('dotenv').config({ path: '.env.local' });
const { execute } = require('../lib/db');

async function checkEstados() {
  try {
    console.log('Checking problematic estados...');

    // Check if estado column exists
    const columnCheck = await execute(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'reports'
      AND column_name IN ('estado', 'status');
    `);

    console.log('Available status columns:');
    console.table(columnCheck.rows);

    if (columnCheck.rows.some(row => row.column_name === 'estado')) {
      const invalidStates = await execute(`
        SELECT DISTINCT estado, COUNT(*) as count
        FROM reports
        WHERE estado IS NOT NULL
        AND estado NOT IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')
        GROUP BY estado
        ORDER BY count DESC;
      `);

      console.log('\nEstados that violate constraint:');
      console.table(invalidStates.rows);

      const allStates = await execute(`
        SELECT DISTINCT estado, COUNT(*) as count
        FROM reports
        WHERE estado IS NOT NULL
        GROUP BY estado
        ORDER BY count DESC;
      `);

      console.log('\nAll existing estados:');
      console.table(allStates.rows);
    }

    if (columnCheck.rows.some(row => row.column_name === 'status')) {
      const allStatuses = await execute(`
        SELECT DISTINCT status, COUNT(*) as count
        FROM reports
        WHERE status IS NOT NULL
        GROUP BY status
        ORDER BY count DESC;
      `);

      console.log('\nAll existing status values:');
      console.table(allStatuses.rows);
    }

  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

checkEstados();