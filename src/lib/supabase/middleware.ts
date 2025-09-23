import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Session } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

type UpdateSessionResult = {
  response: NextResponse;
  session: Session | null;
  user: Session['user'] | null;
};

const logPrefix = '[Supabase middleware]';

export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(`${logPrefix} Missing Supabase environment variables`);
    return { response, session: null, user: null };
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        response.cookies.set({
          name,
          value,
          ...options,
        });
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({
          name,
          value: '',
          ...options,
          maxAge: 0,
        });
      },
    },
  });

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error(`${logPrefix} Error refreshing auth session`, error);
    }

    return {
      response,
      session: session ?? null,
      user: session?.user ?? null,
    };
  } catch (error) {
    console.error(`${logPrefix} Unexpected error retrieving auth session`, error);
    return { response, session: null, user: null };
  }
}
