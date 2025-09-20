/**
 * Verify Database vs Excel "Saldo Actual" Comparison
 * Compare our calculated 2024 balances with Excel data
 */

require('dotenv').config({ path: '.env.local' });
const { execute } = require('./lib/db');

// Excel "Saldo Actual" values from screenshot
const excelSaldoActual = {
  APY: 9432000,
  Caballeros: 3612219,
  Damas: 15643690,
  General: -20731119,
  IBA: 924293,
  'Lazos de Amor': -7011455,
  'Mision Posible': 861952,
  Misiones: 12181240,
  'Niños': 3927753
};

async function compareWithExcel() {
  console.log('📊 Comparing Database Balances vs Excel "Saldo Actual"');
  console.log('='.repeat(70));

  try {
    const dbQuery = await execute(`
      SELECT
        fc.name AS fund_name,
        SUM(CASE WHEN fm.tipo_movimiento = 'entrada' THEN fm.monto ELSE 0 END) AS total_ingresos,
        SUM(CASE WHEN fm.tipo_movimiento = 'salida' THEN fm.monto ELSE 0 END) AS total_egresos
      FROM fund_movements fm
      JOIN fund_categories fc ON fm.fund_category_id = fc.id
      WHERE DATE_PART('year', fm.fecha_movimiento) = $1
      GROUP BY fc.name
      ORDER BY fc.name
    `, [2024]);

    console.log('Fund Name          | Database Balance | Excel Saldo    | Difference');
    console.log('-'.repeat(70));

    let totalDbBalance = 0;
    let totalExcelBalance = 0;
    let totalDifference = 0;

    dbQuery.rows.forEach((row) => {
      const dbBalance = Number(row.total_ingresos) - Number(row.total_egresos);
      const excelBalance = excelSaldoActual[row.fund_name] || 0;
      const difference = dbBalance - excelBalance;

      totalDbBalance += dbBalance;
      totalExcelBalance += excelBalance;
      totalDifference += difference;

      const status = Math.abs(difference) < 1000 ? '✅' : '⚠️';

      console.log(
        `${row.fund_name.padEnd(18)} | ₲${dbBalance.toLocaleString('es-PY').padStart(12)} | ₲${excelBalance.toLocaleString('es-PY').padStart(12)} | ₲${difference.toLocaleString('es-PY').padStart(10)} ${status}`
      );
    });

    console.log('-'.repeat(70));
    console.log(
      `${'TOTALS'.padEnd(18)} | ₲${totalDbBalance.toLocaleString('es-PY').padStart(12)} | ₲${totalExcelBalance
        .toLocaleString('es-PY')
        .padStart(12)} | ₲${totalDifference.toLocaleString('es-PY').padStart(10)}`
    );

    console.log('\n📈 Analysis:');
    if (Math.abs(totalDifference) < 1000) {
      console.log('✅ Totals match within rounding tolerance');
    } else {
      console.log('⚠️  Significant difference detected');
    }

    console.log('\n🔍 Validation:');
    const dbFunds = new Set(dbQuery.rows.map((row) => row.fund_name));
    const excelFunds = new Set(Object.keys(excelSaldoActual));

    const missingInDb = [...excelFunds].filter((fund) => !dbFunds.has(fund));
    const missingInExcel = [...dbFunds].filter((fund) => !excelFunds.has(fund));

    if (missingInDb.length > 0) {
      console.log('❌ Funds in Excel but not in Database:', missingInDb);
    }
    if (missingInExcel.length > 0) {
      console.log('📝 Funds in Database but not in Excel:', missingInExcel);
    }

    if (missingInDb.length === 0 && missingInExcel.length === 0) {
      console.log('✅ All funds present in both datasets');
    }
  } catch (error) {
    console.error('❌ Error comparing balances:', error);
    process.exit(1);
  }
}

compareWithExcel()
  .then(() => {
    console.log('\n✨ Comparison completed');
  })
  .catch((error) => {
    console.error('Unexpected failure:', error);
    process.exit(1);
  });
