# Sistema de Roles y Permisos - IPU PY Tesorería

**Última actualización**: 2025-10-05
**Versión**: 2.1 (Post-migración con fund_director)

---

## 📋 Resumen Ejecutivo

El sistema utiliza **6 roles jerárquicos** para controlar el acceso y las capacidades de los usuarios en la plataforma de tesorería.

### Roles Actuales (en orden jerárquico)

1. **👑 admin** - Administrador del Sistema
2. **💼 fund_director** - Director de Fondos
3. **⛪ pastor** - Pastor de Iglesia
4. **💰 treasurer** - Tesorero de Iglesia
5. **📊 church_manager** - Gerente de Iglesia
6. **📝 secretary** - Secretario de Iglesia

---

## ⚠️ ADVERTENCIA: Inconsistencias Detectadas

Durante la investigación del sistema (2025-10-05) se encontraron las siguientes inconsistencias:

### Roles en Base de Datos vs. Código

| Rol | DB Constraint | UI (authz.ts) | role_permissions | Migration 023 |
|-----|---------------|---------------|------------------|---------------|
| `admin` | ✅ | ✅ | ✅ | ✅ |
| `fund_director` | ✅ | ✅ | ✅ | ❌ |
| `pastor` | ✅ | ✅ | ✅ | ✅ |
| `treasurer` | ✅ | ✅ | ✅ | ✅ |
| `church_manager` | ✅ | ✅ | ❌ | ❌ |
| `secretary` | ✅ | ✅ | ✅ | ✅ |
| `district_supervisor` | ❌ | ❌ | ✅ | ✅ |
| `member` | ❌ | ❌ | ✅ | ✅ |

### Problemas Identificados

1. **`church_manager`**: Existe en DB y UI pero NO tiene permisos definidos en `role_permissions`
2. **`fund_director`**: Existe en DB y UI pero NO estaba en Migration 023 (agregado en Migration 026)
3. **`district_supervisor`** y **`member`**: Tienen permisos definidos pero NO pueden ser asignados (DB constraint los rechaza)

### Recomendación

Se requiere una migración de corrección para:
- Eliminar `district_supervisor` y `member` de `role_permissions` O
- Actualizar el constraint de DB para incluirlos O
- Definir permisos para `church_manager` si se va a usar

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

## 💼 2. Fund Director (Director de Fondos)

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

## ⛪ 3. Pastor (Pastor de Iglesia)

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

## 💰 4. Treasurer (Tesorero de Iglesia)

### Descripción
Responsable de las finanzas de la iglesia local. Crea reportes y aprueba eventos.

### Alcance
- **Iglesia Propia** - Solo su iglesia asignada

### Permisos

| Permiso | Descripción | Ejemplos de Uso |
|---------|-------------|-----------------|
| `reports.create` | Crear reportes mensuales | Nuevo reporte financiero |
| `reports.edit` | Editar reportes propios | Actualizar montos |
| `events.create` | Crear eventos | Planificar evento local |
| `events.manage` | Gestionar eventos | Ver todos los eventos |
| `events.approve` | Aprobar eventos | Aprobar solicitudes de fund_director |
| `funds.view` | Ver fondos de iglesia | Consultar balances |
| `transactions.view` | Ver transacciones | Revisar movimientos |

### Capacidades Clave
- ✅ Crear y editar reportes mensuales
- ✅ Aprobar eventos planificados por fund_directors
- ✅ Crear y gestionar eventos de la iglesia
- ✅ Ver todas las transacciones de su iglesia
- ✅ Consultar balances de fondos
- ❌ NO puede aprobar sus propios reportes mensuales
- ❌ NO puede ver otras iglesias

### Responsabilidades Principales
1. **Reportes Mensuales**: Crear reporte antes del día 5 de cada mes
2. **Aprobación de Eventos**: Revisar y aprobar eventos de fund_directors
3. **Registro de Transacciones**: Mantener ledger actualizado
4. **Depósitos Bancarios**: Registrar depósitos del fondo nacional (10%)

---

## 📊 5. Church Manager (Gerente de Iglesia)

### Descripción
**⚠️ ROL SIN PERMISOS DEFINIDOS** - Existe en el constraint de DB pero NO tiene permisos en `role_permissions`.

### Estado Actual
- ✅ Puede ser asignado desde UI
- ❌ NO tiene permisos definidos en `role_permissions`
- ❌ Funcionalidad no implementada

### Alcance Esperado
- **Iglesia Propia** - Solo su iglesia asignada (asumido)

### Permisos Propuestos
*Pendiente de definición - se recomienda migración para clarificar*

Posibles permisos basados en el nombre:
- `church.view` - Ver información de iglesia
- `members.view` - Ver miembros
- `events.view` - Ver eventos
- `reports.view` - Ver reportes

### Recomendación
**ACCIÓN REQUERIDA**: Definir permisos para este rol O eliminarlo del sistema si no se usa.

---

## 📝 6. Secretary (Secretario de Iglesia)

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

## 🚫 Roles Obsoletos / No Asignables

### District Supervisor (Supervisor de Distrito)

**Estado**: Definido en `role_permissions` pero NO en constraint de DB (no asignable).

**Permisos Definidos** (no utilizables):
- `churches.view` (district)
- `reports.approve` (district)
- `reports.view` (district)
- `members.view` (district)

**Problema**: Existe en migration 023 y tiene permisos, pero el constraint de DB lo rechaza.

**Recomendación**: Eliminar de `role_permissions` O actualizar constraint para incluirlo.

---

### Member (Miembro)

**Estado**: Definido en `role_permissions` pero NO en constraint de DB (no asignable).

**Permisos Definidos** (no utilizables):
- `profile.edit` (own)
- `contributions.view` (own)
- `events.view` (own)

**Problema**: Rol de menor privilegio en migration 023, pero constraint lo rechaza.

**Recomendación**: Si se va a usar portal de miembros, actualizar constraint para incluirlo.

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

```
admin            → 6 (máximo privilegio)
district_supervisor → 5 (obsoleto)
pastor           → 4
treasurer        → 3
secretary        → 2
member           → 1 (mínimo privilegio, obsoleto)
```

**Nota**: `fund_director` y `church_manager` NO tienen nivel definido en la función (bug).

---

## 📊 Matriz de Permisos Completa

### Leyenda de Alcance
- **all**: Todas las iglesias/datos del sistema
- **district**: Iglesias del distrito asignado (no implementado)
- **own**: Solo su iglesia/datos propios

### Tabla de Permisos

| Permiso | admin | fund_director | pastor | treasurer | church_manager | secretary | Alcance |
|---------|:-----:|:-------------:|:------:|:---------:|:--------------:|:---------:|---------|
| **Sistema** |
| `system.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | all |
| `users.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | all |
| `dashboard.view` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | varies |
| **Iglesias** |
| `churches.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | all |
| `churches.view` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | all/assigned |
| `church.manage` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | own |
| **Reportes** |
| `reports.approve` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | all |
| `reports.create` | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | own |
| `reports.edit` | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | own |
| `reports.view` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | varies |
| **Fondos** |
| `funds.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | all |
| `funds.view` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | varies |
| **Transacciones** |
| `transactions.view` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | varies |
| **Eventos** |
| `events.manage` | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | varies |
| `events.create` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | varies |
| `events.edit` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | own |
| `events.submit` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | own |
| `events.approve` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | own |
| `events.actuals` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | own |
| `events.view` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | varies |
| **Miembros** |
| `members.manage` | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | own |
| `members.view` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | varies |

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

## ⚠️ Problemas Conocidos y Acciones Requeridas

### 1. Church Manager Sin Permisos
**Problema**: Rol existe pero no tiene permisos definidos
**Impacto**: Usuarios con este rol no pueden hacer nada
**Acción**: Definir permisos O eliminar rol

### 2. Roles Obsoletos en role_permissions
**Problema**: `district_supervisor` y `member` tienen permisos pero no son asignables
**Impacto**: Código confuso, permisos inútiles
**Acción**: Eliminar de `role_permissions` O actualizar constraint

### 3. Fund Director Sin Nivel en get_role_level()
**Problema**: Función `get_role_level()` no incluye `fund_director`
**Impacto**: Comparaciones jerárquicas fallan
**Acción**: Actualizar función para incluir nivel (probablemente 5)

### 4. Inconsistencia Migration 023 vs. Constraint Actual
**Problema**: Constraint actual no coincide con migration 023
**Impacto**: Confusión sobre estado real del sistema
**Acción**: Crear migration de corrección que documente cambios manuales

---

## 📝 Changelog

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
