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

  try {
    const familiesResult = await execute(
      `SELECT
         f.id,
         f.apellido_familia,
         f.direccion_principal,
         f.telefono_principal,
         f.jefe_familia_id,
         COALESCE(MAX(CONCAT_WS(' ', jefe.nombre, jefe.apellido)), '') AS jefe_familia_nombre,
         COUNT(m.id) AS miembros_total,
         SUM(CASE WHEN m.es_activo = true THEN 1 ELSE 0 END) AS miembros_activos
       FROM families f
       LEFT JOIN members m ON m.family_id = f.id
       LEFT JOIN members jefe ON f.jefe_familia_id = jefe.id
       GROUP BY f.id, f.apellido_familia, f.direccion_principal, f.telefono_principal, f.jefe_familia_id
       ORDER BY f.apellido_familia NULLS LAST, f.id`
    );

    const families = (familiesResult.rows || []).map((row) => ({
      id: row.id,
      apellido_familia: row.apellido_familia,
      direccion_principal: row.direccion_principal,
      telefono_principal: row.telefono_principal,
      jefe_familia_id: row.jefe_familia_id,
      jefe_familia_nombre: row.jefe_familia_nombre || null,
      miembros_total: Number(row.miembros_total || 0),
      miembros_activos: Number(row.miembros_activos || 0)
    }));

    return res.json({
      success: true,
      data: families,
      count: families.length
    });
  } catch (error) {
    console.error('Error en API families:', error);
    return res.status(500).json({
      success: false,
      error: 'No se pudieron obtener las familias',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
