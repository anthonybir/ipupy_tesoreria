require('dotenv').config({ path: '.env.local' });
const { execute } = require('./lib/db');

async function testData() {
  const yearsResult = await execute(`
    SELECT
      DATE_PART('year', fecha_movimiento) AS year,
      COUNT(*) AS count,
      SUM(CASE WHEN tipo_movimiento = 'entrada' THEN monto ELSE 0 END) AS entradas,
      SUM(CASE WHEN tipo_movimiento = 'salida' THEN monto ELSE 0 END) AS salidas
    FROM fund_movements
    GROUP BY DATE_PART('year', fecha_movimiento)
    ORDER BY year
  `);

  console.log('Data by year:');
  console.log(yearsResult.rows);

  const year2024 = await execute(`
    SELECT
      fc.name AS fund_name,
      COUNT(*) AS movements,
      SUM(CASE WHEN fm.tipo_movimiento = 'entrada' THEN fm.monto ELSE 0 END) AS entradas,
      SUM(CASE WHEN fm.tipo_movimiento = 'salida' THEN fm.monto ELSE 0 END) AS salidas
    FROM fund_movements fm
    JOIN fund_categories fc ON fm.fund_category_id = fc.id
    WHERE DATE_PART('year', fm.fecha_movimiento) = $1
    GROUP BY fc.id, fc.name
    ORDER BY fc.name
  `, [2024]);

  console.log('\n2024 Fund Summary:');
  console.log(year2024.rows);

  const sample = await execute(
    `SELECT fecha_movimiento, tipo_movimiento, monto, concepto
     FROM fund_movements
     WHERE DATE_PART('year', fecha_movimiento) = $1
     ORDER BY fecha_movimiento
     LIMIT 5`,
    [2024]
  );

  console.log('\nSample 2024 movements:');
  console.log(sample.rows);
}

testData().catch((error) => {
  console.error('Test DB script failed:', error);
  process.exit(1);
});
