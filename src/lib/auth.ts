import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { execute } from '@/lib/db';
import { getJwtSecret, verifyBearerToken } from '@/lib/jwt';

export const isSystemOwner = (email: string): boolean =>
  email.toLowerCase() === 'administracion@ipupy.org.py';

export const verifyAuth = async (authorization?: string | null) => {
  const payload = verifyBearerToken(authorization);
  if (!payload.userId) {
    throw new Error('Usuario no encontrado o inactivo');
  }

  const result = await execute(
    'SELECT * FROM users WHERE id = $1 AND active = true',
    [payload.userId]
  );

  if (result.rows.length === 0) {
    throw new Error('Usuario no encontrado o inactivo');
  }

  return result.rows[0];
};

export const hashPassword = (password: string) => bcrypt.hash(password, 12);

export const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export const signJwt = (payload: object, expiresIn = '7d') =>
  jwt.sign(payload, getJwtSecret(), { expiresIn } as jwt.SignOptions);
