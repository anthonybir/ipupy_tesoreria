import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit } from '@/lib/rate-limit';

// IMPORTANT: Node.js runtime required for Supabase rate limiting
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<Response> {
  // SECURITY: Rate limit auth attempts (5 per 15 minutes)
  const rateLimitResponse = await withRateLimit(request, 'auth');
  if (rateLimitResponse) return rateLimitResponse;

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${url.origin}${next}`);
}