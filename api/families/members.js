const { execute } = require('../../lib/db');
const { setCORSHeaders, handlePreflight } = require('../../lib/cors');

module.exports = async function handler(req, res) {
  setCORSHeaders(req, res);

  if (handlePreflight(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const familyId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(familyId) || familyId <= 0) {
    return res.status(400).json({ error: 'ID de familia inválido' });
  }

  try {
    const familyResult = await execute(
      `SELECT id, apellido_familia, direccion_principal, telefono_principal, jefe_familia_id
       FROM families
       WHERE id = $1`,
      [familyId]
    );

    if (familyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Familia no encontrada' });
    }

    const membersResult = await execute(
      `SELECT
         id,
         nombre,
         apellido,
         ci_ruc,
         fecha_nacimiento,
         telefono,
         email,
         es_activo,
         es_jefe_familia,
         parentesco_jefe,
         sexo,
         grado_ministerial,
         tipo_membresia
       FROM members
       WHERE family_id = $1
       ORDER BY es_jefe_familia DESC, apellido, nombre`,
      [familyId]
    );

    const members = membersResult.rows || [];
    const activeMembers = members.filter((member) => member.es_activo).length;

    return res.json({
      success: true,
      data: members,
      family: {
        ...familyResult.rows[0],
        miembros_total: members.length,
        miembros_activos: activeMembers
      }
    });
  } catch (error) {
    console.error('Error en API families/members:', error);
    return res.status(500).json({
      success: false,
      error: 'No se pudieron obtener los miembros de la familia',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
