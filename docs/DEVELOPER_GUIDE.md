# Developer Guide - IPU PY Tesorería

## Bienvenido al Desarrollo

Esta guía está diseñada para desarrolladores que contribuirán al Sistema de Tesorería IPU PY. Aquí encontrará toda la información necesaria para configurar su entorno de desarrollo, entender la arquitectura y contribuir efectivamente al proyecto.

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

# PostgreSQL Client (opcional, para queries directas)
psql --version
```

#### Cuentas de Desarrollo
- ✅ Cuenta GitHub con acceso al repositorio
- ✅ Cuenta Supabase para base de datos de desarrollo
- ✅ Cuenta Vercel para deploys de prueba
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

# Verificar instalación
npm run check
npm run lint
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
# Database (Supabase Development)
SUPABASE_DB_URL=postgresql://postgres:[dev-password]@db.[dev-project].supabase.co:5432/postgres
DATABASE_URL=postgresql://postgres:[dev-password]@db.[dev-project].supabase.co:5432/postgres
SUPABASE_URL=https://[dev-project].supabase.co
SUPABASE_SERVICE_KEY=[dev-service-key]

# JWT (usar secreto de desarrollo)
JWT_SECRET=development_jwt_secret_at_least_32_characters_long
JWT_EXPIRES_IN=24h

# Google OAuth (configuración de desarrollo)
GOOGLE_CLIENT_ID=[dev-client-id].apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=[dev-client-secret]

# Admin Development
ADMIN_EMAIL=dev@ipupy.org.py
ADMIN_PASSWORD=dev_password_123

# Development Settings
NODE_ENV=development
DEBUG=true
LOG_LEVEL=debug
```

#### 4. Configurar Base de Datos de Desarrollo
```bash
# Ejecutar migraciones en Supabase desarrollo
npm run migrate

# Insertar datos de prueba
npm run seed:dev

# Configurar usuario administrador de desarrollo
npm run setup:admin:quick
```

#### 5. Iniciar Servidor de Desarrollo
```bash
# Modo desarrollo con hot reload
npm run dev

# El servidor estará disponible en:
# http://localhost:3000
```

## Estructura del Proyecto

### Arquitectura de Directorios
```
ipupy-tesoreria/
├── api/                    # 🚀 Serverless Functions (10)
│   ├── auth.js            # Autenticación y autorización
│   ├── churches.js        # CRUD de iglesias
│   ├── church-transactions.js  # Transacciones por iglesia
│   ├── dashboard.js       # Dashboard y métricas
│   ├── export.js         # Exportación a Excel
│   ├── families.js       # Gestión de familias
│   ├── import.js         # Importación desde Excel
│   ├── members.js        # Gestión de miembros
│   ├── reports.js        # Reportes financieros
│   └── transactions.js   # Transacciones generales
├── src/                   # 🔧 Core Libraries
│   ├── lib/              # Librerías compartidas
│   │   ├── db.js         # Abstracción de base de datos
│   │   ├── db-supabase.js # Implementación PostgreSQL
│   │   └── cors.js       # Configuración CORS
│   └── server.js         # Servidor de desarrollo Express
├── public/               # 🌐 Frontend Assets
│   ├── index.html        # Dashboard principal
│   ├── css/             # Estilos CSS
│   ├── js/              # JavaScript del cliente
│   └── images/          # Assets estáticos
├── migrations/           # 🗄️ Database Migrations
│   ├── 001_initial_schema.sql
│   ├── 002_member_management.sql
│   └── ...
├── scripts/             # 🛠️ Utility Scripts
│   ├── migrate.js       # Ejecutor de migraciones
│   ├── seed.js         # Datos de prueba
│   └── utilities/      # Scripts de utilidad
├── tests/              # 🧪 Test Suite
│   ├── api/            # Tests de API
│   ├── integration/    # Tests de integración
│   └── utilities/      # Utilidades de testing
├── docs/               # 📚 Documentation
└── config/             # ⚙️ Configuration Files
```

### Convenciones de Código

#### Naming Conventions
```javascript
// Variables y funciones: camelCase
const monthlyReport = {};
const calculateFondoNacional = () => {};

// Constantes: UPPER_SNAKE_CASE
const DATABASE_URL = process.env.DATABASE_URL;
const MAX_FILE_SIZE = 10485760;

// Clases: PascalCase
class ReportService {}
class ExcelExporter {}

// Archivos: kebab-case
church-transactions.js
member-management.sql
```

#### Code Structure
```javascript
// Estructura estándar de función API
module.exports = async function handler(req, res) {
  // 1. Configurar CORS
  setCORSHeaders(req, res);
  if (handlePreflight(req, res)) return;

  // 2. Validar autenticación
  const user = await validateAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // 3. Validar permisos
  if (!hasPermission(user, req.query.action)) {
    return res.status(403).json({ error: 'Sin permisos' });
  }

  // 4. Procesar según método HTTP
  switch (req.method) {
    case 'GET':
      return handleGet(req, res, user);
    case 'POST':
      return handlePost(req, res, user);
    case 'PUT':
      return handlePut(req, res, user);
    case 'DELETE':
      return handleDelete(req, res, user);
    default:
      return res.status(405).json({ error: 'Método no permitido' });
  }
};
```

## Patterns y Arquitectura

### Database Access Pattern
```javascript
// ✅ Patrón recomendado: Repository
class ChurchRepository {
  static async findById(id) {
    const { rows } = await db.query(
      'SELECT * FROM churches WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  }

  static async findActive() {
    const { rows } = await db.query(
      'SELECT * FROM churches WHERE active = true ORDER BY name'
    );
    return rows;
  }

  static async create(churchData) {
    const { rows } = await db.query(
      `INSERT INTO churches (name, city, pastor, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [churchData.name, churchData.city, churchData.pastor, churchData.phone]
    );
    return rows[0];
  }
}
```

### Service Layer Pattern
```javascript
// ✅ Lógica de negocio en servicios
class ReportService {
  static calculateFondoNacional(diezmos, ofrendas) {
    const total = parseFloat(diezmos) + parseFloat(ofrendas);
    return Math.round(total * 0.10);
  }

  static validateMonthlyReport(reportData) {
    const errors = [];

    if (!reportData.church_id) {
      errors.push('church_id es requerido');
    }

    if (reportData.month < 1 || reportData.month > 12) {
      errors.push('Mes debe estar entre 1 y 12');
    }

    if (reportData.diezmos < 0) {
      errors.push('Diezmos no puede ser negativo');
    }

    return errors;
  }

  static async generateMonthlyReport(churchId, month, year) {
    // Lógica compleja de generación de reportes
    const church = await ChurchRepository.findById(churchId);
    const transactions = await TransactionRepository.findByPeriod(
      churchId, month, year
    );

    return {
      church,
      period: { month, year },
      summary: this.calculateSummary(transactions),
      fondoNacional: this.calculateFondoNacional(
        transactions.diezmos,
        transactions.ofrendas
      )
    };
  }
}
```

### Error Handling Pattern
```javascript
// ✅ Manejo consistente de errores
class APIError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'APIError';
  }
}

// Uso en funciones API
const handleError = (error, res) => {
  console.error('API Error:', error);

  if (error instanceof APIError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code
    });
  }

  // Error no manejado
  return res.status(500).json({
    error: 'Error interno del servidor',
    code: 'INTERNAL_ERROR'
  });
};
```

## Testing

### Configuración de Tests

#### Estructura de Tests
```bash
tests/
├── api/                    # Tests de endpoints API
│   ├── auth.test.js
│   ├── churches.test.js
│   └── reports.test.js
├── integration/            # Tests de integración
│   ├── database.test.js
│   ├── excel-export.test.js
│   └── full-workflow.test.js
├── unit/                   # Tests unitarios
│   ├── services/
│   │   ├── ReportService.test.js
│   │   └── ExcelService.test.js
│   └── utils/
│       ├── validators.test.js
│       └── formatters.test.js
└── fixtures/               # Datos de prueba
    ├── sample-churches.json
    ├── sample-reports.json
    └── sample-excel-files/
```

#### Ejecutar Tests
```bash
# Todos los tests
npm test

# Tests específicos
npm run test:api
npm run test:integration
npm run test:unit

# Tests con coverage
npm run test:coverage

# Tests en modo watch
npm run test:watch
```

#### Ejemplo de Test API
```javascript
// tests/api/churches.test.js
const request = require('supertest');
const app = require('../../src/server');

describe('Churches API', () => {
  let authToken;
  let testChurch;

  beforeAll(async () => {
    // Setup: obtener token de autenticación
    const loginResponse = await request(app)
      .post('/api/auth?action=login')
      .send({
        email: 'test@ipupy.org.py',
        password: 'test_password'
      });

    authToken = loginResponse.body.token;
  });

  describe('GET /api/churches', () => {
    it('should return list of churches', async () => {
      const response = await request(app)
        .get('/api/churches')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.churches)).toBe(true);
      expect(response.body.churches.length).toBeGreaterThan(0);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/churches')
        .expect(401);
    });
  });

  describe('POST /api/churches', () => {
    it('should create new church', async () => {
      const newChurch = {
        name: 'IPU Test Church',
        city: 'Test City',
        pastor: 'Pastor Test',
        phone: '+595 21 123456'
      };

      const response = await request(app)
        .post('/api/churches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newChurch)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.church.name).toBe(newChurch.name);

      testChurch = response.body.church;
    });

    it('should validate required fields', async () => {
      const invalidChurch = {
        city: 'Test City'
        // Missing required 'name' field
      };

      await request(app)
        .post('/api/churches')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidChurch)
        .expect(422);
    });
  });

  afterAll(async () => {
    // Cleanup: eliminar iglesia de prueba
    if (testChurch) {
      await request(app)
        .delete(`/api/churches/${testChurch.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
  });
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
git commit -m "feat(api): agregar endpoint de familias"
git commit -m "fix(auth): corregir validación de Google OAuth"
git commit -m "docs(api): actualizar documentación de endpoints"
git commit -m "test(reports): agregar tests para cálculo de fondo nacional"
```

#### Deployment a Vercel
```bash
# Desarrollo: Deploy automático en PRs
# Staging: Deploy automático en merge a main
# Production: Deploy manual con tag

# Crear release
git tag -a v2.1.0 -m "Release v2.1.0: Nuevas funcionalidades de familias"
git push origin v2.1.0

# Vercel despliega automáticamente el tag a producción
```

### Environment-Specific Configuration

#### Desarrollo Local
```javascript
// config/development.js
module.exports = {
  database: {
    pool: { min: 1, max: 5 },
    debug: true
  },
  logging: {
    level: 'debug',
    console: true
  },
  cache: {
    enabled: false
  }
};
```

#### Staging
```javascript
// config/staging.js
module.exports = {
  database: {
    pool: { min: 2, max: 10 },
    debug: false
  },
  logging: {
    level: 'info',
    console: true
  },
  cache: {
    enabled: true,
    ttl: 300 // 5 minutos
  }
};
```

#### Production
```javascript
// config/production.js
module.exports = {
  database: {
    pool: { min: 5, max: 20 },
    debug: false
  },
  logging: {
    level: 'warn',
    console: false,
    file: true
  },
  cache: {
    enabled: true,
    ttl: 600 // 10 minutos
  }
};
```

## Debugging y Troubleshooting

### Debugging Local

#### VS Code Configuration
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/server.js",
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "ipupy:*"
      },
      "console": "integratedTerminal",
      "restart": true,
      "runtimeArgs": ["--inspect"]
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "test"
      }
    }
  ]
}
```

#### Debug Logging
```javascript
// utils/logger.js
const debug = require('debug');

const logger = {
  info: debug('ipupy:info'),
  error: debug('ipupy:error'),
  debug: debug('ipupy:debug'),
  db: debug('ipupy:db'),
  api: debug('ipupy:api')
};

// Uso en código
logger.api('Processing request: %s %s', req.method, req.url);
logger.db('Executing query: %s', query);
logger.error('Error occurred: %O', error);
```

### Herramientas de Desarrollo

#### Database Debugging
```bash
# Conectar directamente a Supabase
psql "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"

# Queries útiles para debugging
\dt                           # Listar tablas
\d churches                   # Describir tabla churches
SELECT COUNT(*) FROM reports; # Contar reportes

# Ver queries lentas
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;
```

#### API Testing
```bash
# Usar curl para testing manual
curl -X GET "http://localhost:3000/api/churches" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Usar Postman collection (incluida en repo)
# tests/postman/IPU-Treasury-API.postman_collection.json
```

#### Performance Profiling
```bash
# Profiling con clinic.js
npm install -g clinic
clinic doctor -- node src/server.js
clinic flame -- node src/server.js

# Memory profiling
node --inspect --inspect-brk src/server.js
# Abrir chrome://inspect en Chrome
```

## Contribución y Code Review

### Guidelines de Contribución

#### Antes de Contribuir
1. ✅ Leer esta guía completa
2. ✅ Configurar entorno de desarrollo
3. ✅ Ejecutar tests exitosamente
4. ✅ Revisar issues abiertos en GitHub
5. ✅ Discutir cambios grandes en issues primero

#### Pull Request Process
1. **Fork** del repositorio
2. **Crear rama** para feature/fix
3. **Hacer cambios** siguiendo convenciones
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
- [ ] Tests unitarios pasando
- [ ] Tests de integración pasando
- [ ] Funcionalidad probada manualmente
- [ ] No hay regresiones detectadas

## Checklist
- [ ] Código sigue las convenciones del proyecto
- [ ] Self-review realizado
- [ ] Comentarios agregados en código complejo
- [ ] Documentación actualizada
- [ ] No hay warnings de linting
- [ ] Variables de entorno documentadas (si aplica)

## Screenshots (si aplica)
Agregar capturas de pantalla para cambios de UI.

## Referencias
Closes #[issue_number]
Related to #[issue_number]
```

### Code Review Guidelines

#### Como Reviewer
1. **Funcionalidad**: ¿Los cambios hacen lo que dicen hacer?
2. **Calidad**: ¿El código está bien escrito y es mantenible?
3. **Performance**: ¿Los cambios afectan el rendimiento?
4. **Seguridad**: ¿Hay vulnerabilidades introducidas?
5. **Tests**: ¿Los tests son adecuados y exhaustivos?
6. **Documentación**: ¿Los cambios están documentados?

#### Feedback Constructivo
```markdown
# ✅ Buen feedback
Considerar usar async/await en lugar de callbacks para mejor legibilidad.
Esta función podría beneficiarse de validación de entrada para evitar errores.

# ❌ Mal feedback
Este código está mal.
No me gusta este approach.
```

## Security Guidelines

### Seguridad en Desarrollo

#### Environment Variables
```bash
# ✅ Correcto: usar variables de entorno
const jwtSecret = process.env.JWT_SECRET;

# ❌ Incorrecto: hardcodear secretos
const jwtSecret = "mi_secreto_super_seguro";
```

#### SQL Injection Prevention
```javascript
// ✅ Correcto: usar parámetros
const { rows } = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// ❌ Incorrecto: concatenar strings
const { rows } = await db.query(
  `SELECT * FROM users WHERE email = '${email}'`
);
```

#### Input Validation
```javascript
// ✅ Validación robusta
const validateReportData = (data) => {
  const schema = {
    church_id: 'integer|required|min:1',
    month: 'integer|required|min:1|max:12',
    year: 'integer|required|min:2020|max:2030',
    diezmos: 'number|required|min:0',
    ofrendas: 'number|required|min:0'
  };

  return validator.validate(data, schema);
};
```

#### Authentication Headers
```javascript
// ✅ Verificar headers de seguridad
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};
```

## Performance Optimization

### Database Optimization

#### Query Optimization
```sql
-- ✅ Query optimizada con índices
SELECT r.*, c.name as church_name
FROM reports r
JOIN churches c ON r.church_id = c.id
WHERE r.year = $1 AND r.month = $2
ORDER BY c.name;

-- Índice recomendado:
CREATE INDEX idx_reports_year_month ON reports(year, month);
```

#### Connection Pooling
```javascript
// ✅ Pool de conexiones eficiente
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: 5,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

### API Optimization

#### Caching Strategy
```javascript
// ✅ Cache inteligente por endpoint
const cache = new Map();

const getCachedData = (key, fetchFn, ttl = 300000) => {
  const cached = cache.get(key);

  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  const data = fetchFn();
  cache.set(key, { data, timestamp: Date.now() });

  return data;
};
```

#### Pagination
```javascript
// ✅ Paginación eficiente
const getPaginatedResults = async (table, page = 1, limit = 50) => {
  const offset = (page - 1) * limit;

  const [data, total] = await Promise.all([
    db.query(`SELECT * FROM ${table} LIMIT $1 OFFSET $2`, [limit, offset]),
    db.query(`SELECT COUNT(*) FROM ${table}`)
  ]);

  return {
    data: data.rows,
    pagination: {
      page,
      limit,
      total: parseInt(total.rows[0].count),
      pages: Math.ceil(total.rows[0].count / limit)
    }
  };
};
```

## Monitoring y Analytics

### Application Monitoring

#### Health Checks
```javascript
// api/health.js
module.exports = async function handler(req, res) {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV,
    uptime: process.uptime()
  };

  try {
    // Test database connection
    await db.query('SELECT 1');
    health.database = 'connected';
  } catch (error) {
    health.database = 'error';
    health.status = 'error';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
};
```

#### Error Tracking
```javascript
// utils/errorTracker.js
const trackError = (error, context = {}) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    context
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error tracked:', errorInfo);
  }

  // Send to external service in production
  if (process.env.NODE_ENV === 'production') {
    // Implementar integración con Sentry, LogRocket, etc.
  }
};
```

### Performance Metrics
```javascript
// utils/metrics.js
const metrics = {
  requestCount: 0,
  responseTime: [],
  errorCount: 0
};

const recordMetric = (type, value) => {
  switch (type) {
    case 'request':
      metrics.requestCount++;
      break;
    case 'response_time':
      metrics.responseTime.push(value);
      break;
    case 'error':
      metrics.errorCount++;
      break;
  }
};

const getMetrics = () => {
  const avgResponseTime = metrics.responseTime.length > 0
    ? metrics.responseTime.reduce((a, b) => a + b) / metrics.responseTime.length
    : 0;

  return {
    requests_total: metrics.requestCount,
    avg_response_time: avgResponseTime,
    errors_total: metrics.errorCount,
    error_rate: metrics.requestCount > 0
      ? (metrics.errorCount / metrics.requestCount) * 100
      : 0
  };
};
```

## Recursos y Referencias

### Documentación Técnica
- 📚 [API Reference](API_REFERENCE.md)
- 🏗️ [System Architecture](architecture/SYSTEM_ARCHITECTURE.md)
- 🚀 [Vercel Deployment](deployment/VERCEL_DEPLOYMENT.md)
- 💾 [Database Schema](architecture/DATABASE_SCHEMA.md)

### Herramientas Recomendadas
- **Editor**: VS Code con extensiones ESLint, Prettier
- **Database**: Supabase Studio, pgAdmin, DBeaver
- **API Testing**: Postman, Insomnia, curl
- **Monitoring**: Vercel Analytics, Supabase Dashboard
- **Performance**: Lighthouse, WebPageTest

### Enlaces Útiles
- [Node.js Documentation](https://nodejs.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Jest Testing Framework](https://jestjs.io/docs/)

### Comunidad y Soporte
- **GitHub Issues**: [Reportar bugs y solicitar features](https://github.com/anthonybirhouse/ipupy-tesoreria/issues)
- **Discussions**: [Discusiones técnicas](https://github.com/anthonybirhouse/ipupy-tesoreria/discussions)
- **Email**: desarrollo@ipupy.org.py
- **Slack**: #desarrollo-tesoreria (interno IPU)

---

## Conclusión

Esta guía proporciona todo lo necesario para contribuir efectivamente al Sistema de Tesorería IPU PY. El proyecto está diseñado para ser mantenible, escalable y fácil de desarrollar.

### Principios de Desarrollo
1. **Código Limpio**: Escribir código que otros puedan entender
2. **Testing First**: Escribir tests antes o junto con el código
3. **Documentación**: Documentar decisiones y cambios importantes
4. **Performance**: Considerar el rendimiento en cada cambio
5. **Seguridad**: Nunca comprometer la seguridad por conveniencia

### Siguientes Pasos
1. Configurar entorno de desarrollo
2. Explorar el código existente
3. Ejecutar tests para familiarizarse
4. Elegir un issue beginner-friendly
5. Hacer primera contribución

¡Bienvenido al equipo de desarrollo del Sistema de Tesorería IPU PY! 🚀

---

**Última actualización**: Diciembre 2024
**Versión**: 2.0.0
**Autor**: Equipo Técnico IPU PY