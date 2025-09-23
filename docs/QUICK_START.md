# Quick Start Guide - IPU PY Tesorería

Get up and running with IPU PY Tesorería in 5 minutes.

## Prerequisites

- Node.js 20+ installed
- Git installed
- Supabase account (free tier works)
- Google Cloud account (for OAuth)

## 1. Clone and Install (1 minute)

```bash
# Clone repository
git clone https://github.com/anthonybirhouse/ipupy-tesoreria.git
cd ipupy-tesoreria

# Install dependencies
npm install
```

## 2. Supabase Setup (3 minutes)

### Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in:
   - Project name: `ipupy-tesoreria`
   - Database Password: (save this!)
   - Region: Choose closest to Paraguay

### Get Credentials

1. Go to Settings → API
2. Copy:
   - Project URL
   - Anon Key
   - Service Role Key

### Enable Google OAuth

1. Go to Authentication → Providers
2. Enable Google
3. Add your Google Client ID and Secret
4. Set Authorized redirect URI in Google Console:
   ```
   https://YOUR_PROJECT.supabase.co/auth/v1/callback
   ```

## 3. Environment Setup (1 minute)

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
```

Required variables:
```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
DATABASE_URL=your_database_url
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## 4. Database Setup (30 seconds)

Run migrations in Supabase SQL Editor:

```sql
-- Go to SQL Editor in Supabase
-- Run each file from migrations/ folder in order
-- Or use Supabase CLI: supabase db push
```

## 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 6. First Login

1. Click "Sign in with Google"
2. Use email ending in @ipupy.org.py
3. First user becomes admin automatically

## Common Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run linter
npx tsc --noEmit    # Check TypeScript
```

## Project Structure

```
src/
├── app/            # Next.js pages and API routes
├── components/     # React components
├── lib/           # Utilities and configs
└── types/         # TypeScript types
```

## Quick Tips

### Check Database Connection
```bash
# In Supabase SQL Editor
SELECT NOW();
```

### View Logs
```bash
# Development
npm run dev

# Check browser console for client errors
# Check terminal for server errors
```

### Reset Database
```sql
-- In Supabase SQL Editor
-- Be careful! This deletes all data
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
-- Then re-run migrations
```

## Troubleshooting

### "Invalid credentials"
- Check SUPABASE_SERVICE_KEY in .env.local
- Verify Supabase project is active

### "Google OAuth error"
- Check redirect URI in Google Console
- Verify domain is @ipupy.org.py

### "Database connection failed"
- Check DATABASE_URL format
- Use Session Pooler for Vercel

### Build errors
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

## Next Steps

- Read [Setup Guide](./SETUP_GUIDE.md) for detailed configuration
- Check [Architecture](./ARCHITECTURE.md) to understand the system
- See [API Reference](./API_REFERENCE.md) for endpoints
- Deploy with [Deployment Guide](./DEPLOYMENT.md)

## Support

- Email: administracion@ipupy.org.py
- GitHub Issues: [Report bugs](https://github.com/anthonybirhouse/ipupy-tesoreria/issues)

---

**Ready to go!** 🚀 You should now have a working local instance of IPU PY Tesorería.