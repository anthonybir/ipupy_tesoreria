const { query, initDatabase } = require('../lib/db');

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Inicializar base de datos si es necesario
    if (process.env.VERCEL) {
      await initDatabase();
    }

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Obtener datos del dashboard
    const [
      totalChurchesResult,
      monthReportsResult,
      monthTotalResult,
      nationalFundResult,
      yearlyTotalResult,
      recentReportsResult
    ] = await Promise.all([
      query("SELECT COUNT(*) as count FROM churches WHERE active = true"),
      query("SELECT COUNT(*) as count FROM reports WHERE month = $1 AND year = $2", [currentMonth, currentYear]),
      query("SELECT COALESCE(SUM(total_entradas), 0) as total FROM reports WHERE month = $1 AND year = $2", [currentMonth, currentYear]),
      query("SELECT COALESCE(SUM(fondo_nacional), 0) as total FROM reports WHERE month = $1 AND year = $2", [currentMonth, currentYear]),
      query("SELECT COALESCE(SUM(total_entradas), 0) as total FROM reports WHERE year = $1", [currentYear]),
      query(`
        SELECT r.*, c.name as church_name, c.city, c.pastor
        FROM reports r
        JOIN churches c ON r.church_id = c.id
        WHERE r.year = $1 AND r.month = $2
        ORDER BY r.created_at DESC
        LIMIT 10
      `, [currentYear, currentMonth])
    ]);

    // Calcular estadísticas por mes para el año actual
    const monthlyStatsResult = await query(`
      SELECT
        month,
        COUNT(*) as iglesias_reportadas,
        SUM(total_entradas) as total_entradas,
        SUM(fondo_nacional) as fondo_nacional,
        SUM(diezmos) as total_diezmos,
        SUM(ofrendas) as total_ofrendas
      FROM reports
      WHERE year = $1
      GROUP BY month
      ORDER BY month
    `, [currentYear]);

    // Top 5 iglesias por entradas del mes actual
    const topChurchesResult = await query(`
      SELECT
        c.name as church_name,
        c.city,
        r.total_entradas,
        r.fondo_nacional
      FROM reports r
      JOIN churches c ON r.church_id = c.id
      WHERE r.month = $1 AND r.year = $2
      ORDER BY r.total_entradas DESC
      LIMIT 5
    `, [currentMonth, currentYear]);

    // Iglesias pendientes de reportar este mes
    const pendingChurchesResult = await query(`
      SELECT c.name, c.city, c.pastor
      FROM churches c
      LEFT JOIN reports r ON c.id = r.church_id AND r.month = $1 AND r.year = $2
      WHERE c.active = true AND r.id IS NULL
      ORDER BY c.name
    `, [currentMonth, currentYear]);

    const result = {
      // Resumen general
      totalChurches: totalChurchesResult.rows[0]?.count || 0,
      reportedChurches: monthReportsResult.rows[0]?.count || 0,
      pendingChurches: (totalChurchesResult.rows[0]?.count || 0) - (monthReportsResult.rows[0]?.count || 0),

      // Totales financieros
      monthTotal: parseFloat(monthTotalResult.rows[0]?.total || 0),
      nationalFund: parseFloat(nationalFundResult.rows[0]?.total || 0),
      yearlyTotal: parseFloat(yearlyTotalResult.rows[0]?.total || 0),

      // Periodo actual
      currentMonth,
      currentYear,

      // Estadísticas detalladas
      monthlyStats: monthlyStatsResult.rows.map(row => ({
        month: row.month,
        iglesiasReportadas: parseInt(row.iglesias_reportadas),
        totalEntradas: parseFloat(row.total_entradas || 0),
        fondoNacional: parseFloat(row.fondo_nacional || 0),
        totalDiezmos: parseFloat(row.total_diezmos || 0),
        totalOfrendas: parseFloat(row.total_ofrendas || 0)
      })),

      // Top iglesias
      topChurches: topChurchesResult.rows.map(row => ({
        churchName: row.church_name,
        city: row.city,
        totalEntradas: parseFloat(row.total_entradas || 0),
        fondoNacional: parseFloat(row.fondo_nacional || 0)
      })),

      // Iglesias pendientes
      pendingChurches: pendingChurchesResult.rows,

      // Reportes recientes
      recentReports: recentReportsResult.rows.map(row => ({
        id: row.id,
        churchName: row.church_name,
        city: row.city,
        pastor: row.pastor,
        totalEntradas: parseFloat(row.total_entradas || 0),
        fondoNacional: parseFloat(row.fondo_nacional || 0),
        estado: row.estado,
        createdAt: row.created_at
      }))
    };

    res.json(result);

  } catch (error) {
    console.error('Error en API dashboard:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}