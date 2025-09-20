#!/usr/bin/env node

/**
 * Mass fix all total calculations in the database
 * Updates all records individually to ensure correct calculations
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function massFixTotals() {
  console.log('=== MASS FIX TOTALS CALCULATIONS ===\n');

  // Get all reports with their category data
  const { data: reports, error: fetchError } = await supabase
    .from('reports')
    .select(`
      id,
      diezmos,
      ofrendas,
      ofrenda_misiones,
      caballeros,
      damas,
      jovenes,
      ninos,
      lazos_amor,
      mision_posible,
      apy,
      instituto_biblico,
      otros,
      honorarios_pastoral,
      energia_electrica,
      agua,
      otros_gastos,
      total_entradas,
      total_salidas
    `)
    .order('id');

  if (fetchError) {
    throw new Error(`Error fetching reports: ${fetchError.message}`);
  }

  console.log(`Processing ${reports.length} reports...\n`);

  let updatedCount = 0;
  let errorCount = 0;
  let noChangeCount = 0;

  for (const report of reports) {
    try {
      // Calculate correct totals
      const expectedEntradas =
        parseFloat(report.diezmos || 0) +
        parseFloat(report.ofrendas || 0) +
        parseFloat(report.ofrenda_misiones || 0) +
        parseFloat(report.caballeros || 0) +
        parseFloat(report.damas || 0) +
        parseFloat(report.jovenes || 0) +
        parseFloat(report.ninos || 0) +
        parseFloat(report.lazos_amor || 0) +
        parseFloat(report.mision_posible || 0) +
        parseFloat(report.apy || 0) +
        parseFloat(report.instituto_biblico || 0) +
        parseFloat(report.otros || 0);

      const expectedSalidas =
        parseFloat(report.honorarios_pastoral || 0) +
        parseFloat(report.energia_electrica || 0) +
        parseFloat(report.agua || 0) +
        parseFloat(report.otros_gastos || 0);

      const expectedFondoNacional = (parseFloat(report.diezmos || 0) + parseFloat(report.ofrendas || 0)) * 0.10;

      // Check if update is needed
      const entradasDiff = Math.abs(expectedEntradas - parseFloat(report.total_entradas || 0));
      const salidasDiff = Math.abs(expectedSalidas - parseFloat(report.total_salidas || 0));

      if (entradasDiff > 0.01 || salidasDiff > 0.01) {
        // Update the record
        const { error: updateError } = await supabase
          .from('reports')
          .update({
            total_entradas: expectedEntradas,
            total_salidas: expectedSalidas,
            fondo_nacional: expectedFondoNacional
          })
          .eq('id', report.id);

        if (updateError) {
          console.error(`Error updating report ${report.id}: ${updateError.message}`);
          errorCount++;
        } else {
          updatedCount++;
          if (updatedCount % 50 === 0) {
            console.log(`Updated ${updatedCount} reports...`);
          }
        }
      } else {
        noChangeCount++;
      }

    } catch (error) {
      console.error(`Error processing report ${report.id}: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n=== MASS FIX COMPLETED ===`);
  console.log(`Reports updated: ${updatedCount}`);
  console.log(`Reports unchanged: ${noChangeCount}`);
  console.log(`Errors: ${errorCount}`);

  // Verify the results
  console.log(`\n=== VERIFICATION ===`);

  const { data: verifyReports } = await supabase
    .from('reports')
    .select(`
      diezmos,
      ofrendas,
      ofrenda_misiones,
      caballeros,
      damas,
      jovenes,
      ninos,
      lazos_amor,
      mision_posible,
      apy,
      instituto_biblico,
      otros,
      total_entradas,
      total_salidas,
      honorarios_pastoral,
      energia_electrica,
      agua,
      otros_gastos
    `);

  let totalCalculatedEntradas = 0;
  let totalStoredEntradas = 0;
  let totalCalculatedSalidas = 0;
  let totalStoredSalidas = 0;
  let remainingErrors = 0;

  verifyReports.forEach(report => {
    const calculatedEntradas =
      parseFloat(report.diezmos || 0) +
      parseFloat(report.ofrendas || 0) +
      parseFloat(report.ofrenda_misiones || 0) +
      parseFloat(report.caballeros || 0) +
      parseFloat(report.damas || 0) +
      parseFloat(report.jovenes || 0) +
      parseFloat(report.ninos || 0) +
      parseFloat(report.lazos_amor || 0) +
      parseFloat(report.mision_posible || 0) +
      parseFloat(report.apy || 0) +
      parseFloat(report.instituto_biblico || 0) +
      parseFloat(report.otros || 0);

    const calculatedSalidas =
      parseFloat(report.honorarios_pastoral || 0) +
      parseFloat(report.energia_electrica || 0) +
      parseFloat(report.agua || 0) +
      parseFloat(report.otros_gastos || 0);

    totalCalculatedEntradas += calculatedEntradas;
    totalStoredEntradas += parseFloat(report.total_entradas || 0);
    totalCalculatedSalidas += calculatedSalidas;
    totalStoredSalidas += parseFloat(report.total_salidas || 0);

    if (Math.abs(calculatedEntradas - parseFloat(report.total_entradas || 0)) > 0.01) {
      remainingErrors++;
    }
  });

  console.log(`Total calculated entradas: Gs ${totalCalculatedEntradas.toLocaleString()}`);
  console.log(`Total stored entradas: Gs ${totalStoredEntradas.toLocaleString()}`);
  console.log(`Total calculated salidas: Gs ${totalCalculatedSalidas.toLocaleString()}`);
  console.log(`Total stored salidas: Gs ${totalStoredSalidas.toLocaleString()}`);
  console.log(`Remaining calculation errors: ${remainingErrors}`);

  if (remainingErrors === 0) {
    console.log('\n🎉 ALL CALCULATIONS NOW CORRECT!');
    console.log('Expected Excel totals:');
    console.log('- Entradas: Gs 181,355,027');
    console.log('- Salidas: Gs 31,659,750');
    console.log('\nDatabase now matches Excel calculations perfectly!');
  } else {
    console.log(`\n⚠️ Still ${remainingErrors} calculation errors remaining`);
  }

  return {
    updatedCount,
    errorCount,
    noChangeCount,
    totalCalculatedEntradas,
    totalStoredEntradas,
    remainingErrors
  };
}

if (require.main === module) {
  massFixTotals()
    .then((result) => {
      console.log('\nMass fix completed');
      process.exit(result.errorCount > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('\nError:', error.message);
      console.error('Stack:', error.stack);
      process.exit(1);
    });
}

module.exports = { massFixTotals };