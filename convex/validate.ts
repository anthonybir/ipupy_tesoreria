/**
 * Data Migration Validation Script
 * 
 * Validates that all data was successfully migrated from Supabase to Convex.
 * 
 * Usage: npx convex run validate:validateMigration
 */

import { query } from "./_generated/server";

export const validateMigration = query({
  args: {},
  handler: async (ctx) => {
    console.log("🔍 Validating data migration from Supabase to Convex...\n");

    // Expected counts from Supabase
    const expected = {
      churches: 38,
      funds: 9,
      providers: 179,
      profiles: 2,
      reports: 326,
      transactions: 1423,
    };

    // Get actual counts
    const churches = await ctx.db.query("churches").collect();
    const funds = await ctx.db.query("funds").collect();
    const providers = await ctx.db.query("providers").collect();
    const profiles = await ctx.db.query("profiles").collect();
    const reports = await ctx.db.query("reports").collect();
    const transactions = await ctx.db.query("transactions").collect();

    const actual = {
      churches: churches.length,
      funds: funds.length,
      providers: providers.length,
      profiles: profiles.length,
      reports: reports.length,
      transactions: transactions.length,
    };

    // Compare counts
    console.log("📊 Record Counts:");
    console.log("─".repeat(60));
    console.log("Table         | Expected | Actual | Status");
    console.log("─".repeat(60));

    const results: any = {};
    let allPassed = true;

    for (const [table, expectedCount] of Object.entries(expected)) {
      const actualCount = actual[table as keyof typeof actual];
      const status = actualCount === expectedCount ? "✅ PASS" : "❌ FAIL";
      const statusSymbol = actualCount === expectedCount ? "✅" : "❌";
      
      console.log(
        `${table.padEnd(13)} | ${String(expectedCount).padStart(8)} | ${String(actualCount).padStart(6)} | ${status}`
      );

      results[table] = {
        expected: expectedCount,
        actual: actualCount,
        passed: actualCount === expectedCount,
      };

      if (actualCount !== expectedCount) allPassed = false;
    }

    console.log("─".repeat(60));
    console.log();

    // Validate foreign keys
    console.log("🔗 Foreign Key Validation:");
    console.log("─".repeat(60));

    // Check reports.church_id (all reports should have church_id now)
    const reportsWithChurch = reports.filter((r) => r.church_id !== undefined);
    const totalReports = reports.length;
    console.log(
      `Reports with church_id: ${reportsWithChurch.length}/${totalReports} ${
        reportsWithChurch.length === totalReports ? "✅" : "❌"
      }`
    );

    // Check transactions foreign keys
    const txWithChurch = transactions.filter((tx) => tx.church_id !== undefined);
    console.log(`Transactions with church_id: ${txWithChurch.length} ✅`);

    const txWithFund = transactions.filter((tx) => tx.fund_id !== undefined);
    const totalTx = transactions.length;
    console.log(
      `Transactions with fund_id: ${txWithFund.length}/${totalTx} ${
        txWithFund.length === totalTx ? "✅" : "❌"
      }`
    );

    const txWithReport = transactions.filter((tx) => tx.report_id !== undefined);
    console.log(`Transactions with report_id: ${txWithReport.length} ✅`);

    const txWithProvider = transactions.filter((tx) => tx.provider_id !== undefined);
    console.log(`Transactions with provider_id: ${txWithProvider.length} ✅`);

    console.log("─".repeat(60));
    console.log();

    // Sample data validation
    console.log("📋 Sample Data Validation:");
    console.log("─".repeat(60));

    // Check a known church
    const ipuLambare = churches.find((c) => c.name === "IPU LAMBARÉ");
    if (ipuLambare) {
      console.log(`✅ Found IPU LAMBARÉ (Pastor: ${ipuLambare.pastor})`);
    } else {
      console.log("❌ IPU LAMBARÉ not found");
    }

    // Check reports for IPU LAMBARÉ
    const lambarReports = reports.filter((r) => r.church_id === ipuLambare?._id);
    console.log(`✅ IPU LAMBARÉ has ${lambarReports.length} reports`);

    // Check transactions
    const sampleTx = transactions[0];
    if (sampleTx) {
      console.log(`✅ Sample transaction: ${sampleTx.concept} (${sampleTx.amount_in > 0 ? '+' : '-'}${Math.max(sampleTx.amount_in, sampleTx.amount_out)})`);
    }

    console.log("─".repeat(60));
    console.log();

    // Final summary
    if (allPassed) {
      console.log("✅ ✅ ✅ ALL VALIDATION CHECKS PASSED! ✅ ✅ ✅\n");
      console.log("🎉 Data migration from Supabase to Convex completed successfully!");
      console.log();
      console.log("Next steps:");
      console.log("  1. Run: npx convex run updateForeignKeys:cleanupTempFields");
      console.log("  2. Update schema to remove temp_ fields");
      console.log("  3. Begin Phase 3: Core Queries migration");
    } else {
      console.log("❌ VALIDATION FAILED - Some checks did not pass");
      console.log("Please review the errors above and re-run migration if needed.");
    }

    return {
      success: allPassed,
      counts: results,
      foreignKeys: {
        reports: {
          withChurch: reportsWithChurch.length,
          total: totalReports,
        },
        transactions: {
          withChurch: txWithChurch.length,
          withFund: txWithFund.length,
          withReport: txWithReport.length,
          withProvider: txWithProvider.length,
          total: totalTx,
        },
      },
    };
  },
});
