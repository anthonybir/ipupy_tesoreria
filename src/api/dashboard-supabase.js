/**
 * API: Dashboard Statistics (Supabase)
 * ABSD Treasury System - IPU PY
 */

const { execute } = require('../lib/db');
const { setCORSHeaders, handlePreflight } = require('../lib/cors');

module.exports = async (req, res) => {
  // Use secure CORS configuration instead of wildcard
  setCORSHeaders(req, res);

  if (handlePreflight(req, res)) {
    return;
  }

  try {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();

    const [churchesResult, movementsResult, fundsResult, recentResult] = await Promise.all([
      execute('SELECT COUNT(*) AS count FROM churches WHERE active = true'),
      execute(`
        SELECT
          COUNT(*) AS total_movimientos,
          SUM(CASE WHEN tipo_movimiento = 'entrada' THEN monto ELSE 0 END) AS total_ingresos,
          SUM(CASE WHEN tipo_movimiento = 'salida' THEN monto ELSE 0 END) AS total_egresos
        FROM fund_movements
        WHERE TO_CHAR(fecha_movimiento, 'YYYY') = $1
      `, [String(currentYear)]),
      execute(`
        SELECT
          fc.name AS fund_name,
          SUM(CASE WHEN fm.tipo_movimiento = 'entrada' THEN fm.monto ELSE 0 END) AS ingresos,
          SUM(CASE WHEN fm.tipo_movimiento = 'salida' THEN fm.monto ELSE 0 END) AS egresos
        FROM fund_categories fc
        LEFT JOIN fund_movements fm ON fc.id = fm.fund_category_id
          AND TO_CHAR(fm.fecha_movimiento, 'YYYY') = $1
        WHERE fc.is_active = true
        GROUP BY fc.id, fc.name
        ORDER BY ingresos DESC
        LIMIT 5
      `, [String(currentYear)]),
      execute(`
        SELECT
          fm.fecha_movimiento,
          fm.concepto,
          fm.monto,
          fm.tipo_movimiento,
          fc.name AS fund_name,
          c.name AS church_name
        FROM fund_movements fm
        JOIN fund_categories fc ON fm.fund_category_id = fc.id
        LEFT JOIN churches c ON fm.church_id = c.id
        ORDER BY fm.fecha_movimiento DESC
        LIMIT 10
      `)
    ]);

    const movementRow = movementsResult.rows?.[0] || {};
    const totalIngresos = Number(movementRow.total_ingresos) || 0;
    const totalEgresos = Number(movementRow.total_egresos) || 0;

    const dashboard = {
      stats: {
        total_churches: Number(churchesResult.rows?.[0]?.count || 0),
        total_movimientos: Number(movementRow.total_movimientos) || 0,
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        saldo_total: totalIngresos - totalEgresos,
        fondo_nacional: totalIngresos * 0.1
      },
      top_funds: (fundsResult.rows || []).map((row) => {
        const ingresos = Number(row.ingresos) || 0;
        const egresos = Number(row.egresos) || 0;
        return {
          name: row.fund_name,
          ingresos,
          egresos,
          saldo: ingresos - egresos
        };
      }),
      recent_movements: (recentResult.rows || []).map((row) => ({
        fecha: row.fecha_movimiento,
        concepto: row.concepto,
        monto: Number(row.monto) || 0,
        tipo: row.tipo_movimiento,
        fund: row.fund_name,
        church: row.church_name
      })),
      period: {
        month: currentMonth,
        year: currentYear
      }
    };

    res.status(200).json({
      success: true,
      data: dashboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
