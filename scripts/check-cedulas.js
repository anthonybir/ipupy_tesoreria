require('dotenv').config({ path: '.env.local' });
const { execute } = require('../lib/db');

async function checkCedulas() {
  try {
    console.log('Checking problematic cédulas...');

    // Check if pastor_cedula column exists
    const columnCheck = await execute(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'churches'
      AND column_name IN ('pastor_cedula', 'pastor_ruc');
    `);

    console.log('Available columns:');
    console.table(columnCheck.rows);

    if (columnCheck.rows.some(row => row.column_name === 'pastor_cedula')) {
      const result = await execute(`
        SELECT id, name, pastor, pastor_cedula
        FROM churches
        WHERE pastor_cedula IS NOT NULL
        AND NOT (
          pastor_cedula ~ '^[0-9]{1,2}\\.?[0-9]{3}\\.?[0-9]{3}$' OR
          pastor_cedula ~ '^[0-9]{6,8}$'
        )
        ORDER BY id;
      `);

      console.log('\nCédulas that violate format:');
      console.table(result.rows);

      const allCedulas = await execute(`
        SELECT id, name, pastor, pastor_cedula
        FROM churches
        WHERE pastor_cedula IS NOT NULL
        ORDER BY id;
      `);

      console.log('\nAll existing cédulas:');
      console.table(allCedulas.rows);
    } else {
      console.log('pastor_cedula column does not exist');
    }

  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

checkCedulas();