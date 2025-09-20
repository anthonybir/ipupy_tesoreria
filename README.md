# IPU PY Tesorería - Sistema de Tesorería Nacional

[![Vercel](https://vercelbadges.com/api/anthonybirhouse/ipupy-tesoreria)](https://vercel.com/anthonybirhouse/ipupy-tesoreria)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Enabled-brightgreen.svg)](https://supabase.com/)

Sistema integral de gestión de tesorería para la **Iglesia Pentecostal Unida del Paraguay** (IPU PY). Desarrollado específicamente para administrar las finanzas de 22 iglesias locales con reportes mensuales centralizados.

🌐 **Producción**: [ipupytesoreria.vercel.app](https://ipupytesoreria.vercel.app)

## ✨ Características Principales

- 📊 **Dashboard Centralizado** - Resumen financiero en tiempo real
- ⛪ **Gestión de 22 Iglesias** - Base de datos completa con información pastoral
- 📈 **Reportes Mensuales** - Sistema completo de informes financieros
- 🔐 **Autenticación Segura** - JWT + Google OAuth para @ipupy.org.py
- 📤 **Importación/Exportación Excel** - Compatibilidad total con formatos existentes
- 💰 **Cálculo Automático** - Fondo nacional (10%) y balances
- 🏦 **Control Bancario** - Seguimiento de depósitos y movimientos
- 📱 **Interfaz Responsiva** - Optimizado para móviles y escritorio

## 🚀 Inicio Rápido

### 1. Despliegue en Vercel (Recomendado)

```bash
# Clonar el repositorio
git clone https://github.com/anthonybirhouse/ipupy-tesoreria.git
cd ipupy-tesoreria

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales
```

### 2. Configuración de Base de Datos

#### Opción A: Supabase (Recomendado)
1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a Settings → Database → Connection string
3. Copiar la URI de conexión (Transaction mode)

#### Opción B: Vercel Postgres
1. En tu proyecto Vercel: Storage → Create Database → Postgres
2. Copiar la `DATABASE_URL` generada

### 3. Variables de Entorno

Configurar en Vercel (Settings → Environment Variables):

```bash
# Base de datos
SUPABASE_DB_URL=postgresql://postgres:[password]@[host]:5432/postgres
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres

# Autenticación
JWT_SECRET=tu_jwt_secret_muy_seguro_minimo_32_caracteres
ADMIN_EMAIL=administracion@ipupy.org.py
ADMIN_PASSWORD=password_inicial_muy_seguro

# Configuración IPU Paraguay
RUC_IPUPY=80017726-6
ORGANIZATION_NAME=Iglesia Pentecostal Unida del Paraguay

# Producción
NODE_ENV=production
```

### 4. Despliegue Automático
1. Conectar repositorio GitHub a Vercel
2. Configurar variables de entorno
3. Deploy automático al hacer push a `main`

### 5. Inicialización del Sistema
1. Acceder a tu dominio Vercel
2. Ejecutar migraciones automáticas en primer acceso
3. Configurar usuario administrador inicial

## 🏗️ Arquitectura del Sistema

### Stack Tecnológico
- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Backend**: Node.js 20.x con Express
- **Base de Datos**: PostgreSQL 16 (Supabase)
- **Autenticación**: JWT + Google OAuth
- **Despliegue**: Vercel Serverless Functions
- **Moneda**: Guaraní Paraguayo (PYG)

### Estructura del Proyecto

```
ipupy-tesoreria/
├── api/                    # 10 Serverless Functions
│   ├── auth.js            # Autenticación JWT/Google OAuth
│   ├── churches.js        # Gestión de iglesias
│   ├── church-transactions.js  # Transacciones por iglesia
│   ├── dashboard.js       # Dashboard y métricas
│   ├── export.js         # Exportación Excel
│   ├── families.js       # Gestión de familias
│   ├── import.js         # Importación Excel
│   ├── members.js        # Gestión de miembros
│   ├── reports.js        # Reportes financieros
│   └── transactions.js   # Transacciones generales
├── src/
│   ├── lib/              # Librerías compartidas
│   │   ├── db.js         # Abstracción de base de datos
│   │   ├── db-supabase.js # Implementación PostgreSQL
│   │   └── cors.js       # Configuración CORS
│   └── server.js         # Servidor de desarrollo
├── migrations/           # Migraciones de base de datos
├── public/              # Frontend estático
├── docs/               # Documentación técnica
└── scripts/            # Scripts de utilidad
```

### API Endpoints (10 Funciones Consolidadas)

| Endpoint | Función | Descripción |
|----------|---------|-------------|
| `/api/auth` | Autenticación | Login JWT/OAuth, registro, verificación |
| `/api/churches` | Iglesias | CRUD de 22 iglesias IPU Paraguay |
| `/api/church-transactions` | Transacciones de Iglesia | Movimientos financieros por iglesia |
| `/api/dashboard` | Dashboard | Métricas y resúmenes ejecutivos |
| `/api/export` | Exportación | Generación de archivos Excel |
| `/api/families` | Familias | Gestión de familias por iglesia |
| `/api/import` | Importación | Procesamiento de archivos Excel |
| `/api/members` | Miembros | Gestión de miembros de iglesias |
| `/api/reports` | Reportes | Informes mensuales y anuales |
| `/api/transactions` | Transacciones | Movimientos financieros generales |

## 📊 Funcionalidades del Sistema

### Dashboard Ejecutivo
- **Resumen Financiero**: Total de ingresos mensuales de las 22 iglesias
- **Fondo Nacional**: Cálculo automático del 10% de diezmos y ofrendas
- **Iglesias Activas**: Estado y última actividad de cada iglesia
- **Métricas Clave**: Asistencia, bautismos, depósitos bancarios

### Gestión de Iglesias
- **Base de Datos Completa**: 22 iglesias IPU Paraguay pre-cargadas
- **Información Pastoral**: Datos completos de pastores, grados ministeriales
- **Documentación Legal**: RUC, cédulas, posiciones eclesiásticas
- **Estados**: Control de iglesias activas/inactivas

### Sistema de Reportes Mensuales

#### Entradas del Mes
- Diezmos, Ofrendas, Anexos
- Departamentos: Caballeros, Damas, Jóvenes, Niños
- Otros ingresos especiales

#### Salidas del Mes
- Honorarios pastorales (con facturación legal)
- Servicios básicos: Electricidad, Agua, Basura
- Otros gastos operativos

#### Ofrendas Fondo Nacional
- Misiones, Lazos de Amor, Misión Posible
- APY, Instituto Bíblico, Diezmo Pastoral
- Cálculo automático del 10%

### Importación/Exportación Excel
- **Formato Compatible**: Mantiene estructura de reportes existentes
- **Validación Automática**: Verificación de datos antes de importar
- **Reportes Detallados**: Exportación con formatos oficiales IPU
- **Historial Completo**: Backup de todos los movimientos

### Control Bancario
- **Seguimiento de Depósitos**: Números de depósito y fechas
- **Conciliación**: Comparación entre reportado y depositado
- **Alertas**: Identificación de discrepancias automáticas

## 🔐 Seguridad y Autenticación

### Métodos de Autenticación
- **JWT Tokens**: Sesiones seguras con expiración configurable
- **Google OAuth**: Acceso restringido a dominio @ipupy.org.py
- **Usuario Sistema**: `administracion@ipupy.org.py` (propietario del sistema)
- **Validación de Roles**: Admin/Iglesia con permisos diferenciados

### Medidas de Seguridad
- **SSL/TLS**: Conexiones encriptadas a base de datos
- **CORS Configurado**: Protección contra ataques cross-origin
- **Validación de Entrada**: Sanitización de todos los datos
- **Variables Seguras**: Configuración mediante variables de entorno
- **Rate Limiting**: Protección contra ataques DDoS

## 💾 Base de Datos PostgreSQL

### Esquema Principal
```sql
-- 8 Tablas principales
├── churches (22 iglesias IPU Paraguay)
├── reports (informes mensuales)
├── users (sistema de autenticación)
├── members (miembros de iglesias)
├── families (grupos familiares)
├── transactions (movimientos financieros)
├── fund_categories (categorías de fondos)
└── worship_records (registros de cultos)
```

### Datos Pre-cargados
- **22 Iglesias IPU Paraguay** con información completa
- **Pastores y Ministerio**: Grados, posiciones, documentos legales
- **Estructura Financiera**: Categorías de ingresos y gastos
- **Configuración Paraguay**: Moneda, impuestos, formato de documentos

## 🛠️ Desarrollo Local

### Prerequisitos
- Node.js 20.x
- PostgreSQL 16+ o cuenta Supabase
- Git

### Configuración
```bash
# Clonar repositorio
git clone https://github.com/anthonybirhouse/ipupy-tesoreria.git
cd ipupy-tesoreria

# Instalar dependencias
npm install

# Configurar entorno
cp .env.example .env.local
# Editar .env.local con credenciales reales

# Ejecutar migraciones
npm run migrate

# Configurar administrador
npm run setup:admin

# Iniciar desarrollo
npm run dev
```

### Scripts Disponibles
```bash
npm run dev          # Servidor de desarrollo
npm run build        # Preparar para producción
npm run test         # Ejecutar pruebas
npm run migrate      # Aplicar migraciones
npm run health       # Verificar estado del sistema
npm run lint         # Verificar código
```

## 📚 Documentación Completa

- **[API Reference](docs/API_REFERENCE.md)** - Documentación completa de los 10 endpoints
- **[System Architecture](docs/architecture/SYSTEM_ARCHITECTURE.md)** - Arquitectura técnica del sistema
- **[Vercel Deployment](docs/deployment/VERCEL_DEPLOYMENT.md)** - Guía detallada de despliegue
- **[Migration History](docs/MIGRATION_HISTORY.md)** - Historial de consolidación de funciones
- **[User Guide](docs/USER_GUIDE.md)** - Guía de usuario en español
- **[Developer Guide](docs/DEVELOPER_GUIDE.md)** - Guía para desarrolladores
- **[Database Schema](docs/architecture/DATABASE_SCHEMA.md)** - Esquema de base de datos

## 🚀 Historial de Consolidación

El sistema fue exitosamente **consolidado de 25 funciones a 10** para cumplir con los límites del plan Vercel Hobby:

### Funciones Eliminadas/Consolidadas (15)
- Endpoints redundantes combinados en funciones principales
- Lógica de validación integrada en endpoints respectivos
- Utilidades movidas a librerías compartidas
- Scripts de migración automatizados

### Funciones Actuales (10)
Cada función optimizada para máxima eficiencia y múltiples operaciones.

## 📞 Soporte y Contribución

### Reportar Problemas
- **GitHub Issues**: [Crear issue](https://github.com/anthonybirhouse/ipupy-tesoreria/issues)
- **Email**: administracion@ipupy.org.py
- **Documentar**: Pasos detallados para reproducir errores

### Contribuir al Proyecto
1. Fork del repositorio
2. Crear rama de feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 🎯 Roadmap 2025

### Próximas Funcionalidades
- [ ] **App Móvil Nativa** - React Native para iOS/Android
- [ ] **Notificaciones Push** - Recordatorios de reportes mensuales
- [ ] **Dashboard Analítico** - Gráficos avanzados con Chart.js
- [ ] **Integración Bancaria** - API de bancos paraguayos
- [ ] **Backup Automático** - Respaldos programados en la nube
- [ ] **Reportes AI** - Análisis predictivo de tendencias
- [ ] **Sistema de Alertas** - Notificaciones automáticas por discrepancias

### Optimizaciones Técnicas
- [ ] **PWA Completa** - Instalación en dispositivos móviles
- [ ] **Cache Inteligente** - Mejora de performance
- [ ] **CDN Global** - Distribución mundial de contenido
- [ ] **Tests Automatizados** - Cobertura del 90%+

---

## 📄 Licencia y Derechos

**MIT License** - Ver [LICENSE](LICENSE) para detalles completos.

**Desarrollado para:**
**Iglesia Pentecostal Unida del Paraguay**
Sistema de Tesorería Nacional - Versión 2.0.0 (2024)

**Tecnología:** Vercel Serverless Functions | **Base de Datos:** Supabase PostgreSQL | **Desplegado en:** [ipupytesoreria.vercel.app](https://ipupytesoreria.vercel.app)
