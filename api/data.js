const { execute } = require('../lib/db');
const { setCORSHeaders, handlePreflight } = require('../lib/cors');
const xlsx = require('xlsx');
const multer = require('multer');

// Configurar multer para manejar archivos en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024 // 4MB máximo (compatible con límite de Vercel 4.5MB)
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'), false);
    }
  }
});

const runMiddleware = (req, res, fn) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

module.exports = async function handler(req, res) {
  // Configure CORS
  setCORSHeaders(req, res);

  if (handlePreflight(req, res)) {
    return;
  }

  try {
    const { action } = req.query;

    // Route to appropriate handler based on action parameter
    switch (action) {
      case 'import':
        return await handleImportAPI(req, res);
      case 'export':
        return await handleExportAPI(req, res);
      default:
        return res.status(400).json({
          error: 'Parámetro action requerido. Valores válidos: import, export'
        });
    }
  } catch (error) {
    console.error('Error en API data:', error);

    if (error.message.includes('Solo se permiten archivos Excel')) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// === IMPORT API HANDLER ===
async function handleImportAPI(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido para import - usar POST' });
  }

  try {
    // Ejecutar multer middleware
    await runMiddleware(req, res, upload.single('excelFile'));

    if (!req.file) {
      return res.status(400).json({ error: 'Archivo Excel requerido' });
    }

    const { type = 'reports', year, month, overwrite = false } = req.body;

    // Leer archivo Excel
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'El archivo Excel está vacío o no tiene datos válidos' });
    }

    let result = {};

    if (type === 'reports') {
      result = await importReports(data, year, month, overwrite === 'true');
    } else if (type === 'churches') {
      result = await importChurches(data, overwrite === 'true');
    } else {
      return res.status(400).json({ error: 'Tipo de importación no válido. Use "reports" o "churches"' });
    }

    res.json(result);

  } catch (error) {
    console.error('Error en import:', error);
    throw error;
  }
}

// === EXPORT API HANDLER ===
async function handleExportAPI(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido para export - usar GET' });
  }

  try {
    const { year, month, type = 'monthly' } = req.query;

    if (!year) {
      return res.status(400).json({ error: 'Año requerido' });
    }

    let data = [];
    let filename = '';

    if (type === 'monthly' && month) {
      // Exportar datos mensuales
      const result = await execute(`
        SELECT
          c.name as "Iglesia",
          c.city as "Ciudad",
          c.pastor as "Pastor",
          c.pastor_grado as "Grado",
          c.pastor_posicion as "Posición",
          c.pastor_cedula as "Cédula",
          r.diezmos as "Diezmos (Gs.)",
          r.ofrendas as "Ofrendas (Gs.)",
          r.anexos as "Anexos (Gs.)",
          r.caballeros as "Caballeros (Gs.)",
          r.damas as "Damas (Gs.)",
          r.jovenes as "Jóvenes (Gs.)",
          r.ninos as "Niños (Gs.)",
          r.otros as "Otros (Gs.)",
          r.total_entradas as "Total Entradas (Gs.)",
          r.fondo_nacional as "Fondo Nacional (Gs.)",
          r.honorarios_pastoral as "Honorarios Pastoral (Gs.)",
          r.servicios as "Servicios (Gs.)",
          r.total_salidas as "Total Salidas (Gs.)",
          r.saldo_mes as "Saldo del Mes (Gs.)",
          r.numero_deposito as "Número Depósito",
          r.fecha_deposito as "Fecha Depósito",
          r.monto_depositado as "Monto Depositado (Gs.)",
          r.asistencia_visitas as "Asistencia Visitas",
          r.bautismos_agua as "Bautismos Agua",
          r.bautismos_espiritu as "Bautismos Espíritu Santo",
          r.observaciones as "Observaciones",
          r.estado as "Estado",
          r.created_at as "Fecha Creación"
        FROM reports r
        JOIN churches c ON r.church_id = c.id
        WHERE r.year = $1 AND r.month = $2
        ORDER BY c.name
      `, [year, month]);

      data = result.rows;
      filename = `IPU_PY_Informe_${year}_${String(month).padStart(2, '0')}.xlsx`;

    } else if (type === 'yearly') {
      // Exportar resumen anual
      const result = await execute(`
        SELECT
          c.name as "Iglesia",
          c.city as "Ciudad",
          c.pastor as "Pastor",
          SUM(r.total_entradas) as "Total Entradas Año (Gs.)",
          SUM(r.fondo_nacional) as "Total Fondo Nacional (Gs.)",
          SUM(r.diezmos) as "Total Diezmos (Gs.)",
          SUM(r.ofrendas) as "Total Ofrendas (Gs.)",
          COUNT(r.id) as "Meses Reportados",
          AVG(r.total_entradas) as "Promedio Mensual (Gs.)",
          MAX(r.created_at) as "Último Reporte"
        FROM churches c
        LEFT JOIN reports r ON c.id = r.church_id AND r.year = $1
        WHERE c.active = true
        GROUP BY c.id, c.name, c.city, c.pastor
        ORDER BY SUM(r.total_entradas) DESC NULLS LAST
      `, [year]);

      data = result.rows;
      filename = `IPU_PY_Resumen_Anual_${year}.xlsx`;

    } else if (type === 'churches') {
      // Exportar lista de iglesias
      const result = await execute(`
        SELECT
          name as "Nombre Iglesia",
          city as "Ciudad",
          pastor as "Pastor",
          pastor_grado as "Grado",
          pastor_posicion as "Posición",
          pastor_cedula as "Cédula",
          phone as "Teléfono",
          pastor_ruc as "RUC",
          active as "Activa",
          created_at as "Fecha Registro"
        FROM churches
        ORDER BY name
      `);

      data = result.rows;
      filename = `IPU_PY_Lista_Iglesias_${year}.xlsx`;

    } else {
      return res.status(400).json({ error: 'Tipo de exportación no válido o mes requerido para exportación mensual' });
    }

    if (data.length === 0) {
      return res.status(404).json({ error: 'No se encontraron datos para exportar' });
    }

    // Crear workbook de Excel
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);

    // Configurar ancho de columnas automático
    const colWidths = [];
    const maxWidth = 50;
    const minWidth = 10;

    // Calcular ancho basado en el contenido
    if (data.length > 0) {
      Object.keys(data[0]).forEach((key, index) => {
        const values = data.map(row => String(row[key] || ''));
        const maxLength = Math.max(
          key.length,
          ...values.map(val => val.length)
        );
        colWidths[index] = {
          wch: Math.min(Math.max(maxLength + 2, minWidth), maxWidth)
        };
      });
      ws['!cols'] = colWidths;
    }

    // Agregar hoja al libro
    const sheetName = type === 'monthly' ? `${month}_${year}` :
      type === 'yearly' ? `Resumen_${year}` :
        'Iglesias';

    xlsx.utils.book_append_sheet(wb, ws, sheetName);

    // Agregar metadata
    wb.Props = {
      Title: `IPU Paraguay - ${type === 'monthly' ? 'Informe Mensual' : type === 'yearly' ? 'Resumen Anual' : 'Lista de Iglesias'}`,
      Subject: 'Sistema de Tesorería IPU PY',
      Author: 'Sistema Tesorería IPU PY',
      CreatedDate: new Date()
    };

    // Generar buffer
    const buffer = xlsx.write(wb, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true
    });

    // Configurar headers de respuesta
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Length', buffer.length);

    // Enviar archivo
    res.send(buffer);

  } catch (error) {
    console.error('Error en export:', error);
    throw error;
  }
}

// === IMPORT HELPER FUNCTIONS ===
async function importReports(data, year, month, overwrite) {
  if (!year || !month) {
    throw new Error('Año y mes son requeridos para importar informes');
  }

  const results = {
    imported: 0,
    skipped: 0,
    errors: [],
    details: []
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    try {
      // Buscar iglesia por nombre (flexible)
      const churchName = row['Iglesia'] || row['Church'] || row['Nombre'] || row['Name'];
      if (!churchName) {
        results.errors.push(`Fila ${i + 1}: Nombre de iglesia requerido`);
        continue;
      }

      const churchResult = await execute(
        'SELECT id FROM churches WHERE LOWER(name) LIKE LOWER($1) AND active = true',
        [`%${churchName.trim()}%`]
      );

      if (churchResult.rows.length === 0) {
        results.errors.push(`Fila ${i + 1}: Iglesia "${churchName}" no encontrada`);
        continue;
      }

      const churchId = churchResult.rows[0].id;

      // Verificar si ya existe un informe
      const existingReport = await execute(
        'SELECT id FROM reports WHERE church_id = $1 AND month = $2 AND year = $3',
        [churchId, month, year]
      );

      if (existingReport.rows.length > 0 && !overwrite) {
        results.skipped++;
        results.details.push(`Iglesia "${churchName}": Ya existe un informe para ${month}/${year}`);
        continue;
      }

      // Extraer datos financieros (manejo flexible de nombres de columnas)
      const diezmos = parseFloat(row['Diezmos'] || row['Diezmos (Gs.)'] || 0);
      const ofrendas = parseFloat(row['Ofrendas'] || row['Ofrendas (Gs.)'] || 0);
      const anexos = parseFloat(row['Anexos'] || row['Anexos (Gs.)'] || 0);
      const caballeros = parseFloat(row['Caballeros'] || row['Caballeros (Gs.)'] || 0);
      const damas = parseFloat(row['Damas'] || row['Damas (Gs.)'] || 0);
      const jovenes = parseFloat(row['Jóvenes'] || row['Jovenes'] || row['Jóvenes (Gs.)'] || 0);
      const ninos = parseFloat(row['Niños'] || row['Ninos'] || row['Niños (Gs.)'] || 0);
      const otros = parseFloat(row['Otros'] || row['Otros (Gs.)'] || 0);

      // Calcular totales
      const totalEntradas = diezmos + ofrendas + anexos + caballeros + damas + jovenes + ninos + otros;
      const fondoNacional = totalEntradas * 0.1;

      const honorariosPastoral = parseFloat(row['Honorarios Pastoral'] || row['Honorarios Pastoral (Gs.)'] || 0);
      const servicios = parseFloat(row['Servicios'] || row['Servicios (Gs.)'] || 0);
      const totalSalidas = honorariosPastoral + fondoNacional + servicios;
      const saldoMes = totalEntradas - totalSalidas;

      // Datos adicionales
      const numeroDeposito = row['Número Depósito'] || row['Numero Deposito'] || '';
      const fechaDeposito = row['Fecha Depósito'] || row['Fecha Deposito'] || null;
      const asistenciaVisitas = parseInt(row['Asistencia Visitas'] || 0);
      const bautismosAgua = parseInt(row['Bautismos Agua'] || 0);
      const bautismosEspiritu = parseInt(row['Bautismos Espíritu Santo'] || row['Bautismos Espiritu'] || 0);
      const observaciones = row['Observaciones'] || '';

      if (existingReport.rows.length > 0 && overwrite) {
        // Actualizar informe existente
        await execute(`
          UPDATE reports SET
            diezmos = $1, ofrendas = $2, anexos = $3, caballeros = $4, damas = $5,
            jovenes = $6, ninos = $7, otros = $8, total_entradas = $9, fondo_nacional = $10,
            honorarios_pastoral = $11, servicios = $12, total_salidas = $13, saldo_mes = $14,
            numero_deposito = $15, fecha_deposito = $16, monto_depositado = $17,
            asistencia_visitas = $18, bautismos_agua = $19, bautismos_espiritu = $20,
            observaciones = $21, updated_at = CURRENT_TIMESTAMP
          WHERE church_id = $22 AND month = $23 AND year = $24
        `, [
          diezmos, ofrendas, anexos, caballeros, damas, jovenes, ninos, otros,
          totalEntradas, fondoNacional, honorariosPastoral, servicios, totalSalidas, saldoMes,
          numeroDeposito, fechaDeposito, fondoNacional, asistenciaVisitas, bautismosAgua,
          bautismosEspiritu, observaciones, churchId, month, year
        ]);
      } else {
        // Crear nuevo informe
        await execute(`
          INSERT INTO reports (
            church_id, month, year, diezmos, ofrendas, anexos, caballeros, damas,
            jovenes, ninos, otros, total_entradas, fondo_nacional, honorarios_pastoral,
            servicios, total_salidas, saldo_mes, numero_deposito, fecha_deposito,
            monto_depositado, asistencia_visitas, bautismos_agua, bautismos_espiritu,
            observaciones, estado
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
            $18, $19, $20, $21, $22, $23, $24, 'importado'
          )
        `, [
          churchId, month, year, diezmos, ofrendas, anexos, caballeros, damas,
          jovenes, ninos, otros, totalEntradas, fondoNacional, honorariosPastoral,
          servicios, totalSalidas, saldoMes, numeroDeposito, fechaDeposito,
          fondoNacional, asistenciaVisitas, bautismosAgua, bautismosEspiritu, observaciones
        ]);
      }

      results.imported++;
      results.details.push(`Iglesia "${churchName}": Informe ${overwrite && existingReport.rows.length > 0 ? 'actualizado' : 'importado'} exitosamente`);

    } catch (error) {
      results.errors.push(`Fila ${i + 1}: ${error.message}`);
    }
  }

  return {
    message: 'Importación de informes completada',
    ...results,
    totalProcessed: data.length
  };
}

async function importChurches(data, overwrite) {
  const results = {
    imported: 0,
    skipped: 0,
    errors: [],
    details: []
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    try {
      const name = row['Nombre Iglesia'] || row['Iglesia'] || row['Name'] || row['Church'];
      const city = row['Ciudad'] || row['City'];
      const pastor = row['Pastor'];

      if (!name || !city || !pastor) {
        results.errors.push(`Fila ${i + 1}: Nombre, ciudad y pastor son requeridos`);
        continue;
      }

      // Verificar si ya existe
      const existingChurch = await execute(
        'SELECT id FROM churches WHERE LOWER(name) = LOWER($1)',
        [name.trim()]
      );

      if (existingChurch.rows.length > 0 && !overwrite) {
        results.skipped++;
        results.details.push(`Iglesia "${name}": Ya existe`);
        continue;
      }

      const phone = row['Teléfono'] || row['Phone'] || '';
      const ruc = row['RUC'] || '';
      const cedula = row['Cédula'] || row['Cedula'] || '';
      const grado = row['Grado'] || '';
      const posicion = row['Posición'] || row['Posicion'] || '';

      if (existingChurch.rows.length > 0 && overwrite) {
        // Actualizar iglesia existente
        await execute(`
          UPDATE churches SET
            city = $1, pastor = $2, phone = $3, pastor_ruc = $4, pastor_cedula = $5,
            pastor_grado = $6, pastor_posicion = $7, updated_at = CURRENT_TIMESTAMP
          WHERE LOWER(name) = LOWER($8)
        `, [city, pastor, phone, ruc, cedula, grado, posicion, name]);
      } else {
        // Crear nueva iglesia
        await execute(`
          INSERT INTO churches (name, city, pastor, phone, pastor_ruc, pastor_cedula, pastor_grado, pastor_posicion)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [name, city, pastor, phone, ruc, cedula, grado, posicion]);
      }

      results.imported++;
      results.details.push(`Iglesia "${name}": ${overwrite && existingChurch.rows.length > 0 ? 'Actualizada' : 'Importada'} exitosamente`);

    } catch (error) {
      results.errors.push(`Fila ${i + 1}: ${error.message}`);
    }
  }

  return {
    message: 'Importación de iglesias completada',
    ...results,
    totalProcessed: data.length
  };
}

// Configuración para Vercel
module.exports.config = {
  api: {
    bodyParser: false
  }
};