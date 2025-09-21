require('dotenv').config({ path: '.env.local' });
const { execute } = require('../lib/db');

async function checkBalances() {
  try {
    console.log('Checking problematic balances...');

    const result = await execute(`
      SELECT id, church_id, account_name, current_balance, opening_balance
      FROM church_accounts
      WHERE current_balance < -1000000 OR current_balance > 100000000
         OR opening_balance < -1000000 OR opening_balance > 100000000
      ORDER BY current_balance DESC;
    `);

    console.log('Accounts violating balance constraints:');
    console.table(result.rows);

    const stats = await execute(`
      SELECT
        MIN(current_balance) as min_balance,
        MAX(current_balance) as max_balance,
        AVG(current_balance) as avg_balance,
        COUNT(*) as total_accounts
      FROM church_accounts;
    `);

    console.log('\nBalance statistics:');
    console.table(stats.rows);

    // Check if table exists
    const tableCheck = await execute(`
      SELECT COUNT(*) as count FROM church_accounts;
    `);

    console.log(`\nTotal church accounts: ${tableCheck.rows[0].count}`);

  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

checkBalances();