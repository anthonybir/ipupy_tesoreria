import jwt, { JwtPayload } from 'jsonwebtoken';

export type AuthPayload = JwtPayload & {
  userId?: number;
  email?: string;
  role?: string;
  churchId?: number | null;
  name?: string;
};

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  if (secret === 'fallback_secret') {
    throw new Error('JWT_SECRET cannot use fallback_secret');
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  return secret;
};

export const verifyBearerToken = (authorization?: string | null): AuthPayload => {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new Error('Token requerido');
  }

  const token = authorization.slice('Bearer '.length);
  const payload = jwt.verify(token, getJwtSecret());
  return payload as AuthPayload;
};
