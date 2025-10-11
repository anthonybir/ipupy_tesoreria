'use server';

import { convexAuthNextjsToken, isAuthenticatedNextjs } from '@convex-dev/auth/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import type { Id } from '../../convex/_generated/dataModel';

import { api } from '../../convex/_generated/api';
import type { ProfileRole } from '@/lib/authz';

type NullableNumber = number | null;

const envConvexUrl = process.env['NEXT_PUBLIC_CONVEX_URL'];

if (!envConvexUrl) {
  throw new Error('NEXT_PUBLIC_CONVEX_URL must be defined to resolve Convex authentication context');
}

const convexUrl: string = envConvexUrl;

export type AuthContext = {
  userId: string;
  email: string;
  role: ProfileRole;
  churchId?: NullableNumber;
  fullName?: string;
  permissions?: Record<string, boolean | string | number>;
  assignedFunds?: number[];
  assignedChurches?: number[];
  preferredLanguage?: string;
};

async function getConvexClient(): Promise<ConvexHttpClient | null> {
  const token = await convexAuthNextjsToken();
  if (!token) {
    return null;
  }

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  return client;
}

async function resolveChurchSupabaseId(
  client: ConvexHttpClient,
  churchId: Id<"churches"> | null
): Promise<NullableNumber> {
  if (!churchId) {
    return null;
  }

  try {
    const church = await client.query(api.churches.get, { id: churchId });
    return church?.supabase_id ?? null;
  } catch (error) {
    console.warn('[auth-context] Failed to resolve church supabase_id', error);
    return null;
  }
}

async function resolveFundSupabaseId(
  client: ConvexHttpClient,
  fundId: Id<"funds"> | null
): Promise<NullableNumber> {
  if (!fundId) {
    return null;
  }

  try {
    const fund = await client.query(api.funds.get, { id: fundId });
    return fund?.supabase_id ?? null;
  } catch (error) {
    console.warn('[auth-context] Failed to resolve fund supabase_id', error);
    return null;
  }
}

export const getAuthContext = async (): Promise<AuthContext | null> => {
  const client = await getConvexClient();
  if (!client) {
    return null;
  }

  const profile = await client.query(api.auth.getCurrentProfile, {});

  if (!profile) {
    return null;
  }

  const churchSupabaseId = await resolveChurchSupabaseId(client, profile.church?.id ?? null);
  const fundSupabaseId = await resolveFundSupabaseId(client, profile.fundId ?? null);

  const assignedFunds =
    fundSupabaseId !== null && fundSupabaseId !== undefined ? [fundSupabaseId] : undefined;

  const assignedChurches =
    churchSupabaseId !== null && churchSupabaseId !== undefined ? [churchSupabaseId] : undefined;

  const context: AuthContext = {
    userId: profile.userId,
    email: profile.email,
    role: profile.role,
    churchId: churchSupabaseId ?? null,
    permissions: {},
    preferredLanguage: 'es',
  };

  if (profile.fullName) {
    context.fullName = profile.fullName;
  }

  if (assignedFunds) {
    context.assignedFunds = assignedFunds;
  }

  if (assignedChurches) {
    context.assignedChurches = assignedChurches;
  }

  return context;
};

export const requireAuth = async (): Promise<AuthContext> => {
  const context = await getAuthContext();
  if (!context) {
    throw new Error('Autenticación requerida');
  }
  return context;
};

export const isAuthenticated = async (): Promise<boolean> => {
  return isAuthenticatedNextjs({ convexUrl });
};
