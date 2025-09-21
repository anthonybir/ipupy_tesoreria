#!/usr/bin/env node

/**
 * Apply dual-level accounting enhancement migration to Supabase
 * This adds church-level accounting capabilities alongside national reporting
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Configurar SUPABASE_URL y SUPABASE_SERVICE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function applyMigration() {
  console.log('=== APLICANDO MIGRACION DUAL-LEVEL ACCOUNTING ===\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '005_dual_level_accounting_enhancement.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');

    console.log('1. Leyendo archivo de migración...');
    console.log(`   Archivo: ${migrationPath}`);
    console.log(`   Tamaño: ${migrationSQL.length} caracteres\n`);

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`2. Ejecutando ${statements.length} declaraciones SQL...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip empty statements
      if (!statement || statement.length < 10) {continue;}

      console.log(`   Ejecutando declaración ${i + 1}...`);

      try {
        // Use execute_sql for DDL operations
        const { error } = await supabase.rpc('execute_sql', {
          query: statement + ';'
        });

        if (error) {
          console.log(`   ERROR en declaración ${i + 1}: ${error.message}`);
          errorCount++;
        } else {
          console.log(`   OK - Declaración ${i + 1} ejecutada exitosamente`);
          successCount++;
        }
      } catch (err) {
        console.log(`   ERROR en declaración ${i + 1}: ${err.message}`);
        errorCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n=== RESULTADO DE LA MIGRACION ===`);
    console.log(`Declaraciones exitosas: ${successCount}`);
    console.log(`Declaraciones fallidas: ${errorCount}`);
    console.log(`Total procesadas: ${successCount + errorCount}`);

    if (errorCount === 0) {
      console.log('\nMigracion exitosa. Sistema dual-level accounting habilitado.');
    } else {
      console.log(`\nMigracion parcialmente exitosa. ${errorCount} errores encontrados.`);
    }

    // Verify the migration by checking if new tables exist
    console.log('\n=== VERIFICACION POST-MIGRACION ===');

    const tablesToCheck = [
      'church_accounts',
      'church_transaction_categories',
      'church_transactions',
      'church_budgets',
      'church_financial_goals',
      'church_account_balances'
    ];

    for (const tableName of tablesToCheck) {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`   TABLA ${tableName}: ERROR - ${error.message}`);
        } else {
          console.log(`   TABLA ${tableName}: OK - ${count || 0} registros`);
        }
      } catch (err) {
        console.log(`   TABLA ${tableName}: ERROR - ${err.message}`);
      }
    }

    // Check if views were created
    console.log('\n=== VERIFICACION DE VISTAS ===');

    try {
      const { data: viewData, error: viewError } = await supabase
        .from('church_financial_summary')
        .select('*')
        .limit(1);

      if (viewError) {
        console.log(`   VISTA church_financial_summary: ERROR - ${viewError.message}`);
      } else {
        console.log(`   VISTA church_financial_summary: OK - Vista funcional`);
      }
    } catch (err) {
      console.log(`   VISTA church_financial_summary: ERROR - ${err.message}`);
    }

    try {
      const { data: macroData, error: macroError } = await supabase
        .from('national_treasury_summary')
        .select('*')
        .limit(1);

      if (macroError) {
        console.log(`   VISTA national_treasury_summary: ERROR - ${macroError.message}`);
      } else {
        console.log(`   VISTA national_treasury_summary: OK - Vista funcional`);
      }
    } catch (err) {
      console.log(`   VISTA national_treasury_summary: ERROR - ${err.message}`);
    }

    // Check transaction categories
    console.log('\n=== VERIFICACION DE CATEGORIAS ===');

    try {
      const { data: categories, error: catError } = await supabase
        .from('church_transaction_categories')
        .select('*');

      if (catError) {
        console.log(`   CATEGORIAS: ERROR - ${catError.message}`);
      } else {
        const incomeCategories = categories.filter(c => c.category_type === 'income').length;
        const expenseCategories = categories.filter(c => c.category_type === 'expense').length;
        console.log(`   CATEGORIAS: OK - ${incomeCategories} ingresos, ${expenseCategories} gastos`);
      }
    } catch (err) {
      console.log(`   CATEGORIAS: ERROR - ${err.message}`);
    }

    return {
      success: errorCount === 0,
      successCount,
      errorCount,
      totalStatements: successCount + errorCount
    };

  } catch (error) {
    console.error('\nError durante la migración:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Ejecutar migración si se llama directamente
if (require.main === module) {
  applyMigration()
    .then((result) => {
      console.log('\nMigración completada');
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\nError durante la migración:', error.message);
      process.exit(1);
    });
}

module.exports = { applyMigration };