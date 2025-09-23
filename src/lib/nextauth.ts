import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

import { execute } from '@/lib/db';
import { comparePassword, isSystemOwner } from '@/lib/auth';
import { validateAndTrimEnvVars } from '@/lib/env';

validateAndTrimEnvVars();

const allowedDomains = ['ipupy.org.py', 'ipupy.org'];
const googleClientId = (process.env.GOOGLE_CLIENT_ID ||
  '44786170581-apr8ukthgnp6dku7rkjh90kfruc2sf8t.apps.googleusercontent.com').trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

if (!googleClientSecret) {
  throw new Error('GOOGLE_CLIENT_SECRET environment variable is required for Google authentication');
}

type DbUserRow = {
  id: number;
  email: string;
  role: string | null;
  church_id: number | null;
  church_name?: string | null;
  password_hash: string;
  active: boolean;
  google_id?: string | null;
  display_name?: string | null;
};

type AppUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  churchId: number | null;
  churchName: string | null;
  isSystemOwner: boolean;
};

const mapDbUser = (row: DbUserRow): AppUser => ({
  id: String(row.id),
  email: row.email,
  role: row.role ?? null,
  churchId: row.church_id != null ? Number(row.church_id) : null,
  churchName: row.church_name ?? null,
  isSystemOwner: isSystemOwner(row.email),
  name: row.display_name ?? row.email
});

type MutableUserTarget = {
  id?: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  churchId?: number | null;
  churchName?: string | null;
  isSystemOwner?: boolean;
};

const applyMappedUser = <T extends MutableUserTarget>(target: T, mapped: AppUser): T => {
  target.id = mapped.id;
  target.email = mapped.email;
  target.name = mapped.name;
  target.role = mapped.role ?? null;
  target.churchId = mapped.churchId;
  target.churchName = mapped.churchName;
  target.isSystemOwner = mapped.isSystemOwner;
  return target;
};

const loadUserWithChurch = async (userId: number | string) => {
  const result = await execute<DbUserRow>(
    `
      SELECT u.*, c.name as church_name
      FROM users u
      LEFT JOIN churches c ON u.church_id = c.id
      WHERE u.id = $1
    `,
    [userId]
  );
  return result.rows[0] ?? null;
};

const findUserByEmail = async (email: string) => {
  const result = await execute<DbUserRow>(
    `
      SELECT u.*, c.name as church_name
      FROM users u
      LEFT JOIN churches c ON u.church_id = c.id
      WHERE u.email = $1
    `,
    [email.toLowerCase()]
  );
  return result.rows[0] ?? null;
};

const ensureGoogleUser = async (params: {
  email: string;
  googleId?: string;
}) => {
  const { email, googleId } = params;
  const existing = await execute<DbUserRow>('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

  if (existing.rows.length === 0) {
    const role = isSystemOwner(email) ? 'admin' : 'church';
    const created = await execute<{ id: number }>(
      `
        INSERT INTO users (email, password_hash, role, google_id, active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [email.toLowerCase(), 'google_oauth', role, googleId ?? null, true]
    );
    return loadUserWithChurch(created.rows[0].id);
  }

  const user = existing.rows[0];

  if (!user.google_id && googleId) {
    await execute('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, user.id]);
  }

  if (isSystemOwner(email) && user.role !== 'admin') {
    await execute('UPDATE users SET role = $1, church_id = NULL WHERE id = $2', ['admin', user.id]);
  }

  return loadUserWithChurch(user.id);
};

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
  session: { strategy: 'jwt' },
  providers: [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret
    }),
    CredentialsProvider({
      name: 'Credenciales',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await findUserByEmail(credentials.email);
        if (!user || !user.active) {
          return null;
        }

        const isValid = await comparePassword(credentials.password, user.password_hash);
        if (!isValid) {
          return null;
        }

        const mapped = mapDbUser(user);
        return {
          id: mapped.id,
          email: mapped.email,
          name: mapped.name,
          role: mapped.role,
          churchId: mapped.churchId,
          churchName: mapped.churchName,
          isSystemOwner: mapped.isSystemOwner
        };
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const email = (profile?.email || user.email || '').toLowerCase();
        if (!email) {
          return false;
        }
        const domain = email.split('@')[1];
        if (!allowedDomains.includes(domain)) {
          return false;
        }

        const dbUser = await ensureGoogleUser({
          email,
          googleId: account.providerAccountId
        });

        if (!dbUser) {
          return false;
        }

        const mapped = mapDbUser(dbUser);
        applyMappedUser(user as MutableUserTarget, mapped);
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const userId = Number(user.id);
        if (!Number.isNaN(userId)) {
          token.userId = userId;
        }
        token.email = user.email;
        token.name = user.name;
        const extendedUser = user as MutableUserTarget;
        token.role = extendedUser.role ?? null;
        token.churchId = extendedUser.churchId ?? null;
        token.churchName = extendedUser.churchName ?? null;
        token.isSystemOwner = extendedUser.isSystemOwner ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId != null ? String(token.userId) : session.user.id;
        session.user.role = token.role ?? null;
        session.user.churchId = token.churchId ?? null;
        session.user.churchName = token.churchName ?? null;
        session.user.isSystemOwner = Boolean(token.isSystemOwner);
      }
      return session;
    }
  }
};
