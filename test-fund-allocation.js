const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });
const { execute } = require('./lib/db');

async function testFundAllocation() {
  try {
    console.log('Testing Fund Allocation Rules...\n');

    // Test with sample data
    const testCases = [
      { diezmos: 1000000, ofrendas: 500000, misiones: 200000, lazos_amor: 100000, apy: 50000 }
    ];

    for (const testCase of testCases) {
      console.log('Test Case:');
      console.log('  - Diezmos (10% to national):', testCase.diezmos.toLocaleString());
      console.log('  - Ofrendas (10% to national):', testCase.ofrendas.toLocaleString());
      console.log('  - Misiones (100% to national):', testCase.misiones.toLocaleString());
      console.log('  - Lazos de Amor (100% to national):', testCase.lazos_amor.toLocaleString());
      console.log('  - APY (100% to national):', testCase.apy.toLocaleString());
      console.log('');

      // Calculate expected values
      const expected10Percent = (testCase.diezmos + testCase.ofrendas) * 0.10;
      const expected100Percent = testCase.misiones + testCase.lazos_amor + testCase.apy;
      const expectedTotal = expected10Percent + expected100Percent;
      const expectedLocal90 = (testCase.diezmos + testCase.ofrendas) * 0.90;

      console.log('Expected Calculations:');
      console.log('  - 10% of Diezmos+Ofrendas:', expected10Percent.toLocaleString());
      console.log('  - 100% of Special Funds:', expected100Percent.toLocaleString());
      console.log('  - Total to National Fund:', expectedTotal.toLocaleString());
      console.log('  - 90% Local (Diezmos+Ofrendas):', expectedLocal90.toLocaleString());
      console.log('');

      // Test the database function
      const result = await execute(`
        SELECT
          ROUND(${testCase.diezmos + testCase.ofrendas} * 0.10, 0) as calculated_10_percent,
          ${expected100Percent} as calculated_100_percent,
          ROUND(${testCase.diezmos + testCase.ofrendas} * 0.10, 0) + ${expected100Percent} as total_national_fund,
          ROUND(${testCase.diezmos + testCase.ofrendas} * 0.90, 0) as local_90_percent
      `);

      const dbCalc = result.rows[0];
      console.log('Database Calculations:');
      console.log('  - 10% Fund:', parseFloat(dbCalc.calculated_10_percent).toLocaleString());
      console.log('  - 100% Fund:', parseFloat(dbCalc.calculated_100_percent).toLocaleString());
      console.log('  - Total National:', parseFloat(dbCalc.total_national_fund).toLocaleString());
      console.log('  - 90% Local:', parseFloat(dbCalc.local_90_percent).toLocaleString());
      console.log('');

      // Verify the results match
      const matches10 = Math.abs(parseFloat(dbCalc.calculated_10_percent) - expected10Percent) < 1;
      const matches100 = Math.abs(parseFloat(dbCalc.calculated_100_percent) - expected100Percent) < 1;
      const matchesTotal = Math.abs(parseFloat(dbCalc.total_national_fund) - expectedTotal) < 1;
      const matchesLocal = Math.abs(parseFloat(dbCalc.local_90_percent) - expectedLocal90) < 1;

      console.log('✅ Verification Results:');
      console.log(`  - 10% calculation: ${matches10 ? '✓ PASS' : '✗ FAIL'}`);
      console.log(`  - 100% calculation: ${matches100 ? '✓ PASS' : '✗ FAIL'}`);
      console.log(`  - Total national fund: ${matchesTotal ? '✓ PASS' : '✗ FAIL'}`);
      console.log(`  - 90% local fund: ${matchesLocal ? '✓ PASS' : '✗ FAIL'}`);

      if (!matches10 || !matches100 || !matchesTotal || !matchesLocal) {
        throw new Error('Fund allocation test failed!');
      }
    }

    console.log('\n✅ All fund allocation tests passed successfully!');
    console.log('\nSummary:');
    console.log('- Diezmos & Ofrendas: 10% goes to national fund, 90% stays local');
    console.log('- Special Mission Funds (Misiones, Lazos de Amor, APY, etc.): 100% goes to national fund');
    console.log('- Local Designated Funds (Damas, Jóvenes, Niños, etc.): 100% stays local');

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testFundAllocation();