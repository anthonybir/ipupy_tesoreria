const { execute } = require('../lib/db');
const jwt = require('jsonwebtoken');
const { setCORSHeaders, handlePreflight } = require('../lib/cors');

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
  }
}

class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

const isProvided = (value) => value !== undefined && value !== null && String(value).trim() !== '';

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

const parseDonorId = (value) => {
  const parsed = parseInteger(value);
  if (parsed === null || parsed <= 0) {
    throw new BadRequestError('ID de donante inválido');
  }
  return parsed;
};

const getDecodedChurchId = (decoded) => {
  if (!decoded) {
    return null;
  }
  const raw = decoded.churchId ?? decoded.church_id;
  if (raw === null || raw === undefined) {
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
      throw new ForbiddenError('La cuenta de iglesia no tiene una iglesia asociada.');
    }
    if (decodedChurchId !== normalizedChurchId) {
      throw new ForbiddenError('No tienes permiso para acceder a esta iglesia.');
    }
    return decodedChurchId;
  }

  return normalizedChurchId;
};

const ensureDonorVisibility = (decoded, donorRow) => {
  if (!donorRow) {
    return;
  }
  if (decoded?.role === 'church') {
    const decodedChurchId = getDecodedChurchId(decoded);
    if (!decodedChurchId || decodedChurchId !== donorRow.church_id) {
      throw new ForbiddenError('No tienes permiso para ver este donante.');
    }
  }
};

// Verify JWT token and extract user info
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

// Validate donor data
const validateDonorData = (data) => {
  const errors = [];

  if (!isProvided(data.nombre_completo)) {
    errors.push('Nombre completo es requerido');
  }

  if (!isProvided(data.ci_ruc)) {
    errors.push('CI o RUC es requerido');
  }

  if (!isProvided(data.church_id)) {
    errors.push('ID de iglesia es requerido');
  }

  if (data.tipo_donante && !['regular', 'visitante', 'itinerante'].includes(data.tipo_donante)) {
    errors.push('Tipo de donante debe ser: regular, visitante, o itinerante');
  }

  if (errors.length > 0) {
    throw new BadRequestError(errors.join('; '));
  }

  return {
    church_id: parseRequiredChurchId(data.church_id),
    nombre_completo: data.nombre_completo.trim(),
    ci_ruc: data.ci_ruc.trim().toUpperCase(),
    telefono: data.telefono ? data.telefono.trim() : null,
    email: data.email ? data.email.trim().toLowerCase() : null,
    direccion: data.direccion ? data.direccion.trim() : null,
    tipo_donante: data.tipo_donante || 'regular',
    observaciones: data.observaciones ? data.observaciones.trim() : null,
    activo: data.activo !== undefined ? Boolean(data.activo) : true
  };
};

// Search donors with autocomplete
const searchDonors = async (req, res, decoded) => {
  const { query, church_id, limit = 10 } = req.query;

  if (!query || query.trim().length < 2) {
    return res.json({ donors: [] });
  }

  const churchId = enforceChurchAccess(decoded, church_id);
  const searchLimit = Math.min(parseInt(limit) || 10, 50);

  try {
    const searchQuery = `
      SELECT
        d.id,
        d.nombre_completo,
        d.ci_ruc,
        d.telefono,
        d.email,
        d.tipo_donante,
        d.fecha_primera_contribucion,
        d.activo,
        -- Calculate recent activity
        COUNT(wc.id) FILTER (WHERE wr.fecha_culto >= CURRENT_DATE - INTERVAL '6 months') as contribuciones_6_meses,
        COALESCE(SUM(wc.total) FILTER (WHERE EXTRACT(YEAR FROM wr.fecha_culto) = EXTRACT(YEAR FROM CURRENT_DATE)), 0) as total_año_actual,
        MAX(wr.fecha_culto) as ultima_contribucion
      FROM donors d
      LEFT JOIN worship_contributions wc ON d.id = wc.donor_id
      LEFT JOIN worship_records wr ON wc.worship_record_id = wr.id
      WHERE d.church_id = $1
        AND d.activo = true
        AND (
          d.nombre_completo ILIKE $2
          OR d.ci_ruc ILIKE $2
          OR similarity(d.nombre_completo, $3) > 0.3
        )
      GROUP BY d.id, d.nombre_completo, d.ci_ruc, d.telefono, d.email, d.tipo_donante, d.fecha_primera_contribucion, d.activo
      ORDER BY
        similarity(d.nombre_completo, $3) DESC,
        d.nombre_completo ASC
      LIMIT $4
    `;

    const searchPattern = `%${query.trim()}%`;
    const result = await execute(searchQuery, [churchId, searchPattern, query.trim(), searchLimit]);

    const donors = result.rows.map(row => ({
      id: row.id,
      nombre_completo: row.nombre_completo,
      ci_ruc: row.ci_ruc,
      telefono: row.telefono,
      email: row.email,
      tipo_donante: row.tipo_donante,
      fecha_primera_contribucion: row.fecha_primera_contribucion,
      activo: row.activo,
      estadisticas: {
        contribuciones_6_meses: parseInt(row.contribuciones_6_meses) || 0,
        total_año_actual: parseFloat(row.total_año_actual) || 0,
        ultima_contribucion: row.ultima_contribucion,
        meses_consecutivos: calculateConsecutiveMonths(row.ultima_contribucion)
      }
    }));

    return res.json({ donors });

  } catch (error) {
    console.error('Error searching donors:', error);
    throw error;
  }
};

// Calculate consecutive months for streak display
const calculateConsecutiveMonths = (lastContribution) => {
  if (!lastContribution) {
    return 0;
  }

  const lastDate = new Date(lastContribution);
  const currentDate = new Date();
  const diffTime = Math.abs(currentDate - lastDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // If last contribution was within 45 days, consider it recent
  return diffDays <= 45 ? Math.floor(diffDays / 30) + 1 : 0;
};

// Get all donors for a church
const getDonors = async (req, res, decoded) => {
  const { church_id, includeInactive = false, limit = 100, offset = 0 } = req.query;

  const churchId = enforceChurchAccess(decoded, church_id);
  const includeInactiveFlag = includeInactive === 'true';
  const queryLimit = Math.min(parseInt(limit) || 100, 500);
  const queryOffset = Math.max(parseInt(offset) || 0, 0);

  try {
    const query = `
      SELECT
        d.id,
        d.nombre_completo,
        d.ci_ruc,
        d.telefono,
        d.email,
        d.direccion,
        d.tipo_donante,
        d.fecha_primera_contribucion,
        d.observaciones,
        d.activo,
        d.created_at,
        d.updated_at,
        -- Aggregate contribution statistics
        COUNT(wc.id) as total_contribuciones,
        COALESCE(SUM(wc.total), 0) as total_contribuido,
        COALESCE(SUM(wc.total) FILTER (WHERE EXTRACT(YEAR FROM wr.fecha_culto) = EXTRACT(YEAR FROM CURRENT_DATE)), 0) as total_año_actual,
        MAX(wr.fecha_culto) as ultima_contribucion,
        MIN(wr.fecha_culto) as primera_contribucion_registrada
      FROM donors d
      LEFT JOIN worship_contributions wc ON d.id = wc.donor_id
      LEFT JOIN worship_records wr ON wc.worship_record_id = wr.id
      WHERE d.church_id = $1
        ${includeInactiveFlag ? '' : 'AND d.activo = true'}
      GROUP BY d.id, d.nombre_completo, d.ci_ruc, d.telefono, d.email, d.direccion, d.tipo_donante, d.fecha_primera_contribucion, d.observaciones, d.activo, d.created_at, d.updated_at
      ORDER BY d.nombre_completo ASC
      LIMIT $2 OFFSET $3
    `;

    const result = await execute(query, [churchId, queryLimit, queryOffset]);

    const donors = result.rows.map(row => ({
      id: row.id,
      nombre_completo: row.nombre_completo,
      ci_ruc: row.ci_ruc,
      telefono: row.telefono,
      email: row.email,
      direccion: row.direccion,
      tipo_donante: row.tipo_donante,
      fecha_primera_contribucion: row.fecha_primera_contribucion,
      observaciones: row.observaciones,
      activo: row.activo,
      created_at: row.created_at,
      updated_at: row.updated_at,
      estadisticas: {
        total_contribuciones: parseInt(row.total_contribuciones) || 0,
        total_contribuido: parseFloat(row.total_contribuido) || 0,
        total_año_actual: parseFloat(row.total_año_actual) || 0,
        ultima_contribucion: row.ultima_contribucion,
        primera_contribucion_registrada: row.primera_contribucion_registrada
      }
    }));

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM donors
      WHERE church_id = $1 ${includeInactiveFlag ? '' : 'AND activo = true'}
    `;
    const countResult = await execute(countQuery, [churchId]);
    const totalCount = parseInt(countResult.rows[0].total) || 0;

    return res.json({
      donors,
      pagination: {
        total: totalCount,
        limit: queryLimit,
        offset: queryOffset,
        hasMore: queryOffset + queryLimit < totalCount
      }
    });

  } catch (error) {
    console.error('Error getting donors:', error);
    throw error;
  }
};

// Get detailed donor summary with contribution history
const getDonorSummary = async (req, res, decoded) => {
  const donorId = parseDonorId(req.params.id);

  try {
    // Get donor basic info
    const donorQuery = `
      SELECT
        d.*,
        c.name as church_name,
        c.city as church_city
      FROM donors d
      JOIN churches c ON d.church_id = c.id
      WHERE d.id = $1
    `;
    const donorResult = await execute(donorQuery, [donorId]);

    if (donorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Donante no encontrado' });
    }

    const donor = donorResult.rows[0];
    ensureDonorVisibility(decoded, donor);

    // Get contribution summary by year
    const summaryQuery = `
      SELECT
        EXTRACT(YEAR FROM wr.fecha_culto) as año,
        wc.fund_bucket,
        COUNT(wc.id) as cantidad_contribuciones,
        SUM(wc.total) as total_contribuido,
        MIN(wr.fecha_culto) as primera_contribucion,
        MAX(wr.fecha_culto) as ultima_contribucion
      FROM worship_contributions wc
      JOIN worship_records wr ON wc.worship_record_id = wr.id
      WHERE wc.donor_id = $1
      GROUP BY EXTRACT(YEAR FROM wr.fecha_culto), wc.fund_bucket
      ORDER BY año DESC, wc.fund_bucket ASC
    `;
    const summaryResult = await execute(summaryQuery, [donorId]);

    // Get recent contributions (last 12 months)
    const recentQuery = `
      SELECT
        wr.fecha_culto,
        wr.tipo_culto,
        wc.fund_bucket,
        wc.numero_recibo,
        wc.total
      FROM worship_contributions wc
      JOIN worship_records wr ON wc.worship_record_id = wr.id
      WHERE wc.donor_id = $1
        AND wr.fecha_culto >= CURRENT_DATE - INTERVAL '12 months'
      ORDER BY wr.fecha_culto DESC
      LIMIT 50
    `;
    const recentResult = await execute(recentQuery, [donorId]);

    // Group summary by year
    const yearlyStats = {};
    summaryResult.rows.forEach(row => {
      const year = parseInt(row.año);
      if (!yearlyStats[year]) {
        yearlyStats[year] = {
          año: year,
          contribuciones_por_tipo: {},
          total_cantidad: 0,
          total_monto: 0,
          primera_contribucion: row.primera_contribucion,
          ultima_contribucion: row.ultima_contribucion
        };
      }

      yearlyStats[year].contribuciones_por_tipo[row.fund_bucket] = {
        cantidad: parseInt(row.cantidad_contribuciones),
        monto: parseFloat(row.total_contribuido)
      };
      yearlyStats[year].total_cantidad += parseInt(row.cantidad_contribuciones);
      yearlyStats[year].total_monto += parseFloat(row.total_contribuido);

      // Update date range
      if (new Date(row.primera_contribucion) < new Date(yearlyStats[year].primera_contribucion)) {
        yearlyStats[year].primera_contribucion = row.primera_contribucion;
      }
      if (new Date(row.ultima_contribucion) > new Date(yearlyStats[year].ultima_contribucion)) {
        yearlyStats[year].ultima_contribucion = row.ultima_contribucion;
      }
    });

    return res.json({
      donor: {
        id: donor.id,
        nombre_completo: donor.nombre_completo,
        ci_ruc: donor.ci_ruc,
        telefono: donor.telefono,
        email: donor.email,
        direccion: donor.direccion,
        tipo_donante: donor.tipo_donante,
        fecha_primera_contribucion: donor.fecha_primera_contribucion,
        observaciones: donor.observaciones,
        activo: donor.activo,
        iglesia: {
          id: donor.church_id,
          nombre: donor.church_name,
          ciudad: donor.church_city
        }
      },
      estadisticas_anuales: Object.values(yearlyStats).sort((a, b) => b.año - a.año),
      contribuciones_recientes: recentResult.rows.map(row => ({
        fecha_culto: row.fecha_culto,
        tipo_culto: row.tipo_culto,
        fund_bucket: row.fund_bucket,
        numero_recibo: row.numero_recibo,
        total: parseFloat(row.total),
        concepto: row.concepto
      }))
    });

  } catch (error) {
    console.error('Error getting donor summary:', error);
    throw error;
  }
};

// Create or update donor
const saveDonor = async (req, res, decoded) => {
  const donorData = validateDonorData(req.body);
  const donorId = req.params.id ? parseDonorId(req.params.id) : null;
  donorData.church_id = enforceChurchAccess(decoded, donorData.church_id);

  try {
    let query;
    let params;

    if (donorId) {
      const existingResult = await execute('SELECT id, church_id FROM donors WHERE id = $1', [donorId]);
      if (existingResult.rows.length === 0) {
        return res.status(404).json({ error: 'Donante no encontrado' });
      }
      ensureDonorVisibility(decoded, existingResult.rows[0]);

      // Update existing donor
      query = `
        UPDATE donors
        SET nombre_completo = $2,
            ci_ruc = $3,
            telefono = $4,
            email = $5,
            direccion = $6,
            tipo_donante = $7,
            observaciones = $8,
            activo = $9,
            updated_at = NOW()
        WHERE id = $1 AND church_id = $10
        RETURNING *
      `;
      params = [
        donorId,
        donorData.nombre_completo,
        donorData.ci_ruc,
        donorData.telefono,
        donorData.email,
        donorData.direccion,
        donorData.tipo_donante,
        donorData.observaciones,
        donorData.activo,
        donorData.church_id
      ];
    } else {
      // Create new donor
      query = `
        INSERT INTO donors (church_id, nombre_completo, ci_ruc, telefono, email, direccion, tipo_donante, observaciones, activo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      params = [
        donorData.church_id,
        donorData.nombre_completo,
        donorData.ci_ruc,
        donorData.telefono,
        donorData.email,
        donorData.direccion,
        donorData.tipo_donante,
        donorData.observaciones,
        donorData.activo
      ];
    }

    const result = await execute(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Donante no encontrado o no tienes permisos para editarlo' });
    }

    const savedDonor = result.rows[0];

    return res.status(donorId ? 200 : 201).json({
      message: donorId ? 'Donante actualizado exitosamente' : 'Donante creado exitosamente',
      donor: {
        id: savedDonor.id,
        nombre_completo: savedDonor.nombre_completo,
        ci_ruc: savedDonor.ci_ruc,
        telefono: savedDonor.telefono,
        email: savedDonor.email,
        direccion: savedDonor.direccion,
        tipo_donante: savedDonor.tipo_donante,
        fecha_primera_contribucion: savedDonor.fecha_primera_contribucion,
        observaciones: savedDonor.observaciones,
        activo: savedDonor.activo,
        created_at: savedDonor.created_at,
        updated_at: savedDonor.updated_at
      }
    });

  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        error: 'Ya existe un donante con ese CI/RUC en esta iglesia'
      });
    }
    throw error;
  }
};

module.exports = async (req, res) => {
  // Set CORS headers
  setCORSHeaders(req, res);

  // Handle preflight requests
  if (handlePreflight(req, res)) {
    return;
  }

  try {
    // Verify authentication for all requests
    const decoded = verifyToken(req);
    if (!decoded) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    // Route requests based on path and method
    if (req.method === 'GET' && req.url.includes('/search')) {
      return await searchDonors(req, res, decoded);
    } else if (req.method === 'GET' && req.params?.id && req.url.includes('/summary')) {
      return await getDonorSummary(req, res, decoded);
    } else if (req.method === 'GET') {
      return await getDonors(req, res, decoded);
    } else if (req.method === 'POST') {
      return await saveDonor(req, res, decoded);
    } else if (req.method === 'PUT' && req.params?.id) {
      return await saveDonor(req, res, decoded);
    } else {
      return res.status(405).json({ error: 'Método no permitido' });
    }

  } catch (error) {
    console.error('Error in donors API:', error);

    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: error.message });
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