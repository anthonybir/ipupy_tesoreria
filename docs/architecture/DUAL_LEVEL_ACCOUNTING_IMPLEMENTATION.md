# Sistema de Contabilidad Dual-Level IPU Paraguay

## Resumen Ejecutivo

Este documento describe la implementación completa del sistema de contabilidad dual-level para la Iglesia Pentecostal Unida del Paraguay (IPU PY), que permite el seguimiento financiero en dos niveles:

- **Nivel Macro**: Fondo Nacional - informes mensuales tradicionales agregados
- **Nivel Micro**: Contabilidad Individual de Iglesias - transacciones detalladas por iglesia

## Arquitectura del Sistema

### Nivel Macro (Fondo Nacional)
- **Propósito**: Seguimiento agregado para tesorería nacional
- **Datos**: Informes mensuales consolidados por iglesia
- **Usuarios**: Tesorero Nacional, Administradores
- **Tablas**: `reports`, `churches`

### Nivel Micro (Contabilidad de Iglesias)
- **Propósito**: Contabilidad detallada para cada iglesia individual
- **Datos**: Transacciones individuales, cuentas bancarias, presupuestos
- **Usuarios**: Pastores, Tesoreros de Iglesia
- **Tablas**: `church_accounts`, `church_transactions`, `church_budgets`, etc.

## Componentes Implementados

### 1. Base de Datos (Schema Enhancement)

**Archivo**: `migrations/005_dual_level_accounting_enhancement.sql`

#### Nuevas Tablas:

1. **`church_accounts`** - Cuentas bancarias de iglesias
   - Tipos: checking, savings, petty_cash, special_fund
   - Balances actuales y de apertura
   - Información bancaria

2. **`church_transaction_categories`** - Categorías de transacciones
   - Ingresos: Diezmos, Ofrendas, Caballeros, Damas, etc.
   - Gastos: Honorarios, Servicios Públicos, Mantenimiento, etc.
   - Estructura jerárquica (categorías y subcategorías)

3. **`church_transactions`** - Transacciones individuales
   - Ingresos, gastos, transferencias
   - Enlaces a registros de culto y gastos existentes
   - Sistema de reconciliación

4. **`church_budgets`** - Presupuestos anuales/mensuales
   - Montos presupuestados vs reales
   - Análisis de varianza automático

5. **`church_financial_goals`** - Metas financieras
   - Fondos de construcción, misiones, equipamiento
   - Seguimiento de progreso

6. **`church_account_balances`** - Historial de balances
   - Snapshots mensuales para análisis de tendencias

#### Vistas Automatizadas:

1. **`church_financial_summary`** - Resumen financiero por iglesia
2. **`national_treasury_summary`** - Vista macro vs micro nacional

### 2. APIs del Sistema Micro

#### `api/church-accounts.js`
- **GET**: Listar cuentas de iglesia
- **POST**: Crear nueva cuenta
- **PUT**: Actualizar cuenta existente
- **DELETE**: Eliminar cuenta (con validaciones)

**Control de Acceso**:
- Usuarios de iglesia: solo sus propias cuentas
- Administradores: todas las cuentas

#### `api/church-transactions.js`
- **GET**: Listar transacciones con filtros
- **POST**: Crear nueva transacción
- **PUT**: Actualizar transacción
- **DELETE**: Eliminar transacción

**Funcionalidades**:
- Filtros por cuenta, tipo, categoría, fechas
- Resúmenes automáticos por tipo
- Paginación
- Enlaces automáticos a worship_records y expense_records

#### `api/church-transaction-categories.js`
- **GET**: Listar categorías jerárquicas
- **POST**: Crear categoría (solo admins)
- **PUT**: Actualizar categoría
- **DELETE**: Eliminar categoría con validaciones

**Categorías del Sistema**:
- 9 categorías de ingresos predefinidas
- 7 categorías de gastos predefinidas
- Subcategorías para servicios públicos

### 3. API de Vista Nacional Macro

#### `api/national-treasury-overview.js`
- **Solo Administradores**: Vista agregada nacional
- **Análisis de Varianza**: Compara datos macro vs micro
- **Tendencias**: Evolución mensual de ambos niveles
- **Comparación de Iglesias**: Rankings y métricas

**Endpoints**:
- `?view_type=summary` - Resumen nacional
- `?view_type=variance_analysis` - Análisis de variaciones
- `?view_type=church_comparison` - Comparación entre iglesias
- `?view_type=monthly_trends` - Tendencias mensuales

### 4. Interfaz de Usuario

#### `public/church-accounting.html`
Dashboard completo para contabilidad de iglesias con:

**Características**:
- Panel principal con métricas clave
- Gestión de cuentas bancarias
- Registro de transacciones
- Filtros avanzados
- Gráficos de flujo de caja
- Análisis de gastos por categoría
- Responsive design

**Secciones**:
1. **Dashboard**: Resumen financiero, gráficos, transacciones recientes
2. **Cuentas**: Gestión de cuentas bancarias
3. **Transacciones**: Registro detallado con filtros
4. **Categorías**: Gestión de categorías
5. **Presupuesto**: Planificación financiera
6. **Informes**: Reportes y análisis

## Flujo de Datos Dual-Level

### Nivel Micro (Iglesias Individuales)
1. **Entrada de Transacciones**: Pastores registran ingresos/gastos detallados
2. **Categorización**: Cada transacción se categoriza automáticamente
3. **Balance Automático**: Los balances de cuentas se actualizan en tiempo real
4. **Reconciliación**: Sistema de conciliación bancaria

### Nivel Macro (Nacional)
1. **Informes Mensuales**: Pastores envían informes consolidados (sistema existente)
2. **Aggregación Nacional**: Suma automática de todos los informes
3. **Análisis de Varianza**: Comparación automática macro vs micro
4. **Vista Nacional**: Dashboard para tesorero nacional

### Integración Dual-Level
- **Triggers de Base de Datos**: Actualizan balances automáticamente
- **Vistas Materializadas**: Agregaciones pre-calculadas para performance
- **APIs de Comparación**: Identifican discrepancias entre niveles

## Ventajas sobre Excel

### Capacidades No Disponibles en Excel:

1. **Acceso Multi-Usuario Simultáneo**
   - Múltiples iglesias trabajando al mismo tiempo
   - Sincronización en tiempo real

2. **Control de Acceso Granular**
   - Cada iglesia ve solo sus datos
   - Administradores ven vista consolidada

3. **Automatización de Cálculos**
   - Balances actualizados automáticamente
   - Totales nacionales en tiempo real

4. **Análisis de Varianza Automático**
   - Comparación macro vs micro en tiempo real
   - Identificación automática de discrepancias

5. **Trazabilidad Completa**
   - Cada transacción con timestamp y usuario
   - Historial completo de cambios

6. **Categorización Inteligente**
   - Estructura jerárquica de categorías
   - Reutilización entre iglesias

7. **Reconciliación Bancaria**
   - Marcar transacciones como reconciliadas
   - Seguimiento de depósitos vs reportes

## Implementación Técnica

### Migraciones Aplicadas
```bash
# Aplicar esquema dual-level
node scripts/apply-dual-level-accounting-migration.js
```

### Endpoints Principales
- `/api/church-accounts` - Gestión de cuentas
- `/api/church-transactions` - Transacciones micro
- `/api/church-transaction-categories` - Categorías
- `/api/national-treasury-overview` - Vista macro nacional

### Autenticación y Autorización
- **JWT Tokens**: Autenticación segura
- **Roles**: `admin` (nacional) vs `church` (iglesia)
- **Control de Acceso**: Por iglesia y por función

### Performance y Escalabilidad
- **Índices Optimizados**: Para consultas frecuentes
- **Vistas Materializadas**: Para aggregaciones pesadas
- **Paginación**: En listados de transacciones
- **Filtros Eficientes**: Por fecha, iglesia, categoría

## Próximos Pasos

### Funcionalidades Pendientes:
1. **Módulo de Presupuestos**: Planificación anual/mensual
2. **Reportes Automatizados**: Generación de PDFs
3. **Integración Bancaria**: Import de transacciones
4. **Mobile App**: Para pastores en el campo
5. **Notificaciones**: Alertas por email/SMS

### Optimizaciones Técnicas:
1. **Caching**: Redis para consultas frecuentes
2. **Background Jobs**: Procesamiento asíncrono
3. **Data Warehouse**: Para análisis históricos
4. **API Rate Limiting**: Protección contra abuso

## Beneficios Realizados

### Para Iglesias Individuales:
- ✅ Contabilidad detallada y profesional
- ✅ Seguimiento de múltiples cuentas bancarias
- ✅ Categorización automática de gastos
- ✅ Reconciliación bancaria
- ✅ Planificación presupuestaria

### Para Tesorería Nacional:
- ✅ Vista consolidada en tiempo real
- ✅ Comparación macro vs micro automática
- ✅ Identificación de discrepancias
- ✅ Análisis de tendencias nacionales
- ✅ Métricas de adopción del sistema

### Para la Organización:
- ✅ Transparencia financiera total
- ✅ Auditoría automática
- ✅ Reducción de errores manuales
- ✅ Cumplimiento regulatorio mejorado
- ✅ Eficiencia operacional

## Conclusión

El sistema de contabilidad dual-level implementado proporciona las capacidades que Excel no podía ofrecer, especialmente:

1. **Seguimiento Simultáneo**: Macro (nacional) y micro (iglesias) en paralelo
2. **Análisis Comparativo**: Identificación automática de discrepancias
3. **Escalabilidad**: Soporte para crecimiento organizacional
4. **Profesionalización**: Estándares contables modernos

Este sistema posiciona a IPU Paraguay como una organización con sistemas financieros de clase mundial, superando las limitaciones de Excel y proporcionando la transparencia y control necesarios para una gestión financiera eficiente a nivel nacional.