# Sistema de Roles y Permisos - IPU PY Tesorería

**Última actualización**: 2025-01-06
**Versión**: 4.1 (Role Scope Security Fixes)

---

## 🔒 SEGURIDAD: Alcances de Roles Corregidos (2025-01-06)

**CRÍTICO**: Se corrigieron bugs de seguridad en el enforcement de alcances de roles:

### Cambios Aplicados:
1. ✅ **treasurer** ahora restringido a su iglesia ÚNICAMENTE (antes tenía acceso global incorrectamente)
2. ✅ **church_manager** ahora incluido en filtros de reportes (antes veía todas las iglesias)
3. ✅ **fund_director** ahora limitado a iglesias asignadas (antes veía todos los reportes)
4. ✅ **national_treasurer** ahora explícitamente manejado en API de reportes

### Archivos Modificados:
- `src/lib/auth-supabase.ts`: Funciones `hasFundAccess()` y `hasChurchAccess()` corregidas
- `src/app/api/reports/route.ts`: Lógica de scoping mejorada en `handleGetReports()`

### Impacto de Seguridad:
- **ANTES**: Tesoreros de iglesia podían ver datos de TODAS las iglesias
- **AHORA**: Tesoreros de iglesia solo ven SU iglesia

---

## 📋 Resumen Ejecutivo

El sistema utiliza **7 roles jerárquicos** para controlar el acceso y las capacidades de los usuarios en la plataforma de tesorería.

### Roles Actuales (en orden jerárquico)

1. **👑 admin** - Administrador del Sistema (nivel 7)
2. **🏛️ national_treasurer** - Tesorero Nacional (nivel 6) - **NUEVO en v4.0**
3. **💼 fund_director** - Director de Fondos (nivel 5)
4. **⛪ pastor** - Pastor de Iglesia (nivel 4)
5. **💰 treasurer** - Tesorero de Iglesia (nivel 3)
6. **📊 church_manager** - Gerente de Iglesia (nivel 2)
7. **📝 secretary** - Secretario de Iglesia (nivel 1)

---

## ✅ MODELO DE NEGOCIO IMPLEMENTADO (Migration 038)

**Fecha**: 2025-10-05
**Estado**: ✅ Sistema completamente alineado con modelo de negocio real

### Descubrimiento Crítico

**El sistema es DUAL-SCOPE**:
- **NIVEL NACIONAL**: Gestión centralizada de 9 fondos nacionales (Fondo Nacional, Misiones, APY, etc.)
- **NIVEL IGLESIA**: Reportes financieros para 38 iglesias (0 usuarios actualmente, admin completa formularios)

**Hallazgos clave**:
- 38 iglesias existen, pero **CERO tienen usuarios** excepto admin
- Los **eventos son NACIONALES**: Creados por fund_director, aprobados por admin
- Los **reportes son LOCALES**: Enviados por pastor/tesorero de iglesia, aprobados por admin
- Los **directores de fondo gestionan FONDOS**, no iglesias

### Correcciones Aplicadas en Migration 038

#### Permisos ELIMINADOS (9 total):
1. ❌ `treasurer.events.approve` - Los eventos son aprobados por admin, no tesorero de iglesia
2. ❌ `treasurer.events.create` - Los eventos son creados por fund_director para fondos nacionales
3. ❌ `treasurer.events.manage` - Los eventos son nivel NACIONAL, no iglesia
4. ❌ `fund_director.churches.view` - Los directores de fondo gestionan FONDOS, no iglesias
5. ❌ `fund_director.reports.view` - No necesitan ver reportes de iglesias
6. ❌ `fund_director.dashboard.view` (general) - Reemplazado con scope assigned_funds
7. ❌ `secretary.events.manage` - El secretario es nivel iglesia, eventos son nacionales

#### Permisos AGREGADOS (3 total):
1. ✅ `fund_director.events.submit` (assigned_funds) - Enviar eventos para aprobación de admin
2. ✅ `fund_director.dashboard.view` (assigned_funds) - Ver panel de fondos asignados
3. ✅ `treasurer.transactions.create` (own) - Registrar transacciones de iglesia local

### Tabla de Consistencia Final

| Rol | DB Constraint | UI (authz.ts) | role_permissions | get_role_level() | Scope |
|-----|---------------|---------------|------------------|------------------|-------|
| `admin` | ✅ | ✅ | ✅ (6 perms) | ✅ (7) | ALL - Nacional |
| `national_treasurer` | ✅ | ✅ | ✅ (11 perms) | ✅ (6) | ALL - Nacional |
| `fund_director` | ✅ | ✅ | ✅ (10 perms) | ✅ (5) | assigned_funds - Nacional |
| `pastor` | ✅ | ✅ | ✅ (5 perms) | ✅ (4) | own - Iglesia |
| `treasurer` | ✅ | ✅ | ✅ (5 perms) | ✅ (3) | own - Iglesia |
| `church_manager` | ✅ | ✅ | ✅ (5 perms) | ✅ (2) | own - Iglesia |
| `secretary` | ✅ | ✅ | ✅ (2 perms) | ✅ (1) | own - Iglesia |

**Total**: 44 permisos (desde migration 040)

**Documentación completa**: Ver [`CORRECT_PERMISSIONS_MODEL.md`](./CORRECT_PERMISSIONS_MODEL.md) y [`MIGRATION_038_VERIFICATION.md`](./MIGRATION_038_VERIFICATION.md)

---

## 👑 1. Admin (Administrador del Sistema)

### Descripción
Rol de máximo privilegio. Administra todo el sistema a nivel nacional.

### Alcance
- **Nacional** - Acceso completo a todas las iglesias y datos

### Permisos

| Permiso | Descripción | Ejemplos de Uso |
|---------|-------------|-----------------|
| `system.manage` | Administración completa del sistema | Configuración global, ajustes |
| `churches.manage` | Gestionar todas las iglesias | Crear, editar, eliminar iglesias |
| `users.manage` | Gestionar todos los usuarios | Asignar roles, activar/desactivar |
| `reports.approve` | Aprobar cualquier reporte | Aprobar reportes mensuales |
| `funds.manage` | Gestionar todos los fondos | Crear fondos, ajustar balances |
| `events.manage` | Gestionar todos los eventos | Ver/aprobar eventos de cualquier iglesia |

### Capacidades Clave
- ✅ Acceso a panel de administración completo
- ✅ Gestión de usuarios (crear, editar, eliminar, cambiar roles)
- ✅ Configuración del sistema (opciones globales)
- ✅ Aprobación de reportes de cualquier iglesia
- ✅ Gestión de fondos nacionales
- ✅ Acceso a todas las iglesias y sus datos
- ✅ Exportación de datos consolidados

### Usuarios Típicos
- `administracion@ipupy.org.py`
- `tesoreria@ipupy.org.py`

### Asignación Automática
Todos los usuarios con email `@ipupy.org.py` reciben rol `admin` automáticamente al registrarse.

---

## 🏛️ 2. National Treasurer (Tesorero Nacional)

### Descripción
Posición electa que supervisa TODOS los fondos nacionales y dirige a todos los fund_directors. Tiene acceso total a los 9 fondos nacionales (vs. fund_director que solo accede 1 fondo).

### Alcance
- **Nacional** - Acceso a TODOS los fondos nacionales
- **Multi-fondo** - Supervisa los 9 fondos nacionales simultáneamente
- **Supervisión** - Dirige y aprueba trabajo de fund_directors

### Permisos

| Permiso | Descripción | Ejemplos de Uso |
|---------|-------------|-----------------|
| `events.approve` | Aprobar eventos de cualquier fondo | Aprobar evento propuesto por fund_director |
| `events.view` | Ver todos los eventos de fondos | Consultar eventos planificados |
| `events.edit` | Editar cualquier evento de fondo | Modificar presupuesto de evento |
| `events.create` | Crear eventos de fondos nacionales | Planificar nuevo evento nacional |
| `funds.view` | Ver todos los fondos nacionales | Consultar balances de los 9 fondos |
| `funds.manage` | Gestionar balances de fondos | Ajustar balances, crear fondos |
| `transactions.view` | Ver todas las transacciones de fondos | Revisar movimientos de todos los fondos |
| `transactions.create` | Crear transacciones de fondos | Registrar movimientos nacionales |
| `dashboard.view` | Ver dashboard de tesorería nacional | Panel de control de fondos |
| `churches.view` | Ver iglesias para contexto | Consultar iglesias relacionadas a eventos |
| `reports.view` | Ver reportes mensuales | Consultar reportes (solo lectura) |

### Capacidades Clave
- ✅ Aprobar eventos propuestos por CUALQUIER fund_director
- ✅ Ver y gestionar TODOS los 9 fondos nacionales
- ✅ Crear y editar eventos de cualquier fondo
- ✅ Supervisar trabajo de todos los fund_directors
- ✅ Ver todas las transacciones de fondos
- ✅ Dashboard consolidado de tesorería nacional
- ❌ NO puede gestionar usuarios (solo admin)
- ❌ NO puede aprobar reportes de iglesias (solo admin)
- ❌ NO puede modificar configuración del sistema (solo admin)

### Diferencia con Admin
| Capacidad | national_treasurer | admin |
|-----------|:------------------:|:-----:|
| Gestionar usuarios | ❌ | ✅ |
| Configurar sistema | ❌ | ✅ |
| Aprobar reportes de iglesias | ❌ | ✅ |
| Gestionar iglesias | ❌ | ✅ |
| **Aprobar eventos de fondos** | ✅ | ✅ |
| **Gestionar todos los fondos** | ✅ | ✅ |
| **Supervisar fund_directors** | ✅ | ✅ |

### Diferencia con Fund Director
| Capacidad | national_treasurer | fund_director |
|-----------|:------------------:|:-------------:|
| Fondos accesibles | **TODOS (9)** | Solo 1 asignado |
| Aprobar eventos | ✅ | ❌ |
| Ver eventos de otros fondos | ✅ | ❌ |
| Crear eventos | ✅ | ✅ |
| Editar eventos de otros | ✅ | ❌ |

### Usuarios Típicos
- Tesorero Nacional electo (posición única)
- Supervisor de todos los fondos nacionales

### Flujo de Trabajo Típico
1. **Fund_director crea evento**: Propone evento con presupuesto
2. **Fund_director envía para aprobación**: Status cambia a "submitted"
3. **National_treasurer revisa**: Evalúa presupuesto y justificación
4. **National_treasurer aprueba/rechaza**: Cambia status a "approved" o "rejected"
5. **Post-evento**: Fund_director registra gastos reales
6. **National_treasurer supervisa**: Revisa variaciones presupuesto vs. real

### Nota Importante
**Migration 040 (2025-10-05)**: Rol creado como posición electa para supervisar fondos nacionales. Nivel 6 en jerarquía, entre admin (7) y fund_director (5).

---

## 💼 3. Fund Director (Director de Fondos)

### Descripción
Gestiona eventos y presupuestos para fondos específicos. Requiere aprobación del tesorero.

### Alcance
- **Por Fondo** - Solo fondos asignados explícitamente
- **Multi-iglesia** - Puede trabajar con múltiples iglesias

### Permisos

| Permiso | Descripción | Ejemplos de Uso |
|---------|-------------|-----------------|
| `events.create` | Crear eventos | Planificar nuevo evento |
| `events.edit` | Editar eventos propios | Modificar presupuesto |
| `events.submit` | Enviar para aprobación | Solicitar aprobación del tesorero |
| `events.view` | Ver eventos de sus fondos | Consultar eventos planificados |
| `events.actuals` | Registrar gastos reales | Ingresar gastos post-evento |
| `funds.view` | Ver fondos asignados | Consultar balance del fondo |
| `transactions.view` | Ver transacciones | Revisar movimientos del fondo |
| `reports.view` | Ver reportes | Consultar reportes mensuales |
| `churches.view` | Ver iglesias | Consultar datos de iglesias |
| `dashboard.view` | Ver dashboard | Panel de control personal |

### Capacidades Clave
- ✅ Crear y planificar eventos (presupuesto estimado)
- ✅ Registrar ingresos/gastos reales post-evento
- ✅ Ver balance de fondos asignados
- ✅ Solicitar aprobación del tesorero
- ❌ NO puede aprobar sus propios eventos
- ❌ NO puede crear reportes mensuales
- ❌ Acceso limitado a fondos específicos (definido en `fund_director_assignments`)

### Asignación de Fondos
Los fund_directors deben ser asignados a fondos específicos por un administrador:

```sql
-- Ejemplo: Asignar director al "Fondo Misionero"
INSERT INTO fund_director_assignments (profile_id, fund_id)
VALUES ('user-uuid', 123);
```

### Flujo de Trabajo Típico
1. **Planificar evento**: Crear evento con presupuesto estimado
2. **Enviar para aprobación**: Cambiar status a "submitted"
3. **Tesorero aprueba**: Status cambia a "approved"
4. **Post-evento**: Registrar gastos e ingresos reales
5. **Generar transacciones**: Sistema crea movimientos en el ledger

---

## ⛪ 4. Pastor (Pastor de Iglesia)

### Descripción
Líder de la iglesia local. Gestiona la congregación y supervisalas finanzas.

### Alcance
- **Iglesia Propia** - Solo su iglesia asignada

### Permisos

| Permiso | Descripción | Ejemplos de Uso |
|---------|-------------|-----------------|
| `church.manage` | Gestionar iglesia propia | Actualizar información de iglesia |
| `reports.create` | Crear reportes mensuales | Nuevo reporte financiero |
| `reports.edit` | Editar reportes propios | Corregir reporte antes de enviar |
| `members.manage` | Gestionar miembros | Agregar/editar miembros |
| `funds.view` | Ver fondos de iglesia | Consultar balance |

### Capacidades Clave
- ✅ Crear y editar reportes mensuales de su iglesia
- ✅ Gestionar información de la iglesia (nombre, dirección, etc.)
- ✅ Gestionar miembros de la congregación
- ✅ Ver balances de fondos de su iglesia
- ❌ NO puede aprobar sus propios reportes
- ❌ NO puede ver otras iglesias

### Usuarios Típicos
- Pastores principales de las 22 iglesias locales

---

## 💰 5. Treasurer (Tesorero de Iglesia)

### Descripción
Responsable de las finanzas de la iglesia local. Crea reportes mensuales y registra transacciones de su iglesia.

### Alcance
- **Iglesia Propia** - Solo su iglesia asignada (CHURCH-LEVEL ONLY)
- **⚠️ IMPORTANTE**: Los tesoreros de iglesia NO tienen acceso a otras iglesias ni a fondos nacionales

### Permisos

| Permiso | Descripción | Ejemplos de Uso |
|---------|-------------|-----------------|
| `reports.create` | Crear reportes mensuales | Nuevo reporte financiero |
| `reports.edit` | Editar reportes propios | Actualizar montos |
| `transactions.create` | Crear transacciones | Registrar movimientos de iglesia |
| `funds.view` | Ver fondos de iglesia | Consultar balances (solo lectura) |
| `transactions.view` | Ver transacciones | Revisar movimientos de iglesia |

### Capacidades Clave
- ✅ Crear y editar reportes mensuales de su iglesia
- ✅ Registrar transacciones de su iglesia local
- ✅ Ver balances de fondos (solo lectura)
- ✅ Ver transacciones de su iglesia
- ❌ NO puede aprobar sus propios reportes mensuales (solo admin)
- ❌ NO puede ver otras iglesias
- ❌ NO puede aprobar eventos de fondos nacionales (eso es del national_treasurer)
- ❌ NO puede crear eventos nacionales (eso es del fund_director)

### Responsabilidades Principales
1. **Reportes Mensuales**: Crear reporte antes del día 5 de cada mes
2. **Registro de Transacciones**: Mantener ledger actualizado de su iglesia
3. **Depósitos Bancarios**: Registrar depósitos del fondo nacional (10%)

### Diferencia con National Treasurer
| Capacidad | treasurer (Iglesia) | national_treasurer (Nacional) |
|-----------|:-------------------:|:-----------------------------:|
| Alcance | **Solo su iglesia** | **Todas las iglesias** |
| Fondos | Solo lectura | Gestión completa (9 fondos) |
| Eventos | NO puede aprobar | Aprueba eventos de fondos |
| Reportes | Crea para su iglesia | Lee todos (no aprueba) |
| Transacciones | Solo su iglesia | Todas las transacciones |

---

## 📊 6. Church Manager (Gerente de Iglesia)

### Descripción
Asistente administrativo con acceso de solo lectura a información de la iglesia. Rol de supervisión sin permisos de modificación.

### Alcance
- **Iglesia Propia** - Solo su iglesia asignada

### Permisos

| Permiso | Descripción | Ejemplos de Uso |
|---------|-------------|-----------------|
| `church.view` | Ver información de iglesia | Consultar datos de la iglesia |
| `reports.view` | Ver reportes mensuales | Revisar reportes financieros |
| `members.view` | Ver miembros | Consultar directorio de miembros |
| `events.view` | Ver eventos | Consultar calendario de eventos |
| `dashboard.view` | Ver panel de control | Acceder al dashboard de iglesia |

### Capacidades Clave
- ✅ Ver información completa de la iglesia
- ✅ Consultar reportes mensuales (solo lectura)
- ✅ Acceder al directorio de miembros
- ✅ Ver calendario de eventos
- ✅ Dashboard de iglesia
- ❌ NO puede crear ni editar nada
- ❌ NO puede aprobar reportes
- ❌ NO puede gestionar fondos

### Usuarios Típicos
- Gerentes o administradores de iglesia
- Personal de supervisión con acceso view-only

### Nota Importante
**Migration 037 (2025-10-05)**: Permisos agregados. Anteriormente este rol no tenía permisos definidos.

---

## 📝 7. Secretary (Secretario de Iglesia)

### Descripción
Asistente administrativo de la iglesia. Gestiona miembros y eventos.

### Alcance
- **Iglesia Propia** - Solo su iglesia asignada

### Permisos

| Permiso | Descripción | Ejemplos de Uso |
|---------|-------------|-----------------|
| `members.manage` | Gestionar miembros | Agregar/editar miembros |
| `reports.view` | Ver reportes | Consultar reportes mensuales |
| `events.manage` | Gestionar eventos | Crear/editar eventos |

### Capacidades Clave
- ✅ Gestionar directorio de miembros
- ✅ Ver reportes de la iglesia (solo lectura)
- ✅ Crear y gestionar eventos de iglesia
- ❌ NO puede crear reportes mensuales
- ❌ NO puede aprobar nada
- ❌ NO puede ver fondos o transacciones

### Usuarios Típicos
- Secretarios de iglesias locales
- Asistentes administrativos

---

## 🗑️ Roles Obsoletos ELIMINADOS (Migration 037)

**Fecha de eliminación**: 2025-10-05

Los siguientes roles fueron **removidos del sistema** porque:
1. No estaban en el constraint de DB (no asignables)
2. Causaban confusión en el código
3. Sus permisos nunca fueron utilizados

---

### ~~District Supervisor (Supervisor de Distrito)~~ ❌ ELIMINADO

**Estado anterior**: Definido en `role_permissions` pero NO en constraint de DB.

**Permisos eliminados**:
- `churches.view` (district)
- `reports.approve` (district)
- `reports.view` (district)
- `members.view` (district)

**Razón**: Rol de migration 023 que nunca fue incluido en constraint. **Removido en migration 037**.

---

### ~~Member (Miembro)~~ ❌ ELIMINADO

**Estado anterior**: Definido en `role_permissions` pero NO en constraint de DB.

**Permisos eliminados**:
- `profile.edit` (own)
- `contributions.view` (own)
- `events.view` (own)

**Razón**: Rol para portal de miembros nunca implementado. **Removido en migration 037**.

**Nota**: Si en el futuro se requiere un portal de miembros, se debe:
1. Agregar `member` al constraint de DB
2. Recrear permisos en `role_permissions`
3. Actualizar `get_role_level()` con nivel apropiado (probablemente 0)

---

## 🔐 Row Level Security (RLS)

### Cómo Funciona

Cada consulta a la base de datos establece variables de sesión:
- `app.current_user_id` - UUID del usuario
- `app.current_user_role` - Rol del usuario
- `app.current_user_church_id` - ID de iglesia asignada

Las políticas RLS usan estas variables para filtrar datos automáticamente.

### Funciones Helper RLS

```sql
-- Verificar si usuario es admin
app_user_is_admin() → BOOLEAN

-- Verificar si es fund_director
app_user_is_fund_director() → BOOLEAN

-- Obtener fondos asignados a fund_director actual
app_user_assigned_funds() → INTEGER[]

-- Verificar acceso a fondo específico
app_user_has_fund_access(fund_id INTEGER) → BOOLEAN

-- Obtener nivel jerárquico del rol
get_role_level(role TEXT) → INTEGER

-- Verificar si rol A puede gestionar rol B
can_manage_role(manager_role TEXT, target_role TEXT) → BOOLEAN
```

### Jerarquía de Roles (Función `get_role_level`)

**Actualizada en Migration 040 (2025-10-05)**

```
admin               → 7 (máximo privilegio)
national_treasurer  → 6 (supervisa todos los fondos) - NUEVO
fund_director       → 5 (fondos específicos)
pastor              → 4 (liderazgo de iglesia)
treasurer           → 3 (finanzas)
church_manager      → 2 (administración view-only)
secretary           → 1 (asistente administrativo)
```

**Nota**: `district_supervisor` y `member` fueron eliminados en migration 037. `national_treasurer` agregado en migration 040.

---

## 📊 Matriz de Permisos Completa

### ⚠️ FUENTE DE VERDAD (Source of Truth)

Esta matriz se mantiene sincronizada con:
1. **`src/app/admin/configuration/page.tsx`** - `defaultRolesConfig` (UI)
2. **`migrations/038_fix_permissions_correctly.sql`** - Eliminaciones explícitas
3. **`migrations/039_add_fund_director_view_permissions.sql`** - fund_director permisos
4. **`migrations/040_add_national_treasurer_role.sql`** - national_treasurer permisos

**CRÍTICO**: Si hay discrepancias entre esta matriz y el código, el CÓDIGO es la fuente de verdad. Esta matriz se actualiza para reflejar el estado real del sistema.

**Última verificación de sincronización**: 2025-10-05 (post-migration 040)

### Leyenda de Alcance
- **all**: Todas las iglesias/datos del sistema
- **assigned**: Solo fondos/iglesias asignados al usuario
- **own**: Solo su iglesia/datos propios

### Tabla de Permisos

**IMPORTANTE**: Esta tabla refleja los permisos REALES del sistema según `admin/configuration/page.tsx` y migrations 038-040.

| Permiso | admin | national_treasurer | fund_director | pastor | treasurer | church_manager | secretary | Alcance |
|---------|:-----:|:------------------:|:-------------:|:------:|:---------:|:--------------:|:---------:|---------|
| **Sistema** |
| `system.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | all |
| `users.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | all |
| `dashboard.view` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | all/assigned |
| **Iglesias** |
| `churches.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | all |
| `churches.view` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | all |
| `church.manage` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | own |
| `church.view` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | own |
| **Reportes** |
| `reports.approve` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | all |
| `reports.create` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | own |
| `reports.edit` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | own |
| `reports.view` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | all/assigned |
| **Fondos** |
| `funds.manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | all |
| `funds.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | all/assigned/own |
| **Transacciones** |
| `transactions.view` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | all/assigned/own |
| `transactions.create` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | all/own |
| **Eventos (SOLO NACIONAL - NO iglesias)** |
| `events.create` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | all/assigned |
| `events.edit` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | all/assigned |
| `events.submit` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | assigned |
| `events.approve` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | all |
| `events.actuals` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | assigned |
| `events.view` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | all/assigned/own |
| **Miembros** |
| `members.manage` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | own |
| `members.view` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | own |

---

## 🔧 Gestión de Roles

### Asignar Rol a Usuario

**Desde UI** (solo admin):
1. Admin → Configuración → Usuarios
2. Click "Crear nuevo usuario" o editar existente
3. Seleccionar rol del dropdown
4. Asignar iglesia (opcional, requerido para pastor/treasurer/secretary)
5. Guardar

**Desde Base de Datos**:
```sql
UPDATE profiles
SET role = 'pastor', church_id = 15
WHERE id = 'user-uuid';
```

### Asignar Fondos a Fund Director

Solo admin puede asignar fondos:

```sql
-- Asignar fund_director a fondo específico
INSERT INTO fund_director_assignments (profile_id, fund_id, church_id, created_by)
VALUES ('director-uuid', 42, 15, 'admin-uuid');

-- Asignar acceso a TODOS los fondos
INSERT INTO fund_director_assignments (profile_id, fund_id, church_id, created_by)
VALUES ('director-uuid', NULL, NULL, 'admin-uuid');
```

### Validación de Roles

El sistema valida roles en múltiples capas:

1. **Database Constraint**: `profiles_role_check` rechaza roles inválidos
2. **TypeScript**: `ProfileRole` type proporciona seguridad en compile-time
3. **Runtime**: `isValidProfileRole()` valida roles dinámicamente
4. **RLS**: Políticas verifican rol en cada query

---

## 📚 Referencias Técnicas

### Archivos Clave

- **`src/lib/authz.ts`** - Definición de roles y funciones de autorización
- **`migrations/023_simplify_roles.sql`** - Migración de simplificación de roles
- **`migrations/026_fund_director_events.sql`** - Adición de fund_director
- **`src/hooks/useAdminUsers.ts`** - Tipos de usuario admin
- **`src/components/Admin/AdminUserDialog.tsx`** - UI de gestión de usuarios

### Tablas de Base de Datos

- **`profiles`** - Usuarios y sus roles
- **`role_permissions`** - Matriz de permisos por rol
- **`fund_director_assignments`** - Asignación de fondos a directores
- **`user_activity`** - Log de auditoría de acciones

### Queries Útiles

```sql
-- Ver distribución de roles
SELECT role, COUNT(*) as count
FROM profiles
GROUP BY role
ORDER BY count DESC;

-- Ver permisos de un rol específico
SELECT permission, scope, description
FROM role_permissions
WHERE role = 'pastor'
ORDER BY permission;

-- Ver fondos asignados a un fund_director
SELECT p.full_name, f.name as fund_name, fda.church_id
FROM fund_director_assignments fda
JOIN profiles p ON p.id = fda.profile_id
JOIN funds f ON f.id = fda.fund_id
WHERE p.role = 'fund_director';
```

---

## ✅ Problemas RESUELTOS (Migration 037)

**Todos los problemas identificados fueron corregidos el 2025-10-05**

### 1. Church Manager Sin Permisos ✅ RESUELTO
**Problema**: Rol existía pero no tenía permisos definidos
**Solución**: Agregados 5 permisos de view-only (church.view, reports.view, members.view, events.view, dashboard.view)
**Estado**: ✅ Completamente funcional

### 2. Roles Obsoletos en role_permissions ✅ RESUELTO
**Problema**: `district_supervisor` y `member` tenían permisos pero no eran asignables
**Solución**: Eliminados de `role_permissions` (7 permisos removidos en total)
**Estado**: ✅ Base de datos limpia

### 3. Fund Director Sin Nivel en get_role_level() ✅ RESUELTO
**Problema**: Función `get_role_level()` no incluía `fund_director` ni `church_manager`
**Solución**: Función actualizada con niveles correctos (fund_director=5, church_manager=2)
**Estado**: ✅ Jerarquía completa

### 4. Inconsistencia Migration 023 vs. Constraint Actual ✅ RESUELTO
**Problema**: Constraint no coincidía con migrations originales
**Solución**: Migration 037 documenta y corrige todas las inconsistencias
**Estado**: ✅ Sistema consistente

---

## 📝 Changelog

### 2025-10-05 - Migration 040: Tesorero Nacional Agregado ✅
- **ADDED**: Nuevo rol `national_treasurer` - Tesorero Nacional electo
- **UPDATED**: Jerarquía de roles actualizada (admin: 6→7, nuevo national_treasurer: 6)
- **ADDED**: 11 permisos para national_treasurer (eventos, fondos, transacciones)
- **SCOPE**: national_treasurer supervisa TODOS los 9 fondos nacionales
- **PERMISSIONS**: events.approve, events.view, events.edit, events.create, funds.view, funds.manage, transactions.view, transactions.create, dashboard.view, churches.view, reports.view
- **BUSINESS**: Posición electa que supervisa fund_directors y aprueba eventos de fondos
- **API ROUTES**: Actualizado `/api/fund-events/[id]` para permitir approve/reject por national_treasurer
- **FRONTEND**: Agregado a defaultRolesConfig en admin configuration page
- Sistema ahora con 7 roles jerárquicos (admin, national_treasurer, fund_director, pastor, treasurer, church_manager, secretary)

### 2025-10-05 - Migration 037: Corrección de Inconsistencias ✅
- **FIXED**: `church_manager` ahora tiene 5 permisos definidos (view-only access)
- **FIXED**: `get_role_level()` actualizada con `fund_director` (5) y `church_manager` (2)
- **REMOVED**: Eliminados roles obsoletos `district_supervisor` y `member` de `role_permissions`
- **ADDED**: Permisos adicionales para `fund_director` (dashboard, churches, reports)
- Sistema ahora 100% consistente entre DB, código y permisos
- Todos los problemas identificados han sido resueltos

### 2025-10-05 - Documentación Inicial
- Investigación completa del sistema de roles
- Identificación de inconsistencias
- Documentación de 6 roles activos
- Matriz de permisos completa
- Recomendaciones de corrección

---

**Documento creado por**: Claude Code (Investigación sistemática)
**Para**: IPU PY Tesorería
**Contacto**: administracion@ipupy.org.py
