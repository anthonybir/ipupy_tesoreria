/**
 * Script to Add Initial Fund Balances (Saldo 2023)
 * Based on screenshot data - starting balances for January 1, 2024
 */

require('dotenv').config({ path: '.env.local' });
const { execute } = require('./lib/db');

// Initial balances from screenshot (Saldo 2023)
const initialBalances = [
  { name: 'APY', balance: 5837000, fund_id: 4 },
  { name: 'Caballeros', balance: 9237219, fund_id: 2 },
  { name: 'Damas', balance: 9732017, fund_id: 9 },
  { name: 'General', balance: -13276286, fund_id: 1 }, // Negative balance
  { name: 'IBA', balance: 941293, fund_id: 8 },
  { name: 'Lazos de Amor', balance: 28691119, fund_id: 5 },
  { name: 'Mision Posible', balance: 2190059, fund_id: 6 },
  { name: 'Misiones', balance: 15143046, fund_id: 3 },
  { name: 'Niños', balance: 4958553, fund_id: 7 }
];

async function addInitialBalances() {
  console.log('🚀 Adding national fund initial balances (Saldo Nacional 2023)...');

  try {
    // First, create or get organizational church entry
    let orgChurchId;

    const existingOrg = await execute(
      'SELECT id FROM churches WHERE name = $1 LIMIT 1',
      ['IPU PY - Organización Nacional']
    );

    if (existingOrg.rows.length > 0) {
      orgChurchId = existingOrg.rows[0].id;
      console.log('📋 Using existing organizational church ID:', orgChurchId);
    } else {
      // Create organizational church entry
      const newOrg = await execute(
        `INSERT INTO churches (name, city, pastor, phone, active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        ['IPU PY - Organización Nacional', 'Paraguay', 'Dirección Nacional', '', true]
      );

      orgChurchId = newOrg.rows[0].id;
      console.log('🏛️  Created organizational church with ID:', orgChurchId);
    }

    // Check if initial balances already exist
    const existingCheck = await execute(
      `SELECT COUNT(*) AS count
       FROM fund_movements
       WHERE concepto = $1 AND fecha_movimiento = $2`,
      ['Saldo Nacional Inicial 2024', '2024-01-01']
    );

    if (Number(existingCheck.rows[0].count) > 0) {
      console.log('❌ National initial balances already exist. Skipping insertion.');
      return;
    }

    // Insert initial balances
    for (const fund of initialBalances) {
      const { name, balance, fund_id } = fund;

      // For positive balances, insert as 'entrada'
      // For negative balance (General fund), insert as 'salida' with positive amount
      const tipo_movimiento = balance >= 0 ? 'entrada' : 'salida';
      const monto = Math.abs(balance);

      console.log(`Inserting ${name}: fund_id=${fund_id}, church_id=${orgChurchId}, monto=${monto}, tipo=${tipo_movimiento}`);

      await execute(
        `INSERT INTO fund_movements (
          church_id,
          fund_category_id,
          report_id,
          worship_record_id,
          tipo_movimiento,
          monto,
          concepto,
          fecha_movimiento,
          fund_destino_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [orgChurchId, fund_id, null, null, tipo_movimiento, monto, 'Saldo Nacional Inicial 2024', '2024-01-01', null]
      );

      const signedAmount = tipo_movimiento === 'entrada' ? monto : -monto;
      console.log(`✅ ${name}: ₲${signedAmount.toLocaleString('es-PY')} (${tipo_movimiento})`);
    }

    console.log('\n🎉 Initial balances added successfully!');

    // Verify the additions
    const verification = await execute(
      `SELECT
        fc.name AS fund_name,
        fm.monto,
        fm.tipo_movimiento
      FROM fund_movements fm
      JOIN fund_categories fc ON fm.fund_category_id = fc.id
      WHERE fm.concepto = $1
      ORDER BY fc.name`,
      ['Saldo Nacional Inicial 2024']
    );

    console.log('\n📊 Verification:');
    verification.rows.forEach(row => {
      const rawAmount = Number(row.monto);
      const amount = row.tipo_movimiento === 'entrada' ? rawAmount : -rawAmount;
      console.log(`${row.fund_name}: ₲${amount.toLocaleString('es-PY')}`);
    });

  } catch (error) {
    console.error('❌ Error adding initial balances:', error);
  }
}

// Run the script
addInitialBalances().then(() => {
  console.log('\n✨ Script completed');
}).catch(console.error);