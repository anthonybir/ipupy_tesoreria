const { query, initDatabase } = require('../lib/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Inicializar base de datos si es necesario
    if (process.env.VERCEL) {
      await initDatabase();
    }

    const { action } = req.query;

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

      default:
        res.status(400).json({ error: 'Acción no válida' });
    }
  } catch (error) {
    console.error('Error en API auth:', error);
    res.status(500).json({
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

  try {
    // Buscar usuario
    const result = await query(`
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
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.json({
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

  } catch (error) {
    throw error;
  }
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

  try {
    // Verificar si el email ya existe
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    // Verificar si la iglesia existe (para role church)
    if (churchId) {
      const church = await query('SELECT id FROM churches WHERE id = $1 AND active = true', [churchId]);
      if (church.rows.length === 0) {
        return res.status(400).json({ error: 'Iglesia no encontrada' });
      }
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 12);

    // Crear usuario
    const result = await query(`
      INSERT INTO users (email, password_hash, role, church_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, role, church_id
    `, [email.toLowerCase(), passwordHash, role, churchId || null]);

    const user = result.rows[0];

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        churchId: user.church_id
      }
    });

  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    throw error;
  }
}

async function handleVerify(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

    // Verificar que el usuario aún existe y está activo
    const result = await query(`
      SELECT u.*, c.name as church_name
      FROM users u
      LEFT JOIN churches c ON u.church_id = c.id
      WHERE u.id = $1 AND u.active = true
    `, [decoded.userId]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    const user = result.rows[0];

    res.json({
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
    throw error;
  }
}

async function handleInit(req, res) {
  try {
    // Verificar si ya existe un usuario admin
    const adminExists = await query('SELECT id FROM users WHERE role = $1', ['admin']);
    if (adminExists.rows.length > 0) {
      return res.status(400).json({ error: 'Sistema ya inicializado' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      // Usar valores por defecto de variables de entorno
      const defaultEmail = process.env.ADMIN_EMAIL || 'admin@ipupy.org';
      const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';

      const passwordHash = await bcrypt.hash(defaultPassword, 12);

      await query(`
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

    await query(`
      INSERT INTO users (email, password_hash, role)
      VALUES ($1, $2, 'admin')
    `, [email.toLowerCase(), passwordHash]);

    res.json({
      message: 'Sistema inicializado exitosamente',
      email: email.toLowerCase()
    });

  } catch (error) {
    throw error;
  }
}

// Middleware para verificar autenticación
export const verifyAuth = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Token requerido');
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

  // Verificar que el usuario aún existe y está activo
  const result = await query('SELECT * FROM users WHERE id = $1 AND active = true', [decoded.userId]);
  if (result.rows.length === 0) {
    throw new Error('Usuario no encontrado o inactivo');
  }

  return result.rows[0];
};