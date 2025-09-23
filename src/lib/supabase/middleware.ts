import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Session, User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

type UpdateSessionResult = {
  response: NextResponse;
  session: Session | null;
  user: User | null;
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
        // Only set cookies on the response
        response.cookies.set({
          name,
          value,
          ...options,
        });
      },
      remove(name: string, options: CookieOptions) {
        // Only remove cookies from the response
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
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.warn(`${logPrefix} Error refreshing session`, sessionError.message);
    }

    if (session?.user) {
      return {
        response,
        session,
        user: session.user,
      };
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.warn(`${logPrefix} Error fetching user after session lookup`, userError.message);
    }

    return {
      response,
      session: session ?? null,
      user: user ?? null,
    };
  } catch (error) {
    console.error(`${logPrefix} Unexpected error retrieving auth session`, error);
    return { response, session: null, user: null };
  }
}
