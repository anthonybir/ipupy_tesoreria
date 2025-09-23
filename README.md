# IPU PY Tesorería - Sistema de Tesorería Nacional

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth-green.svg)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-black.svg)](https://vercel.com/)

Sistema integral de gestión de tesorería para la **Iglesia Pentecostal Unida del Paraguay** (IPU PY). Plataforma moderna construida con Next.js 15 y Supabase para administrar las finanzas de 22 iglesias locales con reportes mensuales centralizados.

🌐 **Producción**: [ipupytesoreria.vercel.app](https://ipupytesoreria.vercel.app)

## ✨ Características Principales

- 📊 **Dashboard Centralizado** - Métricas financieras en tiempo real
- ⛪ **Gestión Multi-Iglesia** - Administración de 22 iglesias con información pastoral completa
- 📈 **Reportes Mensuales** - Sistema integral de informes financieros
- 🔐 **Autenticación Segura** - Google OAuth via Supabase para @ipupy.org.py
- 📤 **Excel Compatible** - Importación/exportación con formatos existentes
- 💰 **Cálculos Automáticos** - Fondo nacional (10%) y balances
- 🏦 **Control Bancario** - Seguimiento de depósitos y transacciones
- 📱 **Diseño Responsivo** - Optimizado para móviles y escritorio
- 👥 **Sistema de Roles** - 8 niveles de acceso granular

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
- **Styling**: Tailwind CSS 4, HeadlessUI
- **Backend**: Next.js API Routes (Serverless)
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth con Google OAuth
- **Hosting**: Vercel
- **State**: Zustand, React Query

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

### Roles del Sistema

1. **super_admin** - Control total del sistema
2. **admin** - Administradores de plataforma
3. **district_supervisor** - Supervisores regionales
4. **church_admin** - Líderes de iglesia
5. **treasurer** - Tesoreros
6. **secretary** - Secretarios
7. **member** - Miembros
8. **viewer** - Solo lectura

### Seguridad

- Row Level Security (RLS) en todas las tablas
- Autenticación server-side con middleware
- Cookies httpOnly para sesiones
- HTTPS obligatorio en producción

## 📊 Base de Datos

### Tablas Principales

- `churches` - 22 iglesias con información pastoral
- `reports` - Reportes financieros mensuales
- `profiles` - Perfiles de usuarios con roles
- `fund_transactions` - Transacciones de fondos
- `donors` - Registro de donantes
- `user_activity` - Auditoría de actividades

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

## 📖 Documentación

- [Guía de Inicio Rápido](./docs/QUICK_START.md)
- [Arquitectura del Sistema](./docs/ARCHITECTURE.md)
- [Guía de Configuración](./docs/SETUP_GUIDE.md)
- [API Reference](./docs/API_REFERENCE.md)
- [Guía de Desarrollo](./docs/DEVELOPER_GUIDE.md)
- [Guía de Deployment](./docs/DEPLOYMENT.md)

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