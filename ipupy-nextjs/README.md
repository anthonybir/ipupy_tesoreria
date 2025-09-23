# IPU PY Tesorería - Next.js Application

Sistema moderno de gestión de tesorería para la Iglesia Pentecostal Unida del Paraguay, construido con Next.js 15, TypeScript, y Supabase.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## 📋 Prerequisites

- Node.js 20.x or higher
- PostgreSQL database (Supabase or self-hosted)
- Environment variables configured

## 🔧 Environment Variables

Create a `.env.local` file with the following variables:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database
SUPABASE_DB_URL=postgresql://user:password@host:port/database

# Authentication
JWT_SECRET=your-jwt-secret-key
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# Admin Setup
ADMIN_EMAIL=admin@ipupy.org
ADMIN_PASSWORD=secure-admin-password

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Supabase (Optional)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# CORS Origins (Optional)
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com

# Environment
NODE_ENV=development
```

## 🏗️ Project Structure

```
ipupy-nextjs/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── api/              # API Routes
│   │   │   ├── auth/         # Authentication endpoints
│   │   │   ├── churches/     # Church management
│   │   │   ├── dashboard/    # Dashboard data
│   │   │   ├── reports/      # Financial reports
│   │   │   ├── accounting/   # Accounting operations
│   │   │   ├── donors/       # Donor management
│   │   │   ├── financial/    # Financial operations
│   │   │   ├── people/       # Member management
│   │   │   ├── data/         # Import/Export Excel
│   │   │   ├── worship-records/ # Worship service records
│   │   │   └── dashboard-init/  # Dashboard initialization
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Home page
│   ├── components/           # React components
│   ├── lib/                  # Utility functions
│   │   ├── db.ts            # Database connection
│   │   ├── auth-context.ts  # Authentication context
│   │   ├── jwt.ts           # JWT utilities
│   │   └── cors.ts          # CORS configuration
│   └── types/               # TypeScript type definitions
├── public/                   # Static files
├── next.config.ts           # Next.js configuration
├── tailwind.config.ts       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Dependencies and scripts
```

## 📦 Available Scripts

```bash
# Development
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Database
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed initial data
```

## 🌐 API Endpoints

All API endpoints are available under `/api/`:

### Authentication
- `POST /api/auth` - Login with email/password
- `GET /api/auth` - Verify authentication

### Churches
- `GET /api/churches` - List all churches
- `POST /api/churches` - Create new church
- `PUT /api/churches` - Update church
- `DELETE /api/churches` - Delete church

### Financial Reports
- `GET /api/reports` - Get financial reports
- `POST /api/reports` - Create new report
- `PUT /api/reports` - Update report

### Accounting
- `GET /api/accounting` - Get accounting records
- `POST /api/accounting` - Create accounting entry

### Data Import/Export
- `GET /api/data?action=export` - Export data to Excel
- `POST /api/data?action=import` - Import data from Excel

### Dashboard
- `GET /api/dashboard-init` - Get dashboard initialization data
- `GET /api/dashboard` - Get dashboard metrics

### Worship Records
- `GET /api/worship-records` - Get worship service records
- `POST /api/worship-records` - Create worship record

## 🚢 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Docker

```bash
# Build Docker image
docker build -t ipupy-nextjs .

# Run container
docker run -p 3000:3000 --env-file .env.local ipupy-nextjs
```

### Manual Deployment

```bash
# Build application
npm run build

# Start production server
npm run start
```

## 🔒 Security Features

- JWT-based authentication
- Role-based access control (Admin, Church, User)
- CORS protection
- SQL injection prevention
- XSS protection headers
- Rate limiting ready
- Environment variable validation

## 🗄️ Database Schema

The application uses PostgreSQL with the following main tables:

- `churches` - Church information
- `reports` - Monthly financial reports
- `users` - User accounts
- `donors` - Donor information
- `worship_records` - Worship service attendance and offerings
- `worship_contributions` - Individual contributions
- `funds` - Fund management
- `fund_movements` - Fund transactions
- `accounting_entries` - General accounting

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## 📱 PWA Support

The application includes Progressive Web App features:

- Service Worker for offline support
- Web App Manifest
- Install prompt
- Cache strategies

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is private and proprietary to IPU Paraguay.

## 🆘 Support

For support, contact the development team or create an issue in the repository.

## 🔄 Migration from Express

This is the Next.js version of the IPU PY Tesorería system, migrated from Express.js. Key improvements:

- **Type Safety**: Full TypeScript support
- **Performance**: Next.js optimizations and edge runtime
- **Developer Experience**: Hot reload, better error messages
- **Modern Stack**: React 19, Next.js 15, Tailwind CSS
- **API Routes**: File-based routing with automatic API handling

## 🎯 Roadmap

- [ ] Complete UI migration to React components
- [ ] Add real-time updates with WebSockets
- [ ] Implement advanced reporting dashboard
- [ ] Add mobile app with React Native
- [ ] Multi-language support (Spanish/Guaraní)
- [ ] Advanced audit logging
- [ ] Backup automation

---

Built with ❤️ for IPU Paraguay