# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IPU PY Tesorería is a treasury management system for the Iglesia Pentecostal Unida del Paraguay (United Pentecostal Church of Paraguay). The project exists in **two distinct versions**:

1. **Simplified HTML Version** (Root directory): Ultra-simple, single-page HTML application
2. **Modern Vercel Version** (`cloud-gateway/`): Full-featured Node.js application with PostgreSQL

## Development Commands

### Root Directory (Simplified Version)
```bash
# Option 1: Open directly in browser (no server needed)
open index.html  # macOS
xdg-open index.html  # Linux

# Option 2: Run with Python server
python3 server.py  # Starts server on port 8000

# Quick start script (interactive menu)
./start.sh
```

### Cloud Gateway Directory
```bash
cd cloud-gateway

# Development server
npm run dev

# Production mode
npm start

# No build step required (serverless functions)
npm run build  # Just echoes "No build needed"
```

## Architecture

### Root Directory Structure
```
├── index.html          # Main treasurer dashboard (standalone)
├── mobile.html         # Mobile app for churches (standalone)
├── server.py           # Optional Python server with SQLite
├── start.sh            # Interactive startup script
└── ipupy_treasurer.db  # SQLite database (created when needed)
```

### Cloud Gateway Structure (`cloud-gateway/`)
```
├── api/                # Serverless API functions
│   ├── auth.js         # JWT authentication
│   ├── churches.js     # Church management
│   ├── dashboard.js    # Dashboard data
│   ├── export.js       # Excel export functionality
│   ├── import.js       # Excel import functionality
│   └── reports.js      # Monthly reports
├── lib/
│   └── db.js           # PostgreSQL connection and schema
├── public/
│   ├── index.html      # Legacy HTML version
│   └── app.html        # Modern web application
└── server.js           # Development server (Express)
```

## Database Systems

### Simplified Version
- **SQLite** (`ipupy_treasurer.db`)
- Created automatically by `server.py`
- Tables: `churches`, `reports`
- Local storage fallback in browser-only mode

### Vercel Version
- **PostgreSQL** (Vercel Postgres or Supabase)
- Configured via `DATABASE_URL` environment variable
- Tables: `churches`, `reports`, `users`
- Includes 22 pre-loaded IPU Paraguay churches with complete pastor information

## Key Features

### Treasury Management
- **Church Registration**: 22 pre-loaded IPU Paraguay churches
- **Monthly Reports**: Complete financial reporting system
  - Tithes (`diezmos`), Offerings (`ofrendas`)
  - Automatic 10% national fund calculation (`fondo_nacional`)
  - Bank deposit tracking
- **Fund Events Management**: Event budgeting and tracking system
  - Event budget planning with line items (venue, materials, food, transport, etc.)
  - Actual income/expense tracking after events
  - Treasurer approval workflow (draft → submitted → approved/rejected)
  - Automatic transaction creation in ledger upon approval
  - Variance analysis (budget vs. actuals)
  - Fund director role with restricted access to assigned funds
- **Excel Export/Import**: Full XLSX compatibility
- **Mobile Interface**: Optimized for church phones

### Data Structure
```javascript
// Monthly Report Schema
{
  church_id: Integer,
  month: Integer (1-12),
  year: Integer,
  diezmos: Decimal,
  ofrendas: Decimal,
  fondo_nacional: Decimal,  // Auto-calculated as 10% of total
  numero_deposito: String,
  fecha_deposito: Date,
  // ... additional financial fields
}

// Church Schema
{
  name: String,
  city: String,
  pastor: String,
  cedula: String,           // Paraguayan ID
  grado: String,            // Ministerial rank
  posicion: String          // Church position
}

// Fund Event Schema
{
  id: UUID,
  fund_id: Integer,
  church_id: Integer (optional),
  name: String,
  description: String,
  event_date: Date,
  status: 'draft' | 'pending_revision' | 'submitted' | 'approved' | 'rejected' | 'cancelled',
  budget_items: [{
    category: 'venue' | 'materials' | 'food' | 'transport' | 'honoraria' | 'marketing' | 'other',
    description: String,
    projected_amount: Decimal,
    notes: String
  }],
  actuals: [{
    line_type: 'income' | 'expense',
    description: String,
    amount: Decimal,
    receipt_url: String (optional),
    notes: String (optional)
  }],
  audit: {
    created_by: UUID,
    created_at: Timestamp,
    approved_by: UUID (optional),
    approved_at: Timestamp (optional)
  }
}
```

## Language and Localization

- **Primary Language**: Spanish (Paraguay)
- All UI text, comments, and variable names use Spanish
- Database fields use Spanish naming conventions
- Currency: Paraguayan Guaraní (₲)

## Authentication (Vercel Version Only)

- JWT-based authentication
- Roles: `admin`, `church`
- Environment variables:
  - `JWT_SECRET`: Token signing secret
  - `ADMIN_EMAIL`: Initial admin email
  - `ADMIN_PASSWORD`: Initial admin password

## Deployment Options

### Simplified Version
1. **Browser-only**: Open `index.html` directly
2. **Local server**: Run `python3 server.py`
3. **Mobile access**: Share `mobile.html` via server

### Vercel Version
1. **Environment Variables Required**:
   ```
   DATABASE_URL=postgresql://...
   JWT_SECRET=your_secret_key
   ADMIN_EMAIL=admin@ipupy.org
   ADMIN_PASSWORD=secure_password
   NODE_ENV=production
   ```
2. **Vercel Configuration**: Uses `vercel.json` for serverless routing
3. **Database**: Auto-initializes on first run

## File Upload Handling

- **Simplified**: Python server saves to `uploads/` directory
- **Vercel**: Uses `multer` middleware, 4MB limit (compatible with Vercel's 4.5MB body limit)
- Supports receipt photos and financial documentation

## Development Notes

- **No TypeScript**: Both versions use vanilla JavaScript
- **No Build Process**: Direct file serving (simplified) or serverless functions (Vercel)
- **Database Migrations**: Handled automatically via `initDatabase()` functions
- **Pre-loaded Data**: 22 IPU Paraguay churches with complete ministerial information

## Testing Strategy

Both versions can be tested by:
1. Opening in browser
2. Adding sample churches
3. Creating monthly reports
4. Testing Excel export/import
5. Verifying calculations (10% fondo nacional)

For mobile testing, use browser developer tools to simulate mobile devices.