# Guía Completa de Despliegue en Vercel - IPU PY Tesorería

## Descripción General

Esta guía proporciona instrucciones detalladas para desplegar el Sistema de Tesorería IPU PY en Vercel, incluyendo configuración de base de datos, variables de entorno, y optimizaciones específicas para el plan Hobby.

## Prerequisitos

### Cuentas Requeridas
- ✅ Cuenta GitHub con el repositorio
- ✅ Cuenta Vercel (gratuita o pro)
- ✅ Cuenta Supabase (recomendado) o Vercel Postgres
- ✅ Proyecto Google Cloud (para OAuth)

### Herramientas Locales
```bash
# Node.js y npm
node --version  # >= 20.x
npm --version   # >= 10.x

# Vercel CLI (opcional)
npm i -g vercel

# Git
git --version
```

## Paso 1: Preparación del Repositorio

### 1.1 Clonar y Configurar
```bash
# Clonar el repositorio
git clone https://github.com/anthonybirhouse/ipupy-tesoreria.git
cd ipupy-tesoreria

# Instalar dependencias
npm install

# Verificar estructura
npm run check
```

### 1.2 Verificar Configuración Vercel
```bash
# Verificar vercel.json
cat vercel.json
```

**Contenido esperado:**
```json
{
  "version": 2,
  "name": "ipupy-tesoreria",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/public/$1"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ],
  "functions": {
    "api/**/*.js": {
      "maxDuration": 10
    }
  },
  "regions": ["iad1"]
}
```

## Paso 2: Configuración de Base de Datos

### Opción A: Supabase (Recomendado)

#### 2.1 Crear Proyecto Supabase
1. Ir a [supabase.com](https://supabase.com)
2. Crear nuevo proyecto:
   - **Nombre**: `ipupy-tesoreria`
   - **Región**: `South America (São Paulo)`
   - **Password**: Generar contraseña segura

#### 2.2 Configurar Base de Datos
```bash
# Obtener connection string
# Dashboard → Settings → Database → Connection string
# Copiar URI en modo "Transaction"
```

**Formato esperado:**
```
postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

#### 2.3 Ejecutar Migraciones
```sql
-- En Supabase SQL Editor, ejecutar en orden:
-- 1. migrations/001_initial_schema.sql
-- 2. migrations/002_member_management.sql
-- 3. migrations/003_analytics_tables.sql
-- 4. migrations/004_seed_data.sql
-- 5. migrations/005_dual_level_accounting_enhancement.sql
-- 6. migrations/006_add_google_auth.sql
-- 7. migrations/007_fund_management_tables.sql
```

### Opción B: Vercel Postgres

#### 2.1 Crear Database en Vercel
1. Dashboard Vercel → Tu proyecto → Storage tab
2. Create Database → Postgres
3. Configurar:
   - **Name**: `ipupy-tesoreria-db`
   - **Region**: `Washington, D.C., USA (iad1)`

#### 2.2 Conectar a Proyecto
```bash
# Vercel automáticamente configura variables de entorno
# DATABASE_URL se crea automáticamente
```

## Paso 3: Configuración de Google OAuth

### 3.1 Configurar Google Cloud Console
1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. Crear nuevo proyecto: `IPU-PY-Tesoreria`
3. Habilitar APIs:
   - Google+ API
   - Google Identity API

### 3.2 Configurar OAuth 2.0
```bash
# Credentials → Create Credentials → OAuth 2.0 Client IDs
```

**Configuración:**
- **Application type**: Web application
- **Name**: IPU PY Tesorería
- **Authorized JavaScript origins**:
  - `https://ipupytesoreria.vercel.app`
  - `http://localhost:3000` (desarrollo)
- **Authorized redirect URIs**:
  - `https://ipupytesoreria.vercel.app/auth/google/callback`

### 3.3 Configurar Dominio Restringido
```bash
# OAuth consent screen → Internal User Type
# Authorized domains: ipupy.org.py
```

## Paso 4: Variables de Entorno

### 4.1 Variables Requeridas en Vercel

#### Base de Datos
```bash
# PostgreSQL Connection
SUPABASE_DB_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

# Supabase Specific (si usas Supabase)
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

#### Autenticación
```bash
# JWT Configuration
JWT_SECRET=tu_jwt_secret_muy_seguro_minimo_32_caracteres_aqui
JWT_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Admin Configuration
ADMIN_EMAIL=administracion@ipupy.org.py
ADMIN_PASSWORD=password_inicial_muy_seguro
```

#### Configuración IPU Paraguay
```bash
# Organization Details
RUC_IPUPY=80017726-6
ORGANIZATION_NAME=Iglesia Pentecostal Unida del Paraguay
LEGAL_STATUS=Personería Jurídica N° 17028

# Financial Configuration
IVA_RATE_10=0.10
IVA_RATE_5=0.05
FONDO_NACIONAL_PERCENTAGE=0.10
```

#### Configuración de Aplicación
```bash
# Environment
NODE_ENV=production
TIMEZONE=America/Asuncion
CURRENCY=PYG
LOCALE=es_PY

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=/tmp/uploads

# CORS
ALLOWED_ORIGINS=https://ipupytesoreria.vercel.app

# Pagination
DEFAULT_PAGE_SIZE=50
MAX_PAGE_SIZE=200
```

### 4.2 Configurar en Vercel Dashboard

1. **Ir a Settings → Environment Variables**
2. **Agregar cada variable individualmente**
3. **Configurar para Production y Preview**

```bash
# Comando alternativo con Vercel CLI
vercel env add JWT_SECRET
# Introducir valor cuando se solicite
```

## Paso 5: Despliegue

### 5.1 Conectar Repositorio GitHub

1. **Dashboard Vercel → Add New Project**
2. **Import Git Repository → Seleccionar repo**
3. **Configure Project:**
   - **Project Name**: `ipupy-tesoreria`
   - **Framework Preset**: Other
   - **Root Directory**: `./` (raíz)
   - **Build Command**: `npm run build`
   - **Output Directory**: `public`
   - **Install Command**: `npm install`

### 5.2 Deploy Automático
```bash
# Vercel detecta automáticamente la configuración
# Deploy se inicia automáticamente
```

### 5.3 Verificar Despliegue
```bash
# Verificar que las 10 funciones se desplegaron
curl https://tu-dominio.vercel.app/api/auth?action=health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2024-12-20T10:00:00Z",
  "functions": 10
}
```

## Paso 6: Configuración Post-Despliegue

### 6.1 Inicializar Base de Datos
```bash
# Primera visita a la aplicación ejecuta automáticamente:
# - Creación de tablas
# - Inserción de datos semilla (22 iglesias)
# - Configuración inicial
```

### 6.2 Configurar Usuario Administrador
```bash
# Ejecutar script de configuración
curl -X POST https://tu-dominio.vercel.app/api/auth?action=setup-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "administracion@ipupy.org.py",
    "password": "password_temporal_cambiar"
  }'
```

### 6.3 Verificar Funcionalidades
```bash
# Test API endpoints
npm run test:integration

# Verificar importación/exportación Excel
# Acceder a https://tu-dominio.vercel.app/admin
```

## Paso 7: Optimizaciones para Plan Hobby

### 7.1 Límites del Plan Hobby
- ✅ **Funciones**: 10/12 (dentro del límite)
- ✅ **Bandwidth**: 100GB/mes
- ✅ **Build Minutes**: 6000/mes
- ✅ **Database Rows**: 10k (Vercel Postgres)

### 7.2 Optimizaciones Implementadas
```javascript
// 1. Consolidación de funciones relacionadas
const consolidatedEndpoints = {
  '/api/church-transactions': 'Combina múltiples operaciones de transacciones',
  '/api/dashboard': 'Unifica métricas y analytics',
  '/api/reports': 'Maneja todos los tipos de reportes'
};

// 2. Caching eficiente
const cacheStrategy = {
  static: '1 year',
  api: '5 minutes',
  dashboard: '1 minute'
};

// 3. Lazy loading
const loadOnDemand = [
  'Excel processing',
  'Complex analytics',
  'Large reports'
];
```

### 7.3 Monitoring de Límites
```bash
# Verificar uso actual
vercel env ls
vercel logs --json

# Dashboard Vercel → Usage tab
```

## Paso 8: Configuración de Dominio (Opcional)

### 8.1 Configurar Dominio Personalizado
```bash
# Agregar dominio en Vercel
vercel domains add tesoreria.ipupy.org.py
```

### 8.2 Configurar DNS
```bash
# Agregar registros DNS:
# CNAME: tesoreria.ipupy.org.py → cname.vercel-dns.com
```

### 8.3 Actualizar Variables de Entorno
```bash
# Actualizar ALLOWED_ORIGINS
ALLOWED_ORIGINS=https://tesoreria.ipupy.org.py
```

## Paso 9: Configuración de SSL/Security

### 9.1 SSL Automático
- Vercel proporciona SSL automático
- Certificados renovados automáticamente
- HSTS habilitado

### 9.2 Security Headers
```javascript
// Verificar en vercel.json
const securityHeaders = [
  'X-Content-Type-Options: nosniff',
  'X-Frame-Options: DENY',
  'X-XSS-Protection: 1; mode=block',
  'Referrer-Policy: strict-origin-when-cross-origin'
];
```

## Paso 10: Monitoreo y Mantenimiento

### 10.1 Configurar Alertas
```bash
# Vercel Dashboard → Integrations
# - Slack notifications
# - Email alerts
# - Error tracking
```

### 10.2 Backup Automático
```bash
# Supabase: Backups diarios automáticos
# Vercel: Git repository backup
# Environment: Export variables

# Script de backup semanal
vercel env pull .env.backup
```

### 10.3 Health Checks
```bash
# Configurar monitoring
curl https://tu-dominio.vercel.app/api/dashboard?action=health

# Uptime monitoring con Vercel Analytics
```

## Troubleshooting Común

### Error: Function Timeout
```bash
# Verificar en vercel.json
"functions": {
  "api/**/*.js": {
    "maxDuration": 10  // Máximo para Hobby plan
  }
}
```

### Error: Database Connection
```bash
# Verificar connection string
# Verificar SSL settings
# Verificar firewall rules
```

### Error: Environment Variables
```bash
# Verificar variables están configuradas
vercel env ls

# Verificar sintaxis
node -e "console.log(process.env.JWT_SECRET)"
```

### Error: Build Failure
```bash
# Verificar logs
vercel logs

# Verificar dependencias
npm audit fix
```

## Checklist Final

### ✅ Pre-Deploy
- [ ] Repository configurado correctamente
- [ ] Variables de entorno configuradas
- [ ] Base de datos creada y migrada
- [ ] Google OAuth configurado
- [ ] Dominios autorizados configurados

### ✅ Post-Deploy
- [ ] Aplicación accesible
- [ ] API endpoints funcionando
- [ ] Autenticación funcionando
- [ ] Base de datos conectada
- [ ] Funciones de importación/exportación
- [ ] Usuario administrador creado

### ✅ Testing
- [ ] Login con email/password
- [ ] Login con Google OAuth
- [ ] Crear reporte mensual
- [ ] Exportar a Excel
- [ ] Importar desde Excel
- [ ] Dashboard cargando correctamente

## Soporte y Contacto

### Reportar Problemas
- **GitHub Issues**: [Crear issue](https://github.com/anthonybirhouse/ipupy-tesoreria/issues)
- **Email**: administracion@ipupy.org.py
- **Documentación**: [docs/](../docs/)

### Recursos Adicionales
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Node.js Documentation](https://nodejs.org/docs/)

---

**Última actualización**: Diciembre 2024
**Versión**: 2.0.0
**Autor**: Equipo Técnico IPU PY