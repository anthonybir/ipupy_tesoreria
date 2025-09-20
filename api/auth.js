const { execute } = require('../lib/db');
const { setCORSHeaders, handlePreflight } = require('../lib/cors');
const { OAuth2Client } = require('google-auth-library');
const { validateAndTrimEnvVars } = require('../lib/env-validator');

// Validate environment variables on module load
validateAndTrimEnvVars();

// Función segura para obtener JWT_SECRET
function getJWTSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  if (process.env.JWT_SECRET === 'fallback_secret') {
    throw new Error('JWT_SECRET cannot be the insecure fallback value');
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  return process.env.JWT_SECRET;
}
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Initialize Google OAuth client (moved to function level for serverless compatibility)

// Helper function to identify system owner
function isSystemOwner(email) {
  return email.toLowerCase() === 'administracion@ipupy.org.py';
}

module.exports = async function handler(req, res) {
  // Configurar CORS seguro
  setCORSHeaders(req, res);

  if (handlePreflight(req, res)) {
    return;
  }

  try {
    getJWTSecret();
  } catch (error) {
    console.error('Error en configuración JWT:', error);
    return res.status(500).json({ error: 'Configuración JWT inválida' });
  }

  // Database is initialized via migrations, not aquí
  const { action } = req.query;

  try {
    switch (action) {
    case 'login':
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
      }
      await handleLogin(req, res);
      break;

    case 'register':
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
      }
      await handleRegister(req, res);
      break;

    case 'verify':
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
      }
      await handleVerify(req, res);
      break;

    case 'init':
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
      }
      await handleInit(req, res);
      break;

    case 'google':
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
      }
      await handleGoogleAuth(req, res);
      break;

    default:
      return res.status(400).json({ error: 'Acción no válida' });
    }
  } catch (error) {
    console.error('Error en API auth:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function handleLogin(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  // Buscar usuario
  const result = await execute(`
    SELECT u.*, c.name as church_name
    FROM users u
    LEFT JOIN churches c ON u.church_id = c.id
    WHERE u.email = $1 AND u.active = true
  `, [email.toLowerCase()]);

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const user = result.rows[0];

  // Verificar contraseña
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  // Generar JWT
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      churchId: user.church_id
    },
    getJWTSecret(),
    { expiresIn: '7d' }
  );

  return res.json({
    message: 'Login exitoso',
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      churchId: user.church_id,
      churchName: user.church_name
    }
  });
}

async function handleRegister(req, res) {
  const { email, password, role = 'church', churchId } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  if (role === 'church' && !churchId) {
    return res.status(400).json({ error: 'ID de iglesia requerido para rol church' });
  }

  // Verificar si el email ya existe
  const existingUser = await execute('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existingUser.rows.length > 0) {
    return res.status(400).json({ error: 'El email ya está registrado' });
  }

  // Verificar si la iglesia existe (para role church)
  if (churchId) {
    const church = await execute('SELECT id FROM churches WHERE id = $1 AND active = true', [churchId]);
    if (church.rows.length === 0) {
      return res.status(400).json({ error: 'Iglesia no encontrada' });
    }
  }

  // Hash de la contraseña
  const passwordHash = await bcrypt.hash(password, 12);

  // Crear usuario
  try {
    const result = await execute(`
      INSERT INTO users (email, password_hash, role, church_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, role, church_id
    `, [email.toLowerCase(), passwordHash, role, churchId || null]);

    const user = result.rows[0];

    return res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        churchId: user.church_id
      }
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    console.error('Error registrando usuario:', error);
    return res.status(500).json({ error: 'No se pudo crear el usuario' });
  }
}

async function handleVerify(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, getJWTSecret());

    // Verificar que el usuario aún existe y está activo
    const result = await execute(`
      SELECT u.*, c.name as church_name
      FROM users u
      LEFT JOIN churches c ON u.church_id = c.id
      WHERE u.id = $1 AND u.active = true
    `, [decoded.userId]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    const user = result.rows[0];

    return res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        churchId: user.church_id,
        churchName: user.church_name
      }
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    console.error('Error verificando token:', error);
    return res.status(500).json({ error: 'No se pudo verificar el token' });
  }
}

async function handleInit(req, res) {
  try {
    // Verificar si ya existe un usuario admin
    const adminExists = await execute('SELECT id FROM users WHERE role = $1', ['admin']);
    if (adminExists.rows.length > 0) {
      return res.status(400).json({ error: 'Sistema ya inicializado' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      // Requerir credenciales de admin explícitas
      if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
        return res.status(400).json({
          error: 'ADMIN_EMAIL y ADMIN_PASSWORD deben estar configurados para inicializar'
        });
      }

      const defaultEmail = process.env.ADMIN_EMAIL;
      const defaultPassword = process.env.ADMIN_PASSWORD;

      // Validar que no se usen credenciales inseguras
      if (defaultPassword === 'admin123' || defaultPassword.length < 8) {
        return res.status(400).json({
          error: 'ADMIN_PASSWORD debe ser segura (mínimo 8 caracteres, no usar admin123)'
        });
      }

      const passwordHash = await bcrypt.hash(defaultPassword, 12);

      await execute(`
        INSERT INTO users (email, password_hash, role)
        VALUES ($1, $2, 'admin')
      `, [defaultEmail, passwordHash]);

      return res.json({
        message: 'Sistema inicializado con credenciales por defecto',
        email: defaultEmail,
        warning: 'Cambie las credenciales por defecto inmediatamente'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await execute(`
      INSERT INTO users (email, password_hash, role)
      VALUES ($1, $2, 'admin')
    `, [email.toLowerCase(), passwordHash]);

    return res.json({
      message: 'Sistema inicializado exitosamente',
      email: email.toLowerCase()
    });

  } catch (error) {
    console.error('Error inicializando sistema:', error);
    return res.status(500).json({ error: 'No se pudo inicializar el sistema' });
  }
}

// Middleware para verificar autenticación
const verifyAuth = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Token requerido');
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, getJWTSecret());

  // Verificar que el usuario aún existe y está activo
  const result = await execute('SELECT * FROM users WHERE id = $1 AND active = true', [decoded.userId]);
  if (result.rows.length === 0) {
    throw new Error('Usuario no encontrado o inactivo');
  }

  return result.rows[0];
};

// Google OAuth authentication handler
async function handleGoogleAuth(req, res) {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Token de Google requerido' });
  }

  try {
    // Initialize Google OAuth client (for serverless compatibility)
    // Use hardcoded Client ID to avoid env var issues in serverless cold starts
    // IMPORTANT: Trim environment variables to remove newlines/whitespace
    const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID ||
      '44786170581-apr8ukthgnp6dku7rkjh90kfruc2sf8t.apps.googleusercontent.com').trim();

    console.log('Google OAuth Debug:', {
      envClientId: process.env.GOOGLE_CLIENT_ID,
      usingClientId: GOOGLE_CLIENT_ID,
      credentialLength: credential?.length
    });

    // Decode token to see actual audience (without verification)
    const tokenParts = credential.split('.');
    if (tokenParts.length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
        console.log('Token audience (aud):', payload.aud);
        console.log('Expected audience:', GOOGLE_CLIENT_ID);
        console.log('Audience match:', payload.aud === GOOGLE_CLIENT_ID);
        console.log('Token issuer (iss):', payload.iss);
        console.log('Token azp (authorized party):', payload.azp);
      } catch (decodeError) {
        console.log('Failed to decode token for debugging:', decodeError.message);
      }
    }

    const client = new OAuth2Client(GOOGLE_CLIENT_ID);

    // Try verification with multiple possible audience values
    let ticket;
    const possibleAudiences = [
      GOOGLE_CLIENT_ID,
      '44786170581-apr8ukthgnp6dku7rkjh90kfruc2sf8t.apps.googleusercontent.com',
      process.env.GOOGLE_CLIENT_ID?.trim()
    ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates

    console.log('Trying verification with audiences:', possibleAudiences);

    for (const audience of possibleAudiences) {
      try {
        ticket = await client.verifyIdToken({
          idToken: credential,
          audience: audience
        });
        console.log('Verification successful with audience:', audience);
        break;
      } catch (verifyError) {
        console.log(`Verification failed with audience ${audience}:`, verifyError.message);
      }
    }

    if (!ticket) {
      throw new Error('Token verification failed with all possible audiences');
    }

    const payload = ticket.getPayload();
    const { email, name, hd, sub: googleId, picture } = payload;

    // Check if user has allowed domain
    const allowedDomains = ['ipupy.org.py', 'ipupy.org'];
    const emailDomain = email.split('@')[1];

    if (!allowedDomains.includes(emailDomain)) {
      return res.status(403).json({
        error: `Solo usuarios de dominios autorizados pueden acceder al sistema`,
        domain: emailDomain,
        allowedDomains: allowedDomains
      });
    }

    // Look for existing user
    let userResult = await execute(
      'SELECT * FROM users WHERE email = $1 AND active = true',
      [email.toLowerCase()]
    );

    let user;

    if (userResult.rows.length === 0) {
      // Create new user automatically for IPU PY domain
      const userRole = isSystemOwner(email) ? 'admin' : 'church';
      const createResult = await execute(
        `INSERT INTO users (email, password_hash, role, google_id, active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [email.toLowerCase(), 'google_oauth', userRole, googleId, true]
      );
      user = createResult.rows[0];
    } else {
      user = userResult.rows[0];

      // Update Google ID if not present
      if (!user.google_id && googleId) {
        await execute(
          'UPDATE users SET google_id = $1 WHERE id = $2',
          [googleId, user.id]
        );
        user.google_id = googleId;
      }

      // Upgrade to admin if this is the system owner
      if (isSystemOwner(email) && user.role !== 'admin') {
        await execute(
          'UPDATE users SET role = $1, church_id = NULL WHERE id = $2',
          ['admin', user.id]
        );
        user.role = 'admin';
        user.church_id = null;
      }
    }

    // Get church information if user has church_id
    let churchName = null;
    if (user.church_id) {
      const churchResult = await execute(
        'SELECT name FROM churches WHERE id = $1 AND active = true',
        [user.church_id]
      );
      if (churchResult.rows.length > 0) {
        churchName = churchResult.rows[0].name;
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        churchId: user.church_id,
        isSystemOwner: isSystemOwner(email)
      },
      getJWTSecret(),
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.json({
      message: 'Login exitoso con Google',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        churchId: user.church_id,
        churchName: churchName,
        name: name,
        picture: picture,
        provider: 'google',
        isSystemOwner: isSystemOwner(email)
      }
    });

  } catch (error) {
    console.error('Error en Google OAuth:', error);
    return res.status(500).json({
      error: 'Error interno en autenticación',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports.verifyAuth = verifyAuth;
