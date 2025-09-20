/**
 * Google OAuth Authentication API
 * Handles Google Sign-In for IPU PY Tesorería
 */

const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { execute } = require('../lib/db');
const { setCORSHeaders, handlePreflight } = require('../lib/cors');

// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper function to get JWT secret
function getJWTSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return process.env.JWT_SECRET;
}

// Helper function to identify system owner
function isSystemOwner(email) {
  return email.toLowerCase() === 'administracion@ipupy.org.py';
}

module.exports = async function handler(req, res) {
  // Set CORS headers
  setCORSHeaders(req, res);

  if (handlePreflight(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Token de Google requerido' });
  }

  try {
    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email, name, hd, sub: googleId, picture } = payload;

    console.log('Google OAuth payload:', { email, name, hd, googleId });

    // Check if user has allowed domain (IPU PY Workspace)
    const allowedDomains = ['ipupy.org.py', 'ipupy.org'];
    const emailDomain = email.split('@')[1];

    // Validate domain for ALL users (including system owner)
    if (!allowedDomains.includes(emailDomain)) {
      console.warn('Access denied - unauthorized domain:', emailDomain, 'for email:', email);
      return res.status(403).json({
        error: `Solo usuarios de dominios autorizados pueden acceder al sistema`,
        domain: emailDomain,
        allowedDomains: allowedDomains
      });
    }

    // Log successful domain validation
    if (isSystemOwner(email)) {
      console.log('System owner authenticated:', email);
    } else {
      console.log('Authorized domain user:', email, 'from domain:', emailDomain);
    }

    // Look for existing user
    let userResult = await execute(
      'SELECT * FROM users WHERE email = $1 AND active = true',
      [email.toLowerCase()]
    );

    let user;

    if (userResult.rows.length === 0) {
      // Create new user automatically for IPU PY domain
      console.log('Creating new user for:', email);

      try {
        const userRole = isSystemOwner(email) ? 'admin' : 'church';
        const createResult = await execute(
          `INSERT INTO users (email, password_hash, role, google_id, active)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [email.toLowerCase(), 'google_oauth', userRole, googleId, true]
        );

        user = createResult.rows[0];
        console.log('New user created:', user.id);

      } catch (error) {
        console.error('Error creating user:', error);
        if (error.code === '23505') { // Unique constraint violation
          return res.status(400).json({
            error: 'El usuario ya existe pero está inactivo. Contacte al administrador.'
          });
        }
        throw error;
      }
    } else {
      user = userResult.rows[0];
      console.log('Existing user found:', user.id);

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
        console.log('Upgraded system owner to admin role:', email);
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

    // Generate JWT token (same as regular login)
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

    // Return successful response
    res.json({
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

    if (error.message.includes('Token used too early')) {
      return res.status(401).json({
        error: 'Token de Google inválido. Intente nuevamente.'
      });
    }

    if (error.message.includes('Invalid token')) {
      return res.status(401).json({
        error: 'Token de Google expirado o inválido'
      });
    }

    res.status(500).json({
      error: 'Error interno en autenticación',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};