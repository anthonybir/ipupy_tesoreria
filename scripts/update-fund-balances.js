require('dotenv').config({ path: '.env.local' });

const db = require('../lib/db-supabase');

/**
 * Update fund balances based on imported transactions
 */
async function updateFundBalances() {
  console.log('🔄 Updating fund balances from imported transactions...');

  try {
    // Get calculated balances from transactions
    const query = `
      SELECT
        f.id,
        f.name,
        f.current_balance as old_balance,
        COALESCE(SUM(t.amount_in - t.amount_out), 0) as calculated_balance
      FROM funds f
      LEFT JOIN transactions t ON t.fund_id = f.id
        AND t.created_by = 'legacy-import'
      WHERE f.is_active = true
      GROUP BY f.id, f.name, f.current_balance
      ORDER BY f.name
    `;

    const result = await db.execute(query);

    console.log('\n📊 Fund Balance Updates:');
    console.log('=' * 60);

    for (const fund of result.rows) {
      const oldBalance = parseFloat(fund.old_balance);
      const newBalance = parseFloat(fund.calculated_balance);

      console.log(`\n${fund.name}:`);
      console.log(`  Old balance: ${oldBalance.toLocaleString()} Gs`);
      console.log(`  New balance: ${newBalance.toLocaleString()} Gs`);
      console.log(`  Change:      ${(newBalance - oldBalance).toLocaleString()} Gs`);

      // Update the fund balance
      await db.execute(`
        UPDATE funds
        SET current_balance = $1, updated_at = NOW()
        WHERE id = $2
      `, [newBalance, fund.id]);

      console.log(`  ✅ Updated`);
    }

    console.log('\n🎉 All fund balances updated successfully!');

  } catch (error) {
    console.error('💥 Error updating fund balances:', error.message);
    throw error;
  }
}

/**
 * Verify the updated balances
 */
async function verifyBalances() {
  console.log('\n🔍 Verifying updated balances...');

  const query = `
    SELECT
      f.name,
      f.current_balance,
      COALESCE(SUM(t.amount_in - t.amount_out), 0) as transaction_total,
      COUNT(t.id) as transaction_count
    FROM funds f
    LEFT JOIN transactions t ON t.fund_id = f.id
      AND t.created_by = 'legacy-import'
    WHERE f.is_active = true
    GROUP BY f.id, f.name, f.current_balance
    ORDER BY f.name
  `;

  const result = await db.execute(query);

  console.log('\n📊 Balance Verification:');
  console.log('=' * 60);

  let allMatch = true;

  for (const fund of result.rows) {
    const currentBalance = parseFloat(fund.current_balance);
    const transactionTotal = parseFloat(fund.transaction_total);
    const difference = Math.abs(currentBalance - transactionTotal);
    const matches = difference < 0.01; // Allow for minor rounding

    if (!matches) {allMatch = false;}

    console.log(`\n${fund.name}:`);
    console.log(`  Fund balance:      ${currentBalance.toLocaleString()} Gs`);
    console.log(`  Transaction total: ${transactionTotal.toLocaleString()} Gs`);
    console.log(`  Difference:        ${difference.toLocaleString()} Gs`);
    console.log(`  Transactions:      ${fund.transaction_count}`);
    console.log(`  Status:            ${matches ? '✅ MATCH' : '❌ MISMATCH'}`);
  }

  console.log(`\n📋 Overall Status: ${allMatch ? '✅ ALL BALANCES MATCH' : '❌ SOME MISMATCHES FOUND'}`);

  return allMatch;
}

/**
 * Main execution
 */
async function main() {
  try {
    await updateFundBalances();
    await verifyBalances();

    console.log('\n✅ Fund balance update completed successfully!');

  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

main();