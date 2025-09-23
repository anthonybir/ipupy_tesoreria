import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/nextauth';
import { AuthPayload, verifyBearerToken } from '@/lib/jwt';

export type AuthContext = {
  userId?: number;
  email?: string;
  role?: string;
  churchId?: number | null;
};

const normalizeAuthPayload = (payload: AuthPayload): AuthContext => ({
  userId: payload.userId ? Number(payload.userId) : undefined,
  email: payload.email ?? undefined,
  role: typeof payload.role === 'string' ? payload.role : undefined,
  churchId: typeof payload.churchId === 'number' ? payload.churchId : payload.churchId ?? null
});

export const getAuthContext = async (request: NextRequest): Promise<AuthContext | null> => {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    return {
      userId: session.user.id ? Number(session.user.id) : undefined,
      email: session.user.email ?? undefined,
      role: session.user.role ?? undefined,
      churchId: session.user.churchId ?? null
    };
  }

  const authorization = request.headers.get('authorization');
  if (authorization) {
    const payload = verifyBearerToken(authorization);
    return normalizeAuthPayload(payload);
  }

  return null;
};

export const requireAuth = async (request: NextRequest): Promise<AuthContext> => {
  const context = await getAuthContext(request);
  if (!context) {
    throw new Error('Autenticación requerida');
  }
  return context;
};
