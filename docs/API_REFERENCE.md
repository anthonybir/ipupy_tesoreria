# API Reference - IPU PY Tesorería

## Descripción General

Sistema de API serverless construido con Next.js 15 API Routes, optimizado para la gestión financiera de 22 iglesias de la Iglesia Pentecostal Unida del Paraguay.

**Base URL**: `https://ipupytesoreria.vercel.app/api`

## Autenticación

### Sistema de Autenticación

Todas las rutas protegidas requieren autenticación via Supabase Auth. La autenticación se maneja mediante cookies httpOnly establecidas por Supabase.

```typescript
// Verificación en API routes
import { requireAuth } from '@/lib/auth-context';

export async function GET(request: NextRequest) {
  const context = await requireAuth(request);
  // context contiene: userId, email, role, churchId, etc.
}
```

### Roles Disponibles

- `super_admin` - Control total del sistema
- `admin` - Administradores de plataforma
- `district_supervisor` - Supervisores regionales
- `church_admin` - Líderes de iglesia
- `treasurer` - Tesoreros
- `secretary` - Secretarios
- `member` - Miembros
- `viewer` - Solo lectura

---

## Endpoints

### 1. Dashboard

#### GET `/api/dashboard`
Obtiene métricas y resumen del dashboard principal.

**Autorización**: Requiere autenticación

**Response:**
```json
{
  "success": true,
  "user": {
    "email": "administracion@ipupy.org.py",
    "role": "super_admin",
    "name": "Administrador IPUPY",
    "churchId": null
  },
  "metrics": {
    "totalChurches": 22,
    "totalReports": 156,
    "totalIncome": 45000000,
    "totalExpenses": 4500000,
    "nationalFund": 4500000
  },
  "recentReports": [...],
  "churches": [...],
  "currentPeriod": {
    "month": 9,
    "year": 2025
  },
  "funds": {
    "totalBalance": 40500000,
    "availableBalance": 36000000
  },
  "trends": [...]
}
```

---

### 2. Iglesias

#### GET `/api/churches`
Lista todas las iglesias registradas.

**Autorización**: Requiere autenticación

**Query Parameters:**
- `page` (optional): Número de página
- `limit` (optional): Resultados por página (default: 50)
- `search` (optional): Búsqueda por nombre o ciudad

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Primera Iglesia Central",
      "city": "Asunción",
      "pastor": "Rev. Juan Pérez",
      "cedula": "1234567",
      "grado": "Licenciado",
      "posicion": "Pastor",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 22,
  "page": 1,
  "limit": 50
}
```

#### POST `/api/churches`
Crea una nueva iglesia.

**Autorización**: Requiere rol `admin` o `super_admin`

**Request Body:**
```json
{
  "name": "Nueva Iglesia",
  "city": "Ciudad",
  "pastor": "Nombre del Pastor",
  "cedula": "CI",
  "grado": "Grado Ministerial",
  "posicion": "Posición"
}
```

#### PUT `/api/churches`
Actualiza información de una iglesia.

**Autorización**: Requiere rol `admin` o `super_admin`

**Request Body:**
```json
{
  "id": 1,
  "name": "Nombre Actualizado",
  "city": "Ciudad Nueva",
  "pastor": "Nuevo Pastor"
}
```

---

### 3. Reportes Mensuales

#### GET `/api/reports`
Obtiene reportes financieros mensuales.

**Autorización**: Requiere autenticación

**Query Parameters:**
- `church_id` (optional): Filtrar por iglesia
- `month` (optional): Mes (1-12)
- `year` (optional): Año
- `page` (optional): Paginación
- `limit` (optional): Límite por página

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "church_id": 1,
      "church_name": "Primera Iglesia Central",
      "month": 9,
      "year": 2025,
      "diezmos": 5000000,
      "ofrendas": 3000000,
      "fondo_nacional": 800000,
      "numero_deposito": "DEP-001",
      "fecha_deposito": "2025-09-15",
      "created_at": "2025-09-01T00:00:00Z"
    }
  ],
  "total": 100,
  "summary": {
    "totalDiezmos": 50000000,
    "totalOfrendas": 30000000,
    "totalFondoNacional": 8000000
  }
}
```

#### POST `/api/reports`
Crea un nuevo reporte mensual.

**Autorización**: Requiere rol `treasurer`, `church_admin`, `admin`, o `super_admin`

**Request Body:**
```json
{
  "church_id": 1,
  "month": 9,
  "year": 2025,
  "diezmos": 5000000,
  "ofrendas": 3000000,
  "numero_deposito": "DEP-001",
  "fecha_deposito": "2025-09-15"
}
```

*Nota: El fondo_nacional se calcula automáticamente como 10% del total*

#### PUT `/api/reports`
Actualiza un reporte existente.

**Autorización**: Requiere permisos sobre la iglesia del reporte

---

### 4. Gestión Financiera

#### GET `/api/financial/funds`
Obtiene el estado de los fondos.

**Autorización**: Requiere autenticación

**Response:**
```json
{
  "success": true,
  "funds": {
    "general": {
      "balance": 20000000,
      "lastMovement": "2025-09-15"
    },
    "national": {
      "balance": 8000000,
      "lastMovement": "2025-09-15"
    },
    "missions": {
      "balance": 5000000,
      "lastMovement": "2025-09-10"
    }
  },
  "totalBalance": 33000000
}
```

#### GET `/api/financial/transactions`
Lista transacciones financieras.

**Autorización**: Requiere autenticación

**Query Parameters:**
- `fund_id` (optional): Filtrar por fondo
- `type` (optional): `income` | `expense`
- `from_date` (optional): Fecha inicial
- `to_date` (optional): Fecha final
- `page` (optional): Paginación

#### POST `/api/financial/transactions`
Registra una nueva transacción.

**Autorización**: Requiere rol `treasurer` o superior

**Request Body:**
```json
{
  "fund_id": 1,
  "type": "income",
  "amount": 1000000,
  "description": "Donación especial",
  "reference": "REF-001",
  "date": "2025-09-23"
}
```

#### GET `/api/financial/fund-movements`
Obtiene movimientos de fondos entre cuentas.

**Autorización**: Requiere rol `treasurer` o superior

---

### 5. Gestión de Donantes

#### GET `/api/donors`
Lista de donantes registrados.

**Autorización**: Requiere autenticación

**Query Parameters:**
- `church_id` (optional): Filtrar por iglesia
- `search` (optional): Buscar por nombre

**Response:**
```json
{
  "success": true,
  "donors": [
    {
      "id": 1,
      "name": "Juan Pérez",
      "church_id": 1,
      "phone": "0981123456",
      "email": "juan@example.com",
      "total_donated": 5000000,
      "last_donation": "2025-09-15"
    }
  ],
  "total": 150
}
```

#### POST `/api/donors`
Registra un nuevo donante.

**Autorización**: Requiere rol `secretary` o superior

---

### 6. Contabilidad

#### GET `/api/accounting`
Obtiene información contable detallada.

**Autorización**: Requiere rol `treasurer` o superior

**Query Parameters:**
- `period` (optional): Período contable
- `type` (optional): Tipo de reporte

---

### 7. Registros de Culto

#### GET `/api/worship-records`
Obtiene registros de asistencia a cultos.

**Autorización**: Requiere autenticación

#### POST `/api/worship-records`
Registra asistencia a culto.

**Autorización**: Requiere rol `secretary` o superior

**Request Body:**
```json
{
  "church_id": 1,
  "date": "2025-09-22",
  "service_type": "domingo_am",
  "attendance": 150,
  "visitors": 5,
  "conversions": 2,
  "baptisms": 1
}
```

---

### 8. Personas

#### GET `/api/people`
Lista de miembros y personas relacionadas.

**Autorización**: Requiere autenticación

**Query Parameters:**
- `church_id` (optional): Filtrar por iglesia
- `role` (optional): Filtrar por rol
- `status` (optional): `active` | `inactive`

---

### 9. Exportación de Datos

#### GET `/api/data`
Exporta datos en formato JSON o CSV.

**Autorización**: Requiere rol `admin` o `super_admin`

**Query Parameters:**
- `format`: `json` | `csv` | `excel`
- `type`: `reports` | `churches` | `donors` | `all`
- `from_date` (optional): Fecha inicial
- `to_date` (optional): Fecha final

---

## Respuestas de Error

### Estructura de Error Estándar

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descripción del error",
    "details": {}
  }
}
```

### Códigos de Error Comunes

| Código | HTTP Status | Descripción |
|--------|-------------|-------------|
| `UNAUTHORIZED` | 401 | No autenticado |
| `FORBIDDEN` | 403 | Sin permisos suficientes |
| `NOT_FOUND` | 404 | Recurso no encontrado |
| `VALIDATION_ERROR` | 400 | Datos inválidos |
| `DUPLICATE_ENTRY` | 409 | Entrada duplicada |
| `INTERNAL_ERROR` | 500 | Error del servidor |

---

## Rate Limiting

- **Límite**: 100 requests por minuto por IP
- **Headers de Respuesta**:
  - `X-RateLimit-Limit`: 100
  - `X-RateLimit-Remaining`: 95
  - `X-RateLimit-Reset`: 1695456789

---

## Webhooks

### Eventos Disponibles

- `report.created` - Nuevo reporte creado
- `report.updated` - Reporte actualizado
- `church.created` - Nueva iglesia registrada
- `transaction.created` - Nueva transacción

### Configuración de Webhook

```json
{
  "url": "https://tu-servidor.com/webhook",
  "events": ["report.created", "transaction.created"],
  "secret": "webhook_secret_key"
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
// Usando fetch con cookies
const response = await fetch('/api/churches', {
  method: 'GET',
  credentials: 'include', // Importante para cookies
  headers: {
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
```

### Con Supabase Client

```typescript
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();
const { data, error } = await supabase
  .from('churches')
  .select('*')
  .order('name');
```

---

## Migración desde v1.0

### Cambios Principales

1. **Autenticación**: Migrado de JWT a Supabase Auth
2. **Endpoints**: `/api/auth` ya no existe (auth via Supabase)
3. **Headers**: No se requiere `Authorization: Bearer`
4. **Cookies**: Autenticación basada en cookies httpOnly

### Endpoints Deprecados

- `/api/auth/login` - Usar Supabase Auth
- `/api/auth/logout` - Usar Supabase signOut
- `/api/auth/refresh` - Automático via Supabase

---

## Soporte

Para soporte técnico sobre la API:
- Email: administracion@ipupy.org.py
- Documentación: [GitHub Repository](https://github.com/anthonybirhouse/ipupy-tesoreria)