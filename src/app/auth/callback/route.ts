import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[Auth Callback] Error exchanging code:', error);
      return NextResponse.redirect(`${url.origin}/login?error=auth_callback_error`);
    }
  }

  return NextResponse.redirect(`${url.origin}${next}`);
}