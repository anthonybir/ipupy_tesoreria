#!/usr/bin/env node

/**
 * Final fix for all total calculations in the database
 * This script ensures that total_entradas and total_salidas are properly calculated
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

async function finalFixTotals() {
  console.log('=== CORRECCION FINAL DE TOTALES ===\n');

  // Usar SQL directo para hacer la actualización masiva
  console.log('Actualizando total_entradas...');

  const { error: updateEntradasError } = await supabase.rpc('execute_sql', {
    query: `
      UPDATE reports
      SET total_entradas = (
        COALESCE(diezmos, 0) +
        COALESCE(ofrendas, 0) +
        COALESCE(ofrenda_misiones, 0) +
        COALESCE(caballeros, 0) +
        COALESCE(damas, 0) +
        COALESCE(jovenes, 0) +
        COALESCE(ninos, 0) +
        COALESCE(lazos_amor, 0) +
        COALESCE(mision_posible, 0) +
        COALESCE(apy, 0) +
        COALESCE(instituto_biblico, 0) +
        COALESCE(otros, 0)
      );
    `,
    params: []
  });

  if (updateEntradasError) {
    throw new Error(`Error actualizando entradas: ${updateEntradasError.message}`);
  }

  console.log('Actualizando total_salidas...');

  const { error: updateSalidasError } = await supabase.rpc('execute_sql', {
    query: `
      UPDATE reports
      SET total_salidas = (
        COALESCE(honorarios_pastoral, 0) +
        COALESCE(energia_electrica, 0) +
        COALESCE(agua, 0) +
        COALESCE(otros_gastos, 0)
      );
    `,
    params: []
  });

  if (updateSalidasError) {
    throw new Error(`Error actualizando salidas: ${updateSalidasError.message}`);
  }

  console.log('✅ Actualización masiva completada');

  // Verificar resultados
  console.log('\n=== VERIFICACION POST-ACTUALIZACION ===');

  const { data: verification, error: verifyError } = await supabase.rpc('execute_sql', {
    query: `
      SELECT
        COUNT(*) as total_reports,
        SUM(total_entradas) as sum_entradas,
        SUM(total_salidas) as sum_salidas,
        COUNT(*) FILTER (WHERE
          ABS(total_entradas - (
            COALESCE(diezmos, 0) + COALESCE(ofrendas, 0) + COALESCE(ofrenda_misiones, 0) +
            COALESCE(caballeros, 0) + COALESCE(damas, 0) + COALESCE(jovenes, 0) + COALESCE(ninos, 0) +
            COALESCE(lazos_amor, 0) + COALESCE(mision_posible, 0) + COALESCE(apy, 0) +
            COALESCE(instituto_biblico, 0) + COALESCE(otros, 0)
          )) > 0.01
        ) as calculation_errors
      FROM reports;
    `,
    params: []
  });

  if (verifyError) {
    throw new Error(`Error en verificación: ${verifyError.message}`);
  }

  const results = verification[0];
  console.log(`Total informes: ${results.total_reports}`);
  console.log(`Suma entradas: Gs ${parseFloat(results.sum_entradas).toLocaleString()}`);
  console.log(`Suma salidas: Gs ${parseFloat(results.sum_salidas).toLocaleString()}`);
  console.log(`Balance: Gs ${(parseFloat(results.sum_entradas) - parseFloat(results.sum_salidas)).toLocaleString()}`);
  console.log(`Errores de cálculo: ${results.calculation_errors}`);

  if (results.calculation_errors === 0 || results.calculation_errors === '0') {
    console.log('\n🎉 TODOS LOS CALCULOS CORREGIDOS EXITOSAMENTE');
  } else {
    console.log(`\n⚠️ Aún hay ${results.calculation_errors} errores de cálculo`);
  }

  return results;
}

// Ejecutar corrección si se llama directamente
if (require.main === module) {
  finalFixTotals()
    .then(() => {
      console.log('\nCorreción final completada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nError durante la corrección final:', error.message);
      console.error('Stack:', error.stack);
      process.exit(1);
    });
}

module.exports = { finalFixTotals };