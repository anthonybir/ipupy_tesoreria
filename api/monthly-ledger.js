const { execute, createConnection } = require('../lib/db');
const jwt = require('jsonwebtoken');
const { setCORSHeaders, handlePreflight } = require('../lib/cors');

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

const parseInteger = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseRequiredChurchId = (value) => {
  const parsed = parseInteger(value);
  if (parsed === null || parsed <= 0) {
    throw new BadRequestError('church_id es requerido y debe ser válido');
  }
  return parsed;
};

const parseRequiredMonth = (value) => {
  const parsed = parseInteger(value);
  if (parsed === null || parsed < 1 || parsed > 12) {
    throw new BadRequestError('month debe estar entre 1 y 12');
  }
  return parsed;
};

const parseRequiredYear = (value) => {
  const parsed = parseInteger(value);
  if (parsed === null || parsed < 2020 || parsed > 2030) {
    throw new BadRequestError('year debe ser un año válido');
  }
  return parsed;
};

// Verify JWT token
const verifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    console.warn('Invalid token:', error.message);
    return null;
  }
};

const getDecodedChurchId = (decoded) => {
  if (!decoded) {
    return null;
  }
  const raw = decoded.churchId ?? decoded.church_id;
  if (raw === undefined || raw === null) {
    return null;
  }
  const parsed = parseInteger(raw);
  return parsed === null ? null : parsed;
};

const enforceChurchAccess = (decoded, churchId) => {
  const normalizedChurchId = parseRequiredChurchId(churchId);
  if (!decoded) {
    return normalizedChurchId;
  }

  if (decoded.role === 'church') {
    const decodedChurchId = getDecodedChurchId(decoded);
    if (!decodedChurchId) {
      throw new BadRequestError('La cuenta no tiene una iglesia asignada.');
    }
    if (decodedChurchId !== normalizedChurchId) {
      throw new BadRequestError('No tienes permiso para acceder a esta iglesia.');
    }
    return decodedChurchId;
  }

  return normalizedChurchId;
};

const buildMonthlyLedger = async (churchId, monthNum, yearNum) => {
  try {
    const calculationResult = await execute(
      'SELECT * FROM calculate_monthly_totals($1, $2, $3)',
      [churchId, monthNum, yearNum]
    );
    const calculations = calculationResult.rows[0] || {};

    const incomeResult = await execute(`
      SELECT
        wc.fund_bucket,
        COUNT(wc.id) as cantidad_contribuciones,
        SUM(wc.total) as total_monto,
        COUNT(DISTINCT wc.donor_id) as donantes_unicos
      FROM worship_contributions wc
      JOIN worship_records wr ON wc.worship_record_id = wr.id
      WHERE wr.church_id = $1
        AND EXTRACT(MONTH FROM wr.fecha_culto) = $2
        AND EXTRACT(YEAR FROM wr.fecha_culto) = $3
      GROUP BY wc.fund_bucket
      ORDER BY total_monto DESC
    `, [churchId, monthNum, yearNum]);

    const anonymousResult = await execute(`
      SELECT
        COUNT(*) as servicios_con_ofrenda,
        SUM(ofrenda_general_anonima) as total_ofrenda_anonima
      FROM worship_records
      WHERE church_id = $1
        AND EXTRACT(MONTH FROM fecha_culto) = $2
        AND EXTRACT(YEAR FROM fecha_culto) = $3
        AND ofrenda_general_anonima > 0
    `, [churchId, monthNum, yearNum]);

    const expenseResult = await execute(`
      SELECT
        er.expense_category,
        COUNT(er.id) as cantidad_gastos,
        SUM(er.total_factura) as total_monto,
        AVG(er.total_factura) as promedio_gasto,
        STRING_AGG(DISTINCT er.proveedor, ', ' ORDER BY er.proveedor) as principales_proveedores
      FROM expense_records er
      WHERE er.church_id = $1
        AND EXTRACT(MONTH FROM er.fecha_comprobante) = $2
        AND EXTRACT(YEAR FROM er.fecha_comprobante) = $3
        AND NOT er.es_honorario_pastoral
      GROUP BY er.expense_category
      ORDER BY total_monto DESC
    `, [churchId, monthNum, yearNum]);

    const reportResult = await execute(`
      SELECT
        id,
        balance_status,
        balance_delta,
        fecha_deposito,
        numero_deposito,
        monto_depositado,
        closed_at,
        closed_by,
        observaciones
      FROM reports
      WHERE church_id = $1 AND month = $2 AND year = $3
    `, [churchId, monthNum, yearNum]);

    const salaryResult = await execute(`
      SELECT
        SUM(total_factura) as total_honorarios_registrados,
        COUNT(*) as cantidad_facturas,
        STRING_AGG(numero_comprobante, ', ' ORDER BY fecha_comprobante) as numeros_facturas
      FROM expense_records
      WHERE church_id = $1
        AND EXTRACT(MONTH FROM fecha_comprobante) = $2
        AND EXTRACT(YEAR FROM fecha_comprobante) = $3
        AND es_honorario_pastoral = true
    `, [churchId, monthNum, yearNum]);

    const churchResult = await execute(
      'SELECT name, city, pastor, pastor_ruc FROM churches WHERE id = $1',
      [churchId]
    );

    if (churchResult.rows.length === 0) {
      throw new NotFoundError('Iglesia no encontrada');
    }

    const church = churchResult.rows[0];
    const reportStatus = reportResult.rows[0] || null;
    const salaryInfo = salaryResult.rows[0] || {};
    const anonymousInfo = anonymousResult.rows[0] || {};

    const totalEntradas = parseFloat(calculations.total_entradas || 0);
    // New calculation fields from migration 014
    const fondoNacional10 = parseFloat(calculations.fondo_nacional_10_percent || 0);
    const fondoNacional100 = parseFloat(calculations.fondo_nacional_100_percent || 0);
    const fondoNacionalTotal = parseFloat(calculations.fondo_nacional_total || 0);
    const disponibleLocal90 = parseFloat(calculations.disponible_local_90_percent || 0);
    const disponibleLocalOtros = parseFloat(calculations.disponible_local_otros || 0);
    const disponibleLocalTotal = parseFloat(calculations.disponible_local_total || 0);
    const totalGastos = parseFloat(calculations.total_gastos || 0);
    const salarioPastoralCalculado = parseFloat(calculations.salario_pastoral_calculado || 0);
    const balanceCalculado = parseFloat(calculations.balance_calculado || 0);
    const honorariosRegistrados = parseFloat(salaryInfo.total_honorarios_registrados || 0);

    let balanceStatus = 'abierto';
    let balanceMessage = '';
    let canClose = false;

    if (totalEntradas === 0) {
      balanceStatus = 'sin_entradas';
      balanceMessage = 'No hay entradas registradas para este mes';
    } else if (Math.abs(balanceCalculado) < 1) {
      if (honorariosRegistrados === salarioPastoralCalculado) {
        balanceStatus = 'balanceado';
        balanceMessage = 'Mes balanceado correctamente';
        canClose = true;
      } else if (honorariosRegistrados === 0) {
        balanceStatus = 'pendiente_factura_pastoral';
        balanceMessage = `Pendiente factura pastoral por Gs. ${salarioPastoralCalculado.toLocaleString()}`;
      } else {
        balanceStatus = 'discrepancia_honorarios';
        balanceMessage = `Discrepancia en honorarios: calculado Gs. ${salarioPastoralCalculado.toLocaleString()}, registrado Gs. ${honorariosRegistrados.toLocaleString()}`;
      }
    } else if (balanceCalculado < -1) {
      balanceStatus = 'deficit';
      balanceMessage = `Déficit de Gs. ${Math.abs(balanceCalculado).toLocaleString()}`;
    } else {
      balanceStatus = 'superavit';
      balanceMessage = `Superávit de Gs. ${balanceCalculado.toLocaleString()}`;
    }

    return {
      iglesia: {
        id: churchId,
        nombre: church.name,
        ciudad: church.city,
        pastor: church.pastor,
        pastor_ruc: church.pastor_ruc
      },
      periodo: {
        mes: monthNum,
        año: yearNum,
        descripcion: `${getMonthName(monthNum)} ${yearNum}`
      },
      entradas: {
        detalle_por_tipo: incomeResult.rows.map(row => ({
          tipo: row.fund_bucket,
          cantidad_contribuciones: parseInt(row.cantidad_contribuciones),
          total_monto: parseFloat(row.total_monto),
          donantes_unicos: parseInt(row.donantes_unicos)
        })),
        ofrenda_anonima: {
          servicios_con_ofrenda: parseInt(anonymousInfo.servicios_con_ofrenda || 0),
          total_monto: parseFloat(anonymousInfo.total_ofrenda_anonima || 0)
        },
        totales: {
          diezmos: parseFloat(calculations.total_diezmos || 0),
          ofrendas: parseFloat(calculations.total_ofrendas || 0),
          misiones: parseFloat(calculations.total_misiones || 0),
          otros: parseFloat(calculations.total_otros || 0),
          total_entradas: totalEntradas
        }
      },
      distribucion_automatica: {
        // Detailed national fund breakdown
        fondo_nacional_10_percent: fondoNacional10,
        fondo_nacional_100_percent: fondoNacional100,
        fondo_nacional_total: fondoNacionalTotal,
        // Local funds breakdown
        disponible_local_90_percent: disponibleLocal90,
        disponible_local_otros: disponibleLocalOtros,
        disponible_local_total: disponibleLocalTotal,
        porcentaje_fondo_nacional: totalEntradas > 0 ? (fondoNacionalTotal / totalEntradas * 100).toFixed(1) : 0
      },
      gastos: {
        detalle_por_categoria: expenseResult.rows.map(row => ({
          categoria: row.expense_category,
          cantidad_gastos: parseInt(row.cantidad_gastos),
          total_monto: parseFloat(row.total_monto),
          promedio_gasto: parseFloat(row.promedio_gasto),
          principales_proveedores: row.principales_proveedores
        })),
        totales: {
          servicios_basicos: parseFloat(calculations.total_gastos_servicios || 0),
          otros_gastos: parseFloat(calculations.total_gastos_otros || 0),
          total_gastos: totalGastos
        }
      },
      salario_pastoral: {
        calculado_automatico: salarioPastoralCalculado,
        registrado_en_facturas: honorariosRegistrados,
        diferencia: salarioPastoralCalculado - honorariosRegistrados,
        facturas_emitidas: salaryInfo.cantidad_facturas ? parseInt(salaryInfo.cantidad_facturas) : 0,
        numeros_facturas: salaryInfo.numeros_facturas || null
      },
      balance: {
        saldo_calculado: balanceCalculado,
        status: balanceStatus,
        mensaje: balanceMessage,
        puede_cerrar: canClose,
        requiere_accion: !canClose && totalEntradas > 0
      },
      reporte_oficial: reportStatus ? {
        id: reportStatus.id,
        balance_status: reportStatus.balance_status,
        balance_delta: parseFloat(reportStatus.balance_delta || 0),
        fecha_deposito: reportStatus.fecha_deposito,
        numero_deposito: reportStatus.numero_deposito,
        monto_depositado: parseFloat(reportStatus.monto_depositado || 0),
        closed_at: reportStatus.closed_at,
        closed_by: reportStatus.closed_by,
        observaciones: reportStatus.observaciones
      } : null
    };
  } catch (error) {
    console.error('Error building monthly ledger:', error);
    throw error;
  }
};

// Get comprehensive monthly ledger with real-time calculations
const getMonthlyLedger = async (req, res, decoded) => {
  const { church_id, month, year } = req.query;

  const churchId = enforceChurchAccess(decoded, church_id);
  const monthNum = parseRequiredMonth(month);
  const yearNum = parseRequiredYear(year);

  try {
    const ledger = await buildMonthlyLedger(churchId, monthNum, yearNum);
    return res.json(ledger);
  } catch (error) {
    console.error('Error getting monthly ledger:', error);
    throw error;
  }
};

// Close monthly period with validation
const closeMonthlyPeriod = async (req, res, decoded) => {
  const { church_id, month, year, force_close = false } = req.body;

  const churchId = enforceChurchAccess(decoded, church_id);
  const monthNum = parseRequiredMonth(month);
  const yearNum = parseRequiredYear(year);
  const shouldForceClose = force_close === true || force_close === 'true';

  try {
    const ledger = await buildMonthlyLedger(churchId, monthNum, yearNum);

    if (!shouldForceClose && !ledger.balance.puede_cerrar) {
      return res.status(400).json({
        error: 'No se puede cerrar el mes',
        razon: ledger.balance.mensaje,
        balance_status: ledger.balance.status,
        sugerencias: generateClosureSuggestions(ledger)
      });
    }

    const pool = createConnection();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        'SELECT id FROM reports WHERE church_id = $1 AND month = $2 AND year = $3 FOR UPDATE',
        [churchId, monthNum, yearNum]
      );

      const balanceDelta = ledger.balance.saldo_calculado;
      const closureStatus = determineClosureStatus(ledger, shouldForceClose);
      const closureTimestamp = new Date().toISOString();
      const closedBy = decoded.email || decoded.userId || 'sistema';

      let reportId;

      if (existingResult.rows.length > 0) {
        const updateResult = await client.query(`
          UPDATE reports SET
            balance_status = $4,
            balance_delta = $5,
            closed_at = $6,
            closed_by = $7,
            diezmos = $8,
            ofrendas = $9,
            total_entradas = $10,
            fondo_nacional = $11,
            honorarios_pastoral = $12,
            total_salidas = $13,
            saldo_fin_mes = $14,
            updated_at = NOW()
          WHERE church_id = $1 AND month = $2 AND year = $3
          RETURNING id
        `, [
          churchId,
          monthNum,
          yearNum,
          closureStatus,
          balanceDelta,
          closureTimestamp,
          closedBy,
          ledger.entradas.totales.diezmos,
          ledger.entradas.totales.ofrendas,
          ledger.entradas.totales.total_entradas,
          ledger.distribucion_automatica.fondo_nacional_total,
          ledger.salario_pastoral.registrado_en_facturas,
          ledger.gastos.totales.total_gastos + ledger.salario_pastoral.registrado_en_facturas,
          balanceDelta
        ]);
        reportId = updateResult.rows[0].id;
      } else {
        const insertResult = await client.query(`
          INSERT INTO reports (
            church_id, month, year,
            balance_status, balance_delta, closed_at, closed_by,
            diezmos, ofrendas, total_entradas, fondo_nacional,
            honorarios_pastoral, total_salidas, saldo_fin_mes
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
          ) RETURNING id
        `, [
          churchId,
          monthNum,
          yearNum,
          closureStatus,
          balanceDelta,
          closureTimestamp,
          closedBy,
          ledger.entradas.totales.diezmos,
          ledger.entradas.totales.ofrendas,
          ledger.entradas.totales.total_entradas,
          ledger.distribucion_automatica.fondo_nacional_total,
          ledger.salario_pastoral.registrado_en_facturas,
          ledger.gastos.totales.total_gastos + ledger.salario_pastoral.registrado_en_facturas,
          balanceDelta
        ]);
        reportId = insertResult.rows[0].id;
      }

      // Generate individual transactions for each national fund
      if (ledger.distribucion_automatica.fondo_nacional_total > 0) {
        // Transaction 1: General Fund (10% of tithes and offerings)
        if (ledger.distribucion_automatica.fondo_nacional_10_percent > 0) {
          // Get fund info and current balance
          const fundResult = await client.query(
            'SELECT id, current_balance FROM funds WHERE name = $1',
            ['General']
          );

          if (fundResult.rows.length > 0) {
            const fundId = fundResult.rows[0].id;
            const previousBalance = parseFloat(fundResult.rows[0].current_balance || 0);
            const amount = ledger.distribucion_automatica.fondo_nacional_10_percent;
            const newBalance = previousBalance + amount;

            // Insert transaction
            const txResult = await client.query(`
              INSERT INTO transactions (
                date, church_id, report_id, fund_id,
                concept, amount_in, balance, created_by
              ) VALUES (
                CURRENT_DATE, $1, $2, $3,
                $4, $5, $6, 'system'
              ) RETURNING id
            `, [
              churchId,
              reportId,
              fundId,
              `10% Diezmos/Ofrendas - ${ledger.iglesia.nombre} - ${getMonthName(monthNum)} ${yearNum}`,
              amount,
              newBalance
            ]);

            // Update fund balance
            await client.query(
              'UPDATE funds SET current_balance = $1, updated_at = NOW() WHERE id = $2',
              [newBalance, fundId]
            );

            // Record fund movement
            await client.query(`
              INSERT INTO fund_movements_enhanced (
                fund_id, transaction_id, previous_balance, movement, new_balance
              ) VALUES ($1, $2, $3, $4, $5)
            `, [
              fundId,
              txResult.rows[0].id,
              previousBalance,
              amount,
              newBalance
            ]);
          }
        }

        // Get detailed fund contributions for 100% allocations
        const fundDetails = await client.query(`
          SELECT
            CASE
              WHEN wc.fund_bucket = 'misiones' THEN 'Misiones'
              WHEN wc.fund_bucket = 'apy' THEN 'APY'
              WHEN wc.fund_bucket = 'lazos_amor' THEN 'Lazos de Amor'
              WHEN wc.fund_bucket = 'mision_posible' THEN 'Mision Posible'
              WHEN wc.fund_bucket = 'instituto_biblico' THEN 'IBA'
              WHEN wc.fund_bucket = 'diezmo_pastoral' THEN 'General'
              WHEN wc.fund_bucket = 'caballeros' THEN 'Caballeros'
            END as fund_name,
            SUM(wc.total) as total_amount
          FROM worship_contributions wc
          JOIN worship_records wr ON wc.worship_record_id = wr.id
          WHERE wr.church_id = $1
            AND EXTRACT(MONTH FROM wr.fecha_culto) = $2
            AND EXTRACT(YEAR FROM wr.fecha_culto) = $3
            AND wc.fund_bucket IN ('misiones', 'apy', 'lazos_amor', 'mision_posible',
                                   'instituto_biblico', 'diezmo_pastoral', 'caballeros')
          GROUP BY wc.fund_bucket
          HAVING SUM(wc.total) > 0
        `, [churchId, monthNum, yearNum]);

        // Create individual transactions for each special fund
        for (const fundRow of fundDetails.rows) {
          if (fundRow.fund_name && fundRow.total_amount > 0) {
            // Get fund info and current balance
            const fundResult = await client.query(
              'SELECT id, current_balance FROM funds WHERE name = $1',
              [fundRow.fund_name]
            );

            if (fundResult.rows.length > 0) {
              const fundId = fundResult.rows[0].id;
              const previousBalance = parseFloat(fundResult.rows[0].current_balance || 0);
              const amount = parseFloat(fundRow.total_amount);
              const newBalance = previousBalance + amount;

              // Insert transaction
              const txResult = await client.query(`
                INSERT INTO transactions (
                  date, church_id, report_id, fund_id,
                  concept, amount_in, balance, created_by
                ) VALUES (
                  CURRENT_DATE, $1, $2, $3,
                  $4, $5, $6, 'system'
                ) RETURNING id
              `, [
                churchId,
                reportId,
                fundId,
                `Ofrenda ${fundRow.fund_name} - ${ledger.iglesia.nombre} - ${getMonthName(monthNum)} ${yearNum}`,
                amount,
                newBalance
              ]);

              // Update fund balance
              await client.query(
                'UPDATE funds SET current_balance = $1, updated_at = NOW() WHERE id = $2',
                [newBalance, fundId]
              );

              // Record fund movement
              await client.query(`
                INSERT INTO fund_movements_enhanced (
                  fund_id, transaction_id, previous_balance, movement, new_balance
                ) VALUES ($1, $2, $3, $4, $5)
              `, [
                fundId,
                txResult.rows[0].id,
                previousBalance,
                amount,
                newBalance
              ]);
            }
          }
        }

        // Also maintain the legacy fund_movements record for compatibility
        await client.query(`
          INSERT INTO fund_movements (
            church_id, fund_category_id, report_id,
            tipo_movimiento, monto, concepto, fecha_movimiento
          )
          SELECT
            $1,
            fc.id,
            $2,
            'transferencia',
            $3,
            'Transferencia automática Fondo Nacional - ' || $4,
            CURRENT_DATE
          FROM fund_categories fc
          WHERE fc.name = 'Fondo Nacional'
          LIMIT 1
        `, [
          churchId,
          reportId,
          ledger.distribucion_automatica.fondo_nacional_total,
          `${getMonthName(monthNum)} ${yearNum}`
        ]);
      }

      await client.query('COMMIT');

      const refreshedLedger = await buildMonthlyLedger(churchId, monthNum, yearNum);
      return res.json({
        message: closureStatus === 'balanceado' ? 'Mes balanceado y cerrado' : 'Mes cerrado',
        report_id: reportId,
        balance_final: refreshedLedger.balance.saldo_calculado,
        fondo_nacional_transferido: refreshedLedger.distribucion_automatica.fondo_nacional_total,
        fecha_cierre: closureTimestamp,
        status: closureStatus,
        ledger: refreshedLedger
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error closing monthly period:', error);
    throw error;
  }
};

const determineClosureStatus = (ledger, forced) => {
  const delta = ledger.balance?.saldo_calculado || 0;

  if (Math.abs(delta) < 1) {
    return 'balanceado';
  }

  if (delta < 0) {
    return 'deficit';
  }

  return forced ? 'cerrado' : 'pendiente';
};

// Generate suggestions for closing the month
const generateClosureSuggestions = (ledger) => {
  const suggestions = [];

  if (ledger.entradas.totales.total_entradas === 0) {
    suggestions.push('Registrar las entradas del mes (diezmos, ofrendas, etc.)');
  }

  if (ledger.balance.status === 'pendiente_factura_pastoral') {
    suggestions.push(`Generar factura pastoral por Gs. ${ledger.salario_pastoral.calculado_automatico.toLocaleString()}`);
  }

  if (ledger.balance.status === 'discrepancia_honorarios') {
    suggestions.push('Verificar y ajustar la factura pastoral registrada');
  }

  if (ledger.balance.status === 'deficit') {
    suggestions.push('Revisar gastos o registrar entradas adicionales para cubrir el déficit');
  }

  if (ledger.balance.status === 'superavit') {
    suggestions.push('Registrar gastos adicionales o ajustar cálculos');
  }

  return suggestions;
};

// Helper function to get month name in Spanish
const getMonthName = (monthNum) => {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[monthNum - 1] || monthNum.toString();
};

module.exports = async (req, res) => {
  // Set CORS headers
  setCORSHeaders(req, res);

  // Handle preflight requests
  if (handlePreflight(req, res)) {
    return;
  }

  try {
    // Verify authentication
    const decoded = verifyToken(req);
    if (!decoded) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    // Route requests
    if (req.method === 'GET') {
      return await getMonthlyLedger(req, res, decoded);
    } else if (req.method === 'POST' && req.url.includes('/close')) {
      return await closeMonthlyPeriod(req, res, decoded);
    } else {
      return res.status(405).json({ error: 'Método no permitido' });
    }

  } catch (error) {
    console.error('Error in monthly-ledger API:', error);

    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }

    return res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};