const { execute } = require('../lib/db-turso');
const jwt = require('jsonwebtoken');

// Middleware para verificar JWT
const verifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new Error('Token no proporcionado');

  const token = authHeader.split(' ')[1];
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const decoded = verifyToken(req);

    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, decoded);
      case 'POST':
        return await handlePost(req, res, decoded);
      default:
        return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en fund-movements:', error);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// GET - Obtener movimientos de fondos y saldos
async function handleGet(req, res, decoded) {
  try {
    const {
      church_id,
      fund_id,
      tipo_movimiento,
      fecha_inicio,
      fecha_fin,
      action,
      page = 1,
      limit = 50
    } = req.query;

    // Acción especial para obtener saldos por fondo
    if (action === 'saldos') {
      return await getSaldosByFund(req, res, decoded);
    }

    let sql = `
      SELECT fm.*,
             fc.name as fund_name,
             fcd.name as fund_destino_name,
             c.name as church_name,
             c.pastor
      FROM fund_movements fm
      JOIN fund_categories fc ON fm.fund_category_id = fc.id
      LEFT JOIN fund_categories fcd ON fm.fund_destino_id = fcd.id
      JOIN churches c ON fm.church_id = c.id
      WHERE 1=1
    `;
    const params = [];

    // Filtros
    if (church_id) {
      sql += ` AND fm.church_id = ?`;
      params.push(church_id);
    } else if (decoded.role === 'church' && decoded.church_id) {
      sql += ` AND fm.church_id = ?`;
      params.push(decoded.church_id);
    }

    if (fund_id) {
      sql += ` AND fm.fund_category_id = ?`;
      params.push(fund_id);
    }

    if (tipo_movimiento) {
      sql += ` AND fm.tipo_movimiento = ?`;
      params.push(tipo_movimiento);
    }

    if (fecha_inicio) {
      sql += ` AND fm.fecha_movimiento >= ?`;
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      sql += ` AND fm.fecha_movimiento <= ?`;
      params.push(fecha_fin);
    }

    sql += ` ORDER BY fm.fecha_movimiento DESC, fm.created_at DESC`;

    // Paginación
    const offset = (page - 1) * limit;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const result = await execute(sql, params);

    return res.json({
      movements: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error obteniendo movimientos de fondos:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Función para obtener saldos por fondo
async function getSaldosByFund(req, res, decoded) {
  try {
    const { church_id, fecha_corte } = req.query;

    let churchFilter = '';
    const params = [];

    if (church_id) {
      churchFilter = 'WHERE fm.church_id = ?';
      params.push(church_id);
    } else if (decoded.role === 'church' && decoded.church_id) {
      churchFilter = 'WHERE fm.church_id = ?';
      params.push(decoded.church_id);
    }

    let fechaFilter = '';
    if (fecha_corte) {
      if (churchFilter) {
        fechaFilter = ' AND fm.fecha_movimiento <= ?';
      } else {
        fechaFilter = ' WHERE fm.fecha_movimiento <= ?';
      }
      params.push(fecha_corte);
    }

    const sql = `
      SELECT
        fc.id as fund_id,
        fc.name as fund_name,
        fc.description,
        COALESCE(SUM(
          CASE
            WHEN fm.tipo_movimiento = 'entrada' THEN fm.monto
            WHEN fm.tipo_movimiento = 'salida' THEN -fm.monto
            WHEN fm.tipo_movimiento = 'transferencia' AND fm.fund_category_id = fc.id THEN -fm.monto
            WHEN fm.tipo_movimiento = 'transferencia' AND fm.fund_destino_id = fc.id THEN fm.monto
            ELSE 0
          END
        ), 0) as saldo_actual,
        COUNT(fm.id) as total_movimientos
      FROM fund_categories fc
      LEFT JOIN fund_movements fm ON (fc.id = fm.fund_category_id OR fc.id = fm.fund_destino_id)
      ${churchFilter}${fechaFilter}
      GROUP BY fc.id, fc.name, fc.description
      ORDER BY fc.name
    `;

    const result = await execute(sql, params);

    // Obtener información adicional de la iglesia si se especifica
    let churchInfo = null;
    if (church_id || (decoded.role === 'church' && decoded.church_id)) {
      const churchId = church_id || decoded.church_id;
      const churchResult = await execute(
        'SELECT name, city, pastor FROM churches WHERE id = ?',
        [churchId]
      );
      churchInfo = churchResult.rows[0] || null;
    }

    return res.json({
      saldos: result.rows,
      church_info: churchInfo,
      fecha_corte: fecha_corte || 'actual'
    });

  } catch (error) {
    console.error('Error obteniendo saldos por fondo:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST - Crear movimiento de fondo
async function handlePost(req, res, decoded) {
  try {
    const {
      church_id,
      fund_category_id,
      fund_destino_id = null,
      report_id = null,
      worship_record_id = null,
      tipo_movimiento, // 'entrada', 'salida', 'transferencia'
      monto,
      concepto,
      fecha_movimiento
    } = req.body;

    // Validar permisos
    if (decoded.role === 'church' && decoded.church_id !== parseInt(church_id)) {
      return res.status(403).json({ error: 'Sin permisos para esta iglesia' });
    }

    // Validaciones básicas
    if (!fund_category_id || !tipo_movimiento || !monto || !fecha_movimiento) {
      return res.status(400).json({
        error: 'Fund ID, tipo de movimiento, monto y fecha son requeridos'
      });
    }

    if (parseFloat(monto) <= 0) {
      return res.status(400).json({
        error: 'El monto debe ser mayor a cero'
      });
    }

    // Validaciones específicas por tipo de movimiento
    if (tipo_movimiento === 'transferencia') {
      if (!fund_destino_id) {
        return res.status(400).json({
          error: 'Fondo destino es requerido para transferencias'
        });
      }
      if (fund_category_id === fund_destino_id) {
        return res.status(400).json({
          error: 'El fondo origen y destino no pueden ser el mismo'
        });
      }

      // Verificar que el fondo origen tenga saldo suficiente
      const saldoResult = await execute(`
        SELECT COALESCE(SUM(
          CASE
            WHEN tipo_movimiento = 'entrada' THEN monto
            WHEN tipo_movimiento = 'salida' THEN -monto
            WHEN tipo_movimiento = 'transferencia' AND fund_category_id = ? THEN -monto
            WHEN tipo_movimiento = 'transferencia' AND fund_destino_id = ? THEN monto
            ELSE 0
          END
        ), 0) as saldo
        FROM fund_movements
        WHERE church_id = ? AND (fund_category_id = ? OR fund_destino_id = ?)
      `, [fund_category_id, fund_category_id, church_id, fund_category_id, fund_category_id]);

      const saldoActual = saldoResult.rows[0]?.saldo || 0;
      if (saldoActual < parseFloat(monto)) {
        return res.status(400).json({
          error: `Saldo insuficiente. Saldo actual: ${saldoActual.toLocaleString('es-PY')} Gs.`
        });
      }
    }

    // Insertar movimiento
    const result = await execute(`
      INSERT INTO fund_movements (
        church_id, fund_category_id, fund_destino_id, report_id,
        worship_record_id, tipo_movimiento, monto, concepto, fecha_movimiento
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      church_id, fund_category_id, fund_destino_id, report_id,
      worship_record_id, tipo_movimiento, monto, concepto, fecha_movimiento
    ]);

    // Obtener información del fondo para la respuesta
    const fundResult = await execute(
      'SELECT name FROM fund_categories WHERE id = ?',
      [fund_category_id]
    );

    let fundDestinoName = null;
    if (fund_destino_id) {
      const fundDestinoResult = await execute(
        'SELECT name FROM fund_categories WHERE id = ?',
        [fund_destino_id]
      );
      fundDestinoName = fundDestinoResult.rows[0]?.name;
    }

    return res.status(201).json({
      message: 'Movimiento de fondo registrado exitosamente',
      movementId: result.lastInsertRowid,
      fund_name: fundResult.rows[0]?.name,
      fund_destino_name: fundDestinoName,
      monto: parseFloat(monto)
    });

  } catch (error) {
    console.error('Error creando movimiento de fondo:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}