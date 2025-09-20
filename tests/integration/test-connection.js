/**
 * Script de prueba para verificar conexión con Supabase Postgres
 */

require('dotenv').config({ path: '../../.env.local' });
const { createConnection, execute, initDatabase } = require('../../src/lib/db');

async function testConnection() {
  try {
    console.log('🔄 Probando conexión con Supabase Postgres...');
    console.log(`📡 URL: ${process.env.SUPABASE_DB_URL || process.env.DATABASE_URL ? '✅ Configurada' : '❌ Faltante'}`);
    console.log(`🔑 Service key: ${process.env.SUPABASE_SERVICE_KEY ? '✅ Configurada' : '⚠️ Usando anon/otros credenciales'}`);

    // Crear pool de conexión
    const pool = createConnection();
    console.log('✅ Pool de conexiones creado exitosamente');

    // Probar consulta simple
    const versionResult = await pool.query('SELECT version()');
    console.log(`📊 PostgreSQL version: ${versionResult.rows[0].version}`);

    // Inicializar (log informativo)
    await initDatabase();

    // Verificar tablas creadas en schema público
    const tables = await execute(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\n📋 Tablas en esquema público:');
    tables.rows.forEach((table) => {
      console.log(`  ✅ ${table.table_name}`);
    });

    // Verificar registros clave
    const churches = await execute('SELECT COUNT(*) AS count FROM churches');
    console.log(`\n⛪ Iglesias cargadas: ${churches.rows[0].count}`);

    const funds = await execute('SELECT COUNT(*) AS count FROM fund_categories');
    console.log(`💰 Fondos configurados: ${funds.rows[0].count}`);

    const fundList = await execute('SELECT id, name FROM fund_categories ORDER BY id');
    console.log('\n💰 Fondos disponibles:');
    fundList.rows.forEach((fund) => {
      console.log(`  ${fund.id}. ${fund.name}`);
    });

    console.log('\n🎉 ¡Conexión exitosa! Base de datos lista para usar.');
  } catch (error) {
    console.error('\n❌ Error de conexión:', error.message);

    if (!process.env.SUPABASE_DB_URL && !process.env.DATABASE_URL) {
      console.error('📡 Configure SUPABASE_DB_URL en .env.local');
    }
    if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_ANON_KEY) {
      console.error('🔑 Configure SUPABASE_SERVICE_KEY o SUPABASE_ANON_KEY en .env.local');
    }

    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar prueba
testConnection();
