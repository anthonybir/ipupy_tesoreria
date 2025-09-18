const { execute } = require('../lib/db-turso');
const jwt = require('jsonwebtoken');

// Utilidades para cálculos de IVA
const calculateIVA = (monto, rate) => {
  return parseFloat((monto * rate).toFixed(2));
};

const calculateTotalWithIVA = (montoExenta, montoGravada10, montoGravada5) => {
  const iva10 = calculateIVA(montoGravada10, 0.10);
  const iva5 = calculateIVA(montoGravada5, 0.05);
  return {
    iva_10: iva10,
    iva_5: iva5,
    total_factura: montoExenta + montoGravada10 + iva10 + montoGravada5 + iva5
  };
};

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
      case 'PUT':
        return await handlePut(req, res, decoded);
      case 'DELETE':
        return await handleDelete(req, res, decoded);
      default:
        return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en expense-records:', error);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// GET - Obtener registros de gastos/salidas
async function handleGet(req, res, decoded) {
  try {
    const {
      church_id,
      report_id,
      fecha_inicio,
      fecha_fin,
      tipo_salida,
      proveedor,
      page = 1,
      limit = 50
    } = req.query;

    let sql = `
      SELECT er.*,
             c.name as church_name,
             c.pastor,
             r.month,
             r.year
      FROM expense_records er
      JOIN churches c ON er.church_id = c.id
      LEFT JOIN reports r ON er.report_id = r.id
      WHERE 1=1
    `;
    const params = [];

    // Filtros
    if (church_id) {
      sql += ` AND er.church_id = ?`;
      params.push(church_id);
    } else if (decoded.role === 'church' && decoded.church_id) {
      sql += ` AND er.church_id = ?`;
      params.push(decoded.church_id);
    }

    if (report_id) {
      sql += ` AND er.report_id = ?`;
      params.push(report_id);
    }

    if (fecha_inicio) {
      sql += ` AND er.fecha_comprobante >= ?`;
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      sql += ` AND er.fecha_comprobante <= ?`;
      params.push(fecha_fin);
    }

    if (tipo_salida) {
      sql += ` AND er.tipo_salida = ?`;
      params.push(tipo_salida);
    }

    if (proveedor) {
      sql += ` AND er.proveedor LIKE ?`;
      params.push(`%${proveedor}%`);
    }

    sql += ` ORDER BY er.fecha_comprobante DESC, er.created_at DESC`;

    // Paginación
    const offset = (page - 1) * limit;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const result = await execute(sql, params);

    // Obtener total de registros para paginación
    let countSql = `
      SELECT COUNT(*) as total
      FROM expense_records er
      WHERE 1=1
    `;
    const countParams = [];

    if (church_id) {
      countSql += ` AND er.church_id = ?`;
      countParams.push(church_id);
    } else if (decoded.role === 'church' && decoded.church_id) {
      countSql += ` AND er.church_id = ?`;
      countParams.push(decoded.church_id);
    }

    if (report_id) {
      countSql += ` AND er.report_id = ?`;
      countParams.push(report_id);
    }

    if (fecha_inicio) {
      countSql += ` AND er.fecha_comprobante >= ?`;
      countParams.push(fecha_inicio);
    }

    if (fecha_fin) {
      countSql += ` AND er.fecha_comprobante <= ?`;
      countParams.push(fecha_fin);
    }

    if (tipo_salida) {
      countSql += ` AND er.tipo_salida = ?`;
      countParams.push(tipo_salida);
    }

    if (proveedor) {
      countSql += ` AND er.proveedor LIKE ?`;
      countParams.push(`%${proveedor}%`);
    }

    const countResult = await execute(countSql, countParams);
    const total = countResult.rows[0]?.total || 0;

    return res.json({
      expenses: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error obteniendo registros de gastos:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST - Crear nuevo registro de gasto
async function handlePost(req, res, decoded) {
  try {
    const {
      church_id,
      report_id = null,
      fecha_comprobante,
      numero_comprobante = '',
      ruc_ci_proveedor = '',
      proveedor,
      concepto,
      tipo_salida = 'Gastos Operativos',
      monto_exenta = 0,
      monto_gravada_10 = 0,
      monto_gravada_5 = 0,
      es_factura_legal = false,
      es_honorario_pastoral = false,
      observaciones = ''
    } = req.body;

    // Validar permisos
    if (decoded.role === 'church' && decoded.church_id !== parseInt(church_id)) {
      return res.status(403).json({ error: 'Sin permisos para esta iglesia' });
    }

    // Validaciones básicas
    if (!proveedor || !concepto || !fecha_comprobante) {
      return res.status(400).json({
        error: 'Proveedor, concepto y fecha son requeridos'
      });
    }

    // Calcular IVA y total
    const calculations = calculateTotalWithIVA(
      parseFloat(monto_exenta),
      parseFloat(monto_gravada_10),
      parseFloat(monto_gravada_5)
    );

    // Validaciones especiales para honorarios pastorales
    if (es_honorario_pastoral) {
      if (!es_factura_legal) {
        return res.status(400).json({
          error: 'Honorarios pastorales requieren factura legal con IVA 10%'
        });
      }
      if (!ruc_ci_proveedor) {
        return res.status(400).json({
          error: 'RUC del pastor es requerido para honorarios pastorales'
        });
      }
      if (monto_gravada_10 <= 0) {
        return res.status(400).json({
          error: 'Honorarios pastorales deben tener monto gravado 10%'
        });
      }
    }

    // Insertar registro
    const result = await execute(`
      INSERT INTO expense_records (
        church_id, report_id, fecha_comprobante, numero_comprobante,
        ruc_ci_proveedor, proveedor, concepto, tipo_salida,
        monto_exenta, monto_gravada_10, iva_10, monto_gravada_5, iva_5,
        total_factura, es_factura_legal, es_honorario_pastoral, observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      church_id, report_id, fecha_comprobante, numero_comprobante,
      ruc_ci_proveedor, proveedor, concepto, tipo_salida,
      monto_exenta, monto_gravada_10, calculations.iva_10,
      monto_gravada_5, calculations.iva_5, calculations.total_factura,
      es_factura_legal, es_honorario_pastoral, observaciones
    ]);

    return res.status(201).json({
      message: 'Registro de gasto creado exitosamente',
      expenseId: result.lastInsertRowid,
      calculations: {
        iva_10: calculations.iva_10,
        iva_5: calculations.iva_5,
        total_factura: calculations.total_factura
      }
    });

  } catch (error) {
    console.error('Error creando registro de gasto:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PUT - Actualizar registro de gasto
async function handlePut(req, res, decoded) {
  try {
    const expenseId = req.query.id;
    if (!expenseId) {
      return res.status(400).json({ error: 'ID de gasto requerido' });
    }

    // Verificar que el registro existe y permisos
    const existingExpense = await execute(
      'SELECT church_id FROM expense_records WHERE id = ?',
      [expenseId]
    );

    if (!existingExpense.rows[0]) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    if (decoded.role === 'church' && decoded.church_id !== existingExpense.rows[0].church_id) {
      return res.status(403).json({ error: 'Sin permisos para este registro' });
    }

    const {
      fecha_comprobante,
      numero_comprobante = '',
      ruc_ci_proveedor = '',
      proveedor,
      concepto,
      tipo_salida = 'Gastos Operativos',
      monto_exenta = 0,
      monto_gravada_10 = 0,
      monto_gravada_5 = 0,
      es_factura_legal = false,
      es_honorario_pastoral = false,
      observaciones = ''
    } = req.body;

    // Calcular IVA y total
    const calculations = calculateTotalWithIVA(
      parseFloat(monto_exenta),
      parseFloat(monto_gravada_10),
      parseFloat(monto_gravada_5)
    );

    await execute(`
      UPDATE expense_records SET
        fecha_comprobante = ?, numero_comprobante = ?, ruc_ci_proveedor = ?,
        proveedor = ?, concepto = ?, tipo_salida = ?,
        monto_exenta = ?, monto_gravada_10 = ?, iva_10 = ?,
        monto_gravada_5 = ?, iva_5 = ?, total_factura = ?,
        es_factura_legal = ?, es_honorario_pastoral = ?, observaciones = ?
      WHERE id = ?
    `, [
      fecha_comprobante, numero_comprobante, ruc_ci_proveedor,
      proveedor, concepto, tipo_salida,
      monto_exenta, monto_gravada_10, calculations.iva_10,
      monto_gravada_5, calculations.iva_5, calculations.total_factura,
      es_factura_legal, es_honorario_pastoral, observaciones,
      expenseId
    ]);

    return res.json({
      message: 'Registro actualizado exitosamente',
      calculations: {
        iva_10: calculations.iva_10,
        iva_5: calculations.iva_5,
        total_factura: calculations.total_factura
      }
    });

  } catch (error) {
    console.error('Error actualizando registro de gasto:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// DELETE - Eliminar registro de gasto
async function handleDelete(req, res, decoded) {
  try {
    const expenseId = req.query.id;
    if (!expenseId) {
      return res.status(400).json({ error: 'ID de gasto requerido' });
    }

    // Verificar permisos
    const existingExpense = await execute(
      'SELECT church_id FROM expense_records WHERE id = ?',
      [expenseId]
    );

    if (!existingExpense.rows[0]) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    if (decoded.role === 'church' && decoded.church_id !== existingExpense.rows[0].church_id) {
      return res.status(403).json({ error: 'Sin permisos para este registro' });
    }

    const result = await execute('DELETE FROM expense_records WHERE id = ?', [expenseId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    return res.json({ message: 'Registro eliminado exitosamente' });

  } catch (error) {
    console.error('Error eliminando registro de gasto:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}