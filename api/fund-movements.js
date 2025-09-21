const { execute } = require('../lib/db');
const { setSecureCORSHeaders } = require('../src/lib/cors-handler');

module.exports = async function handler(req, res) {
  // Configure secure CORS (no wildcards)
  const isPreflightHandled = setSecureCORSHeaders(req, res, ['POST']);

  if (isPreflightHandled) {
    return; // Preflight request handled securely
  }

  try {
    const { fund_id, church_id, start_date, end_date } = req.query || {};

    // Build query based on filters
    let query = `
      SELECT
        fm.*,
        c.name as church_name,
        f.name as fund_name
      FROM fund_movements fm
      LEFT JOIN churches c ON fm.church_id = c.id
      LEFT JOIN funds f ON fm.fund_id = f.id
      WHERE 1=1
    `;
    const params = [];

    if (fund_id) {
      params.push(fund_id);
      query += ` AND fm.fund_id = $${params.length}`;
    }

    if (church_id) {
      params.push(church_id);
      query += ` AND fm.church_id = $${params.length}`;
    }

    if (start_date) {
      params.push(start_date);
      query += ` AND fm.movement_date >= $${params.length}`;
    }

    if (end_date) {
      params.push(end_date);
      query += ` AND fm.movement_date <= $${params.length}`;
    }

    query += ' ORDER BY fm.movement_date DESC';

    // Check if the fund_movements table exists
    const tableCheck = await execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'fund_movements'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      // Return empty data if table doesn't exist
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Fund movements table not yet initialized'
      });
    }

    const result = await execute(query, params);

    return res.status(200).json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });

  } catch (error) {
    console.error('Fund movements error:', error);
    return res.status(500).json({
      error: 'Error loading fund movements',
      details: error.message
    });
  }
};