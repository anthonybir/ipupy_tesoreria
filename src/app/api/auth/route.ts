import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';

import { execute } from '@/lib/db';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';
import { validateAndTrimEnvVars } from '@/lib/env';
import {
  comparePassword,
  hashPassword,
  isSystemOwner,
  signJwt
} from '@/lib/auth';
import { getJwtSecret, verifyBearerToken } from '@/lib/jwt';

validateAndTrimEnvVars();

interface User {
  id: number;
  email: string;
  password_hash: string;
  role: string;
  church_id?: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const jsonResponse = (data: unknown, origin: string | null, status = 200) =>
  new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...buildCorsHeaders(origin)
    }
  });

const jsonError = (status: number, message: string, origin: string | null, details?: string) =>
  jsonResponse({ error: message, details }, origin, status);

const ensureJwtSecret = () => {
  getJwtSecret();
};

type LoginBody = {
  email?: string;
  password?: string;
};

type RegisterBody = {
  email?: string;
  password?: string;
  role?: string;
  churchId?: number;
};

type InitBody = {
  email?: string;
  password?: string;
};

type GoogleBody = {
  credential?: string;
};

const parseJson = async <T>(request: NextRequest): Promise<T> =>
  (await request.json()) as T;
const handleLogin = async (body: LoginBody, origin: string | null) => {
  const { email, password } = body;

  if (!email || !password) {
    return jsonError(400, 'Email y contraseña requeridos', origin);
  }

  const result = await execute<User & { church_name?: string }>(
    `
      SELECT u.*, c.name as church_name
      FROM users u
      LEFT JOIN churches c ON u.church_id = c.id
      WHERE u.email = $1 AND u.active = true
    `,
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    return jsonError(401, 'Credenciales inválidas', origin);
  }

  const user = result.rows[0];
  const isValid = await comparePassword(password, user.password_hash);
  if (!isValid) {
    return jsonError(401, 'Credenciales inválidas', origin);
  }

  const token = signJwt({
    userId: user.id,
    email: user.email,
    role: user.role,
    churchId: user.church_id
  });

  return jsonResponse(
    {
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        churchId: user.church_id,
        churchName: user.church_name
      }
    },
    origin
  );
};
const handleRegister = async (body: RegisterBody, origin: string | null) => {
  const { email, password, role = 'church', churchId } = body;

  if (!email || !password) {
    return jsonError(400, 'Email y contraseña requeridos', origin);
  }

  if (password.length < 6) {
    return jsonError(400, 'La contraseña debe tener al menos 6 caracteres', origin);
  }

  if (role === 'church' && !churchId) {
    return jsonError(400, 'ID de iglesia requerido para rol church', origin);
  }

  const existingUser = await execute('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existingUser.rows.length > 0) {
    return jsonError(400, 'El email ya está registrado', origin);
  }

  if (churchId) {
    const church = await execute('SELECT id FROM churches WHERE id = $1 AND active = true', [churchId]);
    if (church.rows.length === 0) {
      return jsonError(400, 'Iglesia no encontrada', origin);
    }
  }

  const passwordHash = await hashPassword(password);

  try {
    const insert = await execute(
      `
        INSERT INTO users (email, password_hash, role, church_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, role, church_id
      `,
      [email.toLowerCase(), passwordHash, role, churchId || null]
    );

    const user = insert.rows[0];
    return jsonResponse(
      {
        message: 'Usuario creado exitosamente',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          churchId: user.church_id
        }
      },
      origin,
      201
    );
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      return jsonError(400, 'El email ya está registrado', origin);
    }
    console.error('Error registrando usuario:', error);
    return jsonError(500, 'No se pudo crear el usuario', origin);
  }
};
const handleVerify = async (authorization: string | null, origin: string | null) => {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return jsonError(401, 'Token requerido', origin);
  }

  try {
    const payload = verifyBearerToken(authorization);
    if (!payload.userId) {
      return jsonError(401, 'Token inválido', origin);
    }

    const result = await execute(
      `
        SELECT u.*, c.name as church_name
        FROM users u
        LEFT JOIN churches c ON u.church_id = c.id
        WHERE u.id = $1 AND u.active = true
      `,
      [payload.userId]
    );

    if (result.rows.length === 0) {
      return jsonError(401, 'Usuario no encontrado o inactivo', origin);
    }

    const user = result.rows[0];
    return jsonResponse(
      {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          churchId: user.church_id,
          churchName: user.church_name
        }
      },
      origin
    );
  } catch (error) {
    const name = (error as Error).name;
    if (name === 'TokenExpiredError') {
      return jsonError(401, 'Token expirado', origin);
    }
    if (name === 'JsonWebTokenError') {
      return jsonError(401, 'Token inválido', origin);
    }
    console.error('Error verificando token:', error);
    return jsonError(500, 'No se pudo verificar el token', origin);
  }
};
const handleInit = async (body: InitBody, origin: string | null) => {
  const adminExists = await execute('SELECT id FROM users WHERE role = $1', ['admin']);
  if (adminExists.rows.length > 0) {
    return jsonError(400, 'Sistema ya inicializado', origin);
  }

  const { email, password } = body;

  if (!email || !password) {
    const defaultEmail = process.env.ADMIN_EMAIL;
    const defaultPassword = process.env.ADMIN_PASSWORD;

    if (!defaultEmail || !defaultPassword) {
      return jsonError(400, 'ADMIN_EMAIL y ADMIN_PASSWORD deben estar configurados para inicializar', origin);
    }

    if (defaultPassword === 'admin123' || defaultPassword.length < 8) {
      return jsonError(400, 'ADMIN_PASSWORD debe ser segura (mínimo 8 caracteres, no usar admin123)', origin);
    }

    const passwordHash = await hashPassword(defaultPassword);
    await execute(
      `
        INSERT INTO users (email, password_hash, role)
        VALUES ($1, $2, 'admin')
      `,
      [defaultEmail.toLowerCase(), passwordHash]
    );

    return jsonResponse(
      {
        message: 'Sistema inicializado con credenciales por defecto',
        email: defaultEmail,
        warning: 'Cambie las credenciales por defecto inmediatamente'
      },
      origin
    );
  }

  if (password.length < 6) {
    return jsonError(400, 'La contraseña debe tener al menos 6 caracteres', origin);
  }

  const passwordHash = await hashPassword(password);
  await execute(
    `
      INSERT INTO users (email, password_hash, role)
      VALUES ($1, $2, 'admin')
    `,
    [email.toLowerCase(), passwordHash]
  );

  return jsonResponse(
    {
      message: 'Sistema inicializado exitosamente',
      email: email.toLowerCase()
    },
    origin
  );
};
const handleGoogle = async (body: GoogleBody, origin: string | null) => {
  const { credential } = body;

  if (!credential) {
    return jsonError(400, 'Token de Google requerido', origin);
  }

  try {
    const clientId = (process.env.GOOGLE_CLIENT_ID ||
      '44786170581-apr8ukthgnp6dku7rkjh90kfruc2sf8t.apps.googleusercontent.com').trim();

    const client = new OAuth2Client(clientId);
    const possibleAudiences = [
      clientId,
      '44786170581-apr8ukthgnp6dku7rkjh90kfruc2sf8t.apps.googleusercontent.com',
      process.env.GOOGLE_CLIENT_ID?.trim()
    ].filter(Boolean) as string[];

    let ticket;
    for (const audience of possibleAudiences) {
      try {
        ticket = await client.verifyIdToken({ idToken: credential, audience });
        break;
      } catch (verifyError) {
        console.log(`Verification failed with audience ${audience}:`, (verifyError as Error).message);
      }
    }

    if (!ticket) {
      throw new Error('Token verification failed with all possible audiences');
    }

    const payload = ticket.getPayload();
    if (!payload?.email) {
      throw new Error('Token inválido');
    }

    const { email, name, sub: googleId, picture } = payload;
    const allowedDomains = ['ipupy.org.py', 'ipupy.org'];
    const emailDomain = email.split('@')[1];

    if (!allowedDomains.includes(emailDomain)) {
      return jsonError(403, 'Solo usuarios de dominios autorizados pueden acceder al sistema', origin, emailDomain);
    }

    const existing = await execute('SELECT * FROM users WHERE email = $1 AND active = true', [email.toLowerCase()]);
    let user = existing.rows[0];

    if (!user) {
      const userRole = isSystemOwner(email) ? 'admin' : 'church';
      const created = await execute(
        `
          INSERT INTO users (email, password_hash, role, google_id, active)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `,
        [email.toLowerCase(), 'google_oauth', userRole, googleId, true]
      );
      user = created.rows[0];
    } else {
      if (!user.google_id && googleId) {
        await execute('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, user.id]);
        user.google_id = googleId;
      }

      if (isSystemOwner(email) && user.role !== 'admin') {
        await execute('UPDATE users SET role = $1, church_id = NULL WHERE id = $2', ['admin', user.id]);
        user.role = 'admin';
        user.church_id = null;
      }
    }

    let churchName: string | null = null;
    if (user.church_id) {
      const churchResult = await execute<{ name: string }>('SELECT name FROM churches WHERE id = $1 AND active = true', [user.church_id]);
      if (churchResult.rows.length > 0) {
        churchName = churchResult.rows[0].name;
      }
    }

    const token = signJwt({
      userId: user.id,
      email: user.email,
      role: user.role,
      churchId: user.church_id,
      isSystemOwner: isSystemOwner(email)
    }, process.env.JWT_EXPIRES_IN || '7d');

    return jsonResponse(
      {
        message: 'Login exitoso con Google',
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          churchId: user.church_id,
          churchName,
          name,
          picture,
          provider: 'google',
          isSystemOwner: isSystemOwner(email)
        }
      },
      origin
    );
  } catch (error) {
    console.error('Error en Google OAuth:', error);
    return jsonError(500, 'Error interno en autenticación', origin,
      process.env.NODE_ENV === 'development' ? (error as Error).message : undefined);
  }
};
export async function OPTIONS(request: NextRequest) {
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }
  return jsonError(405, 'Method not allowed', request.headers.get('origin'));
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  ensureJwtSecret();

  const action = request.nextUrl.searchParams.get('action');
  if (action !== 'verify') {
    return jsonError(400, 'Acción no válida', origin);
  }

  return handleVerify(request.headers.get('authorization'), origin);
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const preflight = handleCorsPreflight(request);
  if (preflight) {
    return preflight;
  }

  ensureJwtSecret();

  const action = request.nextUrl.searchParams.get('action');

  try {
    switch (action) {
      case 'login': {
        const body = await parseJson<LoginBody>(request);
        return handleLogin(body, origin);
      }
      case 'register': {
        const body = await parseJson<RegisterBody>(request);
        return handleRegister(body, origin);
      }
      case 'init': {
        const body = await parseJson<InitBody>(request);
        return handleInit(body, origin);
      }
      case 'google': {
        const body = await parseJson<GoogleBody>(request);
        return handleGoogle(body, origin);
      }
      default:
        return jsonError(400, 'Acción no válida', origin);
    }
  } catch (error) {
    console.error('Error en API auth:', error);
    return jsonError(500, 'Error interno del servidor', origin,
      process.env.NODE_ENV === 'development' ? (error as Error).message : undefined);
  }
}
