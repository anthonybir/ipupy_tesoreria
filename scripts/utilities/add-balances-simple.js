/**
 * Simple Script to Add National Initial Balances
 * Direct SQL approach since parameterized queries had issues
 */

require('dotenv').config({ path: '.env.local' });
const { execute } = require('./lib/db');

async function addAllBalances() {
  console.log('🚀 Adding all national fund initial balances...');

  try {
    // Clean up any test entries first
    await execute('DELETE FROM fund_movements WHERE concepto = $1', ['Saldo Nacional Inicial 2024']);

    // Insert all balances with direct SQL
    const insertSQL = `
      INSERT INTO fund_movements (church_id, fund_category_id, tipo_movimiento, monto, concepto, fecha_movimiento)
      VALUES
        (23, 4, 'entrada', 5837000, 'Saldo Nacional Inicial 2024', '2024-01-01'),   -- APY
        (23, 2, 'entrada', 9237219, 'Saldo Nacional Inicial 2024', '2024-01-01'),   -- Caballeros
        (23, 9, 'entrada', 9732017, 'Saldo Nacional Inicial 2024', '2024-01-01'),   -- Damas
        (23, 1, 'salida', 13276286, 'Saldo Nacional Inicial 2024', '2024-01-01'),   -- General (negative)
        (23, 8, 'entrada', 941293, 'Saldo Nacional Inicial 2024', '2024-01-01'),    -- IBA
        (23, 5, 'entrada', 28691119, 'Saldo Nacional Inicial 2024', '2024-01-01'),  -- Lazos de Amor
        (23, 6, 'entrada', 2190059, 'Saldo Nacional Inicial 2024', '2024-01-01'),   -- Misión Posible
        (23, 3, 'entrada', 15143046, 'Saldo Nacional Inicial 2024', '2024-01-01'),  -- Misiones
        (23, 7, 'entrada', 4958553, 'Saldo Nacional Inicial 2024', '2024-01-01')    -- Niños
    `;

    await execute(insertSQL);
    console.log('✅ All 9 initial balances inserted successfully!');

    // Verify the insertions
    const verification = await execute(
      `SELECT
        fc.name AS fund_name,
        fm.monto,
        fm.tipo_movimiento,
        CASE WHEN fm.tipo_movimiento = 'entrada' THEN fm.monto ELSE -fm.monto END AS balance
      FROM fund_movements fm
      JOIN fund_categories fc ON fm.fund_category_id = fc.id
      WHERE fm.concepto = $1
      ORDER BY fc.name`,
      ['Saldo Nacional Inicial 2024']
    );

    console.log('\n📊 Verification - Initial Balances:');
    let total = 0;
    verification.rows.forEach(row => {
      const balance = Number(row.balance);
      console.log(`${row.fund_name.padEnd(20)}: ₲${balance.toLocaleString('es-PY').padStart(12)}`);
      total += balance;
    });
    console.log(`${''.padEnd(20)}: ₲${total.toLocaleString('es-PY').padStart(12)} (Total)`);

    console.log('\n🎉 National fund initial balances added successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

addAllBalances().then(() => {
  console.log('\n✨ Script completed');
}).catch(console.error);