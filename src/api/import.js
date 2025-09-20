const { execute } = require('../lib/db');
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
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Database is initialized via migrations, not here

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
    console.error('Error en API import:', error);

    if (error.message.includes('Solo se permiten archivos Excel')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

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

module.exports.config = {
  api: {
    bodyParser: false
  }
};