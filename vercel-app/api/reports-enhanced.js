const { execute, initDatabase } = require('../lib/db-turso');
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
    // Inicializar base de datos si es necesario
    if (process.env.VERCEL) {
      await initDatabase();
    }

    const decoded = verifyToken(req);

    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, decoded);
      case 'POST':
        return await handleGenerateReport(req, res, decoded);
      default:
        return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en reports-enhanced:', error);
    if (error.name === 'JsonWebTokenError' || error.message.includes('Token')) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET - Obtener informes según los 3 formatos markdown
async function handleGet(req, res, decoded) {
  try {
    const { type, church_id, month, year } = req.query;

    // Validar permisos
    if (decoded.role === 'church' && decoded.church_id !== parseInt(church_id)) {
      return res.status(403).json({ error: 'Sin permisos para esta iglesia' });
    }

    switch (type) {
      case 'resumen-financiero':
        return await getResumenFinanciero(req, res, church_id, month, year);
      case 'resumen-entradas':
        return await getResumenEntradas(req, res, church_id, month, year);
      case 'resumen-salidas':
        return await getResumenSalidas(req, res, church_id, month, year);
      case 'registro-culto':
        return await getRegistroCulto(req, res, church_id, req.query.fecha);
      default:
        return res.status(400).json({ error: 'Tipo de informe no válido' });
    }
  } catch (error) {
    console.error('Error obteniendo informe:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// RESUMEN FINANCIERO - Basado en "RESUMEN FINANCIERO Mensual.md"
async function getResumenFinanciero(req, res, church_id, month, year) {
  try {
    // Obtener información de la iglesia
    const churchResult = await execute(
      'SELECT * FROM churches WHERE id = ?',
      [church_id]
    );
    const church = churchResult.rows[0];

    if (!church) {
      return res.status(404).json({ error: 'Iglesia no encontrada' });
    }

    // Obtener informe mensual
    const reportResult = await execute(`
      SELECT * FROM reports
      WHERE church_id = ? AND month = ? AND year = ?
    `, [church_id, month, year]);

    const report = reportResult.rows[0] || {};

    // Calcular totales automáticamente si no existen
    const totalEntradas = (report.diezmos || 0) + (report.ofrendas || 0) +
                         (report.anexos || 0) + (report.caballeros || 0) +
                         (report.damas || 0) + (report.jovenes || 0) +
                         (report.ninos || 0) + (report.otros || 0);

    const fondoNacional = totalEntradas * 0.10; // 10% automático

    const totalSalidas = (report.honorarios_pastoral || 0) + fondoNacional +
                        (report.energia_electrica || 0) + (report.agua || 0) +
                        (report.recoleccion_basura || 0) + (report.otros_gastos || 0);

    const totalFondoNacional = (report.ofrenda_misiones || 0) + (report.lazos_amor || 0) +
                              (report.mision_posible || 0) + (report.aporte_caballeros || 0) +
                              (report.apy || 0) + (report.instituto_biblico || 0) +
                              (report.diezmo_pastoral || 0);

    const saldoFinMes = (report.saldo_mes_anterior || 0) + totalEntradas - totalSalidas;

    const resumenFinanciero = {
      // Datos Generales
      iglesia: church.name,
      mes_ano: `${month}/${year}`,

      // ENTRADAS DEL MES
      entradas: {
        diezmos: report.diezmos || 0,
        ofrendas: report.ofrendas || 0,
        anexos: report.anexos || 0,
        caballeros: report.caballeros || 0,
        damas: report.damas || 0,
        jovenes: report.jovenes || 0,
        ninos: report.ninos || 0,
        otros: report.otros || 0,
        total: totalEntradas
      },

      // SALIDAS DEL MES
      salidas: {
        honorarios_pastoral: report.honorarios_pastoral || 0,
        honorarios_factura_info: {
          numero: report.honorarios_factura_numero || '',
          ruc_pastor: report.honorarios_ruc_pastor || church.pastor_ruc || ''
        },
        fondo_nacional_10_porciento: fondoNacional,
        energia_electrica: report.energia_electrica || 0,
        agua: report.agua || 0,
        recoleccion_basura: report.recoleccion_basura || 0,
        otros_gastos: report.otros_gastos || 0,
        total: totalSalidas
      },

      // OFRENDAS DIRECTAS – FONDO NACIONAL
      ofrendas_directas_fondo_nacional: {
        ofrenda_misiones: report.ofrenda_misiones || 0,
        lazos_amor: report.lazos_amor || 0,
        mision_posible: report.mision_posible || 0,
        aporte_caballeros: report.aporte_caballeros || 0,
        apy: report.apy || 0,
        instituto_biblico: report.instituto_biblico || 0,
        diezmo_pastoral: report.diezmo_pastoral || 0,
        total: totalFondoNacional
      },

      // EXISTENCIA EN CAJA – FIN DE MES
      existencia_caja: {
        saldo_mes_anterior: report.saldo_mes_anterior || 0,
        entrada_iglesia_local: totalEntradas,
        total_entrada_mensual: (report.saldo_mes_anterior || 0) + totalEntradas,
        total_salidas_mes: totalSalidas,
        saldo_fin_mes: saldoFinMes
      },

      // BOLETA DE DEPÓSITO
      deposito: {
        fecha_depositada: report.fecha_deposito || null,
        numero_boleta: report.numero_deposito || '',
        monto_depositado: report.monto_depositado || 0
      },

      // ASISTENCIAS Y BAUTISMOS
      asistencias_bautismos: {
        asistencia_visitas: report.asistencia_visitas || 0,
        bautismos_agua: report.bautismos_agua || 0,
        bautismos_espiritu: report.bautismos_espiritu || 0
      },

      observaciones: report.observaciones || '',

      // INFORMACIÓN ADICIONAL
      church_info: {
        pastor: church.pastor,
        grado: church.pastor_grado,
        posicion: church.pastor_posicion,
        ruc_ipu: process.env.RUC_IPUPY || '80017726-6'
      }
    };

    return res.json(resumenFinanciero);

  } catch (error) {
    console.error('Error generando resumen financiero:', error);
    throw error;
  }
}

// RESUMEN DE ENTRADAS - Basado en "RESUMEN DE ENTRADAS Mensual.md"
async function getResumenEntradas(req, res, church_id, month, year) {
  try {
    // Obtener información de la iglesia
    const churchResult = await execute(
      'SELECT * FROM churches WHERE id = ?',
      [church_id]
    );
    const church = churchResult.rows[0];

    // Obtener registros de culto del mes
    const worshipRecordsResult = await execute(`
      SELECT wr.*,
             COUNT(wc.id) as total_contributions,
             SUM(wc.total) as total_contributions_amount
      FROM worship_records wr
      LEFT JOIN worship_contributions wc ON wr.id = wc.worship_record_id
      WHERE wr.church_id = ?
        AND strftime('%m', wr.fecha_culto) = ?
        AND strftime('%Y', wr.fecha_culto) = ?
      GROUP BY wr.id
      ORDER BY wr.fecha_culto
    `, [church_id, month.toString().padStart(2, '0'), year.toString()]);

    // Obtener contribuciones detalladas
    const contributionsResult = await execute(`
      SELECT wc.*, wr.fecha_culto, wr.tipo_culto
      FROM worship_contributions wc
      JOIN worship_records wr ON wc.worship_record_id = wr.id
      WHERE wr.church_id = ?
        AND strftime('%m', wr.fecha_culto) = ?
        AND strftime('%Y', wr.fecha_culto) = ?
      ORDER BY wr.fecha_culto, wc.numero_fila
    `, [church_id, month.toString().padStart(2, '0'), year.toString()]);

    const resumenEntradas = {
      iglesia: church?.name || '',
      mes_ano: `${month}/${year}`,
      ruc_ipu: process.env.RUC_IPUPY || '80017726-6',

      // Resumen por cultos
      cultos: worshipRecordsResult.rows.map(record => ({
        fecha: record.fecha_culto,
        tipo_culto: record.tipo_culto,
        total_diezmos: record.total_diezmos,
        total_ofrendas: record.total_ofrendas,
        total_misiones: record.total_misiones,
        total_otros: record.total_otros,
        ofrenda_general: record.ofrenda_general_anonima,
        total_recaudado: record.total_recaudado,
        total_contributions: record.total_contributions
      })),

      // Detalle de contribuciones individuales
      contribuciones_detalle: contributionsResult.rows.map((contrib, index) => ({
        numero: index + 1,
        fecha_culto: contrib.fecha_culto,
        fecha_recibo: contrib.fecha_culto, // Usar fecha del culto como referencia
        numero_recibo: contrib.numero_recibo,
        ruc_ci: contrib.ci_ruc,
        aportante: contrib.nombre_aportante,
        concepto: this.getConceptoFromContribution(contrib),
        total: contrib.total
      })),

      // Totales del mes
      totales: {
        total_diezmos: worshipRecordsResult.rows.reduce((sum, r) => sum + (r.total_diezmos || 0), 0),
        total_ofrendas: worshipRecordsResult.rows.reduce((sum, r) => sum + (r.total_ofrendas || 0), 0),
        total_misiones: worshipRecordsResult.rows.reduce((sum, r) => sum + (r.total_misiones || 0), 0),
        total_otros: worshipRecordsResult.rows.reduce((sum, r) => sum + (r.total_otros || 0), 0),
        total_general: worshipRecordsResult.rows.reduce((sum, r) => sum + (r.total_recaudado || 0), 0)
      },

      church_info: {
        pastor: church?.pastor || '',
        city: church?.city || ''
      }
    };

    return res.json(resumenEntradas);

  } catch (error) {
    console.error('Error generando resumen de entradas:', error);
    throw error;
  }
}

// RESUMEN DE SALIDAS - Basado en "RESUMEN DE SALIDAS Mensual.md"
async function getResumenSalidas(req, res, church_id, month, year) {
  try {
    // Obtener información de la iglesia
    const churchResult = await execute(
      'SELECT * FROM churches WHERE id = ?',
      [church_id]
    );
    const church = churchResult.rows[0];

    // Obtener gastos detallados del mes
    const expensesResult = await execute(`
      SELECT er.*
      FROM expense_records er
      WHERE er.church_id = ?
        AND strftime('%m', er.fecha_comprobante) = ?
        AND strftime('%Y', er.fecha_comprobante) = ?
      ORDER BY er.fecha_comprobante
    `, [church_id, month.toString().padStart(2, '0'), year.toString()]);

    const resumenSalidas = {
      iglesia: church?.name || '',
      mes_ano: `${month}/${year}`,
      ruc_ipu: process.env.RUC_IPUPY || '80017726-6',

      // Detalle de salidas
      salidas_detalle: expensesResult.rows.map((expense, index) => ({
        numero: index + 1,
        fecha_comprobante: expense.fecha_comprobante,
        numero_comprobante: expense.numero_comprobante,
        ruc_ci_proveedor: expense.ruc_ci_proveedor,
        proveedor: expense.proveedor,
        tipo_salida: expense.tipo_salida,
        concepto: expense.concepto,

        // Desglose fiscal
        monto_exenta: expense.monto_exenta,
        monto_gravada_10: expense.monto_gravada_10,
        iva_10: expense.iva_10,
        monto_gravada_5: expense.monto_gravada_5,
        iva_5: expense.iva_5,
        total_factura: expense.total_factura,

        // Indicadores
        es_factura_legal: expense.es_factura_legal,
        es_honorario_pastoral: expense.es_honorario_pastoral
      })),

      // Totales por categoría
      totales_por_categoria: {
        honorarios_pastorales: expensesResult.rows
          .filter(e => e.es_honorario_pastoral)
          .reduce((sum, e) => sum + (e.total_factura || 0), 0),

        servicios_publicos: expensesResult.rows
          .filter(e => ['Energía Eléctrica', 'Agua', 'Recolección Basura'].includes(e.tipo_salida))
          .reduce((sum, e) => sum + (e.total_factura || 0), 0),

        gastos_operativos: expensesResult.rows
          .filter(e => e.tipo_salida === 'Gastos Operativos')
          .reduce((sum, e) => sum + (e.total_factura || 0), 0),

        otros: expensesResult.rows
          .filter(e => !e.es_honorario_pastoral &&
                      !['Energía Eléctrica', 'Agua', 'Recolección Basura', 'Gastos Operativos'].includes(e.tipo_salida))
          .reduce((sum, e) => sum + (e.total_factura || 0), 0)
      },

      // Totales fiscales
      totales_fiscales: {
        total_exenta: expensesResult.rows.reduce((sum, e) => sum + (e.monto_exenta || 0), 0),
        total_gravada_10: expensesResult.rows.reduce((sum, e) => sum + (e.monto_gravada_10 || 0), 0),
        total_iva_10: expensesResult.rows.reduce((sum, e) => sum + (e.iva_10 || 0), 0),
        total_gravada_5: expensesResult.rows.reduce((sum, e) => sum + (e.monto_gravada_5 || 0), 0),
        total_iva_5: expensesResult.rows.reduce((sum, e) => sum + (e.iva_5 || 0), 0),
        total_general: expensesResult.rows.reduce((sum, e) => sum + (e.total_factura || 0), 0)
      },

      // Validaciones de compliance
      validaciones: {
        honorarios_con_factura_legal: expensesResult.rows
          .filter(e => e.es_honorario_pastoral && e.es_factura_legal).length,
        total_honorarios_pastorales: expensesResult.rows
          .filter(e => e.es_honorario_pastoral).length,
        facturas_sin_ruc: expensesResult.rows
          .filter(e => !e.ruc_ci_proveedor || e.ruc_ci_proveedor.trim() === '').length
      },

      church_info: {
        pastor: church?.pastor || '',
        city: church?.city || ''
      }
    };

    return res.json(resumenSalidas);

  } catch (error) {
    console.error('Error generando resumen de salidas:', error);
    throw error;
  }
}

// Función auxiliar para obtener concepto de contribución
function getConceptoFromContribution(contrib) {
  const conceptos = [];
  if (contrib.diezmo > 0) conceptos.push('Diezmo');
  if (contrib.ofrenda > 0) conceptos.push('Ofrenda');
  if (contrib.misiones > 0) conceptos.push('Misiones');
  if (contrib.otros > 0) conceptos.push(contrib.otros_concepto || 'Otros');
  return conceptos.join(', ') || 'No especificado';
}

// POST - Generar informe automáticamente
async function handleGenerateReport(req, res, decoded) {
  try {
    const { church_id, month, year, auto_calculate = true } = req.body;

    // Validar permisos
    if (decoded.role === 'church' && decoded.church_id !== parseInt(church_id)) {
      return res.status(403).json({ error: 'Sin permisos para esta iglesia' });
    }

    if (auto_calculate) {
      // Generar informe automáticamente basado en registros de culto y gastos
      const result = await generateAutoReport(church_id, month, year);
      return res.json({
        message: 'Informe generado automáticamente',
        report: result
      });
    } else {
      return res.status(400).json({ error: 'Generación manual no implementada' });
    }

  } catch (error) {
    console.error('Error generando informe:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Función para generar informe automático
async function generateAutoReport(church_id, month, year) {
  // Obtener totales de cultos del mes
  const worshipTotals = await execute(`
    SELECT
      SUM(total_diezmos) as total_diezmos,
      SUM(total_ofrendas) as total_ofrendas,
      SUM(total_misiones) as total_misiones,
      SUM(total_otros) as total_otros,
      SUM(total_recaudado) as total_recaudado,
      SUM(bautismos_agua) as total_bautismos_agua,
      SUM(bautismos_espiritu) as total_bautismos_espiritu,
      AVG(visitas) as promedio_visitas
    FROM worship_records
    WHERE church_id = ?
      AND strftime('%m', fecha_culto) = ?
      AND strftime('%Y', fecha_culto) = ?
  `, [church_id, month.toString().padStart(2, '0'), year.toString()]);

  const worship = worshipTotals.rows[0] || {};

  // Obtener totales de gastos del mes
  const expenseTotals = await execute(`
    SELECT
      SUM(CASE WHEN es_honorario_pastoral = 1 THEN total_factura ELSE 0 END) as honorarios_pastoral,
      SUM(CASE WHEN tipo_salida = 'Energía Eléctrica' THEN total_factura ELSE 0 END) as energia_electrica,
      SUM(CASE WHEN tipo_salida = 'Agua' THEN total_factura ELSE 0 END) as agua,
      SUM(CASE WHEN tipo_salida = 'Recolección Basura' THEN total_factura ELSE 0 END) as recoleccion_basura,
      SUM(CASE WHEN tipo_salida = 'Gastos Operativos' THEN total_factura ELSE 0 END) as otros_gastos,
      SUM(total_factura) as total_salidas
    FROM expense_records
    WHERE church_id = ?
      AND strftime('%m', fecha_comprobante) = ?
      AND strftime('%Y', fecha_comprobante) = ?
  `, [church_id, month.toString().padStart(2, '0'), year.toString()]);

  const expenses = expenseTotals.rows[0] || {};

  // Calcular valores automáticos
  const totalEntradas = (worship.total_recaudado || 0);
  const fondoNacional = totalEntradas * 0.10;

  // Crear o actualizar el informe
  const reportData = {
    church_id,
    month,
    year,
    diezmos: worship.total_diezmos || 0,
    ofrendas: worship.total_ofrendas || 0,
    total_entradas: totalEntradas,
    honorarios_pastoral: expenses.honorarios_pastoral || 0,
    fondo_nacional: fondoNacional,
    energia_electrica: expenses.energia_electrica || 0,
    agua: expenses.agua || 0,
    recoleccion_basura: expenses.recoleccion_basura || 0,
    otros_gastos: expenses.otros_gastos || 0,
    total_salidas: (expenses.total_salidas || 0) + fondoNacional,
    bautismos_agua: worship.total_bautismos_agua || 0,
    bautismos_espiritu: worship.total_bautismos_espiritu || 0,
    asistencia_visitas: Math.round(worship.promedio_visitas || 0)
  };

  // Insertar o actualizar en la base de datos
  await execute(`
    INSERT OR REPLACE INTO reports (
      church_id, month, year, diezmos, ofrendas, total_entradas,
      honorarios_pastoral, fondo_nacional, energia_electrica, agua,
      recoleccion_basura, otros_gastos, total_salidas,
      bautismos_agua, bautismos_espiritu, asistencia_visitas,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              COALESCE((SELECT created_at FROM reports WHERE church_id = ? AND month = ? AND year = ?), CURRENT_TIMESTAMP),
              CURRENT_TIMESTAMP)
  `, [
    church_id, month, year, reportData.diezmos, reportData.ofrendas, reportData.total_entradas,
    reportData.honorarios_pastoral, reportData.fondo_nacional, reportData.energia_electrica, reportData.agua,
    reportData.recoleccion_basura, reportData.otros_gastos, reportData.total_salidas,
    reportData.bautismos_agua, reportData.bautismos_espiritu, reportData.asistencia_visitas,
    church_id, month, year
  ]);

  return reportData;
}