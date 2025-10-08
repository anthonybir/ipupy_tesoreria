# Plan de Backfill para Datos Pastorales Normalizados

> Última actualización: 2025-10-01 · Responsable inicial: Tesorería / Equipo de Datos

La migración `031_create_pastors_table.sql` crea el registro normalizado de pastores y enlaza cada congregación mediante `churches.primary_pastor_id`. Para garantizar que los datos históricos estén completos y listos para vistas y notificaciones, sigue el siguiente plan en tres fases.

---

## 1. Preparación

1. **Aplicar migraciones** en el entorno objetivo:
   ```bash
   node scripts/migrate.js
   ```
2. **Respaldar información existente**:
   ```sql
   -- Exportar snapshot previo a actualizaciones manuales
   COPY (
     SELECT c.id, c.name, c.pastor, c.pastor_ruc, c.pastor_cedula, c.pastor_grado,
            c.pastor_posicion, p.id AS pastor_id, p.email, p.phone, p.whatsapp,
            p.ordination_level, p.role_title, p.status, p.start_date, p.end_date
     FROM churches c
     LEFT JOIN pastors p ON p.id = c.primary_pastor_id
   ) TO '/tmp/church_pastor_snapshot_2025-10-01.csv' WITH CSV HEADER;
   ```
3. **Configurar acceso**: asegúrate de contar con credenciales RLS para rol `admin` o `treasurer` antes de ejecutar actualizaciones.

---

## 2. Identificar huecos de información

Ejecuta las consultas de diagnóstico para localizar campos críticos sin datos:

```sql
-- Pastores sin correo ni teléfono directo
SELECT church_id, full_name
FROM pastors
WHERE (email IS NULL OR email = '')
  AND (phone IS NULL OR phone = '')
  AND (whatsapp IS NULL OR whatsapp = '');

-- Falta de fecha de inicio (requerida para trayectoria histórica)
SELECT church_id, full_name
FROM pastors
WHERE start_date IS NULL;

-- Iglesias sin `primary_pastor_id` asignado
SELECT id, name
FROM churches
WHERE primary_pastor_id IS NULL;
```

Documenta los resultados y coordina con las regiones para obtener la información faltante (correo, WhatsApp, fecha de asunción, grado ministerial, etc.).

---

## 3. Actualizaciones controladas

### 3.1. Carga rápida vía hojas de cálculo

1. Exporta el template:
   ```sql
   COPY (
     SELECT p.id AS pastor_id, c.id AS church_id, c.name AS church_name,
            p.full_name, p.preferred_name, p.email, p.phone, p.whatsapp,
            p.national_id, p.tax_id, p.ordination_level, p.role_title,
            p.start_date, p.end_date, p.status, p.notes
     FROM church_primary_pastors ppp
     JOIN churches c ON c.id = ppp.church_id
     JOIN pastors p ON p.id = ppp.pastor_id
   ) TO '/tmp/pastor_directory_template.csv' WITH CSV HEADER;
   ```
2. Completa los campos faltantes en la planilla (correo, WhatsApp, fechas, notas de transición).
3. Reimporta usando `psql` o `postgres-copy` manteniendo RLS desactivado (solo en staging):
   ```sql
   -- Ejemplo de MERGE para aplicar actualizaciones del CSV a staging
   CREATE TEMP TABLE tmp_pastors_update (
     pastor_id BIGINT,
     phone TEXT,
     whatsapp TEXT,
     email TEXT,
     ordination_level TEXT,
     role_title TEXT,
     start_date DATE,
     notes TEXT
   );

   COPY tmp_pastors_update FROM '/tmp/pastor_directory_template_COMPLETO.csv' WITH CSV HEADER;

   UPDATE pastors p
   SET phone = NULLIF(u.phone, ''),
       whatsapp = NULLIF(u.whatsapp, ''),
       email = NULLIF(u.email, ''),
       ordination_level = NULLIF(u.ordination_level, ''),
       role_title = NULLIF(u.role_title, ''),
       start_date = COALESCE(u.start_date, p.start_date),
       notes = NULLIF(u.notes, ''),
       updated_at = now()
   FROM tmp_pastors_update u
   WHERE p.id = u.pastor_id;
   ```

### 3.2. Script Node opcional

Para automatizar cargas puntuales desde JSON o servicios externos, crea un script basado en `src/lib/db.ts`. Sketch inicial (`scripts/backfill-pastors.ts`):

```ts
import { executeWithContext } from '@/lib/db';
import { adminContext } from '@/lib/db-context-fixtures';

const payload = [
  {
    churchId: 12,
    fullName: 'Pr. María López',
    whatsapp: '+595981123123',
    startDate: '2023-02-01',
    notes: 'Transferida desde Encarnación'
  }
];

for (const pastor of payload) {
  await executeWithContext(adminContext, {
    text: `UPDATE pastors
           SET full_name = $1, whatsapp = $2, start_date = COALESCE($3::date, start_date),
               notes = CASE WHEN $4 <> '' THEN $4 ELSE notes END,
               updated_at = now()
           WHERE church_id = $5 AND is_primary = TRUE;`,
    values: [pastor.fullName, pastor.whatsapp, pastor.startDate, pastor.notes ?? '', pastor.churchId]
  });
}
```

> **Nota**: publica el script definitivo en `scripts/` una vez definidos los formatos de entrada reales.

---

## 4. Validación posterior

1. Verifica que todos los dashboards consuman los datos normalizados:
   ```sql
   SELECT COUNT(*) FROM church_primary_pastors WHERE pastor_email IS NULL;
   ```
2. Ejecuta `npm run lint` y pruebas manuales en la vista de Iglesias y en `admin/configuration` para confirmar que el UI refleja los contactos actualizados.
3. Documenta en la bitácora de despliegue (`docs/DEPLOYMENT_SUMMARY.md`) qué iglesias todavía requieren seguimiento.

---

## 5. Checklist de Cierre

- [ ] Todos los pastores principales tienen correo o WhatsApp válido.
- [ ] `start_date` registrado para los últimos 24 meses de transiciones.
- [ ] Notas administrativas creadas para traspasos o interinatos.
- [ ] Export `church_primary_pastors` entregado al equipo regional.

Con este procedimiento, la tabla `pastors` quedará alineada con las operaciones actuales y lista para futuros portales pastorales y notificaciones segmentadas.
