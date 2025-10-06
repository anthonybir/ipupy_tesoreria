# Migration 047 Application Code Changes

**Migration**: `047_report_totals_generated.sql`
**Purpose**: Convert `total_entradas`, `total_salidas`, `saldo_mes` to GENERATED columns
**Status**: ⚠️ **REQUIRES APPLICATION CODE CHANGES BEFORE DEPLOYMENT**

---

## 🚨 Breaking Change Warning

Migration 047 converts three `reports` table columns to `GENERATED ALWAYS` columns:
- `total_entradas` - Sum of all income components
- `total_salidas` - Sum of all expense components
- `saldo_mes` - Net balance (entradas - salidas)

**After this migration**, any INSERT or UPDATE that provides values for these columns will **FAIL** with:
```
ERROR: cannot insert a non-DEFAULT value into column "total_entradas"
DETAIL: Column "total_entradas" is a generated column.
```

---

## 📋 Required Code Changes

### File: `src/app/api/reports/route.ts`

#### Change #1: Remove from INSERT Statement (Lines 556-607)

**BEFORE** (current code):
```typescript
INSERT INTO reports (
  church_id, month, year,
  diezmos, ofrendas, anexos, caballeros, damas,
  jovenes, ninos, otros,
  total_entradas, fondo_nacional, honorarios_pastoral,  // ❌ Remove total_entradas
  servicios, energia_electrica, agua, recoleccion_basura, mantenimiento, materiales, otros_gastos,
  total_salidas, saldo_mes,                             // ❌ Remove total_salidas, saldo_mes
  ofrendas_directas_misiones, lazos_amor, mision_posible, aporte_caballeros, apy, instituto_biblico,
  numero_deposito, fecha_deposito, monto_depositado,
  asistencia_visitas, bautismos_agua, bautismos_espiritu, observaciones, estado,
  foto_informe, foto_deposito, submission_type, submitted_by, submitted_at,
  submission_source, manual_report_source, manual_report_notes, entered_by, entered_at
) VALUES (
  $1, $2, $3,
  $4, $5, $6, $7, $8,
  $9, $10, $11,
  $12, $13, $14,        // ❌ Remove $12 (total_entradas)
  $15, $16, $17, $18, $19, $20, $21,
  $22, $23,             // ❌ Remove $22, $23 (total_salidas, saldo_mes)
  ...
)
```

**AFTER** (required changes):
```typescript
INSERT INTO reports (
  church_id, month, year,
  diezmos, ofrendas, anexos, caballeros, damas,
  jovenes, ninos, otros,
  -- total_entradas REMOVED (GENERATED column)
  fondo_nacional, honorarios_pastoral,
  servicios, energia_electrica, agua, recoleccion_basura, mantenimiento, materiales, otros_gastos,
  -- total_salidas, saldo_mes REMOVED (GENERATED columns)
  ofrendas_directas_misiones, lazos_amor, mision_posible, aporte_caballeros, apy, instituto_biblico,
  numero_deposito, fecha_deposito, monto_depositado,
  asistencia_visitas, bautismos_agua, bautismos_espiritu, observaciones, estado,
  foto_informe, foto_deposito, submission_type, submitted_by, submitted_at,
  submission_source, manual_report_source, manual_report_notes, entered_by, entered_at
) VALUES (
  $1, $2, $3,
  $4, $5, $6, $7, $8,
  $9, $10, $11,
  -- $12 (total_entradas) REMOVED
  $12, $13,             // ✅ Now fondo_nacional, honorarios_pastoral
  $14, $15, $16, $17, $18, $19, $20,
  -- $21, $22 (total_salidas, saldo_mes) REMOVED
  $21, $22, $23, $24, $25, $26,
  ...
)
```

**Parameter Array Changes** (Lines 584-632):
- **REMOVE** `totals.totalEntradas` (was $12)
- **REMOVE** `totals.totalSalidas` (was $22)
- **REMOVE** `totals.saldoMes` (was $23)
- **Renumber** all subsequent parameters

#### Change #2: Remove from UPDATE Statement (Lines 931-989)

**BEFORE** (current code):
```typescript
UPDATE reports SET
  diezmos = $1,
  ofrendas = $2,
  anexos = $3,
  caballeros = $4,
  damas = $5,
  jovenes = $6,
  ninos = $7,
  otros = $8,
  total_entradas = $9,           // ❌ Remove this line
  fondo_nacional = $10,
  honorarios_pastoral = $11,
  servicios = $12,
  energia_electrica = $13,
  agua = $14,
  recoleccion_basura = $15,
  mantenimiento = $16,
  materiales = $17,
  otros_gastos = $18,
  total_salidas = $19,           // ❌ Remove this line
  saldo_mes = $20,               // ❌ Remove this line
  ofrendas_directas_misiones = $21,
  ...
WHERE id = $40
```

**AFTER** (required changes):
```typescript
UPDATE reports SET
  diezmos = $1,
  ofrendas = $2,
  anexos = $3,
  caballeros = $4,
  damas = $5,
  jovenes = $6,
  ninos = $7,
  otros = $8,
  -- total_entradas REMOVED (GENERATED column)
  fondo_nacional = $9,           // ✅ Now $9 (was $10)
  honorarios_pastoral = $10,     // ✅ Now $10 (was $11)
  servicios = $11,               // ✅ Now $11 (was $12)
  energia_electrica = $12,       // ✅ Now $12 (was $13)
  agua = $13,                    // ✅ Now $13 (was $14)
  recoleccion_basura = $14,      // ✅ Now $14 (was $15)
  mantenimiento = $15,           // ✅ Now $15 (was $16)
  materiales = $16,              // ✅ Now $16 (was $17)
  otros_gastos = $17,            // ✅ Now $17 (was $18)
  -- total_salidas, saldo_mes REMOVED (GENERATED columns)
  ofrendas_directas_misiones = $18,  // ✅ Now $18 (was $21)
  ...
WHERE id = $37                   // ✅ Now $37 (was $40)
```

**Parameter Array Changes** (Lines 976-1000):
- **REMOVE** `totals.totalEntradas` (was $9)
- **REMOVE** `totals.totalSalidas` (was $19)
- **REMOVE** `totals.saldoMes` (was $20)
- **Renumber** all subsequent parameters

---

## 🔄 Deployment Sequence (CRITICAL)

**Option A - Code-First Deployment (RECOMMENDED)**:
1. ✅ Deploy application code changes (remove columns from INSERT/UPDATE)
2. ✅ Verify application works with manual totals calculation
3. ✅ Deploy migration 047 (convert to GENERATED columns)
4. ✅ Verify database auto-calculates totals correctly

**Option B - Migration-First Deployment (RISKY)**:
1. ⚠️ Deploy migration 047 first
2. ❌ **APPLICATION BREAKS IMMEDIATELY** (all report submissions fail)
3. 🔥 Emergency deploy code changes
4. ✅ Application restored

**Recommendation**: Use Option A to avoid production downtime.

---

## ✅ Verification Steps

### After Code Changes (Before Migration)

1. **Test report creation**:
   ```bash
   # Submit a test report via API
   curl -X POST /api/reports \
     -H "Content-Type: application/json" \
     -d '{"church_id": 1, "month": 1, "year": 2025, "diezmos": 100000, ...}'
   ```

2. **Verify totals still calculated**:
   - Check `extractReportPayload()` still calculates totals
   - Verify totals passed to transaction creation
   - Confirm UI displays correct values

### After Migration 047

1. **Verify GENERATED columns work**:
   ```sql
   -- Insert test report
   INSERT INTO reports (
     church_id, month, year,
     diezmos, ofrendas, anexos
   ) VALUES (
     1, 12, 2099,  -- Test data
     100000, 50000, 20000
   );

   -- Verify auto-calculation
   SELECT
     diezmos, ofrendas, anexos,
     total_entradas,  -- Should be 170000
     total_salidas,   -- Should be calculated
     saldo_mes        -- Should be entradas - salidas
   FROM reports
   WHERE church_id = 1 AND month = 12 AND year = 2099;

   -- Cleanup
   DELETE FROM reports WHERE church_id = 1 AND month = 12 AND year = 2099;
   ```

2. **Verify INSERT fails with manual totals**:
   ```sql
   -- This should FAIL
   INSERT INTO reports (
     church_id, month, year,
     diezmos, total_entradas  -- ERROR: cannot insert into GENERATED column
   ) VALUES (1, 12, 2099, 100000, 999999);
   ```

---

## 🐛 Troubleshooting

### Error: "cannot insert a non-DEFAULT value into column"

**Cause**: Application code still providing values for GENERATED columns after migration

**Solution**: Remove `total_entradas`, `total_salidas`, `saldo_mes` from INSERT/UPDATE statements

### Error: "column does not exist"

**Cause**: Code changes deployed but migration 047 not applied yet

**Solution**: Deploy migration 047 to production

### Totals Mismatch

**Cause**: Migration 047 formula doesn't match application calculation

**Solution**:
1. Check migration 047 GENERATED formulas match `extractReportPayload()` logic
2. Verify all income/expense components included
3. Run verification query from migration Part 5

---

## 📝 Notes

**Why GENERATED Columns?**:
- Prevents manual override (like `fondo_nacional` in migration 042)
- Database-enforced consistency
- Cannot be bypassed by direct SQL
- Simplifies application code (no manual calculation in INSERT/UPDATE)

**Calculation Logic**:
```sql
total_entradas = diezmos + ofrendas + anexos + caballeros + damas + jovenes + ninos + otros

total_salidas = honorarios_pastoral + fondo_nacional + energia_electrica + agua +
                recoleccion_basura + otros_gastos

saldo_mes = total_entradas - total_salidas
```

**Related Files**:
- `migrations/047_report_totals_generated.sql` - Database migration
- `src/app/api/reports/route.ts` - Application code to update
- `migrations/042_make_fondo_nacional_generated.sql` - Similar pattern

---

**Last Updated**: 2025-01-06
**Status**: Migration ready, code changes required before deployment
