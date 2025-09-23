import { DefaultSession } from 'next-auth';
import { AdapterUser as DefaultAdapterUser } from 'next-auth/adapters';
import { JWT as DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: ({
      id: string;
      role?: string | null;
      churchId?: number | null;
      churchName?: string | null;
      isSystemOwner?: boolean;
    }) & DefaultSession['user'];
  }

  interface User {
    id: string;
    role?: string | null;
    churchId?: number | null;
    churchName?: string | null;
    isSystemOwner?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    userId?: number;
    role?: string | null;
    churchId?: number | null;
    churchName?: string | null;
    isSystemOwner?: boolean;
  }
}

declare module 'next-auth/adapters' {
  interface AdapterUser extends DefaultAdapterUser {
    role?: string | null;
    churchId?: number | null;
    churchName?: string | null;
    isSystemOwner?: boolean;
  }
}
