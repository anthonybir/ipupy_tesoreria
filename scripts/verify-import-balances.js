require('dotenv').config({ path: '.env.local' });

const db = require('../lib/db-supabase');

// Expected starting balances as of 2024-01-01
const EXPECTED_STARTING_BALANCES = {
  'APY': 5837000,
  'Caballeros': 9237219,
  'Damas': 9732017,
  'General': -13276286,
  'IBA': 941293,
  'Lazos de Amor': 28691119,
  'Mision Posible': 2190059,
  'Misiones': 15143046,
  'Niños': 4958553
};

/**
 * Calculate running balance for each fund from transactions
 */
async function calculateRunningBalances() {
  console.log('📊 Calculating running balances from transactions...');

  const query = `
    SELECT
      f.name as fund_name,
      SUM(t.amount_in - t.amount_out) as calculated_balance,
      COUNT(*) as transaction_count,
      MIN(t.date) as first_transaction,
      MAX(t.date) as last_transaction
    FROM transactions t
    JOIN funds f ON t.fund_id = f.id
    WHERE t.created_by = 'legacy-import'
    GROUP BY f.id, f.name
    ORDER BY f.name
  `;

  const result = await db.execute(query);
  return result.rows;
}

/**
 * Get current fund balances from funds table
 */
async function getCurrentFundBalances() {
  console.log('📊 Getting current fund balances...');

  const query = `
    SELECT name, current_balance
    FROM funds
    WHERE is_active = true
    ORDER BY name
  `;

  const result = await db.execute(query);
  return result.rows;
}

/**
 * Get import statistics
 */
async function getImportStatistics() {
  console.log('📊 Getting import statistics...');

  const queries = {
    totalTransactions: `
      SELECT COUNT(*) as count
      FROM transactions
      WHERE created_by = 'legacy-import'
    `,
    totalAmount: `
      SELECT
        SUM(amount_in) as total_in,
        SUM(amount_out) as total_out,
        SUM(amount_in - amount_out) as net_amount
      FROM transactions
      WHERE created_by = 'legacy-import'
    `,
    dateRange: `
      SELECT
        MIN(date) as first_date,
        MAX(date) as last_date
      FROM transactions
      WHERE created_by = 'legacy-import'
    `,
    byFund: `
      SELECT
        f.name,
        COUNT(*) as transaction_count,
        SUM(t.amount_in) as total_in,
        SUM(t.amount_out) as total_out,
        SUM(t.amount_in - t.amount_out) as net_amount
      FROM transactions t
      JOIN funds f ON t.fund_id = f.id
      WHERE t.created_by = 'legacy-import'
      GROUP BY f.id, f.name
      ORDER BY f.name
    `,
    withChurches: `
      SELECT
        COUNT(*) as count
      FROM transactions
      WHERE created_by = 'legacy-import'
        AND church_id IS NOT NULL
    `,
    withReports: `
      SELECT
        COUNT(*) as count
      FROM transactions
      WHERE created_by = 'legacy-import'
        AND report_id IS NOT NULL
    `
  };

  const stats = {};
  for (const [key, query] of Object.entries(queries)) {
    const result = await db.execute(query);
    stats[key] = result.rows;
  }

  return stats;
}

/**
 * Verify balance consistency
 */
function verifyBalances(calculated, current) {
  console.log('\n🔍 Balance Verification:');
  console.log('=' * 80);

  let allMatch = true;
  const tolerance = 0.01; // Allow for minor rounding differences

  for (const calc of calculated) {
    const fundName = calc.fund_name;
    const calculatedBalance = parseFloat(calc.calculated_balance);

    const currentFund = current.find(f => f.name === fundName);
    const currentBalance = currentFund ? parseFloat(currentFund.current_balance) : 0;

    const expected = EXPECTED_STARTING_BALANCES[fundName] || 0;
    const difference = Math.abs(calculatedBalance - currentBalance);
    const matches = difference <= tolerance;

    if (!matches) {allMatch = false;}

    console.log(`\n${fundName}:`);
    console.log(`  Expected (starting):  ${expected.toLocaleString()} Gs`);
    console.log(`  Calculated:          ${calculatedBalance.toLocaleString()} Gs`);
    console.log(`  Current in DB:       ${currentBalance.toLocaleString()} Gs`);
    console.log(`  Difference:          ${(calculatedBalance - currentBalance).toLocaleString()} Gs`);
    console.log(`  Status:              ${matches ? '✅ MATCH' : '❌ MISMATCH'}`);
    console.log(`  Transactions:        ${calc.transaction_count}`);
  }

  return allMatch;
}

/**
 * Show detailed statistics
 */
function showStatistics(stats) {
  console.log('\n📊 Import Statistics:');
  console.log('=' * 80);

  // Overall stats
  const total = stats.totalTransactions[0];
  const amounts = stats.totalAmount[0];
  const dates = stats.dateRange[0];

  console.log(`\nOverall:`);
  console.log(`  Total transactions:   ${parseInt(total.count).toLocaleString()}`);
  console.log(`  Total amount in:      ${parseFloat(amounts.total_in || 0).toLocaleString()} Gs`);
  console.log(`  Total amount out:     ${parseFloat(amounts.total_out || 0).toLocaleString()} Gs`);
  console.log(`  Net amount:           ${parseFloat(amounts.net_amount || 0).toLocaleString()} Gs`);
  console.log(`  Date range:           ${dates.first_date} to ${dates.last_date}`);

  // Church and report linkage
  const withChurches = stats.withChurches[0];
  const withReports = stats.withReports[0];

  console.log(`\nLinkage:`);
  console.log(`  With church ID:       ${parseInt(withChurches.count).toLocaleString()}`);
  console.log(`  With report ID:       ${parseInt(withReports.count).toLocaleString()}`);

  // By fund
  console.log(`\nBy Fund:`);
  for (const fund of stats.byFund) {
    console.log(`  ${fund.name}:`);
    console.log(`    Transactions:       ${parseInt(fund.transaction_count).toLocaleString()}`);
    console.log(`    Amount in:          ${parseFloat(fund.total_in || 0).toLocaleString()} Gs`);
    console.log(`    Amount out:         ${parseFloat(fund.total_out || 0).toLocaleString()} Gs`);
    console.log(`    Net amount:         ${parseFloat(fund.net_amount || 0).toLocaleString()} Gs`);
  }
}

/**
 * Check for potential issues
 */
async function checkForIssues() {
  console.log('\n🔍 Checking for potential issues...');

  const issues = [];

  // Check for duplicate transactions
  const duplicateCheck = await db.execute(`
    SELECT
      date, fund_id, concept, amount_in, amount_out, COUNT(*) as count
    FROM transactions
    WHERE created_by = 'legacy-import'
    GROUP BY date, fund_id, concept, amount_in, amount_out
    HAVING COUNT(*) > 1
    LIMIT 10
  `);

  if (duplicateCheck.rows.length > 0) {
    issues.push(`Found ${duplicateCheck.rows.length} potential duplicate transaction groups`);
  }

  // Check for zero-amount transactions
  const zeroAmountCheck = await db.execute(`
    SELECT COUNT(*) as count
    FROM transactions
    WHERE created_by = 'legacy-import'
      AND amount_in = 0 AND amount_out = 0
  `);

  if (parseInt(zeroAmountCheck.rows[0].count) > 0) {
    issues.push(`Found ${zeroAmountCheck.rows[0].count} zero-amount transactions`);
  }

  // Check for transactions with both in and out amounts
  const bothAmountsCheck = await db.execute(`
    SELECT COUNT(*) as count
    FROM transactions
    WHERE created_by = 'legacy-import'
      AND amount_in > 0 AND amount_out > 0
  `);

  if (parseInt(bothAmountsCheck.rows[0].count) > 0) {
    issues.push(`Found ${bothAmountsCheck.rows[0].count} transactions with both in and out amounts`);
  }

  // Check for very large amounts (potential data errors)
  const largeAmountCheck = await db.execute(`
    SELECT COUNT(*) as count
    FROM transactions
    WHERE created_by = 'legacy-import'
      AND (amount_in > 100000000 OR amount_out > 100000000)
  `);

  if (parseInt(largeAmountCheck.rows[0].count) > 0) {
    issues.push(`Found ${largeAmountCheck.rows[0].count} transactions with very large amounts (>100M Gs)`);
  }

  if (issues.length === 0) {
    console.log('✅ No issues found');
  } else {
    console.log('⚠️  Issues found:');
    issues.forEach(issue => console.log(`  - ${issue}`));
  }

  return issues;
}

/**
 * Main verification function
 */
async function main() {
  try {
    console.log('🔍 Legacy Transaction Import Verification');
    console.log('=' * 80);

    // Check if any transactions were imported
    const countResult = await db.execute(`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE created_by = 'legacy-import'
    `);

    const importedCount = parseInt(countResult.rows[0].count);

    if (importedCount === 0) {
      console.log('❌ No imported transactions found');
      console.log('Make sure to run the import script first:');
      console.log('  node scripts/import-legacy-transactions.js --commit --from 2024-01-01');
      return;
    }

    console.log(`✅ Found ${importedCount.toLocaleString()} imported transactions`);

    // Get balances
    const [calculated, current] = await Promise.all([
      calculateRunningBalances(),
      getCurrentFundBalances()
    ]);

    // Verify balances
    const balancesMatch = verifyBalances(calculated, current);

    // Get and show statistics
    const stats = await getImportStatistics();
    showStatistics(stats);

    // Check for issues
    const issues = await checkForIssues();

    // Final summary
    console.log('\n📋 Summary:');
    console.log('=' * 80);
    console.log(`Imported transactions: ${importedCount.toLocaleString()}`);
    console.log(`Balance verification:  ${balancesMatch ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Issues found:          ${issues.length}`);

    if (balancesMatch && issues.length === 0) {
      console.log('\n🎉 Import verification PASSED! All balances match and no issues found.');
    } else {
      console.log('\n⚠️  Import verification found issues. Please review the output above.');
    }

  } catch (error) {
    console.error('💥 Verification error:', error.message);
    process.exit(1);
  }
}

main();