require('dotenv').config({ path: '.env.local' });
const { execute } = require('./lib/db');

async function debug() {
  const sql = `
    SELECT
      fm.fund_category_id,
      fc.name AS fund_name,
      SUM(CASE WHEN fm.tipo_movimiento = 'entrada' THEN fm.monto ELSE 0 END) AS total_ingresos,
      SUM(CASE WHEN fm.tipo_movimiento = 'salida' THEN fm.monto ELSE 0 END) AS total_egresos,
      COUNT(*) AS total_movimientos
    FROM fund_movements fm
    JOIN fund_categories fc ON fm.fund_category_id = fc.id
    WHERE DATE_PART('year', fm.fecha_movimiento) = $1
    GROUP BY fm.fund_category_id, fc.name
    ORDER BY fc.name
  `;

  console.log('Testing SQL query with year 2024:');
  const result = await execute(sql, [2024]);
  console.log(result.rows);

  const sql2 = `
    SELECT
      fm.fund_category_id,
      fc.name AS fund_name,
      SUM(CASE WHEN fm.tipo_movimiento = 'entrada' THEN fm.monto ELSE 0 END) AS total_ingresos,
      SUM(CASE WHEN fm.tipo_movimiento = 'salida' THEN fm.monto ELSE 0 END) AS total_egresos,
      COUNT(*) AS total_movimientos
    FROM fund_movements fm
    JOIN fund_categories fc ON fm.fund_category_id = fc.id
    WHERE TO_CHAR(fm.fecha_movimiento, 'YYYY') = $1
    GROUP BY fm.fund_category_id, fc.name
    ORDER BY fc.name
  `;

  console.log('\nTesting SQL query with year as string:');
  const result2 = await execute(sql2, ['2024']);
  console.log(result2.rows);
}

debug().catch((error) => {
  console.error('Debug query failed:', error);
  process.exit(1);
});
