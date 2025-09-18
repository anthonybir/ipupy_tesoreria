/**
 * Script de prueba para verificar conexión con Turso
 */

require('dotenv').config({ path: '.env.local' });
const { createConnection, initDatabase } = require('./lib/db-turso');

async function testConnection() {
  try {
    console.log('🔄 Probando conexión con Turso...');
    console.log(`📡 URL: ${process.env.TURSO_DATABASE_URL}`);
    console.log(`🔑 Token: ${process.env.TURSO_AUTH_TOKEN ? '✅ Configurado' : '❌ Faltante'}`);

    // Crear conexión
    const db = createConnection();
    console.log('✅ Conexión creada exitosamente');

    // Probar consulta simple
    const result = await db.execute('SELECT sqlite_version() as version');
    console.log(`📊 SQLite version: ${result.rows[0].version}`);

    // Inicializar schema
    console.log('🏗️ Inicializando schema de base de datos...');
    await initDatabase();
    console.log('✅ Schema inicializado');

    // Verificar tablas creadas
    const tables = await db.execute(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    console.log('\n📋 Tablas creadas:');
    tables.rows.forEach(table => {
      console.log(`  ✅ ${table.name}`);
    });

    // Verificar iglesias cargadas
    const churches = await db.execute('SELECT COUNT(*) as count FROM churches');
    console.log(`\n⛪ Iglesias cargadas: ${churches.rows[0].count}`);

    // Verificar fondos cargados
    const funds = await db.execute('SELECT COUNT(*) as count FROM fund_categories');
    console.log(`💰 Fondos configurados: ${funds.rows[0].count}`);

    // Mostrar fondos disponibles
    const fundList = await db.execute('SELECT id, name FROM fund_categories ORDER BY id');
    console.log('\n💰 Fondos disponibles:');
    fundList.rows.forEach(fund => {
      console.log(`  ${fund.id}. ${fund.name}`);
    });

    console.log('\n🎉 ¡Conexión exitosa! Base de datos lista para usar.');

  } catch (error) {
    console.error('\n❌ Error de conexión:', error.message);

    if (error.message.includes('auth')) {
      console.error('🔑 Verificar TURSO_AUTH_TOKEN en .env.local');
    }
    if (error.message.includes('url')) {
      console.error('📡 Verificar TURSO_DATABASE_URL en .env.local');
    }

    process.exit(1);
  }
}

// Ejecutar prueba
testConnection();