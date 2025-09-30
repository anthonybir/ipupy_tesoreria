# IPU PY Tesorería - Sistema de Tesorería Nacional

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth-green.svg)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-black.svg)](https://vercel.com/)

Sistema integral de gestión de tesorería para la **Iglesia Pentecostal Unida del Paraguay** (IPU PY). Plataforma moderna construida con Next.js 15 y Supabase para administrar las finanzas de 22 iglesias locales con reportes mensuales centralizados.

🌐 **Producción**: [ipupytesoreria.vercel.app](https://ipupytesoreria.vercel.app)

## ✨ Características Principales

- 📊 **Dashboard Centralizado** - Métricas financieras en tiempo real con visualizaciones
- ⛪ **Gestión Multi-Iglesia** - Administración de 22 iglesias con información pastoral completa
- 📈 **Reportes Mensuales** - Sistema integral de informes financieros
- 🔐 **Autenticación Segura** - Google OAuth via Supabase para @ipupy.org.py
- 📤 **Excel Compatible** - Importación/exportación con formatos existentes
- 💰 **Cálculos Automáticos** - Fondo nacional (10%) y balances
- 🏦 **Control Bancario** - Seguimiento de depósitos y transacciones
- 📱 **Diseño Responsivo** - Optimizado para móviles y escritorio con touch targets
- 👥 **Sistema de Roles** - 6 roles simplificados y jerárquicos
- ⚙️ **Panel de Configuración** - Sistema administrable de configuración
- 🔒 **Seguridad Mejorada** - RLS con contexto de usuario robusto
- 📋 **Transacciones ACID** - Integridad de datos garantizada
- 🎨 **Design System Moderno** - Tokens, animaciones, y componentes coherentes
- ⌨️ **Navegación por Teclado** - 15+ atajos para usuarios avanzados
- 📉 **Visualizaciones Ligeras** - Charts SVG sin dependencias pesadas (~5KB)
- ♿ **Accesibilidad WCAG 2.1** - Level AA compliant con soporte para motion reducido

## 🚀 Inicio Rápido

### Prerequisitos

- Node.js 20+
- Cuenta de Supabase
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
# Editar .env.local con tus credenciales de Supabase

# Ejecutar migraciones
npm run db:migrate

# Iniciar servidor de desarrollo
npm run dev
```

Visitar [http://localhost:3000](http://localhost:3000)

## 🏗 Arquitectura

### Stack Tecnológico

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4, shadcn/ui, Radix UI
- **Backend**: Next.js API Routes (Serverless)
- **Database**: PostgreSQL via Supabase con custom pooling
- **Auth**: Supabase Auth con Google OAuth + Magic Link
- **Hosting**: Vercel
- **State**: React State + Custom hooks, TanStack Query v5

### Estructura del Proyecto

```
ipupy-tesoreria/
├── src/
│   ├── app/              # Next.js 15 App Router
│   │   ├── api/          # API routes serverless
│   │   ├── (routes)/     # Páginas de la aplicación
│   │   └── layout.tsx    # Layout principal
│   ├── components/       # Componentes React
│   ├── lib/             # Utilidades y configuración
│   │   └── supabase/    # Cliente Supabase
│   └── types/           # TypeScript types
├── migrations/          # SQL migrations
├── public/             # Assets estáticos
└── docs/              # Documentación
```

## 🔐 Autenticación y Seguridad

### Sistema de Autenticación

- **Provider**: Google OAuth via Supabase
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

- Row Level Security (RLS) con contexto de usuario mejorado
- `executeWithContext` para queries seguras con RLS
- Autenticación server-side con middleware
- Cookies httpOnly para sesiones
- CORS estricto con dominios permitidos
- HTTPS obligatorio en producción
- Rate limiting en API routes
- Audit trail completo con `user_activity`

## 📊 Base de Datos

### Tablas Principales

- `churches` - 22 iglesias con información pastoral
- `monthly_reports` - Reportes financieros mensuales (expandido)
- `profiles` - Perfiles de usuarios con 6 roles simplificados
- `system_configuration` - Configuración administrable del sistema
- `fund_balances` - Balances de fondos por iglesia
- `fund_transactions` - Transacciones de fondos
- `donors` - Registro de donantes
- `user_activity` - Auditoría completa de actividades
- `role_permissions` - Matriz de permisos por rol

### Migraciones

Las migraciones se ejecutan automáticamente via Supabase. Para ejecutar manualmente:

```bash
npm run db:migrate
```

## 🚢 Deployment

### Vercel (Recomendado)

1. Fork este repositorio
2. Importar en Vercel
3. Configurar variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `DATABASE_URL`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
4. Deploy

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

### Arquitectura de Base de Datos Mejorada
- **executeWithContext**: Ejecución segura con contexto RLS
- **executeTransaction**: Transacciones ACID para operaciones complejas
- **Connection Pool Health**: Monitoreo y recuperación automática de conexiones
- **Retry Logic**: Recuperación automática con backoff exponencial

### Simplificación de Roles (Migration 023)
- **6 Roles**: Simplificado desde 8 roles para mejor claridad
- **Role Hierarchy**: Sistema jerárquico con niveles de permisos
- **Permission Matrix**: Documentación clara de permisos por rol

### Seguridad Reforzada
- **RLS Context Fix**: Corrección crítica del fallback de autenticación
- **CORS Security**: Restricción estricta de orígenes permitidos
- **Environment Validation**: Validación de variables críticas al inicio

### Experiencia de Usuario
- **shadcn/ui**: Migración a componentes modernos con Radix UI
- **TanStack Query v5**: Migration completa con nuevas APIs
- **Type Safety**: Mejoras en TypeScript en toda la aplicación

## 📖 Documentación

- [Guía de Inicio Rápido](./docs/QUICK_START.md)
- [Arquitectura del Sistema](./docs/ARCHITECTURE.md)
- **[Sistema de Configuración](./docs/CONFIGURATION.md)** ✨
- **[Database Layer](./docs/DATABASE.md)** ✨
- **[Seguridad y RLS](./docs/SECURITY.md)** ✨
- [API Reference](./docs/API_REFERENCE.md)
- [Guía de Desarrollo](./docs/DEVELOPER_GUIDE.md)
- [Historial de Migraciones](./docs/MIGRATION_HISTORY.md)

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