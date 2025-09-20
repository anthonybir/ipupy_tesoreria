#!/usr/bin/env node

/**
 * Comprehensive validation script for Excel import
 * Compares Excel totals with database totals and identifies discrepancies
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Configurar SUPABASE_URL y SUPABASE_SERVICE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false
  }
});

// Expected totals from Excel processing
const EXPECTED_TOTALS = {
  totalEntradas: 181355027,
  totalSalidas: 31659750,
  balance: 149695277,
  validRows: 1241,
  invalidRows: 263,
  totalReports: 326
};

async function validateImport() {
  console.log('=== VALIDACION COMPREHENSIVA DE IMPORTACION EXCEL ===\n');

  const validation = {
    totalChecks: 0,
    passedChecks: 0,
    failedChecks: 0,
    warnings: [],
    errors: []
  };

  // 1. Verificar conteos básicos
  console.log('1. VERIFICACION DE CONTEOS BASICOS');
  console.log('='.repeat(50));

  validation.totalChecks++;
  const { count: reportCount, error: countError } = await supabase
    .from('reports')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.log(`❌ Error contando informes: ${countError.message}`);
    validation.failedChecks++;
    validation.errors.push(`Error contando informes: ${countError.message}`);
  } else if (reportCount === EXPECTED_TOTALS.totalReports) {
    console.log(`✅ Total informes: ${reportCount} (esperado: ${EXPECTED_TOTALS.totalReports})`);
    validation.passedChecks++;
  } else {
    console.log(`❌ Total informes: ${reportCount} (esperado: ${EXPECTED_TOTALS.totalReports})`);
    validation.failedChecks++;
    validation.errors.push(`Discrepancia en total de informes: ${reportCount} vs ${EXPECTED_TOTALS.totalReports}`);
  }

  // 2. Verificar iglesias activas
  validation.totalChecks++;
  const { data: churchData, error: churchError } = await supabase
    .from('reports')
    .select('church_id');

  if (churchError) {
    console.log(`❌ Error obteniendo iglesias: ${churchError.message}`);
    validation.failedChecks++;
  } else {
    const uniqueChurches = new Set(churchData.map(r => r.church_id)).size;
    console.log(`✅ Iglesias con informes: ${uniqueChurches}`);
    validation.passedChecks++;
  }

  // 3. Verificar totales financieros
  console.log('\n2. VERIFICACION DE TOTALES FINANCIEROS');
  console.log('='.repeat(50));

  const { data: financialTotals } = await supabase
    .from('reports')
    .select(`
      total_entradas,
      total_salidas,
      fondo_nacional,
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
      otros_gastos
    `);

  let dbTotalEntradas = 0;
  let dbTotalSalidas = 0;
  let calculatedEntradas = 0;
  let calculatedSalidas = 0;

  financialTotals.forEach(report => {
    dbTotalEntradas += parseFloat(report.total_entradas || 0);
    dbTotalSalidas += parseFloat(report.total_salidas || 0);

    // Recalcular entradas
    calculatedEntradas += parseFloat(report.diezmos || 0) +
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

    // Recalcular salidas
    calculatedSalidas += parseFloat(report.honorarios_pastoral || 0) +
                        parseFloat(report.energia_electrica || 0) +
                        parseFloat(report.agua || 0) +
                        parseFloat(report.otros_gastos || 0);
  });

  console.log(`DB Total Entradas: Gs ${dbTotalEntradas.toLocaleString()}`);
  console.log(`DB Total Salidas: Gs ${dbTotalSalidas.toLocaleString()}`);
  console.log(`Balance DB: Gs ${(dbTotalEntradas - dbTotalSalidas).toLocaleString()}`);
  console.log('');
  console.log(`Excel Total Entradas: Gs ${EXPECTED_TOTALS.totalEntradas.toLocaleString()}`);
  console.log(`Excel Total Salidas: Gs ${EXPECTED_TOTALS.totalSalidas.toLocaleString()}`);
  console.log(`Balance Excel: Gs ${EXPECTED_TOTALS.balance.toLocaleString()}`);
  console.log('');

  // Verificar discrepancias
  const entradaDiff = Math.abs(dbTotalEntradas - EXPECTED_TOTALS.totalEntradas);
  const salidaDiff = Math.abs(dbTotalSalidas - EXPECTED_TOTALS.totalSalidas);

  validation.totalChecks += 2;

  if (entradaDiff < 1000) {
    console.log(`✅ Entradas coinciden (diferencia: Gs ${entradaDiff.toLocaleString()})`);
    validation.passedChecks++;
  } else {
    console.log(`❌ Discrepancia en entradas: Gs ${entradaDiff.toLocaleString()}`);
    validation.failedChecks++;
    validation.errors.push(`Discrepancia significativa en entradas: Gs ${entradaDiff.toLocaleString()}`);
  }

  if (salidaDiff < 1000) {
    console.log(`✅ Salidas coinciden (diferencia: Gs ${salidaDiff.toLocaleString()})`);
    validation.passedChecks++;
  } else {
    console.log(`❌ Discrepancia en salidas: Gs ${salidaDiff.toLocaleString()}`);
    validation.failedChecks++;
    validation.errors.push(`Discrepancia significativa en salidas: Gs ${salidaDiff.toLocaleString()}`);
  }

  // 4. Verificar integridad de cálculos
  console.log('\n3. VERIFICACION DE INTEGRIDAD DE CALCULOS');
  console.log('='.repeat(50));

  let calculationErrors = 0;
  financialTotals.forEach((report, index) => {
    const expectedEntradas = parseFloat(report.diezmos || 0) +
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

    const actualEntradas = parseFloat(report.total_entradas || 0);

    if (Math.abs(expectedEntradas - actualEntradas) > 0.01) {
      calculationErrors++;
      if (calculationErrors <= 5) { // Solo mostrar los primeros 5
        console.log(`⚠️ Informe ${index + 1}: total_entradas = ${actualEntradas}, calculado = ${expectedEntradas}`);
      }
    }
  });

  validation.totalChecks++;
  if (calculationErrors === 0) {
    console.log(`✅ Todos los cálculos de entradas son correctos`);
    validation.passedChecks++;
  } else {
    console.log(`❌ ${calculationErrors} informes con errores de cálculo`);
    validation.failedChecks++;
    validation.errors.push(`${calculationErrors} informes tienen errores en total_entradas`);
  }

  // 5. Análisis por iglesia
  console.log('\n4. ANALISIS POR IGLESIA');
  console.log('='.repeat(50));

  const { data: churchAnalysis } = await supabase
    .from('churches')
    .select(`
      id,
      name,
      active,
      reports!inner(
        total_entradas,
        total_salidas
      )
    `);

  console.log(`Iglesias activas con informes: ${churchAnalysis.filter(c => c.active && c.reports.length > 0).length}`);
  console.log(`Iglesias inactivas con informes: ${churchAnalysis.filter(c => !c.active && c.reports.length > 0).length}`);

  // Top 5 iglesias por ingresos
  const topChurches = churchAnalysis
    .map(church => ({
      name: church.name,
      active: church.active,
      reportCount: church.reports.length,
      totalIncome: church.reports.reduce((sum, r) => sum + parseFloat(r.total_entradas || 0), 0)
    }))
    .filter(c => c.totalIncome > 0)
    .sort((a, b) => b.totalIncome - a.totalIncome)
    .slice(0, 5);

  console.log('\nTop 5 iglesias por ingresos:');
  topChurches.forEach((church, index) => {
    console.log(`  ${index + 1}. ${church.name}: Gs ${church.totalIncome.toLocaleString()} (${church.reportCount} informes)`);
  });

  // 6. Verificar mapeo de iglesias
  console.log('\n5. VERIFICACION DE MAPEO DE IGLESIAS');
  console.log('='.repeat(50));

  const { data: allChurches } = await supabase
    .from('churches')
    .select('id, name, active');

  const churchesWithReports = new Set(churchAnalysis.map(c => c.id));
  const churchesWithoutReports = allChurches.filter(c => !churchesWithReports.has(c.id));

  validation.totalChecks++;
  if (churchesWithoutReports.length === 0) {
    console.log(`✅ Todas las iglesias tienen informes`);
    validation.passedChecks++;
  } else {
    console.log(`⚠️ ${churchesWithoutReports.length} iglesias sin informes:`);
    churchesWithoutReports.slice(0, 10).forEach(church => {
      console.log(`  - ${church.name} (${church.active ? 'activa' : 'inactiva'})`);
    });
    validation.warnings.push(`${churchesWithoutReports.length} iglesias sin informes`);
    validation.passedChecks++;
  }

  // 7. Resumen final
  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN DE VALIDACION');
  console.log('='.repeat(60));

  console.log(`Total verificaciones: ${validation.totalChecks}`);
  console.log(`Exitosas: ${validation.passedChecks}`);
  console.log(`Fallidas: ${validation.failedChecks}`);
  console.log(`Advertencias: ${validation.warnings.length}`);

  if (validation.errors.length > 0) {
    console.log('\nERRORES CRITICOS:');
    validation.errors.forEach(error => console.log(`  ❌ ${error}`));
  }

  if (validation.warnings.length > 0) {
    console.log('\nADVERTENCIAS:');
    validation.warnings.forEach(warning => console.log(`  ⚠️ ${warning}`));
  }

  if (validation.failedChecks === 0 && validation.warnings.length === 0) {
    console.log('\n🎉 VALIDACION COMPLETAMENTE EXITOSA');
    console.log('El sistema está listo para producción.');
  } else if (validation.failedChecks === 0) {
    console.log('\n✅ VALIDACION EXITOSA CON ADVERTENCIAS');
    console.log('El sistema está funcional pero revise las advertencias.');
  } else {
    console.log('\n❌ VALIDACION FALLIDA');
    console.log('Corrija los errores antes de continuar.');
  }

  return validation;
}

// Ejecutar validación si se llama directamente
if (require.main === module) {
  validateImport()
    .then((result) => {
      process.exit(result.failedChecks > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('\nError durante la validación:', error.message);
      console.error('Stack:', error.stack);
      process.exit(1);
    });
}

module.exports = { validateImport, EXPECTED_TOTALS };