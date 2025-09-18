const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuración de multer para uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Database setup
const db = new sqlite3.Database('./ipupy.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initDatabase();
  }
});

function initDatabase() {
  // Tabla de iglesias
  db.run(`CREATE TABLE IF NOT EXISTS churches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    pastor TEXT NOT NULL,
    phone TEXT,
    ruc TEXT,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabla de informes mensuales
  db.run(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    church_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    diezmos REAL DEFAULT 0,
    ofrendas REAL DEFAULT 0,
    anexos REAL DEFAULT 0,
    caballeros REAL DEFAULT 0,    damas REAL DEFAULT 0,
    jovenes REAL DEFAULT 0,
    ninos REAL DEFAULT 0,
    otros REAL DEFAULT 0,
    total_entradas REAL DEFAULT 0,
    fondo_nacional REAL DEFAULT 0,
    honorarios_pastoral REAL DEFAULT 0,
    servicios REAL DEFAULT 0,
    total_salidas REAL DEFAULT 0,
    saldo_mes REAL DEFAULT 0,
    ofrendas_directas_misiones REAL DEFAULT 0,
    lazos_amor REAL DEFAULT 0,
    mision_posible REAL DEFAULT 0,
    aporte_caballeros REAL DEFAULT 0,
    apy REAL DEFAULT 0,
    instituto_biblico REAL DEFAULT 0,
    diezmo_pastoral REAL DEFAULT 0,
    numero_deposito TEXT,
    fecha_deposito DATE,
    monto_depositado REAL DEFAULT 0,
    asistencia_visitas INTEGER DEFAULT 0,
    bautismos_agua INTEGER DEFAULT 0,
    bautismos_espiritu INTEGER DEFAULT 0,
    foto_informe TEXT,
    foto_deposito TEXT,
    observaciones TEXT,
    estado TEXT DEFAULT 'pendiente',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(church_id, month, year),
    FOREIGN KEY (church_id) REFERENCES churches (id)
  )`, (err) => {
    if (!err) {
      // Pre-poblar con las iglesias de la lista
      populateChurches();
    }
  });
}

// Poblar iglesias iniciales
function populateChurches() {
  const churches = [
    { name: 'IPU LAMBARÉ', city: 'Lambaré', pastor: 'Joseph Anthony Bir', phone: '' },    { name: 'IPU EDELIRA', city: 'Edelira', pastor: 'Venancio Vázquez Benítez', phone: '' },
    { name: 'IPU MARAMBURÉ', city: 'Maramburé', pastor: 'Ricardo Martínez', phone: '' },
    { name: 'IPU LUQUE', city: 'Luque', pastor: 'Gregorio Chaparro', phone: '' },
    { name: 'IPU VILLA HAYES PAÑETE', city: 'Villa Hayes', pastor: 'Juan Gómez', phone: '' },
    { name: 'IPU ITAUGUÁ', city: 'Itauguá', pastor: 'Ricardo Ramón Ybañez Martínez', phone: '' },
    { name: 'IPU ANAHÍ', city: 'Anahí', pastor: 'Isidoro Ramírez Ayala', phone: '' },
    { name: 'IPU CAACUPE', city: 'Caacupé', pastor: 'Abel Ortiz Yrigoyen', phone: '' },
    { name: 'IPU BARBEROS', city: 'Barberos', pastor: 'Hugo Javier Sosa Escobar', phone: '' },
    { name: 'IPU CAPIATÁ', city: 'Capiatá', pastor: 'Narciso Armoa Palacios', phone: '' },
    { name: 'IPU ITÁ', city: 'Itá', pastor: 'Ramón Alberto Bogarín Lezcano', phone: '' },
    { name: 'IPU CAAGUAZÚ', city: 'Caaguazú', pastor: 'Christian Antonio Bareiro', phone: '' },
    { name: 'IPU HERNANDARIAS', city: 'Hernandarias', pastor: 'Ramón Jara Santacruz', phone: '' },
    { name: 'IPU CONCEPCIÓN', city: 'Concepción', pastor: 'Vicente Ayala Stumpjs', phone: '' },
    { name: 'IPU ÑEMBY', city: 'Ñemby', pastor: 'Eliezer Jara Ortiz', phone: '' },
    { name: 'IPU ASUNCIÓN', city: 'Asunción', pastor: 'Daves James Linares Silva', phone: '' },
    { name: 'IPU CDE PRIMAVERA', city: 'Ciudad del Este', pastor: 'Johny Quintana', phone: '' },
    { name: 'IPU CDE REMANSITO', city: 'Ciudad del Este', pastor: 'Eddie Yepez', phone: '' },
    { name: 'IPU YUQUYRY', city: 'Yuquyry', pastor: 'Julian Ortiz', phone: '' },
    { name: 'IPU PILAR', city: 'Pilar', pastor: 'Alexis Escurra', phone: '' },
    { name: 'IPU EDELIRA KM 28', city: 'Edelira', pastor: 'Adelio Raúl Barreto', phone: '' },
    { name: 'IPU PINDOLO', city: 'Píndolo', pastor: 'Nilton Sotelo', phone: '' }
  ];

  // Verificar si ya existen iglesias
  db.get("SELECT COUNT(*) as count FROM churches", (err, row) => {
    if (!err && row.count === 0) {
      const stmt = db.prepare("INSERT INTO churches (name, city, pastor, phone) VALUES (?, ?, ?, ?)");
      churches.forEach(church => {
        stmt.run(church.name, church.city, church.pastor, church.phone);
      });
      stmt.finalize();
      console.log('✅ Iglesias iniciales cargadas');
    }
  });
}

// API Endpoints

// Obtener todas las iglesias
app.get('/api/churches', (req, res) => {
  db.all("SELECT * FROM churches ORDER BY name", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Obtener resumen del dashboard
app.get('/api/dashboard', (req, res) => {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const queries = {
    totalChurches: "SELECT COUNT(*) as count FROM churches WHERE active = 1",
    monthReports: `SELECT COUNT(*) as count FROM reports WHERE month = ? AND year = ?`,
    monthTotal: `SELECT COALESCE(SUM(total_entradas), 0) as total FROM reports WHERE month = ? AND year = ?`,
    nationalFund: `SELECT COALESCE(SUM(fondo_nacional), 0) as total FROM reports WHERE month = ? AND year = ?`
  };
  
  let result = {};
  
  db.get(queries.totalChurches, (err, row) => {
    result.totalChurches = row ? row.count : 0;
    
    db.get(queries.monthReports, [currentMonth, currentYear], (err, row) => {
      result.reportedChurches = row ? row.count : 0;
      result.pendingChurches = result.totalChurches - result.reportedChurches;
      
      db.get(queries.monthTotal, [currentMonth, currentYear], (err, row) => {
        result.monthTotal = row ? row.total : 0;
        
        db.get(queries.nationalFund, [currentMonth, currentYear], (err, row) => {
          result.nationalFund = row ? row.total : 0;
          res.json(result);
        });
      });
    });
  });
});

// Crear nuevo informe
app.post('/api/reports', upload.fields([
  { name: 'foto_informe', maxCount: 1 },
  { name: 'foto_deposito', maxCount: 1 }
]), (req, res) => {
  const data = req.body;
  
  // Calcular totales
  const totalEntradas = parseFloat(data.diezmos || 0) + 
                       parseFloat(data.ofrendas || 0) + 
                       parseFloat(data.anexos || 0) +
                       parseFloat(data.caballeros || 0) +
                       parseFloat(data.damas || 0) +
                       parseFloat(data.jovenes || 0) +
                       parseFloat(data.ninos || 0) +
                       parseFloat(data.otros || 0);
  
  const fondoNacional = totalEntradas * 0.1; // 10% automático
  
  const totalSalidas = parseFloat(data.honorarios_pastoral || 0) +
                      fondoNacional +
                      parseFloat(data.servicios || 0);
  
  const saldoMes = totalEntradas - totalSalidas;
  
  // Archivos subidos
  const fotoInforme = req.files['foto_informe'] ? req.files['foto_informe'][0].filename : null;
  const fotoDeposito = req.files['foto_deposito'] ? req.files['foto_deposito'][0].filename : null;
  
  const sql = `INSERT INTO reports (
    church_id, month, year, diezmos, ofrendas, anexos, caballeros, damas, 
    jovenes, ninos, otros, total_entradas, fondo_nacional, honorarios_pastoral, 
    servicios, total_salidas, saldo_mes, numero_deposito, fecha_deposito, 
    monto_depositado, foto_informe, foto_deposito, observaciones, estado
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [
    data.church_id, data.month, data.year,
    data.diezmos || 0, data.ofrendas || 0, data.anexos || 0,
    data.caballeros || 0, data.damas || 0, data.jovenes || 0,
    data.ninos || 0, data.otros || 0,
    totalEntradas, fondoNacional,
    data.honorarios_pastoral || 0, data.servicios || 0,
    totalSalidas, saldoMes,
    data.numero_deposito, data.fecha_deposito, fondoNacional,
    fotoInforme, fotoDeposito,
    data.observaciones, 'recibido'
  ], function(err) {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      res.json({ 
        id: this.lastID,
        message: 'Informe guardado exitosamente',
        totales: { totalEntradas, fondoNacional, totalSalidas, saldoMes }
      });
    }
  });
});

// Obtener informes por mes
app.get('/api/reports/:year/:month', (req, res) => {
  const sql = `
    SELECT r.*, c.name as church_name, c.city, c.pastor
    FROM reports r
    JOIN churches c ON r.church_id = c.id
    WHERE r.year = ? AND r.month = ?
    ORDER BY c.name
  `;
  
  db.all(sql, [req.params.year, req.params.month], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Exportar a Excel
app.get('/api/export/:year/:month', (req, res) => {
  const sql = `
    SELECT c.name as Iglesia, c.city as Ciudad, c.pastor as Pastor,
           r.diezmos, r.ofrendas, r.total_entradas, r.fondo_nacional,
           r.numero_deposito, r.fecha_deposito
    FROM reports r
    JOIN churches c ON r.church_id = c.id
    WHERE r.year = ? AND r.month = ?
    ORDER BY c.name
  `;
  
  db.all(sql, [req.params.year, req.params.month], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      // Crear workbook de Excel
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet(rows);
      xlsx.utils.book_append_sheet(wb, ws, `Informe_${req.params.month}_${req.params.year}`);
      
      // Enviar archivo
      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', `attachment; filename="IPU_PY_${req.params.year}_${req.params.month}.xlsx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor IPU PY Tesorería corriendo en puerto ${PORT}`);
});