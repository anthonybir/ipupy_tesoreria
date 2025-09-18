const { createClient } = require('@libsql/client');

let client;

const createConnection = () => {
  if (!client) {
    if (!process.env.TURSO_DATABASE_URL) {
      throw new Error('TURSO_DATABASE_URL environment variable is required');
    }

    client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
};

const initDatabase = async () => {
  const db = createConnection();

  try {
    // Crear tabla de fondos (fund categories) - Nueva tabla basada en análisis Excel
    await db.execute(`
      CREATE TABLE IF NOT EXISTS fund_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Poblar fondos desde análisis Excel
    const funds = [
      'General', 'Caballeros', 'Misiones', 'APY', 'Lazos de Amor',
      'Mision Posible', 'Niños', 'IBA', 'Damas'
    ];

    for (const fund of funds) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO fund_categories (name) VALUES (?)`,
        args: [fund]
      });
    }

    // Crear tabla de iglesias con información completa de pastores
    await db.execute(`
      CREATE TABLE IF NOT EXISTS churches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        pastor TEXT NOT NULL,
        phone TEXT,
        pastor_ruc TEXT,
        pastor_cedula TEXT,
        pastor_grado TEXT,
        pastor_posicion TEXT,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Crear tabla de informes mensuales mejorada
    await db.execute(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        church_id INTEGER NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,

        -- ENTRADAS DEL MES
        diezmos REAL DEFAULT 0,
        ofrendas REAL DEFAULT 0,
        anexos REAL DEFAULT 0,
        caballeros REAL DEFAULT 0,
        damas REAL DEFAULT 0,
        jovenes REAL DEFAULT 0,
        ninos REAL DEFAULT 0,
        otros REAL DEFAULT 0,
        total_entradas REAL DEFAULT 0,

        -- SALIDAS DEL MES
        honorarios_pastoral REAL DEFAULT 0,
        honorarios_factura_numero TEXT,
        honorarios_ruc_pastor TEXT,
        fondo_nacional REAL DEFAULT 0,
        energia_electrica REAL DEFAULT 0,
        agua REAL DEFAULT 0,
        recoleccion_basura REAL DEFAULT 0,
        otros_gastos REAL DEFAULT 0,
        total_salidas REAL DEFAULT 0,

        -- OFRENDAS DIRECTAS FONDO NACIONAL
        ofrenda_misiones REAL DEFAULT 0,
        lazos_amor REAL DEFAULT 0,
        mision_posible REAL DEFAULT 0,
        aporte_caballeros REAL DEFAULT 0,
        apy REAL DEFAULT 0,
        instituto_biblico REAL DEFAULT 0,
        diezmo_pastoral REAL DEFAULT 0,
        total_fondo_nacional REAL DEFAULT 0,

        -- EXISTENCIA EN CAJA
        saldo_mes_anterior REAL DEFAULT 0,
        entrada_iglesia_local REAL DEFAULT 0,
        total_entrada_mensual REAL DEFAULT 0,
        saldo_fin_mes REAL DEFAULT 0,

        -- DEPÓSITO BANCARIO
        fecha_deposito DATE,
        numero_deposito TEXT,
        monto_depositado REAL DEFAULT 0,

        -- ASISTENCIAS Y BAUTISMOS
        asistencia_visitas INTEGER DEFAULT 0,
        bautismos_agua INTEGER DEFAULT 0,
        bautismos_espiritu INTEGER DEFAULT 0,

        -- ARCHIVOS Y OBSERVACIONES
        foto_informe TEXT,
        foto_deposito TEXT,
        observaciones TEXT,
        estado TEXT DEFAULT 'pendiente',

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(church_id, month, year),
        FOREIGN KEY (church_id) REFERENCES churches (id)
      );
    `);

    // Nueva tabla: Registro de cultos individuales
    await db.execute(`
      CREATE TABLE IF NOT EXISTS worship_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        church_id INTEGER NOT NULL,
        fecha_culto DATE NOT NULL,
        tipo_culto TEXT NOT NULL, -- 'Domingo AM', 'Domingo PM', 'Miércoles', 'Viernes', 'Especial'
        predicador TEXT,
        encargado_registro TEXT,

        -- TOTALES DEL CULTO
        total_diezmos REAL DEFAULT 0,
        total_ofrendas REAL DEFAULT 0,
        total_misiones REAL DEFAULT 0,
        total_otros REAL DEFAULT 0,
        ofrenda_general_anonima REAL DEFAULT 0,
        total_recaudado REAL DEFAULT 0,

        -- ASISTENCIA
        miembros_activos INTEGER DEFAULT 0,
        visitas INTEGER DEFAULT 0,
        ninos INTEGER DEFAULT 0,
        jovenes INTEGER DEFAULT 0,
        total_asistencia INTEGER DEFAULT 0,
        bautismos_agua INTEGER DEFAULT 0,
        bautismos_espiritu INTEGER DEFAULT 0,

        observaciones TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (church_id) REFERENCES churches (id)
      );
    `);

    // Nueva tabla: Detalle de aportes por culto
    await db.execute(`
      CREATE TABLE IF NOT EXISTS worship_contributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        worship_record_id INTEGER NOT NULL,
        numero_fila INTEGER,
        nombre_aportante TEXT,
        ci_ruc TEXT,
        numero_recibo TEXT,
        diezmo REAL DEFAULT 0,
        ofrenda REAL DEFAULT 0,
        misiones REAL DEFAULT 0,
        otros REAL DEFAULT 0,
        otros_concepto TEXT,
        total REAL DEFAULT 0,

        FOREIGN KEY (worship_record_id) REFERENCES worship_records (id)
      );
    `);

    // Nueva tabla: Registro detallado de salidas/gastos
    await db.execute(`
      CREATE TABLE IF NOT EXISTS expense_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        church_id INTEGER NOT NULL,
        report_id INTEGER,

        -- INFORMACIÓN DEL COMPROBANTE
        fecha_comprobante DATE NOT NULL,
        numero_comprobante TEXT,
        ruc_ci_proveedor TEXT,
        proveedor TEXT NOT NULL,
        concepto TEXT NOT NULL,
        tipo_salida TEXT, -- 'Honorarios', 'Servicios', 'Gastos Operativos', etc.

        -- CÁLCULOS DE IVA
        monto_exenta REAL DEFAULT 0,
        monto_gravada_10 REAL DEFAULT 0,
        iva_10 REAL DEFAULT 0,
        monto_gravada_5 REAL DEFAULT 0,
        iva_5 REAL DEFAULT 0,
        total_factura REAL DEFAULT 0,

        -- VALIDACIONES FISCALES
        es_factura_legal BOOLEAN DEFAULT 0,
        es_honorario_pastoral BOOLEAN DEFAULT 0,

        observaciones TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (church_id) REFERENCES churches (id),
        FOREIGN KEY (report_id) REFERENCES reports (id)
      );
    `);

    // Nueva tabla: Control de fondos múltiples
    await db.execute(`
      CREATE TABLE IF NOT EXISTS fund_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        church_id INTEGER NOT NULL,
        fund_category_id INTEGER NOT NULL,
        report_id INTEGER,
        worship_record_id INTEGER,

        tipo_movimiento TEXT NOT NULL, -- 'entrada', 'salida', 'transferencia'
        monto REAL NOT NULL,
        concepto TEXT,
        fecha_movimiento DATE NOT NULL,

        -- Para transferencias entre fondos
        fund_destino_id INTEGER,

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (church_id) REFERENCES churches (id),
        FOREIGN KEY (fund_category_id) REFERENCES fund_categories (id),
        FOREIGN KEY (fund_destino_id) REFERENCES fund_categories (id),
        FOREIGN KEY (report_id) REFERENCES reports (id),
        FOREIGN KEY (worship_record_id) REFERENCES worship_records (id)
      );
    `);

    // Crear tabla de usuarios para autenticación
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'church',
        church_id INTEGER,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (church_id) REFERENCES churches (id)
      );
    `);

    // Poblar iglesias iniciales con información completa
    await populateChurches(db);

    console.log('✅ Base de datos Turso SQLite inicializada correctamente');
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    throw error;
  }
};

const populateChurches = async (db) => {
  try {
    // Verificar si ya existen iglesias
    const result = await db.execute('SELECT COUNT(*) as count FROM churches');
    const count = result.rows[0].count;

    if (count > 0) {
      console.log('Iglesias ya existen, omitiendo población inicial');
      return;
    }

    const churches = [
      { name: 'IPU LAMBARÉ', city: 'Lambaré', pastor: 'Joseph Anthony Bir', pastor_cedula: '2370941', pastor_grado: 'ORDENADO', pastor_posicion: 'Obispo Consejero' },
      { name: 'IPU EDELIRA', city: 'Edelira', pastor: 'Venancio Vázquez Benítez', pastor_cedula: '2122970', pastor_grado: 'ORDENADO', pastor_posicion: 'Diácono' },
      { name: 'IPU MARAMBURÉ', city: 'Maramburé', pastor: 'Ricardo Martínez', pastor_cedula: '1795191', pastor_grado: 'ORDENADO', pastor_posicion: 'Presidente' },
      { name: 'IPU LUQUE', city: 'Luque', pastor: 'Gregorio Chaparro', pastor_cedula: '1001860', pastor_grado: 'ORDENADO', pastor_posicion: 'Vice-Presidente' },
      { name: 'IPU VILLA HAYES PAÑETE', city: 'Villa Hayes', pastor: 'Juan Gómez', pastor_cedula: '2447195', pastor_grado: 'ORDENADO', pastor_posicion: 'Director de Misiones' },
      { name: 'IPU ITAUGUÁ', city: 'Itauguá', pastor: 'Ricardo Ramón Ybañez Martínez', pastor_cedula: '3262368', pastor_grado: 'ORDENADO', pastor_posicion: 'Secretario' },
      { name: 'IPU ANAHÍ', city: 'Anahí', pastor: 'Isidoro Ramírez Ayala', pastor_cedula: '3592507', pastor_grado: 'ORDENADO', pastor_posicion: 'Pastor' },
      { name: 'IPU CAACUPE', city: 'Caacupé', pastor: 'Abel Ortiz Yrigoyen', pastor_cedula: '2669610', pastor_grado: 'GENERAL', pastor_posicion: 'Pastor' },
      { name: 'IPU BARBEROS', city: 'Barberos', pastor: 'Hugo Javier Sosa Escobar', pastor_cedula: '3395880', pastor_grado: 'ORDENADO', pastor_posicion: 'Pastor' },
      { name: 'IPU CAPIATÁ', city: 'Capiatá', pastor: 'Narciso Armoa Palacios', pastor_cedula: '1232089', pastor_grado: 'GENERAL', pastor_posicion: 'Director de Caballeros' },
      { name: 'IPU ITÁ', city: 'Itá', pastor: 'Ramón Alberto Bogarín Lezcano', pastor_cedula: '4548452', pastor_grado: 'GENERAL', pastor_posicion: 'Pastor' },
      { name: 'IPU CAAGUAZÚ', city: 'Caaguazú', pastor: 'Christian Antonio Bareiro', pastor_cedula: '21787099', pastor_grado: 'LOCAL', pastor_posicion: 'Pastor' },
      { name: 'IPU HERNANDARIAS', city: 'Hernandarias', pastor: 'Ramón Jara Santacruz', pastor_cedula: '5853477', pastor_grado: 'LOCAL', pastor_posicion: 'Pastor' },
      { name: 'IPU CONCEPCIÓN', city: 'Concepción', pastor: 'Vicente Ayala Stumpjs', pastor_cedula: '1361882', pastor_grado: 'LOCAL', pastor_posicion: 'Pastor' },
      { name: 'IPU ÑEMBY', city: 'Ñemby', pastor: 'Eliezer Jara Ortiz', pastor_cedula: '4882109', pastor_grado: 'LOCAL', pastor_posicion: 'Pastor' },
      { name: 'IPU ASUNCIÓN', city: 'Asunción', pastor: 'Daves James Linares Silva', pastor_cedula: '8609861', pastor_grado: 'LOCAL', pastor_posicion: 'Pastor' },
      { name: 'IPU CDE PRIMAVERA', city: 'Ciudad del Este', pastor: 'Johny Quintana', pastor_cedula: '3707449', pastor_grado: 'LOCAL', pastor_posicion: 'Pastor' },
      { name: 'IPU CDE REMANSITO', city: 'Ciudad del Este', pastor: 'Eddie Yepez', pastor_cedula: '22430074', pastor_grado: 'LOCAL', pastor_posicion: 'Pastor' },
      { name: 'IPU YUQUYRY', city: 'Yuquyry', pastor: 'Julian Ortiz', pastor_cedula: '640904', pastor_grado: 'LOCAL', pastor_posicion: 'Pastor' },
      { name: 'IPU PILAR', city: 'Pilar', pastor: 'Alexis Escurra', pastor_cedula: '5808509', pastor_grado: 'LOCAL', pastor_posicion: 'Pastor' },
      { name: 'IPU EDELIRA KM 28', city: 'Edelira', pastor: 'Adelio Raúl Barreto', pastor_cedula: '4768440', pastor_grado: 'LOCAL', pastor_posicion: 'Pastor' },
      { name: 'IPU PINDOLO', city: 'Píndolo', pastor: 'Nilton Sotelo', pastor_cedula: '', pastor_grado: 'GENERAL', pastor_posicion: 'Pastor' }
    ];

    for (const church of churches) {
      await db.execute({
        sql: `INSERT INTO churches (name, city, pastor, pastor_cedula, pastor_grado, pastor_posicion)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [church.name, church.city, church.pastor, church.pastor_cedula, church.pastor_grado, church.pastor_posicion]
      });
    }

    console.log('✅ Iglesias iniciales cargadas en Turso SQLite');
  } catch (error) {
    console.error('❌ Error poblando iglesias:', error);
    throw error;
  }
};

const execute = async (sql, args = []) => {
  const db = createConnection();
  try {
    if (typeof sql === 'string') {
      return await db.execute({ sql, args });
    } else {
      return await db.execute(sql);
    }
  } catch (error) {
    console.error('Database execute error:', error);
    throw error;
  }
};

const batch = async (statements) => {
  const db = createConnection();
  try {
    return await db.batch(statements);
  } catch (error) {
    console.error('Database batch error:', error);
    throw error;
  }
};

module.exports = {
  initDatabase,
  execute,
  batch,
  createConnection
};