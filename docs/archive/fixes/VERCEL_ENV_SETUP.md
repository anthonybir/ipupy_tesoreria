# Vercel Environment Variables Setup

## Critical Environment Variables for Auth Fix

Add these environment variables to your Vercel project dashboard:

### 1. Required Supabase Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://vnxghlfrmmzvlhzhontk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZueGdobGZybW16dmxoemhvbnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyNTEyNjIsImV4cCI6MjA3MzgyNzI2Mn0.Ve8zX3Hi0qVCAmlygnxzbTukYL8yYZ0JFwXuYXML3aQ
```

### 2. Production URL (CRITICAL FOR AUTH)
```
NEXT_PUBLIC_SITE_URL=https://ipupy-tesoreria.vercel.app
```
⚠️ **Replace with your actual Vercel domain!**

### 3. Node Environment
```
NODE_ENV=production
```

### 4. Database URL (for Vercel IPv4 compatibility)
```
DATABASE_URL=postgresql://postgres.vnxghlfrmmzvlhzhontk:tidcYm-mamwu0-wyqzyp@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
```

## Supabase Dashboard Configuration

### Redirect URLs to Add
In your Supabase project dashboard (Authentication > URL Configuration):

1. **Production URL:**
   ```
   https://ipupy-tesoreria.vercel.app/auth/callback
   ```

2. **Vercel Preview URLs (wildcard):**
   ```
   https://*.vercel.app/auth/callback
   ```

3. **Local Development:**
   ```
   http://localhost:3000/auth/callback
   ```

### Site URL
Set the Site URL to your production domain:
```
https://ipupy-tesoreria.vercel.app
```

## How to Add Variables to Vercel

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable above
4. Select all environments (Production, Preview, Development)
5. Click Save

## Verification Steps

After deployment, check the following in your browser console:

1. Visit `/login`
2. Open browser DevTools → Application → Cookies
3. After OAuth callback, verify these cookies exist:
   - `sb-vnxghlfrmmzvlhzhontk-auth-token`
   - `sb-vnxghlfrmmzvlhzhontk-auth-token-code-verifier`

## Troubleshooting

If auth still fails:
1. Check Vercel function logs for cookie setting errors
2. Verify all environment variables are set
3. Ensure Supabase redirect URLs match exactly
4. Clear all cookies and try again

## Cookie Configuration Applied

Our code now explicitly sets:
- `sameSite: 'lax'` - Allows cookies on navigation
- `secure: true` - Required for HTTPS (production)
- `httpOnly: false` - Allows Supabase client access
- `path: '/'` - Available site-wide
- `domain: '.vercel.app'` - Shared across subdomains