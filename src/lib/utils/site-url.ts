/**
 * Gets the correct site URL for OAuth callbacks and redirects
 * Handles local development, Vercel preview, and production environments
 */
export function getSiteURL(): string {
  // Check for explicit site URL configuration
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  // In production, use Vercel URL if available
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // For client-side code, check if we're in browser
  if (typeof window !== 'undefined') {
    // In production, ensure we use HTTPS
    const protocol = window.location.hostname === 'localhost' ? 'http' : 'https';
    return `${protocol}://${window.location.host}`;
  }

  // Fallback for server-side code during development
  return 'http://localhost:3000';
}