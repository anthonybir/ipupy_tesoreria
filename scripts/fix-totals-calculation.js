#!/usr/bin/env node

/**
 * Fix total_entradas and total_salidas calculations in the database
 * Recalculate all totals based on individual categories
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

async function fixTotalsCalculation() {
  console.log('=== CORRECCION DE CALCULOS DE TOTALES ===\n');

  // 1. Obtener todos los reportes
  const { data: reports, error: fetchError } = await supabase
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
      honorarios_pastoral,
      energia_electrica,
      agua,
      otros_gastos,
      total_entradas,
      total_salidas
    `);

  if (fetchError) {
    throw new Error(`Error obteniendo reportes: ${fetchError.message}`);
  }

  console.log(`Procesando ${reports.length} informes...\n`);

  let updatedCount = 0;
  let errorCount = 0;

  for (const report of reports) {
    try {
      // Recalcular total_entradas
      const newTotalEntradas = (parseFloat(report.diezmos) || 0) +
                               (parseFloat(report.ofrendas) || 0) +
                               (parseFloat(report.ofrenda_misiones) || 0) +
                               (parseFloat(report.caballeros) || 0) +
                               (parseFloat(report.damas) || 0) +
                               (parseFloat(report.jovenes) || 0) +
                               (parseFloat(report.ninos) || 0) +
                               (parseFloat(report.lazos_amor) || 0) +
                               (parseFloat(report.mision_posible) || 0) +
                               (parseFloat(report.apy) || 0) +
                               (parseFloat(report.instituto_biblico) || 0) +
                               (parseFloat(report.otros) || 0);

      // Recalcular total_salidas
      const newTotalSalidas = (parseFloat(report.honorarios_pastoral) || 0) +
                              (parseFloat(report.energia_electrica) || 0) +
                              (parseFloat(report.agua) || 0) +
                              (parseFloat(report.otros_gastos) || 0);

      // Solo actualizar si hay diferencias
      const entradaDiff = Math.abs((parseFloat(report.total_entradas) || 0) - newTotalEntradas);
      const salidaDiff = Math.abs((parseFloat(report.total_salidas) || 0) - newTotalSalidas);

      if (entradaDiff > 0.01 || salidaDiff > 0.01) {
        const { error: updateError } = await supabase
          .from('reports')
          .update({
            total_entradas: newTotalEntradas,
            total_salidas: newTotalSalidas
          })
          .eq('id', report.id);

        if (updateError) {
          console.error(`Error actualizando reporte ${report.id}: ${updateError.message}`);
          errorCount++;
        } else {
          updatedCount++;
          if (updatedCount % 50 === 0) {
            console.log(`Actualizados ${updatedCount} informes...`);
          }
        }
      }

    } catch (error) {
      console.error(`Error procesando reporte ${report.id}: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n=== CORRECCION COMPLETADA ===`);
  console.log(`Informes actualizados: ${updatedCount}`);
  console.log(`Errores: ${errorCount}`);

  // 2. Verificar totales después de la corrección
  console.log(`\n=== VERIFICACION POST-CORRECCION ===`);

  const { data: newTotals } = await supabase
    .from('reports')
    .select(`
      total_entradas,
      total_salidas,
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

  let totalEntradasDB = 0;
  let totalSalidasDB = 0;
  let calculationErrors = 0;

  newTotals.forEach(report => {
    const dbEntradas = parseFloat(report.total_entradas) || 0;
    const dbSalidas = parseFloat(report.total_salidas) || 0;

    totalEntradasDB += dbEntradas;
    totalSalidasDB += dbSalidas;

    // Verificar que los cálculos son correctos
    const expectedEntradas = (parseFloat(report.diezmos) || 0) +
                           (parseFloat(report.ofrendas) || 0) +
                           (parseFloat(report.ofrenda_misiones) || 0) +
                           (parseFloat(report.caballeros) || 0) +
                           (parseFloat(report.damas) || 0) +
                           (parseFloat(report.jovenes) || 0) +
                           (parseFloat(report.ninos) || 0) +
                           (parseFloat(report.lazos_amor) || 0) +
                           (parseFloat(report.mision_posible) || 0) +
                           (parseFloat(report.apy) || 0) +
                           (parseFloat(report.instituto_biblico) || 0) +
                           (parseFloat(report.otros) || 0);

    if (Math.abs(dbEntradas - expectedEntradas) > 0.01) {
      calculationErrors++;
    }
  });

  console.log(`Total entradas DB: Gs ${totalEntradasDB.toLocaleString()}`);
  console.log(`Total salidas DB: Gs ${totalSalidasDB.toLocaleString()}`);
  console.log(`Balance: Gs ${(totalEntradasDB - totalSalidasDB).toLocaleString()}`);
  console.log(`Errores de cálculo restantes: ${calculationErrors}`);

  if (calculationErrors === 0) {
    console.log(`✅ Todos los cálculos son ahora correctos`);
  } else {
    console.log(`⚠️ Aún hay ${calculationErrors} errores de cálculo`);
  }

  return { updatedCount, errorCount, totalEntradasDB, totalSalidasDB, calculationErrors };
}

// Ejecutar corrección si se llama directamente
if (require.main === module) {
  fixTotalsCalculation()
    .then((result) => {
      console.log('\nProceso de corrección completado');
      process.exit(result.errorCount > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('\nError durante la corrección:', error.message);
      console.error('Stack:', error.stack);
      process.exit(1);
    });
}

module.exports = { fixTotalsCalculation };