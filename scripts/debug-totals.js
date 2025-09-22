#!/usr/bin/env node

/**
 * Debug script to understand why totals aren't calculating correctly
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function debugTotals() {
  console.log('=== DEBUGGING TOTALS CALCULATION ===\n');

  // Check a problematic record in detail
  const { data: sample, error } = await supabase
    .from('reports')
    .select(`
      id,
      church_id,
      month,
      year,
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
    `)
    .eq('id', 2)
    .single();

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('Sample record (ID 2):');
  console.log(JSON.stringify(sample, null, 2));

  // Calculate what the totals should be
  const expectedEntradas =
    parseFloat(sample.diezmos || 0) +
    parseFloat(sample.ofrendas || 0) +
    parseFloat(sample.ofrenda_misiones || 0) +
    parseFloat(sample.caballeros || 0) +
    parseFloat(sample.damas || 0) +
    parseFloat(sample.jovenes || 0) +
    parseFloat(sample.ninos || 0) +
    parseFloat(sample.lazos_amor || 0) +
    parseFloat(sample.mision_posible || 0) +
    parseFloat(sample.apy || 0) +
    parseFloat(sample.instituto_biblico || 0) +
    parseFloat(sample.otros || 0);

  const expectedSalidas =
    parseFloat(sample.honorarios_pastoral || 0) +
    parseFloat(sample.energia_electrica || 0) +
    parseFloat(sample.agua || 0) +
    parseFloat(sample.otros_gastos || 0);

  console.log('\nCalculations:');
  console.log(`Expected entradas: ${expectedEntradas}`);
  console.log(`Stored entradas: ${sample.total_entradas}`);
  console.log(`Difference: ${Math.abs(expectedEntradas - parseFloat(sample.total_entradas))}`);
  console.log(`Expected salidas: ${expectedSalidas}`);
  console.log(`Stored salidas: ${sample.total_salidas}`);

  // Try a direct update to see if it works
  console.log('\nTesting direct update...');
  const { error: updateError } = await supabase
    .from('reports')
    .update({
      total_entradas: expectedEntradas,
      total_salidas: expectedSalidas
    })
    .eq('id', 2);

  if (updateError) {
    console.error('Update error:', updateError.message);
  } else {
    console.log('✅ Direct update successful');

    // Verify the update
    const { data: updated } = await supabase
      .from('reports')
      .select('id, total_entradas, total_salidas')
      .eq('id', 2)
      .single();

    console.log('After update:', updated);
  }

  // Check overall database state
  console.log('\n=== OVERALL DATABASE STATE ===');
  const { data: overall } = await supabase
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
  let calculationErrors = 0;

  overall.forEach(report => {
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
      calculationErrors++;
    }
  });

  console.log(`Total calculated entradas: Gs ${totalCalculatedEntradas.toLocaleString()}`);
  console.log(`Total stored entradas: Gs ${totalStoredEntradas.toLocaleString()}`);
  console.log(`Total calculated salidas: Gs ${totalCalculatedSalidas.toLocaleString()}`);
  console.log(`Total stored salidas: Gs ${totalStoredSalidas.toLocaleString()}`);
  console.log(`Records with calculation errors: ${calculationErrors}`);

  return {
    totalCalculatedEntradas,
    totalStoredEntradas,
    totalCalculatedSalidas,
    totalStoredSalidas,
    calculationErrors
  };
}

if (require.main === module) {
  debugTotals()
    .then(() => {
      console.log('\nDebug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nError:', error.message);
      process.exit(1);
    });
}

module.exports = { debugTotals };