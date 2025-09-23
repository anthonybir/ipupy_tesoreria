import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Session, User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

type UpdateSessionResult = {
  response: NextResponse;
  session: Session | null;
  user: User | null;
};

const logPrefix = '[Supabase middleware]';

const applyCookie = (
  target: { set: (cookie: { name: string; value: string } & CookieOptions) => void },
  name: string,
  value: string,
  options: CookieOptions = {},
) => {
  try {
    target.set({
      name,
      value,
      ...options,
    });
  } catch (error) {
    console.error(`${logPrefix} Failed setting cookie ${name}`, error);
  }
};

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
        applyCookie(request.cookies, name, value, options);
        applyCookie(response.cookies, name, value, options);
      },
      remove(name: string, options: CookieOptions) {
        const removalOptions: CookieOptions = {
          ...options,
          maxAge: 0,
        };
        applyCookie(request.cookies, name, '', removalOptions);
        applyCookie(response.cookies, name, '', removalOptions);
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
