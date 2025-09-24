import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

type UpdateSessionResult = {
  response: NextResponse;
  user: User | null;
};

const logPrefix = '[Supabase middleware]';

export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  // Create a response object that we'll modify with cookies
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(`${logPrefix} Missing Supabase environment variables`);
    return { response, user: null };
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        // Set cookie on the response to send to browser
        response.cookies.set({
          name,
          value,
          ...options,
        });
      },
      remove(name: string, options: CookieOptions) {
        // Remove cookie by setting empty value with maxAge 0
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
    // IMPORTANT: Always use getUser() in middleware for security
    // This makes a request to Supabase Auth to verify the token
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.warn(`${logPrefix} Error getting user:`, error.message);
      return { response, user: null };
    }

    if (user) {
      console.log(`${logPrefix} User authenticated:`, user.email);
    }

    return {
      response,
      user: user || null,
    };
  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return { response, user: null };
  }
}