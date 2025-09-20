# IPU PY Tesorería - Cloud Gateway para Vercel

## 🚀 Despliegue en Vercel

### Paso 1: Preparar el repositorio
```bash
# Clonar o crear repositorio
git init
git add .
git commit -m "Initial commit - IPU PY Tesorería System"
git branch -M main
git remote add origin https://github.com/tu-usuario/ipupy-tesoreria.git
git push -u origin main
```

### Paso 2: Configurar base de datos PostgreSQL

#### Opción A: Vercel Postgres (Recomendado)
1. Ve a tu proyecto en Vercel
2. Pestaña "Storage" → "Create Database" → "Postgres"
3. Copia la `DATABASE_URL` generada

#### Opción B: Supabase
1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ve a Settings → Database
3. Copia la connection string (modo de transacción)

### Paso 3: Variables de entorno en Vercel
En tu proyecto de Vercel, ve a Settings → Environment Variables y agrega:

```
SUPABASE_DB_URL=tu_database_url_aqui
SUPABASE_URL=https://tu_proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu_service_role_key_seguro
JWT_SECRET=tu_jwt_secret_muy_seguro_aqui
ADMIN_EMAIL=admin@ipupy.org
ADMIN_PASSWORD=password_inicial_seguro
NODE_ENV=production
```

### Paso 4: Desplegar
1. Conecta tu repositorio GitHub a Vercel
2. Vercel detectará automáticamente la configuración
3. El despliegue se iniciará automáticamente

## 🔧 Estructura del proyecto

```
cloud-gateway/
├── api/                  # Serverless functions
│   ├── auth.js          # Autenticación
│   ├── churches.js      # Gestión de iglesias
│   ├── dashboard.js     # Dashboard principal
│   ├── export.js        # Exportación a Excel
│   ├── import.js        # Importación desde Excel
│   └── reports.js       # Gestión de informes
├── lib/
│   └── db.js           # Configuración PostgreSQL
├── public/
│   ├── index.html      # App original (legacy)
│   └── app.html        # App modernizada
├── .env.example        # Variables de entorno ejemplo
├── package.json        # Dependencias
├── vercel.json         # Configuración Vercel
└── README.md          # Este archivo
```

## 📱 Uso del sistema

### Primera vez (Inicialización)
1. Accede a `/app.html` en tu dominio
2. Click en "Inicializar Sistema"
3. Configura email y contraseña del administrador
4. ¡Listo para usar!

### Funcionalidades principales

#### 📊 Dashboard
- Resumen de iglesias activas
- Total de entradas del mes
- Fondo nacional acumulado
- Informes recientes

#### 📄 Gestión de Informes
- Visualizar informes por mes/año
- Filtros avanzados
- Cálculos automáticos del 10% fondo nacional

#### ⛪ Gestión de Iglesias
- Lista completa de iglesias
- Información de pastores
- Grados ministeriales y posiciones

#### 📤 Importación
- Importar desde Excel existente
- Validación automática de datos
- Reporte de errores detallado

#### 📥 Exportación
- Exportar informe mensual
- Resumen anual
- Lista de iglesias
- Formato Excel optimizado

## 🔐 Seguridad

- Autenticación JWT
- Roles de usuario (admin/church)
- Validación de datos
- Conexión SSL a base de datos
- Variables de entorno seguras

## 📊 Base de datos

### Tablas principales:
- `churches`: Información de iglesias
- `reports`: Informes mensuales
- `users`: Sistema de usuarios

### Datos pre-cargados:
- 22 iglesias de IPU Paraguay
- Información completa de pastores
- Estructura de informes financieros

## 🛠️ Desarrollo local

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus datos

# Ejecutar en desarrollo
npm run dev
```

## 📞 Soporte

Para reportar problemas o solicitar funcionalidades:
1. Crear issue en GitHub
2. Contactar al administrador del sistema
3. Documentar pasos para reproducir errores

## 🎯 Próximas mejoras

- [ ] App móvil para iglesias
- [ ] Notificaciones automáticas
- [ ] Reportes gráficos avanzados
- [ ] Integración con sistemas bancarios
- [ ] Backup automático

---

**Desarrollado para la Iglesia Pentecostal Unida del Paraguay**
Sistema de Tesorería Nacional - Versión Vercel 2024
