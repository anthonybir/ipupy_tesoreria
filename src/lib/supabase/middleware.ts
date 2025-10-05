import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from '@/lib/env-validation';

type UpdateSessionResult = {
  response: NextResponse;
  user: User | null;
};

export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { url, anonKey } = getSupabaseConfig();
  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  // Always use getUser() for security
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error('[Middleware] Error getting user:', {
      message: error.message,
      status: error.status,
      path: request.nextUrl.pathname,
      hasCookies: request.cookies.getAll().length > 0,
      cookieNames: request.cookies.getAll().map(c => c.name)
    });
  } else if (!user) {
    console.warn('[Middleware] No user found in session:', {
      path: request.nextUrl.pathname,
      hasCookies: request.cookies.getAll().length > 0
    });
  } else {
    console.log('[Middleware] User authenticated:', {
      userId: user.id,
      email: user.email,
      path: request.nextUrl.pathname
    });
  }

  return {
    response,
    user: user || null,
  };
}