# API Reference - IPU PY Tesorería

## Descripción General

Sistema de API serverless construido con Next.js 15 API Routes, optimizado para la gestión financiera de 22 iglesias de la Iglesia Pentecostal Unida del Paraguay.

**Base URL**: `https://ipupytesoreria.vercel.app/api`

## Autenticación

### Sistema de Autenticación

Todas las rutas protegidas requieren autenticación via Supabase Auth. La autenticación se maneja mediante cookies httpOnly establecidas por Supabase.

```typescript
// Verificación en API routes
import { getAuthContext } from '@/lib/auth-context';
import { executeWithContext, executeTransaction } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use executeWithContext for RLS enforcement
    const result = await executeWithContext(
      auth,
      'SELECT * FROM monthly_reports WHERE church_id = $1',
      [auth.churchId]
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Ejecución Segura de Base de Datos

El sistema implementa tres patrones de ejecución de base de datos:

1. **executeWithContext**: Para consultas con Row Level Security (RLS)
2. **executeTransaction**: Para operaciones transaccionales complejas
3. **execute**: Solo para consultas a nivel de sistema (sin RLS)

```typescript
// Operación transaccional segura
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);

  await executeTransaction(auth, async (client) => {
    // Crear reporte
    const report = await client.query(
      'INSERT INTO monthly_reports (...) VALUES (...) RETURNING id',
      [...]
    );

    // Actualizar balances de fondos
    await client.query(
      'UPDATE fund_balances SET balance = balance + $1 WHERE ...',
      [...]
    );

    // Registrar actividad
    await client.query(
      'INSERT INTO user_activity (...) VALUES (...)',
      [...]
    );
  });
}
```

### Roles Disponibles (Simplificado desde Migration 023)

El sistema se ha simplificado de 8 roles a 6 roles jerárquicos:

- `admin` - Administradores de plataforma (consolidado desde super_admin)
- `district_supervisor` - Supervisores regionales
- `pastor` - Líderes de iglesia (renombrado desde church_admin)
- `treasurer` - Tesoreros
- `secretary` - Secretarios
- `member` - Miembros (convertido desde viewer)

**Roles Deprecados:**
- `super_admin` → **Consolidado en `admin`**
- `church_admin` → **Renombrado a `pastor`**
- `viewer` → **Convertido a `member`**

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
    "role": "admin",
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

**Autorización**: Requiere rol `admin`

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

**Autorización**: Requiere rol `admin`

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
Crea un nuevo reporte mensual (desde iglesias o cargado manualmente por el tesorero nacional).

**Autorización**: Requiere rol `treasurer`, `pastor`, o `admin`

**Request Body (ejemplo iglesia en línea):**
```json
{
  "church_id": 12,
  "month": 8,
  "year": 2025,
  "diezmos": 4500000,
  "ofrendas": 2350000,
  "misiones": 600000,
  "lazos_amor": 150000,
  "mision_posible": 120000,
  "apy": 80000,
  "iba": 55000,
  "caballeros": 110000,
  "damas": 90000,
  "jovenes": 65000,
  "ninos": 45000,
  "servicios": 320000,
  "energia_electrica": 280000,
  "agua": 95000,
  "recoleccion_basura": 55000,
  "mantenimiento": 110000,
  "materiales": 45000,
  "otros_gastos": 25000,
  "numero_deposito": "DEP-0825-001",
  "fecha_deposito": "2025-08-28",
  "aportantes": [
    { "first_name": "María", "last_name": "Gómez", "document": "5123456", "amount": 2500000 },
    { "first_name": "Carlos", "last_name": "López", "document": "4022333", "amount": 2000000 }
  ]
}
```

**Request Body (ejemplo tesorero nacional cargando informe manual):**
```json
{
  "church_id": 7,
  "month": 7,
  "year": 2025,
  "diezmos": 3800000,
  "ofrendas": 2100000,
  "otros": 500000,
  "misiones": 450000,
  "manual_report_source": "whatsapp",
  "manual_report_notes": "Foto de informe enviada por Pr. Duarte",
  "aportantes": [
    { "first_name": "Lucía", "last_name": "Medina", "document": "1234567", "amount": 1800000 },
    { "first_name": "Pedro", "last_name": "Vera", "document": "", "amount": 2000000 }
  ],
  "submission_source": "pastor_manual"
}
```

**Campos calculados automáticamente**
- `fondo_nacional` → 10% de (diezmos + ofrendas)
- `honorarios_pastoral` → ingreso neto restante después de designados, gastos y 10%
- `total_designado`, `total_operativo`, `total_salidas_calculadas`, `saldo_mes`
- `submission_source`, `manual_report_source`, `entered_by`, `entered_at` se establecen según el rol autenticado si no se envían explícitamente.

**Validaciones clave**
- Si `diezmos > 0`, el arreglo `aportantes` debe incluir al menos un registro con `amount > 0` y la suma debe coincidir (±1 Gs) con el total de diezmos.
- Cada aportante debe tener al menos nombre, apellido o documento informado.
- Admins pueden registrar fuentes manuales (`paper`, `whatsapp`, etc.) para auditar la recepción.

**Response (parcial):**
```json
{
  "success": true,
  "data": {
    "id": 812,
    "church_id": 7,
    "month": 7,
    "year": 2025,
    "estado": "pendiente_admin",
    "submission_source": "pastor_manual",
    "manual_report_source": "whatsapp",
    "manual_report_notes": "Foto de informe enviada por Pr. Duarte",
    "entered_by": "administracion@ipupy.org.py",
    "entered_at": "2025-09-25T02:41:33.421Z",
    "totals": {
      "totalEntradas": 6400000,
      "fondoNacional": 590000,
      "honorariosPastoral": 1850000,
      "totalDesignado": 450000,
      "totalOperativo": 865000,
      "saldoMes": 0
    }
  }
}
```

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

### 9. Configuración del Sistema

#### GET `/api/admin/configuration`
Obtiene la configuración del sistema por sección.

**Autorización**: Requiere rol `admin`

**Query Parameters:**
- `section` (optional): Sección específica (`general`, `financial`, `security`, `notifications`, `funds`, `roles`, `integration`)

**Response:**
```json
{
  "success": true,
  "data": {
    "financial": {
      "fondoNacionalPercentage": 10,
      "reportDeadlineDay": 5,
      "requireReceipts": true,
      "receiptMinAmount": 100000,
      "autoCalculateTotals": true,
      "requireDoubleEntry": true
    }
  }
}
```

#### POST `/api/admin/configuration`
Actualiza la configuración del sistema.

**Autorización**: Requiere rol `admin`

**Request Body:**
```json
{
  "section": "financial",
  "data": {
    "fondoNacionalPercentage": 12,
    "reportDeadlineDay": 7,
    "requireReceipts": true,
    "receiptMinAmount": 150000
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration updated successfully"
}
```

#### PUT `/api/admin/configuration`
Restablece la configuración a valores predeterminados.

**Autorización**: Requiere rol `admin`

**Response:**
```json
{
  "success": true,
  "message": "Configuration reset to defaults"
}
```

---

### 10. Exportación de Datos

#### GET `/api/data`
Exporta datos en formato JSON o CSV.

**Autorización**: Requiere rol `admin`

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