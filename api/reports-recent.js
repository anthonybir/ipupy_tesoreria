const { execute } = require('../lib/db');
const { setCORSHeaders, handlePreflight } = require('../lib/cors');

module.exports = async function handler(req, res) {
  setCORSHeaders(req, res);

  if (handlePreflight(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const parsedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 25) : 10;

  try {
    const recentReports = await execute(
      `SELECT
         r.id,
         r.month,
         r.year,
         r.total_entradas,
         r.fondo_nacional,
         r.numero_deposito,
         r.estado,
         c.name AS church_name,
         c.city
       FROM reports r
       JOIN churches c ON r.church_id = c.id
       ORDER BY r.created_at DESC
       LIMIT $1`,
      [limit]
    );

    const rows = recentReports.rows || [];

    return res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Error en API reports/recent:', error);
    return res.status(500).json({
      success: false,
      error: 'No se pudieron obtener los reportes recientes',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
