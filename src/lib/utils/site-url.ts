/**
 * Gets the correct site URL for OAuth callbacks and redirects
 * Handles local development, Vercel preview, and production environments
 */
export function getSiteURL(): string {
  // Check for explicit site URL configuration (production)
  if (process.env['NEXT_PUBLIC_SITE_URL']) {
    const url = process.env['NEXT_PUBLIC_SITE_URL'];
    // Ensure it has a protocol
    const hasProtocol = url.startsWith('http://') || url.startsWith('https://');
    const finalUrl = hasProtocol ? url : `https://${url}`;
    console.log('[getSiteURL] Using NEXT_PUBLIC_SITE_URL:', finalUrl);
    return finalUrl;
  }

  // In production, use Vercel URL if available
  if (process.env['NEXT_PUBLIC_VERCEL_URL']) {
    const vercelUrl = `https://${process.env['NEXT_PUBLIC_VERCEL_URL']}`;
    console.log('[getSiteURL] Using NEXT_PUBLIC_VERCEL_URL:', vercelUrl);
    return vercelUrl;
  }

  // Check if we're in production mode
  if (process.env['NODE_ENV'] === 'production') {
    // Try to get the Vercel deployment URL from system environment
    const vercelUrl = process.env['VERCEL_URL'];
    if (vercelUrl) {
      const url = `https://${vercelUrl}`;
      console.log('[getSiteURL] Using VERCEL_URL (production):', url);
      return url;
    }
  }

  // For client-side code, check if we're in browser
  if (typeof window !== 'undefined') {
    // In production, ensure we use HTTPS
    const protocol = window.location.hostname === 'localhost' ? 'http' : 'https';
    const url = `${protocol}://${window.location.host}`;
    console.log('[getSiteURL] Using window.location:', url);
    return url;
  }

  // Fallback for server-side code during development
  const fallbackUrl = 'http://localhost:3000';
  console.log('[getSiteURL] Using fallback URL:', fallbackUrl);
  return fallbackUrl;
}

/**
 * Helper to get URL with forwarded host handling (for use in Route Handlers)
 */
export function getSiteURLWithHeaders(headers: Headers): string {
  // Check for forwarded host (Vercel deployment)
  const forwardedHost = headers.get('x-forwarded-host');
  const forwardedProto = headers.get('x-forwarded-proto') || 'https';

  if (forwardedHost) {
    const url = `${forwardedProto}://${forwardedHost}`;
    console.log('[getSiteURLWithHeaders] Using forwarded host:', url);
    return url;
  }

  // Fall back to regular getSiteURL
  return getSiteURL();
}