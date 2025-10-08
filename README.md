# IPU PY Tesorería - Sistema de Tesorería Nacional

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Convex](https://img.shields.io/badge/Convex-Backend-orange.svg)](https://convex.dev/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-black.svg)](https://vercel.com/)

Sistema integral de gestión de tesorería para la **Iglesia Pentecostal Unida del Paraguay** (IPU PY). Plataforma moderna construida con Next.js 15, Convex y NextAuth para administrar las finanzas de 22 iglesias locales con reportes mensuales centralizados.

🌐 **Producción**: [ipupytesoreria.vercel.app](https://ipupytesoreria.vercel.app)

## ✨ Características Principales

- 📊 **Dashboard Centralizado** - Métricas financieras en tiempo real con visualizaciones
- ⛪ **Gestión Multi-Iglesia** - Administración de 22 iglesias con información pastoral completa
- 📈 **Reportes Mensuales** - Sistema integral de informes financieros
- 🔐 **Autenticación Segura** - NextAuth v5 con Google OAuth para @ipupy.org.py
- 📤 **Excel Compatible** - Importación/exportación con formatos existentes
- 💰 **Cálculos Automáticos** - Fondo nacional (10%) y balances
- 🏦 **Control Bancario** - Seguimiento de depósitos y transacciones
- 📱 **Diseño Responsivo** - Optimizado para móviles y escritorio con touch targets
- 👥 **Sistema de Roles** - 6 roles simplificados y jerárquicos
- ⚙️ **Panel de Configuración** - Sistema administrable de configuración
- 🔒 **Seguridad Mejorada** - Autorización en código con Convex
- 📋 **Integridad de Datos** - Document transactions con Convex
- 🎨 **Design System Moderno** - Tokens, animaciones, y componentes coherentes
- ⌨️ **Navegación por Teclado** - 15+ atajos para usuarios avanzados
- 📉 **Visualizaciones Ligeras** - Charts SVG sin dependencias pesadas (~5KB)
- ♿ **Accesibilidad WCAG 2.1** - Level AA compliant con soporte para motion reducido

## 🚀 Inicio Rápido

### Prerequisitos

- Node.js 20+
- Cuenta de Convex (free tier: [convex.dev](https://convex.dev))
- Cuenta de Google Cloud (para OAuth)
- Cuenta de Vercel (para deployment)

### Instalación Local

```bash
# Clonar el repositorio
git clone https://github.com/anthonybirhouse/ipupy-tesoreria.git
cd ipupy-tesoreria

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Convex y Google OAuth

# Iniciar Convex desarrollo (en terminal separada)
npx convex dev

# Iniciar servidor de desarrollo Next.js
npm run dev
```

Visitar [http://localhost:3000](http://localhost:3000)

## 🏗 Arquitectura

### Stack Tecnológico

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4, shadcn/ui, Radix UI
- **Backend**: Convex (TypeScript-first backend)
- **Database**: Convex Document Database con real-time subscriptions
- **Auth**: NextAuth v5 con Google OAuth + Convex OIDC Bridge
- **Hosting**: Vercel (Frontend) + Convex Cloud (Backend)
- **State**: Convex React hooks + TanStack Query v5 (transición)

### Estructura del Proyecto

```
ipupy-tesoreria/
├── src/
│   ├── app/              # Next.js 15 App Router
│   │   ├── api/          # API routes serverless (wrapper REST sobre Convex)
│   │   ├── (routes)/     # Páginas de la aplicación
│   │   └── layout.tsx    # Layout principal
│   ├── components/       # Componentes React
│   ├── lib/             # Utilidades y configuración
│   │   ├── auth.ts      # NextAuth configuration
│   │   └── convex-*.ts  # Convex client utilities
│   └── types/           # TypeScript types
├── convex/              # Convex backend functions
│   ├── schema.ts        # Database schema
│   ├── *.ts             # Queries, mutations, actions
│   └── auth.config.ts   # OIDC bridge configuration
├── public/             # Assets estáticos
└── docs/              # Documentación
```

## 🔐 Autenticación y Seguridad

### Sistema de Autenticación

- **Provider**: NextAuth v5 con Google OAuth
- **Backend Integration**: Convex OIDC Bridge
- **Dominio Restringido**: Solo @ipupy.org.py
- **Admin Principal**: administracion@ipupy.org.py

### Roles del Sistema (Simplificado v2.0)

El sistema se ha simplificado de 8 a 6 roles jerárquicos:

1. **admin** - Administradores de plataforma (consolidado desde super_admin)
2. **district_supervisor** - Supervisores regionales
3. **pastor** - Líderes de iglesia (renombrado desde church_admin)
4. **treasurer** - Tesoreros
5. **secretary** - Secretarios
6. **member** - Miembros (convertido desde viewer)

**Roles Migrados (Migration 023):**
- `super_admin` → `admin`
- `church_admin` → `pastor`
- `viewer` → `member`

### Seguridad

- **Autorización en Código**: Convex authorization functions con `ctx.auth()`
- **NextAuth Sessions**: Autenticación server-side con JWT tokens
- **OIDC Integration**: Google tokens validados en Convex backend
- **Role-Based Access**: Verificación de roles en cada query/mutation
- **CORS Estricto**: Dominios permitidos configurados
- **HTTPS Obligatorio**: En producción
- **Rate Limiting**: En API routes REST
- **Audit Trail**: Completo con tabla `userActivity`

## 📊 Base de Datos

### Colecciones Principales (Convex)

- **churches** - 22 iglesias con información pastoral (incluye `supabase_id` para compatibilidad)
- **monthlyReports** - Reportes financieros mensuales con referencias a iglesias
- **profiles** - Perfiles de usuarios con 6 roles simplificados
- **systemConfiguration** - Configuración administrable del sistema
- **fundBalances** - Balances de fondos por iglesia
- **fundTransactions** - Transacciones de fondos con trazabilidad
- **fundEvents** - Eventos con aprobación y presupuesto
- **donors** - Registro de donantes
- **userActivity** - Auditoría completa de actividades
- **providers** - Registro centralizado de proveedores

### Schema y Migraciones

El schema de Convex está definido en `convex/schema.ts`. Los IDs legados de Supabase se preservan en el campo `supabase_id` para compatibilidad con APIs REST existentes.

**Migración desde Supabase**: Ver [CONVEX_MIGRATION_PLAN.md](./docs/CONVEX_MIGRATION_PLAN.md) para detalles de la estrategia de migración.

## 🚢 Deployment

### Vercel (Recomendado)

1. **Deploy Convex Backend**:
   ```bash
   npx convex deploy
   ```

2. **Configurar Vercel**:
   - Fork este repositorio
   - Importar en Vercel
   - Configurar variables de entorno:
     - `CONVEX_DEPLOYMENT` (prod:your-deployment)
     - `NEXT_PUBLIC_CONVEX_URL` (https://your-deployment.convex.cloud)
     - `NEXTAUTH_URL` (tu dominio de producción)
     - `NEXTAUTH_SECRET` (generar con `openssl rand -base64 32`)
     - `GOOGLE_CLIENT_ID`
     - `GOOGLE_CLIENT_SECRET`
   - Deploy

3. **Configurar OIDC en Convex**:
   - En Convex dashboard, configurar Google OAuth
   - Verificar que el OIDC bridge está activo

### Variables de Entorno

Ver [`.env.example`](./.env.example) para la lista completa de variables requeridas.

## 🆕 Novedades v3.3 - UX & Design System

### Design System Completo
- **Design Tokens**: Sistema completo de tokens CSS (tipografía, espaciado, sombras, animaciones)
- **Micro-Interacciones**: 9 tipos de animaciones GPU-accelerated (fade, slide, scale, bounce, etc.)
- **Dark Mode Mejorado**: Glassmorphism, sombras ajustadas, contraste optimizado
- **Componentes Visuales**: StatusPill con iconos, botones con elevación, cards interactivas

### Navegación Mejorada
- **Breadcrumbs**: Navegación consistente en 12+ páginas principales
- **Keyboard Shortcuts**: 15+ atajos estilo Vim (g h = home, g i = iglesias, ? = ayuda)
- **Skeleton Loaders**: 7 variantes de loading states que previenen layout shift

### Visualización de Datos
- **Charts Ligeros**: 3 componentes SVG personalizados (~5KB vs ~85KB Recharts)
  - MiniLineChart: Sparklines para tendencias
  - ProgressBar: Indicadores de progreso con variantes
  - SimpleBarChart: Gráficos de barras y comparaciones
- **StatCards Mejoradas**: Arrows de tendencia, porcentajes, mini charts embebidos

### Mobile & Accesibilidad
- **Touch Targets**: Mínimo 44x44px en todos los controles
- **Responsive Tables**: Vista de cards en móviles
- **WCAG 2.1 AA**: Cumplimiento completo con reduced motion support
- **iOS Optimizations**: Prevención de zoom en inputs, safe areas

### Bundle Impact
- **Total additions**: ~15KB gzipped
- **Charts**: 94% más pequeños que Recharts
- **Performance**: Sin impacto negativo, mejoras en perceived performance

## 🆕 Novedades v3.0-3.2

### Sistema de Configuración Administrable
- **Panel Admin Completo**: Configuración por secciones (General, Financiera, Seguridad, etc.)
- **Configuración en DB**: Almacenamiento persistente con `system_configuration`
- **Audit Trail**: Seguimiento completo de cambios de configuración

### Migración a Convex Backend
- **Document Database**: Schema TypeScript-first en lugar de SQL
- **Real-time Subscriptions**: Actualizaciones automáticas sin polling
- **Authorization in Code**: Verificación de permisos en funciones TypeScript
- **Serverless Functions**: Queries, mutations y actions escalables

### Simplificación de Roles (Migration 023)
- **6 Roles**: Simplificado desde 8 roles para mejor claridad
- **Role Hierarchy**: Sistema jerárquico con niveles de permisos
- **Permission Matrix**: Documentación clara de permisos por rol

### Seguridad Reforzada
- **NextAuth Integration**: Migración completa desde Supabase Auth
- **OIDC Bridge**: Integración segura entre Google OAuth y Convex
- **CORS Security**: Restricción estricta de orígenes permitidos
- **Environment Validation**: Validación de variables críticas al inicio

### Experiencia de Usuario
- **shadcn/ui**: Migración a componentes modernos con Radix UI
- **TanStack Query v5**: Migration completa con nuevas APIs
- **Type Safety**: Mejoras en TypeScript en toda la aplicación

## 📖 Documentación

- [Guía de Inicio Rápido](./docs/QUICK_START.md)
- [Arquitectura del Sistema](./docs/ARCHITECTURE.md)
- **[Convex Schema Reference](./docs/CONVEX_SCHEMA.md)** ✨
- **[Plan de Migración Convex](./docs/CONVEX_MIGRATION_PLAN.md)** 🚀
- **[Arquitectura Propuesta](./docs/Arquitectura%20propuesta%20(Next.js%2015%20+%20Vercel%20+%20Convex).md)** 📐
- **[Seguridad y Autorización](./docs/SECURITY.md)** ✨
- [API Reference](./docs/API_REFERENCE.md)
- [Guía de Desarrollo](./docs/DEVELOPER_GUIDE.md)
- [Sistema de Configuración](./docs/CONFIGURATION.md)

## 🛠 Desarrollo

### Comandos Disponibles

```bash
npm run dev        # Servidor de desarrollo
npm run build      # Build de producción
npm run start      # Servidor de producción
npm run lint       # Linter
npm run type-check # TypeScript check
```

### Estándares de Código

- TypeScript strict mode habilitado
- ESLint configurado
- Prettier para formateo
- Convenciones de nombres en español para dominio

## 📱 Características por Rol

### Administrador (administracion@ipupy.org.py)
- Dashboard completo con métricas
- Gestión de todas las iglesias
- Reportes consolidados
- Gestión de usuarios y roles
- Exportación de datos

### Tesorero de Iglesia
- Ingreso de reportes mensuales
- Gestión de donantes
- Registro de transacciones
- Vista de historial

### Miembro
- Vista de reportes públicos
- Información de la iglesia

## 🤝 Contribuir

1. Fork el proyecto
2. Crear branch de feature (`git checkout -b feature/NuevaCaracteristica`)
3. Commit cambios (`git commit -m 'feat: agregar nueva característica'`)
4. Push al branch (`git push origin feature/NuevaCaracteristica`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto es privado y propiedad de la Iglesia Pentecostal Unida del Paraguay.

## 👥 Equipo

- **Desarrollo**: Anthony Birhouse
- **Administración**: administracion@ipupy.org.py

## 🆘 Soporte

Para soporte técnico, contactar a administracion@ipupy.org.py

---

**IPU PY** - Iglesia Pentecostal Unida del Paraguay
Personería Jurídica N° 17028
RUC: 80017726-6