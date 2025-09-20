# Deployment Guide - IPU PY Treasury System

## Vercel Deployment

### Prerequisites
1. Install Vercel CLI: `npm install -g vercel`
2. Provision a Supabase project (or other Postgres instance) and capture the project URL + service role key

### Environment Variables Required

Create these in the Vercel dashboard or `.env.local` file:

```bash
# Supabase Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_DB_URL=postgresql://postgres:your_password@db.your-project.supabase.co:5432/postgres
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
# If you do not have the service key locally, provide SUPABASE_ANON_KEY for read-only access

# Environment
NODE_ENV=production
JWT_SECRET=your_32_characters_minimum_secret
```

### Deployment Steps

1. **Login to Vercel**
```bash
vercel login
```

2. **Deploy to Vercel**
```bash
vercel --prod
```

3. **Set Environment Variables in Vercel Dashboard**
- Go to project settings
- Navigate to Environment Variables
- Add the required variables above

4. **Test Deployment**
```bash
# Test API endpoint
curl https://your-app.vercel.app/api/test

# Test database connection
curl https://your-app.vercel.app/api/db-test

# Test fund data
curl https://your-app.vercel.app/api/funds
```

## API Endpoints

### Supabase-Backed APIs
- `/api/test` - System status
- `/api/db-test` - Database connection test
- `/api/funds` - Fund categories with summaries
- `/api/dashboard` - Dashboard statistics
- `/api/churches` - Church management

### Frontend Routes
- `/` - Main dashboard (index.html)

## Data Summary

The system contains:
- **9 Fund Categories**: General, Caballeros, Misiones, APY, Lazos de Amor, Misión Posible, Niños, IBA, Damas
- **1,967 Transactions**: Spanning 2023-2025
- **2024 Data**: 1,388 movements with ₲205M income, ₲187M expenses
- **Churches**: 22 IPU Paraguay churches

## Important Notes

1. **Default Year**: API defaults to 2024 (most complete data)
2. **Transaction Types**: Database uses 'entrada'/'salida' (not 'ingreso'/'egreso')
3. **Progressive Disclosure**: UI shows 1, 5, or 9 funds based on user preference
4. **Offline Support**: PWA with service worker caching

## Troubleshooting

### If fund balances show as 0:
- Check that queries use 'entrada'/'salida' not 'ingreso'/'egreso'
- Verify year parameter (default is 2024)
- Check date format in WHERE clauses (use strftime without CAST)

### If API returns empty:
- Verify Supabase credentials in environment variables
- Check that `SUPABASE_URL` uses the `https://` project URL
- Ensure the service role (or anon) key is valid and not expired

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Access at http://localhost:3000
```

## Architecture

```
cloud-gateway/
├── api/                # Vercel serverless functions
│   ├── funds.js       # Fund management API
│   ├── test.js        # Status check
│   └── db-test.js     # Database connection test
├── public/            # Static assets
│   ├── index.html     # ABSD Dashboard
│   ├── js/            # JavaScript modules
│   └── sw.js          # Service worker
├── server.js          # Development server
└── package.json       # Dependencies
```

## Support

For issues or questions about the treasury system, contact the IPU PY technical team.
