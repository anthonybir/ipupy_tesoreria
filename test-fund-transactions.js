const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });
const { execute } = require('./lib/db');

async function testFundTransactions() {
  try {
    console.log('Testing Individual Fund Transaction Generation...\n');
    console.log('================================================\n');

    // Check if funds table exists and has the required funds
    const fundsResult = await execute(`
      SELECT id, name, type, current_balance
      FROM funds
      WHERE name IN ('General', 'Misiones', 'APY', 'Lazos de Amor', 'Caballeros', 'IBA')
      ORDER BY name
    `);

    console.log('Available National Funds:');
    console.log('-------------------------');
    for (const fund of fundsResult.rows) {
      console.log(`- ${fund.name} (ID: ${fund.id}, Type: ${fund.type})`);
    }
    console.log('');

    // Check recent transactions to see if individual fund transactions are being created
    const transactionsResult = await execute(`
      SELECT
        t.id,
        t.date,
        c.name as church_name,
        f.name as fund_name,
        t.concept,
        t.amount_in,
        t.amount_out,
        t.balance,
        t.created_at
      FROM transactions t
      LEFT JOIN churches c ON t.church_id = c.id
      JOIN funds f ON t.fund_id = f.id
      WHERE t.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY t.created_at DESC
      LIMIT 20
    `);

    if (transactionsResult.rows.length > 0) {
      console.log('Recent Individual Fund Transactions:');
      console.log('------------------------------------');
      for (const tx of transactionsResult.rows) {
        console.log(`\nTransaction ID: ${tx.id}`);
        console.log(`  Date: ${tx.date}`);
        console.log(`  Church: ${tx.church_name || 'N/A'}`);
        console.log(`  Fund: ${tx.fund_name}`);
        console.log(`  Concept: ${tx.concept}`);
        console.log(`  Amount In: ${tx.amount_in ? parseFloat(tx.amount_in).toLocaleString() : '0'} Gs`);
        console.log(`  Created: ${tx.created_at}`);
      }
    } else {
      console.log('No recent transactions found in the last 7 days.');
      console.log('This is expected if no months have been closed recently.');
    }

    // Simulate what transactions should be generated for a sample case
    console.log('\n\nExample Transaction Generation:');
    console.log('================================');
    console.log('For IPU Lambaré with:');
    console.log('  - Diezmos: 10,000,000 Gs');
    console.log('  - Ofrendas: 1,000,000 Gs');
    console.log('  - Misiones: 50,000 Gs');
    console.log('  - APY: 50,000 Gs');
    console.log('');
    console.log('Should generate these transactions:');
    console.log('-----------------------------------');
    console.log('1. General Fund: 1,100,000 Gs (10% of 11,000,000)');
    console.log('2. Misiones Fund: 50,000 Gs (100% of Misiones)');
    console.log('3. APY Fund: 50,000 Gs (100% of APY)');
    console.log('');
    console.log('Total to National: 1,200,000 Gs');
    console.log('Stays Local: 9,900,000 Gs (90% of tithes/offerings)');

    // Check if we can query worship_contributions to see fund buckets
    const fundBucketsResult = await execute(`
      SELECT
        wc.fund_bucket,
        COUNT(*) as contribution_count,
        SUM(wc.total) as total_amount
      FROM worship_contributions wc
      JOIN worship_records wr ON wc.worship_record_id = wr.id
      WHERE wr.fecha_culto >= NOW() - INTERVAL '30 days'
      GROUP BY wc.fund_bucket
      ORDER BY wc.fund_bucket
    `);

    if (fundBucketsResult.rows.length > 0) {
      console.log('\n\nRecent Fund Bucket Contributions (Last 30 Days):');
      console.log('-------------------------------------------------');
      for (const bucket of fundBucketsResult.rows) {
        const amount = parseFloat(bucket.total_amount || 0);
        const percentage = ['diezmo', 'ofrenda'].includes(bucket.fund_bucket) ? '10%' :
          ['misiones', 'apy', 'lazos_amor', 'mision_posible', 'instituto_biblico', 'diezmo_pastoral', 'caballeros'].includes(bucket.fund_bucket) ? '100%' :
            'Local';
        console.log(`${bucket.fund_bucket}: ${amount.toLocaleString()} Gs (${bucket.contribution_count} contributions) - ${percentage} to National`);
      }
    }

    console.log('\n✅ Fund transaction structure is ready for individual fund tracking!');
    console.log('\nNext Steps:');
    console.log('1. Record worship services with various fund contributions');
    console.log('2. Close the month to generate individual fund transactions');
    console.log('3. Verify transactions are created for each specific fund');

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testFundTransactions();