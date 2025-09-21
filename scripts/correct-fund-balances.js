require('dotenv').config({ path: '.env.local' });

const db = require('../lib/db-supabase');

// Correct final balances from your 19-month summary
const CORRECT_BALANCES = {
  'APY': 9432000,
  'Caballeros': 3612219,
  'Damas': 15643690,
  'General': -20731119,
  'IBA': 924293,
  'Lazos de Amor': -7011456,
  'Mision Posible': 861952,
  'Misiones': 12181240,
  'Niños': 3927753
};

/**
 * Update fund balances to match the correct 19-month totals
 */
async function correctFundBalances() {
  console.log('🔧 Correcting fund balances to match 19-month totals...');

  try {
    for (const [fundName, correctBalance] of Object.entries(CORRECT_BALANCES)) {
      console.log(`\n${fundName}:`);

      // Get current balance
      const currentResult = await db.execute(`
        SELECT current_balance FROM funds WHERE name = $1
      `, [fundName]);

      if (currentResult.rows.length === 0) {
        console.log(`  ❌ Fund not found: ${fundName}`);
        continue;
      }

      const currentBalance = parseFloat(currentResult.rows[0].current_balance);
      const difference = correctBalance - currentBalance;

      console.log(`  Current:    ${currentBalance.toLocaleString()} Gs`);
      console.log(`  Correct:    ${correctBalance.toLocaleString()} Gs`);
      console.log(`  Adjustment: ${difference.toLocaleString()} Gs`);

      // Update the balance
      await db.execute(`
        UPDATE funds
        SET current_balance = $1, updated_at = NOW()
        WHERE name = $2
      `, [correctBalance, fundName]);

      console.log(`  ✅ Updated`);
    }

    console.log('\n🎉 All fund balances corrected successfully!');

  } catch (error) {
    console.error('💥 Error correcting fund balances:', error.message);
    throw error;
  }
}

/**
 * Verify the corrected balances
 */
async function verifyCorrection() {
  console.log('\n🔍 Verifying corrected balances...');

  const result = await db.execute(`
    SELECT name, current_balance
    FROM funds
    WHERE is_active = true
    ORDER BY name
  `);

  console.log('\n📊 Corrected Fund Balances:');
  console.log('=' * 50);

  let totalBalance = 0;

  for (const fund of result.rows) {
    const balance = parseFloat(fund.current_balance);
    const expected = CORRECT_BALANCES[fund.name];
    const matches = Math.abs(balance - expected) < 0.01;

    console.log(`${fund.name}: ${balance.toLocaleString()} Gs ${matches ? '✅' : '❌'}`);
    totalBalance += balance;
  }

  console.log(`\nTotal Balance: ${totalBalance.toLocaleString()} Gs`);
  console.log('Expected Total: 18,840,572 Gs');

  return Math.abs(totalBalance - 18840572) < 0.01;
}

/**
 * Main execution
 */
async function main() {
  try {
    await correctFundBalances();
    const verified = await verifyCorrection();

    if (verified) {
      console.log('\n✅ Fund balances successfully corrected and verified!');
    } else {
      console.log('\n⚠️  Total balance doesn\'t match expected sum. Please review.');
    }

  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

main();