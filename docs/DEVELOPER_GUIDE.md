# Developer Guide - IPU PY Tesorería

## Bienvenido al Desarrollo

Esta guía está diseñada para desarrolladores que contribuirán al Sistema de Tesorería IPU PY. Aquí encontrará toda la información necesaria para configurar su entorno de desarrollo, entender la arquitectura Convex, y contribuir efectivamente al proyecto.

## Configuración del Entorno de Desarrollo

### Prerequisitos

#### Software Requerido
```bash
# Node.js y npm
node --version  # >= 20.x LTS
npm --version   # >= 10.x

# Git
git --version

# Editor recomendado: VS Code
code --version
```

#### Cuentas de Desarrollo
- ✅ Cuenta GitHub con acceso al repositorio
- ✅ Cuenta Convex (https://convex.dev) para backend
- ✅ Cuenta Vercel para deploys de frontend
- ✅ Cuenta Google Cloud para OAuth testing

### Configuración Inicial

#### 1. Clonar y Configurar Repositorio
```bash
# Clonar el repositorio
git clone https://github.com/anthonybirhouse/ipupy-tesoreria.git
cd ipupy-tesoreria

# Configurar remotes
git remote -v
git remote add upstream https://github.com/anthonybirhouse/ipupy-tesoreria.git

# Configurar Git
git config user.name "Tu Nombre"
git config user.email "tu.email@ipupy.org.py"
```

#### 2. Instalar Dependencias
```bash
# Instalar dependencias del proyecto
npm install

# Instalar Convex CLI globalmente
npm install -g convex

# Verificar instalación
npm run lint
npx tsc --noEmit
```

#### 3. Configurar Variables de Entorno
```bash
# Copiar template de configuración
cp .env.example .env.local

# Editar con valores de desarrollo
nano .env.local
```

**Variables de desarrollo requeridas:**
```bash
# Convex Backend (Required)
CONVEX_DEPLOYMENT=dev:your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# NextAuth v5 (Required)
NEXTAUTH_SECRET=your-development-secret-min-32-chars
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (Development)
GOOGLE_CLIENT_ID=[dev-client-id].apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=[dev-client-secret]

# Admin Development
SYSTEM_OWNER_EMAIL=dev@ipupy.org.py
ORGANIZATION_NAME="IPU Paraguay - Dev"

# Development Settings
NODE_ENV=development
```

#### 4. Configurar Convex Backend
```bash
# Inicializar Convex (primera vez)
npx convex dev --once

# Esto creará tu deployment de desarrollo y te pedirá:
# 1. Login con tu cuenta Convex
# 2. Nombre del proyecto
# 3. Nombre del deployment (usar "dev")

# El comando actualizará .env.local automáticamente con:
# - CONVEX_DEPLOYMENT
# - NEXT_PUBLIC_CONVEX_URL
```

#### 5. Poblar Base de Datos (Primera Vez)
```bash
# Importar datos iniciales (22 iglesias, usuarios demo)
npx convex import --table churches convex-data/churches.jsonl
npx convex import --table profiles convex-data/profiles.jsonl

# Verificar importación
npx convex run scripts:checkData
```

#### 6. Iniciar Servidores de Desarrollo
```bash
# Terminal 1: Convex backend (watch mode)
npx convex dev

# Terminal 2: Next.js frontend
npm run dev

# El sistema estará disponible en:
# - Frontend: http://localhost:3000
# - Convex Dashboard: https://dashboard.convex.dev
```

## Estructura del Proyecto

### Arquitectura de Directorios
```
ipupy-tesoreria/
├── convex/                     # 🚀 Convex Backend Functions
│   ├── schema.ts              # Database schema with TypeScript validators
│   ├── auth.config.ts         # OIDC configuration for NextAuth
│   ├── churches.ts            # Church queries & mutations
│   ├── reports.ts             # Monthly reports logic
│   ├── fundEvents.ts          # Event budgeting system
│   ├── fundTransactions.ts    # Transaction ledger
│   ├── funds.ts               # Fund management
│   ├── providers.ts           # Provider registry
│   ├── profiles.ts            # User profiles
│   ├── userActivity.ts        # Audit logs
│   └── _generated/            # Auto-generated API types
├── src/                        # 🔧 Next.js Application
│   ├── app/                   # Next.js 15 App Router
│   │   ├── api/               # REST API compatibility layer
│   │   │   ├── churches/      # Church endpoints
│   │   │   ├── reports/       # Report endpoints
│   │   │   ├── dashboard/     # Dashboard data
│   │   │   └── auth/          # NextAuth endpoints
│   │   ├── (routes)/          # Application pages
│   │   │   ├── churches/      # Church management UI
│   │   │   ├── reports/       # Monthly reports UI
│   │   │   ├── funds/         # Fund management
│   │   │   ├── transactions/  # Transaction ledger
│   │   │   └── login/         # Login page
│   │   ├── layout.tsx         # Root layout with ConvexProvider
│   │   └── providers.tsx      # Client-side providers
│   ├── components/            # React components
│   │   ├── ui/                # shadcn/ui components
│   │   ├── Auth/              # Authentication components
│   │   ├── Churches/          # Church management
│   │   ├── Reports/           # Report forms and views
│   │   └── Shared/            # Reusable UI components
│   ├── hooks/                 # React hooks
│   │   ├── useChurches.ts     # Church data (TanStack Query - legacy)
│   │   └── useReports.ts      # Report data (TanStack Query - legacy)
│   ├── lib/                   # Core utilities
│   │   ├── auth.ts            # NextAuth configuration
│   │   ├── convex-server.ts   # Server-side Convex client
│   │   └── utils/             # Utility functions
│   ├── types/                 # TypeScript type definitions
│   └── styles/                # Global styles & CSS tokens
├── convex-data/               # 📊 Data Import Files
│   ├── churches.jsonl         # 22 IPU Paraguay churches
│   └── profiles.jsonl         # Demo user profiles
├── scripts/                   # 🛠️ Utility Scripts
│   ├── export-supabase.ts     # Legacy migration script
│   └── transform-for-convex.ts # Data transformation
├── docs/                      # 📚 Documentation
│   ├── ARCHITECTURE.md        # System architecture
│   ├── CONVEX_SCHEMA.md       # Database schema reference
│   ├── API_REFERENCE.md       # API documentation
│   └── SECURITY.md            # Security patterns
└── migrations/                # 🗄️ Legacy SQL Migrations (deprecated)
```

### Convenciones de Código

#### Naming Conventions
```typescript
// Variables y funciones: camelCase
const monthlyReport = {};
const calculateFondoNacional = () => {};

// Constantes: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 10485760;
const ALLOWED_ROLES = ['admin', 'treasurer'];

// Tipos e Interfaces: PascalCase
type MonthlyReport = {};
interface ReportFormData {}

// Archivos Convex: camelCase.ts
churches.ts
fundEvents.ts
monthlyReports.ts

// Archivos React: PascalCase.tsx
ChurchForm.tsx
ReportsList.tsx
```

#### Code Structure

**Convex Query Pattern:**
```typescript
// convex/churches.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    // 1. Verificar autenticación
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // 2. Cargar perfil de usuario
    const user = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .unique();

    if (!user) {
      throw new Error("User profile not found");
    }

    // 3. Filtrar datos según permisos
    if (["admin", "national_treasurer"].includes(user.role)) {
      // Ver todas las iglesias
      return await ctx.db.query("churches").collect();
    }

    // Solo ver iglesia asignada
    if (!user.churchId) {
      return [];
    }

    const church = await ctx.db.get(user.churchId);
    return church ? [church] : [];
  },
});
```

**Convex Mutation Pattern:**
```typescript
// convex/reports.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    churchId: v.id("churches"),
    month: v.number(),
    year: v.number(),
    diezmos: v.number(),
    ofrendas: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Verificar autenticación
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // 2. Cargar perfil y verificar permisos
    const user = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .unique();

    if (!user) {
      throw new Error("User profile not found");
    }

    // 3. Verificar acceso a la iglesia
    if (!["admin", "treasurer"].includes(user.role)) {
      if (user.churchId !== args.churchId) {
        throw new Error("Unauthorized: Can only create reports for your church");
      }
    }

    // 4. Validar datos
    if (args.month < 1 || args.month > 12) {
      throw new Error("Month must be between 1 and 12");
    }

    if (args.diezmos < 0 || args.ofrendas < 0) {
      throw new Error("Amounts cannot be negative");
    }

    // 5. Calcular fondo nacional (10%)
    const total = args.diezmos + args.ofrendas;
    const fondoNacional = Math.round(total * 0.10);

    // 6. Crear reporte
    const reportId = await ctx.db.insert("monthlyReports", {
      churchId: args.churchId,
      month: args.month,
      year: args.year,
      diezmos: args.diezmos,
      ofrendas: args.ofrendas,
      fondoNacional,
      status: "draft",
      createdBy: user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 7. Registrar auditoría
    await ctx.db.insert("userActivity", {
      userId: user._id,
      action: "report.create",
      details: { reportId, churchId: args.churchId },
      timestamp: Date.now(),
    });

    return await ctx.db.get(reportId);
  },
});
```

## Patterns y Arquitectura

### Authorization Helpers

Crear funciones reutilizables para autorización:

```typescript
// convex/lib/auth.ts
import { QueryCtx, MutationCtx } from "./_generated/server";

export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db
    .query("profiles")
    .withIndex("by_email", (q) => q.eq("email", identity.email))
    .unique();

  if (!user) {
    throw new Error("User profile not found");
  }

  return user;
}

export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  allowedRoles: string[]
) {
  const user = await requireAuth(ctx);

  if (!allowedRoles.includes(user.role)) {
    throw new Error(`Unauthorized: requires ${allowedRoles.join(", ")}`);
  }

  return user;
}

export async function requireChurchAccess(
  ctx: QueryCtx | MutationCtx,
  churchId: string
) {
  const user = await requireAuth(ctx);

  // Admin y tesoreros nacionales ven todas las iglesias
  if (["admin", "national_treasurer"].includes(user.role)) {
    return user;
  }

  // Otros roles solo su iglesia
  if (user.churchId !== churchId) {
    throw new Error("Unauthorized: Can only access your church");
  }

  return user;
}
```

**Uso de helpers:**
```typescript
// convex/reports.ts
import { requireAuth, requireChurchAccess } from "./lib/auth";

export const getForChurch = query({
  args: { churchId: v.id("churches") },
  handler: async (ctx, { churchId }) => {
    // Verificar autenticación y acceso en una línea
    await requireChurchAccess(ctx, churchId);

    // Query autorizado
    return await ctx.db
      .query("monthlyReports")
      .withIndex("by_church", (q) => q.eq("churchId", churchId))
      .collect();
  },
});
```

### Real-time Subscriptions Pattern

```typescript
// src/components/Reports/ReportsList.tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function ReportsList({ churchId }: { churchId: Id<"churches"> }) {
  // Auto-actualiza cuando cambian los datos
  const reports = useQuery(api.reports.listForChurch, { churchId });

  if (reports === undefined) {
    return <div>Cargando reportes...</div>;
  }

  if (reports.length === 0) {
    return <div>No hay reportes</div>;
  }

  return (
    <ul>
      {reports.map((report) => (
        <li key={report._id}>
          {report.month}/{report.year} - ₲{report.diezmos + report.ofrendas}
        </li>
      ))}
    </ul>
  );
}
```

### Error Handling Pattern

```typescript
// convex/lib/errors.ts
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

// Uso en funciones
export const approve = mutation({
  handler: async (ctx, { reportId }) => {
    const user = await requireAuth(ctx);

    if (!["admin", "treasurer"].includes(user.role)) {
      throw new PermissionError("Only treasurers can approve reports");
    }

    const report = await ctx.db.get(reportId);
    if (!report) {
      throw new ValidationError("Report not found");
    }

    if (report.status !== "submitted") {
      throw new ValidationError("Can only approve submitted reports");
    }

    await ctx.db.patch(reportId, {
      status: "approved",
      approvedBy: user._id,
      approvedAt: Date.now(),
    });

    return await ctx.db.get(reportId);
  },
});
```

## Testing

### Configuración de Tests

#### Estructura de Tests
```bash
tests/
├── convex/                 # Tests de funciones Convex
│   ├── churches.test.ts
│   ├── reports.test.ts
│   └── auth.test.ts
├── integration/            # Tests de integración
│   ├── report-workflow.test.ts
│   └── fund-events.test.ts
├── components/             # Tests de componentes React
│   ├── ChurchForm.test.tsx
│   └── ReportsList.test.tsx
└── fixtures/               # Datos de prueba
    ├── sample-churches.json
    └── sample-reports.json
```

#### Ejecutar Tests
```bash
# Todos los tests
npm test

# Tests en watch mode
npm run test:watch

# Tests con coverage
npm run test:coverage

# Lint y typecheck
npm run lint
npx tsc --noEmit
```

#### Ejemplo de Test Convex
```typescript
// tests/convex/reports.test.ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

test("create report calculates fondo nacional", async () => {
  const t = convexTest(schema);

  // Setup: crear iglesia y usuario
  const churchId = await t.mutation(api.churches.create, {
    name: "Test Church",
    city: "Asunción",
    pastor: "Pastor Test",
  });

  const userId = await t.mutation(api.profiles.create, {
    email: "test@ipupy.org.py",
    role: "treasurer",
    churchId,
  });

  // Autenticar
  await t.withIdentity({ email: "test@ipupy.org.py" });

  // Test: crear reporte
  const report = await t.mutation(api.reports.create, {
    churchId,
    month: 1,
    year: 2025,
    diezmos: 1000000,
    ofrendas: 500000,
  });

  // Verificar cálculo 10%
  expect(report.fondoNacional).toBe(150000);
  expect(report.status).toBe("draft");
});
```

## Deployment y CI/CD

### Flujo de Desarrollo

#### Git Workflow
```bash
# 1. Crear rama de feature
git checkout -b feature/nueva-funcionalidad

# 2. Hacer cambios y commits
git add .
git commit -m "feat: agregar nueva funcionalidad de reportes"

# 3. Push y crear Pull Request
git push origin feature/nueva-funcionalidad

# 4. Después de aprobación, merge a main
git checkout main
git pull origin main
git merge feature/nueva-funcionalidad
git push origin main
```

#### Conventional Commits
```bash
# Tipos de commits
feat:     # Nueva funcionalidad
fix:      # Corrección de bug
docs:     # Cambios en documentación
style:    # Formato, espacios, etc.
refactor: # Refactoring de código
test:     # Agregar tests
chore:    # Tareas de mantenimiento

# Ejemplos
git commit -m "feat(convex): agregar query para dashboard"
git commit -m "fix(auth): corregir validación de roles"
git commit -m "docs(api): actualizar documentación de mutations"
git commit -m "test(reports): agregar tests para cálculo de fondo"
```

### Deployment a Producción

#### Convex Deployment
```bash
# Deploy a producción
npx convex deploy --prod

# Esto:
# 1. Compila funciones TypeScript
# 2. Valida schema
# 3. Despliega a Convex Cloud
# 4. Actualiza índices y migraciones
```

#### Vercel Deployment
```bash
# Desarrollo: Deploy automático en PRs
# Production: Deploy automático en merge a main

# Variables de entorno en Vercel:
# - CONVEX_DEPLOYMENT=prod:your-project
# - NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
# - NEXTAUTH_SECRET=<production-secret>
# - GOOGLE_CLIENT_ID=<production-oauth>
# - GOOGLE_CLIENT_SECRET=<production-oauth>
```

## Debugging y Troubleshooting

### Convex Dashboard

El dashboard de Convex (https://dashboard.convex.dev) es tu mejor herramienta de debugging:

1. **Logs en Tiempo Real**: Ver todas las llamadas a funciones
2. **Data Browser**: Explorar y editar documentos
3. **Schema Inspector**: Verificar índices y validadores
4. **Function Playground**: Probar funciones manualmente

### Debugging Local

#### VS Code Configuration
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

#### Console Logging en Convex
```typescript
// convex/reports.ts
export const approve = mutation({
  handler: async (ctx, { reportId }) => {
    console.log("Approving report:", reportId);

    const user = await requireAuth(ctx);
    console.log("User role:", user.role);

    // Los logs aparecen en:
    // 1. Terminal donde corre `npx convex dev`
    // 2. Convex Dashboard > Logs tab
  },
});
```

### Herramientas de Desarrollo

#### Convex CLI Commands
```bash
# Ver logs en tiempo real
npx convex logs

# Ejecutar función manualmente
npx convex run reports:list

# Exportar datos
npx convex export

# Importar datos
npx convex import --table churches data.jsonl

# Limpiar deployment de desarrollo
npx convex data clear
```

#### Testing API con curl
```bash
# Queries no requieren autenticación en desarrollo
curl "https://your-deployment.convex.cloud/api/query" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "churches:list",
    "args": {}
  }'
```

## Contribución y Code Review

### Guidelines de Contribución

#### Antes de Contribuir
1. ✅ Leer esta guía completa
2. ✅ Configurar entorno de desarrollo
3. ✅ Ejecutar `npm run lint` y `npx tsc --noEmit` exitosamente
4. ✅ Revisar issues abiertos en GitHub
5. ✅ Discutir cambios grandes en issues primero

#### Pull Request Process
1. **Fork** del repositorio
2. **Crear rama** para feature/fix
3. **Hacer cambios** siguiendo convenciones TypeScript
4. **Agregar tests** para nueva funcionalidad
5. **Documentar** cambios relevantes
6. **Submit PR** con descripción detallada

#### Template de Pull Request
```markdown
## Descripción
Descripción clara de los cambios realizados.

## Tipo de cambio
- [ ] Bug fix (cambio que corrige un problema)
- [ ] Nueva funcionalidad (cambio que agrega funcionalidad)
- [ ] Breaking change (cambio que rompe funcionalidad existente)
- [ ] Documentación (cambios solo en documentación)

## Testing
- [ ] TypeScript compila sin errores (`npx tsc --noEmit`)
- [ ] Lint pasa sin warnings (`npm run lint`)
- [ ] Tests unitarios pasando
- [ ] Funcionalidad probada manualmente en Convex dev

## Checklist
- [ ] Código sigue las convenciones TypeScript del proyecto
- [ ] Self-review realizado
- [ ] Comentarios agregados en código complejo
- [ ] Documentación actualizada
- [ ] Schema validado en Convex Dashboard

## Screenshots (si aplica)
Agregar capturas de pantalla para cambios de UI.

## Referencias
Closes #[issue_number]
Related to #[issue_number]
```

### Code Review Guidelines

#### Como Reviewer
1. **Funcionalidad**: ¿Los cambios hacen lo que dicen hacer?
2. **Type Safety**: ¿Se usan tipos explícitos? ¿Se evita `any`?
3. **Performance**: ¿Las queries están optimizadas con índices?
4. **Seguridad**: ¿Se validan permisos correctamente?
5. **Tests**: ¿Los tests cubren casos edge?
6. **Documentación**: ¿Los cambios están documentados?

## Security Guidelines

### Authorization Best Practices

#### Siempre Verificar Autenticación
```typescript
// ✅ Correcto: verificar en cada función
export const sensitiveQuery = query({
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    // ... resto de lógica
  },
});

// ❌ Incorrecto: asumir autenticación
export const sensitiveQuery = query({
  handler: async (ctx) => {
    // PELIGRO: cualquiera puede llamar esto
    return await ctx.db.query("sensitiveData").collect();
  },
});
```

#### Validación de Input
```typescript
// ✅ Usar validators de Convex
export const create = mutation({
  args: {
    amount: v.number(),
    email: v.string(),
    churchId: v.id("churches"),
  },
  handler: async (ctx, args) => {
    // Validación adicional
    if (args.amount < 0) {
      throw new Error("Amount cannot be negative");
    }

    if (!args.email.includes("@")) {
      throw new Error("Invalid email format");
    }

    // ... resto de lógica
  },
});
```

#### Evitar Exposición de Datos Sensibles
```typescript
// ✅ Filtrar campos sensibles
export const getUserProfile = query({
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);

    // No exponer email a otros usuarios
    return {
      _id: user._id,
      fullName: user.fullName,
      role: user.role,
      // Omitir: email, supabase_id
    };
  },
});
```

## Performance Optimization

### Query Optimization

#### Usar Índices Correctamente
```typescript
// ✅ Query optimizada con índice
export const getReportsForChurch = query({
  args: { churchId: v.id("churches") },
  handler: async (ctx, { churchId }) => {
    // Usa índice "by_church" definido en schema
    return await ctx.db
      .query("monthlyReports")
      .withIndex("by_church", (q) => q.eq("churchId", churchId))
      .collect();
  },
});

// ❌ Query sin índice (lenta)
export const getReportsForChurch = query({
  handler: async (ctx, { churchId }) => {
    const allReports = await ctx.db.query("monthlyReports").collect();
    return allReports.filter((r) => r.churchId === churchId);
  },
});
```

#### Pagination para Grandes Datasets
```typescript
// ✅ Paginación eficiente
export const getReportsPaginated = query({
  args: {
    churchId: v.id("churches"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { churchId, paginationOpts }) => {
    return await ctx.db
      .query("monthlyReports")
      .withIndex("by_church", (q) => q.eq("churchId", churchId))
      .paginate(paginationOpts);
  },
});
```

## Recursos y Referencias

### Documentación Técnica
- 📚 [API Reference](API_REFERENCE.md)
- 🏗️ [Architecture](ARCHITECTURE.md)
- 💾 [Convex Schema](CONVEX_SCHEMA.md)
- 🔒 [Security](SECURITY.md)

### Herramientas Recomendadas
- **Editor**: VS Code con extensiones ESLint, Prettier, Convex
- **Database**: Convex Dashboard
- **API Testing**: Convex Function Playground, Postman
- **Monitoring**: Convex Dashboard Logs, Vercel Analytics

### Enlaces Útiles
- [Convex Documentation](https://docs.convex.dev)
- [NextAuth Documentation](https://authjs.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

### Comunidad y Soporte
- **GitHub Issues**: [Reportar bugs y solicitar features](https://github.com/anthonybirhouse/ipupy-tesoreria/issues)
- **Email**: desarrollo@ipupy.org.py

---

## Conclusión

Esta guía proporciona todo lo necesario para contribuir efectivamente al Sistema de Tesorería IPU PY usando Convex como backend. El sistema está diseñado con type safety, real-time capabilities, y code-based authorization.

### Principios de Desarrollo
1. **Type Safety**: TypeScript estricto en todo el stack
2. **Authorization First**: Verificar permisos en cada función
3. **Real-time by Default**: Aprovechar subscripciones de Convex
4. **Documentación**: Documentar decisiones y cambios importantes
5. **Performance**: Usar índices y paginación apropiadamente

### Siguientes Pasos
1. Configurar entorno con `npx convex dev`
2. Explorar schema en `convex/schema.ts`
3. Revisar funciones existentes en `convex/`
4. Probar funciones en Convex Dashboard
5. Hacer primera contribución

¡Bienvenido al equipo de desarrollo del Sistema de Tesorería IPU PY! 🚀

---

**Última actualización**: Enero 2025  
**Versión**: 4.0.0 (Convex Migration)  
**Autor**: Equipo Técnico IPU PY
