import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  console.log('[Auth Callback] Starting with code:', code ? 'present' : 'missing');

  if (code) {
    const cookieStore = await cookies();

    // Create the redirect response first
    const redirectUrl = new URL(next, origin);
    const response = NextResponse.redirect(redirectUrl);

    // Create Supabase client with cookie handlers that write to the response
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            // Set the cookie on the response that will be sent to the browser
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: CookieOptions) {
            // Remove the cookie by setting it with empty value and maxAge 0
            response.cookies.set({
              name,
              value: '',
              ...options,
              maxAge: 0,
            });
          },
        },
      }
    );

    // Exchange the code for a session
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    console.log('[Auth Callback] Exchange result:', {
      error: error?.message || 'none',
      user: data?.user?.email || 'none',
      session: data?.session ? 'present' : 'missing',
      next
    });

    if (!error && data?.session) {
      // Session cookies have been set on the response object
      console.log('[Auth Callback] Success - redirecting to:', next);
      return response;
    }

    // If there's an error, redirect to login with error
    console.error('[Auth Callback] Exchange failed:', error);
  }

  // Return the user to an error page with instructions
  console.log('[Auth Callback] No code or error - redirecting to login');
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}