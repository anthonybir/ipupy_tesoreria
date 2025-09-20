/**
 * Individual Member API Endpoint
 * Handles GET, PUT, DELETE operations for specific members
 */

const db = require('../../lib/db');

module.exports = async function handler(req, res) {
  const { method, query } = req;
  const { id } = query;

  if (!id) {
    return res.status(400).json({ error: 'ID de miembro requerido' });
  }

  try {
    switch (method) {
    case 'GET':
      await handleGetMember(req, res, id);
      break;
    case 'PUT':
      await handleUpdateMember(req, res, id);
      break;
    case 'DELETE':
      await handleDeleteMember(req, res, id);
      break;
    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('Member API error:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}

async function handleGetMember(req, res, id) {
  // Get member with complete information
  const memberQuery = `
    SELECT
      m.*,
      f.apellido_familia,
      f.direccion_principal as familia_direccion,
      f.telefono_principal as familia_telefono,
      c.name as church_name,
      c.city as church_city,
      c.pastor as church_pastor
    FROM members m
    LEFT JOIN families f ON m.family_id = f.id
    LEFT JOIN churches c ON m.church_id = c.id
    WHERE m.id = $1
  `;

  const memberResult = await db.query(memberQuery, [id]);

  if (memberResult.rows.length === 0) {
    return res.status(404).json({ error: 'Miembro no encontrado' });
  }

  const member = memberResult.rows[0];

  // Get member's ministries
  const ministriesResult = await db.query(`
    SELECT
      mn.id,
      mn.nombre,
      mn.descripcion,
      mm.rol,
      mm.fecha_inicio,
      mm.fecha_fin,
      mm.es_activo,
      fc.name as fund_name
    FROM member_ministries mm
    JOIN ministries mn ON mm.ministry_id = mn.id
    LEFT JOIN fund_categories fc ON mn.fund_category_id = fc.id
    WHERE mm.member_id = $1
    ORDER BY mm.es_activo DESC, mm.fecha_inicio DESC
  `, [id]);

  member.ministerios = ministriesResult.rows;

  // Get family members (if part of a family)
  if (member.family_id) {
    const familyMembersResult = await db.query(`
      SELECT
        id,
        nombre,
        apellido,
        parentesco_jefe,
        es_jefe_familia,
        es_activo,
        fecha_nacimiento,
        sexo
      FROM members
      WHERE family_id = $1 AND id != $2
      ORDER BY es_jefe_familia DESC, fecha_nacimiento ASC
    `, [member.family_id, id]);

    member.familia_miembros = familyMembersResult.rows;
  }

  // Get attendance statistics
  const attendanceStatsResult = await db.query(`
    SELECT
      COUNT(*) as total_servicios,
      SUM(CASE WHEN ma.presente = 1 THEN 1 ELSE 0 END) as servicios_asistidos,
      MAX(wr.fecha_culto) as ultima_asistencia,
      AVG(CASE WHEN ma.presente = 1 THEN 1.0 ELSE 0.0 END) * 100 as porcentaje_asistencia
    FROM worship_records wr
    LEFT JOIN member_attendance ma ON wr.id = ma.worship_record_id AND ma.member_id = $1
    WHERE wr.church_id = $2 AND wr.fecha_culto >= CURRENT_DATE - INTERVAL '6 months'
  `, [id, member.church_id]);

  member.estadisticas_asistencia = attendanceStatsResult.rows[0];

  // Get contribution history (last 6 months)
  const contributionsResult = await db.query(`
    SELECT
      mc.monto,
      mc.tipo_contribucion,
      mc.fecha_contribucion,
      fc.name as fund_name,
      wr.tipo_culto
    FROM member_contributions mc
    LEFT JOIN fund_categories fc ON mc.fund_category_id = fc.id
    LEFT JOIN worship_records wr ON mc.worship_record_id = wr.id
    WHERE mc.member_id = $1 AND mc.fecha_contribucion >= CURRENT_DATE - INTERVAL '6 months'
    ORDER BY mc.fecha_contribucion DESC
    LIMIT 20
  `, [id]);

  member.contribuciones_recientes = contributionsResult.rows;

  res.status(200).json({
    success: true,
    data: member
  });
}

async function handleUpdateMember(req, res, id) {
  const updateData = req.body;

  // Check if member exists
  const existsResult = await db.query('SELECT id FROM members WHERE id = $1', [id]);
  if (existsResult.rows.length === 0) {
    return res.status(404).json({ error: 'Miembro no encontrado' });
  }

  // Build update query dynamically
  const allowedFields = [
    'family_id', 'nombre', 'apellido', 'ci_ruc', 'fecha_nacimiento',
    'telefono', 'email', 'direccion', 'estado_civil', 'profesion', 'sexo',
    'fecha_bautismo_agua', 'fecha_bautismo_espiritu', 'fecha_membresia',
    'es_miembro_activo', 'tipo_membresia', 'grado_ministerial', 'posicion_ministerial',
    'dones_espirituales', 'es_jefe_familia', 'parentesco_jefe',
    'contacto_emergencia_nombre', 'contacto_emergencia_telefono', 'contacto_emergencia_relacion',
    'observaciones', 'notas_pastorales', 'foto_perfil'
  ];

  const updateFields = [];
  const updateParams = [];

  let paramIndex = 1;
  for (const [key, value] of Object.entries(updateData)) {
    if (allowedFields.includes(key)) {
      updateFields.push(`${key} = $${paramIndex++}`);
      updateParams.push(key === 'dones_espirituales' ? JSON.stringify(value) : value);
    }
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
  }

  // Add updated_at field
  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateParams.push(id);

  const updateQuery = `
    UPDATE members
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
  `;

  await db.query(updateQuery, updateParams);

  // If es_jefe_familia was updated, handle family head changes
  if (updateData.es_jefe_familia !== undefined && updateData.family_id) {
    if (updateData.es_jefe_familia) {
      // Set this member as head of family
      await db.query(
        'UPDATE families SET jefe_familia_id = $1 WHERE id = $2',
        [id, updateData.family_id]
      );
      // Remove jefe_familia flag from other family members
      await db.query(
        'UPDATE members SET es_jefe_familia = 0 WHERE family_id = $1 AND id != $2',
        [updateData.family_id, id]
      );
    } else {
      // If removing jefe_familia flag, clear family head
      await db.query(
        'UPDATE families SET jefe_familia_id = NULL WHERE id = $1 AND jefe_familia_id = $2',
        [updateData.family_id, id]
      );
    }
  }

  // Get updated member data
  const updatedMember = await db.query(`
    SELECT
      m.*,
      f.apellido_familia,
      c.name as church_name
    FROM members m
    LEFT JOIN families f ON m.family_id = f.id
    LEFT JOIN churches c ON m.church_id = c.id
    WHERE m.id = $1
  `, [id]);

  res.status(200).json({
    success: true,
    message: 'Miembro actualizado exitosamente',
    data: updatedMember.rows[0]
  });
}

async function handleDeleteMember(req, res, id) {
  // Check if member exists
  const memberResult = await db.query('SELECT * FROM members WHERE id = $1', [id]);
  if (memberResult.rows.length === 0) {
    return res.status(404).json({ error: 'Miembro no encontrado' });
  }

  // Check for dependencies
  const dependencies = [];

  // Check ministry leadership
  const ministryLeaderResult = await db.query('SELECT id FROM ministries WHERE lider_id = $1', [id]);
  if (ministryLeaderResult.rows.length > 0) {
    dependencies.push('Es líder de uno o más ministerios');
  }

  // Check family head
  const familyHeadResult = await db.query('SELECT id FROM families WHERE jefe_familia_id = $1', [id]);
  if (familyHeadResult.rows.length > 0) {
    dependencies.push('Es jefe de familia');
  }

  // Check event responsibilities
  const eventResponsibleResult = await db.query('SELECT id FROM church_events WHERE responsable_id = $1', [id]);
  if (eventResponsibleResult.rows.length > 0) {
    dependencies.push('Es responsable de eventos');
  }

  if (dependencies.length > 0) {
    return res.status(400).json({
      error: 'No se puede eliminar el miembro',
      reason: 'El miembro tiene dependencias que deben resolverse primero',
      dependencies
    });
  }

  // Soft delete (mark as inactive) instead of hard delete
  await db.query('UPDATE members SET es_activo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

  res.status(200).json({
    success: true,
    message: 'Miembro marcado como inactivo exitosamente'
  });
}