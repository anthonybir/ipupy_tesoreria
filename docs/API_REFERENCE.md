# API Reference - IPU PY Tesorería

## Descripción General

El sistema IPU PY Tesorería expone 14+ funciones serverless optimizadas para el manejo integral de la tesorería de 22 iglesias de la Iglesia Pentecostal Unida del Paraguay.

**Base URL**: `https://ipupytesoreria.vercel.app/api`

## Version 2.0.0 Updates
- New three-step monthly workflow system
- Permanent donor registry with autocomplete
- Individual fund transaction generation
- Corrected fund allocation rules (10% vs 100%)

## Autenticación

### JWT Token
Todas las rutas protegidas requieren un token JWT en el header:
```http
Authorization: Bearer <jwt_token>
```

### Google OAuth
Para autenticación con Google (dominio restringido a @ipupy.org.py):
```http
Content-Type: application/json
{
  "id_token": "google_id_token"
}
```

---

## 1. `/api/auth` - Autenticación

### POST `/api/auth?action=login`
Autenticación con email/password

**Request:**
```json
{
  "email": "administracion@ipupy.org.py",
  "password": "password_seguro"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "administracion@ipupy.org.py",
    "role": "admin",
    "church_id": null
  }
}
```

### POST `/api/auth?action=google-login`
Autenticación con Google OAuth

**Request:**
```json
{
  "id_token": "google_jwt_token"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": 2,
    "email": "pastor@ipupy.org.py",
    "role": "church",
    "church_id": 5,
    "google_id": "google_user_id"
  }
}
```

### POST `/api/auth?action=register`
Registro de nuevo usuario (solo admins)

**Request:**
```json
{
  "email": "nuevo@ipupy.org.py",
  "password": "password_seguro",
  "role": "church",
  "church_id": 3
}
```

### GET `/api/auth?action=verify`
Verificar token válido

**Headers:**
```http
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": 1,
    "email": "admin@ipupy.org.py",
    "role": "admin"
  }
}
```

---

## 2. `/api/churches` - Gestión de Iglesias

### GET `/api/churches`
Listar todas las iglesias

**Response:**
```json
{
  "success": true,
  "churches": [
    {
      "id": 1,
      "name": "IPU Asunción Central",
      "city": "Asunción",
      "pastor": "Rev. Juan Pérez",
      "phone": "+595 21 123456",
      "pastor_ruc": "12345678-9",
      "pastor_cedula": "1234567",
      "pastor_grado": "Reverendo",
      "pastor_posicion": "Pastor Principal",
      "active": true,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### GET `/api/churches/:id`
Obtener iglesia específica

**Response:**
```json
{
  "success": true,
  "church": {
    "id": 1,
    "name": "IPU Asunción Central",
    "city": "Asunción",
    "pastor": "Rev. Juan Pérez",
    "phone": "+595 21 123456",
    "pastor_ruc": "12345678-9",
    "pastor_cedula": "1234567",
    "pastor_grado": "Reverendo",
    "pastor_posicion": "Pastor Principal",
    "active": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### POST `/api/churches`
Crear nueva iglesia (solo admins)

**Request:**
```json
{
  "name": "IPU Nueva Iglesia",
  "city": "Ciudad del Este",
  "pastor": "Rev. María González",
  "phone": "+595 61 234567",
  "pastor_ruc": "87654321-0",
  "pastor_cedula": "7654321",
  "pastor_grado": "Pastora",
  "pastor_posicion": "Pastora Principal"
}
```

### PUT `/api/churches/:id`
Actualizar iglesia existente

**Request:**
```json
{
  "phone": "+595 21 654321",
  "pastor_grado": "Reverendo Senior"
}
```

### DELETE `/api/churches/:id`
Desactivar iglesia (soft delete)

---

## 3. `/api/church-transactions` - Transacciones por Iglesia

### GET `/api/church-transactions?church_id=1&month=12&year=2024`
Obtener transacciones de una iglesia específica

**Query Parameters:**
- `church_id` (required): ID de la iglesia
- `month` (optional): Mes (1-12)
- `year` (optional): Año
- `type` (optional): Tipo de transacción (entrada|salida)

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": 1,
      "church_id": 1,
      "type": "entrada",
      "category": "diezmos",
      "amount": 5000000,
      "description": "Diezmos mes diciembre",
      "date": "2024-12-01",
      "created_at": "2024-12-01T10:00:00Z"
    }
  ],
  "summary": {
    "total_entradas": 15000000,
    "total_salidas": 8000000,
    "balance": 7000000,
    "fondo_nacional": 1500000
  }
}
```

### POST `/api/church-transactions`
Crear nueva transacción

**Request:**
```json
{
  "church_id": 1,
  "type": "entrada",
  "category": "ofrendas",
  "amount": 2500000,
  "description": "Ofrenda especial construcción",
  "date": "2024-12-15",
  "report_id": 25
}
```

---

## 4. `/api/dashboard` - Dashboard y Métricas

### GET `/api/dashboard`
Obtener datos del dashboard principal

**Query Parameters:**
- `month` (optional): Mes específico
- `year` (optional): Año específico

**Response:**
```json
{
  "success": true,
  "dashboard": {
    "summary": {
      "total_churches": 22,
      "active_churches": 20,
      "total_monthly_income": 125000000,
      "total_fondo_nacional": 12500000,
      "total_deposits": 112500000,
      "pending_reports": 3
    },
    "monthly_stats": {
      "month": 12,
      "year": 2024,
      "churches_reported": 19,
      "total_diezmos": 85000000,
      "total_ofrendas": 40000000,
      "total_gastos": 45000000,
      "net_balance": 80000000
    },
    "recent_reports": [
      {
        "church_name": "IPU Asunción Central",
        "month": 12,
        "year": 2024,
        "total_entradas": 8500000,
        "fondo_nacional": 850000,
        "status": "approved",
        "created_at": "2024-12-15T14:30:00Z"
      }
    ],
    "top_contributing_churches": [
      {
        "church_name": "IPU Asunción Central",
        "total_contribution": 8500000,
        "percentage": 6.8
      }
    ]
  }
}
```

### GET `/api/dashboard/analytics`
Obtener análisis avanzados y tendencias

**Response:**
```json
{
  "success": true,
  "analytics": {
    "yearly_trend": [
      {
        "month": "Enero",
        "total_income": 98000000,
        "fondo_nacional": 9800000
      }
    ],
    "church_performance": [
      {
        "church_id": 1,
        "consistency_score": 95,
        "average_monthly": 7500000,
        "growth_rate": 12.5
      }
    ],
    "financial_health": {
      "liquidity_ratio": 1.8,
      "growth_rate": 8.2,
      "variance_coefficient": 0.15
    }
  }
}
```

---

## 5. `/api/export` - Exportación de Datos

### GET `/api/export?type=monthly_report&church_id=1&month=12&year=2024`
Exportar reporte mensual a Excel

**Query Parameters:**
- `type` (required): Tipo de exportación
  - `monthly_report`: Reporte mensual específico
  - `annual_summary`: Resumen anual
  - `churches_list`: Lista de iglesias
  - `financial_summary`: Resumen financiero
- `church_id` (optional): ID de iglesia específica
- `month` (optional): Mes
- `year` (required): Año

**Response:**
```http
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="Reporte_Mensual_Diciembre_2024.xlsx"

[Binary Excel file content]
```

### GET `/api/export?type=annual_summary&year=2024`
Exportar resumen anual completo

**Response:**
Excel file con múltiples hojas:
- Resumen Ejecutivo
- Ingresos por Iglesia
- Fondo Nacional
- Gastos Consolidados
- Análisis de Tendencias

### GET `/api/export?type=churches_list`
Exportar lista completa de iglesias

**Response:**
Excel con información completa de las 22 iglesias:
- Datos básicos
- Información pastoral
- Documentos legales
- Estado actual

---

## 6. `/api/families` - Gestión de Familias

### GET `/api/families?church_id=1`
Listar familias de una iglesia

**Response:**
```json
{
  "success": true,
  "families": [
    {
      "id": 1,
      "church_id": 1,
      "family_name": "Familia González",
      "head_of_family": "Roberto González",
      "address": "Av. España 1234",
      "phone": "+595 21 123456",
      "members_count": 4,
      "active": true,
      "created_at": "2024-01-15T00:00:00Z"
    }
  ]
}
```

### POST `/api/families`
Crear nueva familia

**Request:**
```json
{
  "church_id": 1,
  "family_name": "Familia Martínez",
  "head_of_family": "Ana Martínez",
  "address": "Calle Palma 567",
  "phone": "+595 21 654321"
}
```

### PUT `/api/families/:id`
Actualizar información de familia

### DELETE `/api/families/:id`
Desactivar familia

---

## 7. `/api/import` - Importación de Datos

### POST `/api/import`
Importar datos desde archivo Excel

**Content-Type:** `multipart/form-data`

**Request:**
```http
POST /api/import
Content-Type: multipart/form-data

file: [Excel file]
type: "monthly_reports" | "churches" | "members"
church_id: 1 (optional)
month: 12 (optional)
year: 2024 (optional)
```

**Response:**
```json
{
  "success": true,
  "import_summary": {
    "total_rows": 150,
    "successful_imports": 145,
    "failed_imports": 5,
    "warnings": 12,
    "processing_time": "3.2s"
  },
  "errors": [
    {
      "row": 23,
      "error": "Monto inválido: debe ser numérico",
      "data": "abc123"
    }
  ],
  "warnings": [
    {
      "row": 45,
      "warning": "Fecha futura detectada",
      "data": "2025-12-01"
    }
  ]
}
```

### POST `/api/import/validate`
Validar archivo antes de importación

**Request:** Similar al endpoint de importación

**Response:**
```json
{
  "valid": true,
  "validation_results": {
    "total_rows": 150,
    "valid_rows": 145,
    "invalid_rows": 5,
    "columns_detected": [
      "iglesia", "mes", "ano", "diezmos", "ofrendas", "fondo_nacional"
    ],
    "format_detected": "IPU_MONTHLY_REPORT_V2"
  },
  "errors": [],
  "suggestions": [
    "Se recomienda corregir las fechas en las filas 23, 45, 67"
  ]
}
```

---

## 8. `/api/members` - Gestión de Miembros

### GET `/api/members?church_id=1`
Listar miembros de una iglesia

**Query Parameters:**
- `church_id` (required): ID de la iglesia
- `status` (optional): Estado del miembro (active|inactive)
- `age_min` (optional): Edad mínima
- `age_max` (optional): Edad máxima
- `baptized` (optional): Solo bautizados (true|false)

**Response:**
```json
{
  "success": true,
  "members": [
    {
      "id": 1,
      "church_id": 1,
      "family_id": 1,
      "first_name": "Juan",
      "last_name": "González",
      "cedula": "1234567",
      "phone": "+595 21 123456",
      "email": "juan@example.com",
      "birth_date": "1985-05-15",
      "baptism_date": "2010-08-20",
      "status": "active",
      "membership_date": "2009-12-01",
      "position": "Diácono",
      "created_at": "2024-01-15T00:00:00Z"
    }
  ],
  "statistics": {
    "total_members": 156,
    "active_members": 142,
    "baptized_members": 134,
    "average_age": 35.2,
    "new_members_this_year": 12
  }
}
```

### POST `/api/members`
Registrar nuevo miembro

**Request:**
```json
{
  "church_id": 1,
  "family_id": 1,
  "first_name": "María",
  "last_name": "González",
  "cedula": "2345678",
  "phone": "+595 21 234567",
  "email": "maria@example.com",
  "birth_date": "1990-03-10",
  "baptism_date": "2015-06-14",
  "membership_date": "2015-01-01",
  "position": "Miembro"
}
```

### PUT `/api/members/:id`
Actualizar información de miembro

### DELETE `/api/members/:id`
Desactivar miembro

### POST `/api/members/:id/baptism`
Registrar bautismo

**Request:**
```json
{
  "baptism_date": "2024-12-25",
  "baptism_type": "agua",
  "minister": "Rev. Juan Pérez",
  "location": "Rio Paraguay"
}
```

---

## 9. `/api/reports` - Reportes Financieros

### GET `/api/reports`
Listar reportes financieros

**Query Parameters:**
- `church_id` (optional): ID de iglesia específica
- `month` (optional): Mes (1-12)
- `year` (optional): Año
- `status` (optional): Estado (pendiente|aprobado|rechazado)
- `limit` (optional): Límite de resultados (default: 50)
- `offset` (optional): Offset para paginación

**Response:**
```json
{
  "success": true,
  "reports": [
    {
      "id": 1,
      "church_id": 1,
      "church_name": "IPU Asunción Central",
      "month": 12,
      "year": 2024,

      // ENTRADAS DEL MES
      "diezmos": 5000000,
      "ofrendas": 2500000,
      "anexos": 500000,
      "caballeros": 300000,
      "damas": 400000,
      "jovenes": 200000,
      "ninos": 100000,
      "otros": 150000,
      "total_entradas": 9150000,

      // SALIDAS DEL MES
      "honorarios_pastoral": 2000000,
      "honorarios_factura_numero": "001-001-0000123",
      "honorarios_ruc_pastor": "12345678-9",
      "fondo_nacional": 915000,
      "energia_electrica": 450000,
      "agua": 150000,
      "recoleccion_basura": 80000,
      "otros_gastos": 200000,
      "total_salidas": 3795000,

      // OFRENDAS DIRECTAS FONDO NACIONAL
      "ofrenda_misiones": 200000,
      "lazos_amor": 150000,
      "mision_posible": 100000,
      "aporte_caballeros": 80000,
      "apy": 50000,
      "instituto_biblico": 75000,
      "diezmo_pastoral": 125000,
      "total_fondo_nacional": 1695000,

      // EXISTENCIA EN CAJA
      "saldo_mes_anterior": 3000000,
      "entrada_iglesia_local": 7455000,
      "total_entrada_mensual": 10455000,
      "saldo_fin_mes": 6660000,

      // DEPÓSITO BANCARIO
      "fecha_deposito": "2024-12-15",
      "numero_deposito": "DEP-001234567",
      "monto_depositado": 1695000,

      // ASISTENCIAS Y BAUTISMOS
      "asistencia_visitas": 45,
      "bautismos_agua": 3,
      "bautismos_espiritu": 2,

      // ARCHIVOS Y OBSERVACIONES
      "foto_informe": "/uploads/reports/report_1_informe.jpg",
      "foto_deposito": "/uploads/reports/report_1_deposito.jpg",
      "observaciones": "Mes exitoso con buen crecimiento",
      "estado": "aprobado",

      "created_at": "2024-12-15T14:30:00Z",
      "updated_at": "2024-12-16T09:15:00Z"
    }
  ],
  "pagination": {
    "total": 284,
    "limit": 50,
    "offset": 0,
    "has_next": true
  }
}
```

### GET `/api/reports/:id`
Obtener reporte específico con todos los detalles

### POST `/api/reports`
Crear nuevo reporte mensual

**Request:**
```json
{
  "church_id": 1,
  "month": 12,
  "year": 2024,
  "diezmos": 5000000,
  "ofrendas": 2500000,
  "anexos": 500000,
  "caballeros": 300000,
  "damas": 400000,
  "jovenes": 200000,
  "ninos": 100000,
  "otros": 150000,
  "honorarios_pastoral": 2000000,
  "honorarios_factura_numero": "001-001-0000123",
  "honorarios_ruc_pastor": "12345678-9",
  "energia_electrica": 450000,
  "agua": 150000,
  "recoleccion_basura": 80000,
  "otros_gastos": 200000,
  "ofrenda_misiones": 200000,
  "lazos_amor": 150000,
  "mision_posible": 100000,
  "aporte_caballeros": 80000,
  "apy": 50000,
  "instituto_biblico": 75000,
  "diezmo_pastoral": 125000,
  "saldo_mes_anterior": 3000000,
  "fecha_deposito": "2024-12-15",
  "numero_deposito": "DEP-001234567",
  "asistencia_visitas": 45,
  "bautismos_agua": 3,
  "bautismos_espiritu": 2,
  "observaciones": "Mes exitoso con buen crecimiento"
}
```

### PUT `/api/reports/:id`
Actualizar reporte existente

### DELETE `/api/reports/:id`
Eliminar reporte (solo admins)

### POST `/api/reports/:id/approve`
Aprobar reporte (solo admins)

**Request:**
```json
{
  "approval_notes": "Reporte revisado y aprobado"
}
```

### POST `/api/reports/:id/reject`
Rechazar reporte (solo admins)

**Request:**
```json
{
  "rejection_reason": "Falta comprobante de depósito bancario"
}
```

---

## 10. `/api/transactions` - Transacciones Generales

### GET `/api/transactions`
Listar todas las transacciones del sistema

**Query Parameters:**
- `type` (optional): Tipo (entrada|salida|transferencia)
- `category` (optional): Categoría específica
- `date_from` (optional): Fecha desde (YYYY-MM-DD)
- `date_to` (optional): Fecha hasta (YYYY-MM-DD)
- `amount_min` (optional): Monto mínimo
- `amount_max` (optional): Monto máximo
- `church_id` (optional): ID de iglesia específica
- `limit` (optional): Límite de resultados
- `offset` (optional): Offset para paginación

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": 1,
      "church_id": 1,
      "church_name": "IPU Asunción Central",
      "report_id": 25,
      "type": "entrada",
      "category": "diezmos",
      "subcategory": "diezmo_regular",
      "amount": 5000000,
      "description": "Diezmos mensuales diciembre 2024",
      "date": "2024-12-01",
      "reference_number": "DZ-202412-001",
      "status": "confirmed",
      "created_by": 1,
      "created_at": "2024-12-01T10:00:00Z"
    }
  ],
  "summary": {
    "total_transactions": 1250,
    "total_amount": 890500000,
    "total_entradas": 750000000,
    "total_salidas": 140500000,
    "net_balance": 609500000
  },
  "pagination": {
    "total": 1250,
    "limit": 100,
    "offset": 0,
    "has_next": true
  }
}
```

### POST `/api/transactions`
Crear nueva transacción

**Request:**
```json
{
  "church_id": 1,
  "report_id": 25,
  "type": "entrada",
  "category": "ofrendas",
  "subcategory": "ofrenda_especial",
  "amount": 1500000,
  "description": "Ofrenda especial para construcción",
  "date": "2024-12-15",
  "reference_number": "OF-202412-015"
}
```

### PUT `/api/transactions/:id`
Actualizar transacción existente

### DELETE `/api/transactions/:id`
Eliminar transacción (solo admins)

### GET `/api/transactions/summary`
Resumen financiero general

**Query Parameters:**
- `period` (optional): Período (monthly|quarterly|yearly)
- `year` (optional): Año específico
- `month` (optional): Mes específico

**Response:**
```json
{
  "success": true,
  "summary": {
    "period": "monthly",
    "month": 12,
    "year": 2024,
    "total_churches_reported": 20,
    "financial_summary": {
      "total_entradas": 125000000,
      "total_salidas": 45000000,
      "net_income": 80000000,
      "fondo_nacional_total": 12500000,
      "fondo_nacional_percentage": 10.0
    },
    "category_breakdown": {
      "diezmos": 85000000,
      "ofrendas": 30000000,
      "anexos": 5000000,
      "departamentos": 5000000
    },
    "expense_breakdown": {
      "honorarios_pastoral": 25000000,
      "servicios_basicos": 8000000,
      "otros_gastos": 12000000
    },
    "growth_metrics": {
      "income_growth": 8.5,
      "expense_growth": 3.2,
      "net_growth": 12.1
    }
  }
}
```

---

## 11. `/api/worship-records` - Registros de Culto (v2.0.0)

### GET `/api/worship-records`
Obtener registros de culto para una iglesia y mes específico.

**Query Parameters:**
- `church_id` (required): ID de la iglesia
- `month` (required): Número de mes (1-12)
- `year` (required): Año (2020-2030)

**Headers:**
```http
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "records": [
    {
      "id": 1,
      "church_id": 1,
      "fecha_culto": "2025-09-01",
      "tipo_culto": "dominical",
      "predicador": "Rev. Juan Pérez",
      "total_diezmos": 10000000,
      "total_ofrendas": 1000000,
      "total_misiones": 50000,
      "total_recaudado": 11050000,
      "miembros_activos": 30,
      "visitas": 15,
      "total_asistencia": 45,
      "contributions": [
        {
          "id": 1,
          "donor_id": 123,
          "nombre_aportante": "Juan González",
          "ci_ruc": "1234567",
          "fund_bucket": "diezmo",
          "total": 500000
        }
      ]
    }
  ]
}
```

### POST `/api/worship-records`
Crear nuevo registro de culto con contribuciones.

**Request Body:**
```json
{
  "church_id": 1,
  "fecha_culto": "2025-09-01",
  "tipo_culto": "dominical",
  "predicador": "Rev. Juan Pérez",
  "encargado_registro": "María López",
  "contributions": [
    {
      "donor_id": 123,
      "nombre_aportante": "Juan González",
      "ci_ruc": "1234567",
      "diezmo": 500000,
      "ofrenda": 100000,
      "misiones": 50000,
      "apy": 50000
    }
  ],
  "miembros_activos": 30,
  "visitas": 15,
  "ninos": 10,
  "jovenes": 8,
  "ofrenda_general_anonima": 25000,
  "observaciones": "Culto especial de misiones"
}
```

---

## 12. `/api/expense-records` - Registros de Gastos (v2.0.0)

### GET `/api/expense-records`
Obtener gastos de una iglesia para un mes específico.

**Query Parameters:**
- `church_id` (required): ID de la iglesia
- `month` (required): Número de mes (1-12)
- `year` (required): Año (2020-2030)

**Response:**
```json
{
  "expenses": [
    {
      "id": 1,
      "church_id": 1,
      "fecha_comprobante": "2025-09-15",
      "proveedor": "ANDE",
      "ruc_proveedor": "80000000-1",
      "numero_comprobante": "001-002-0000123",
      "concepto": "Electricidad mes de septiembre",
      "expense_category": "servicios_basicos",
      "total_factura": 150000,
      "es_honorario_pastoral": false
    }
  ],
  "total_expenses": 2000000,
  "total_pastoral": 7900000
}
```

### POST `/api/expense-records`
Registrar nuevo gasto o factura pastoral.

**Request Body:**
```json
{
  "church_id": 1,
  "fecha_comprobante": "2025-09-15",
  "proveedor": "ANDE",
  "ruc_proveedor": "80000000-1",
  "numero_comprobante": "001-002-0000123",
  "concepto": "Electricidad mes de septiembre",
  "expense_category": "servicios_basicos",
  "total_factura": 150000,
  "es_honorario_pastoral": false
}
```

**Categories válidas:**
- `servicios_basicos`: Electricidad, agua, internet
- `honorarios`: Honorarios profesionales
- `ministerio`: Gastos ministeriales
- `materiales`: Materiales y suministros
- `mantenimiento`: Reparaciones, limpieza
- `otros`: Otros gastos

---

## 13. `/api/donors` - Registro de Donantes (v2.0.0)

### GET `/api/donors`
Buscar y listar donantes de una iglesia.

**Query Parameters:**
- `church_id` (required): ID de la iglesia
- `search` (optional): Término de búsqueda (nombre o CI/RUC)
- `limit` (optional): Límite de resultados (default: 10, max: 50)

**Response:**
```json
{
  "donors": [
    {
      "id": 123,
      "church_id": 1,
      "nombre": "Juan González",
      "ci_ruc": "1234567",
      "telefono": "0981234567",
      "direccion": "Asunción",
      "email": "juan@email.com",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 150
}
```

---

## 14. `/api/monthly-ledger` - Libro Mayor Mensual (v2.0.0)

### GET `/api/monthly-ledger`
Obtener cálculos completos del mes con distribución de fondos.

**Query Parameters:**
- `church_id` (required): ID de la iglesia
- `month` (required): Número de mes (1-12)
- `year` (required): Año (2020-2030)

**Response:**
```json
{
  "iglesia": {
    "id": 1,
    "nombre": "IPU Lambaré",
    "pastor": "Rev. Juan Pérez"
  },
  "entradas": {
    "totales": {
      "diezmos": 10000000,
      "ofrendas": 1000000,
      "misiones": 50000,
      "otros": 0,
      "total_entradas": 11050000
    },
    "detalle_por_tipo": [
      {
        "tipo": "diezmo",
        "cantidad_contribuciones": 25,
        "total_monto": 10000000,
        "donantes_unicos": 20
      }
    ]
  },
  "distribucion_automatica": {
    "fondo_nacional_10_percent": 1100000,
    "fondo_nacional_100_percent": 50000,
    "fondo_nacional_total": 1150000,
    "disponible_local_90_percent": 9900000,
    "disponible_local_otros": 0,
    "disponible_local_total": 9900000,
    "porcentaje_fondo_nacional": "10.4"
  },
  "gastos": {
    "totales": {
      "servicios_basicos": 500000,
      "otros_gastos": 1500000,
      "total_gastos": 2000000
    },
    "detalle_por_categoria": []
  },
  "salario_pastoral": {
    "calculado_automatico": 7900000,
    "registrado_en_facturas": 7900000,
    "diferencia": 0
  },
  "balance": {
    "saldo_calculado": 0,
    "status": "balanceado",
    "mensaje": "Mes balanceado correctamente",
    "puede_cerrar": true
  }
}
```

### POST `/api/monthly-ledger/close`
Cerrar período mensual y generar transacciones de fondos.

**Request Body:**
```json
{
  "church_id": 1,
  "month": 9,
  "year": 2025,
  "force_close": false
}
```

**Response:**
```json
{
  "message": "Mes balanceado y cerrado",
  "report_id": 123,
  "balance_final": 0,
  "fondo_nacional_transferido": 1150000,
  "fecha_cierre": "2025-09-21T12:00:00Z",
  "status": "balanceado"
}
```

**Transacciones Generadas (Automáticamente):**
- General Fund: 10% de diezmos/ofrendas
- Misiones Fund: 100% de ofrendas misioneras
- APY Fund: 100% de contribuciones APY
- Otros fondos especiales según corresponda

---

## Códigos de Error Comunes

| Código | Descripción | Acción Recomendada |
|--------|-------------|-------------------|
| 400 | Bad Request | Verificar parámetros enviados |
| 401 | Unauthorized | Verificar token de autenticación |
| 403 | Forbidden | Usuario sin permisos suficientes |
| 404 | Not Found | Recurso no encontrado |
| 422 | Validation Error | Corregir datos de entrada |
| 500 | Internal Server Error | Contactar soporte técnico |

## Rate Limiting

- **Límite**: 100 requests per 15 minutos por IP
- **Headers de respuesta**:
  - `X-RateLimit-Limit`: Límite total
  - `X-RateLimit-Remaining`: Requests restantes
  - `X-RateLimit-Reset`: Timestamp de reset

## Versionado

La API actualmente está en versión `v1`. Cambios breaking serán notificados con 30 días de anticipación.

## Soporte

Para reportar problemas con la API:
- **GitHub Issues**: [Reportar problema](https://github.com/anthonybirhouse/ipupy-tesoreria/issues)
- **Email**: administracion@ipupy.org.py
- **Documentación**: [docs/](../docs/)

---

**Última actualización**: Septiembre 2025
**Versión API**: v2.0.0