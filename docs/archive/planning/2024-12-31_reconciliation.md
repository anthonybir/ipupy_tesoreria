# Libro Diario – Ajuste de Saldos 31/12/2024

Este documento registra las transacciones de conciliación aplicadas el **31 de diciembre de 2024** para alinear los saldos del sistema con el libro oficial "Saldos" provisto por la tesorería nacional (total consolidado: **₲ 18.840.572**).

## Contexto
- Los saldos importados desde Excel presentaban diferencias en varios fondos nacionales.
- Se decidió respetar los valores del archivo oficial y registrar ajustes contables manuales.
- Cada movimiento está etiquetado como `Ajuste de saldo - Reconciliación Excel` y `created_by = 'system-reconciliation'`.

## Script SQL Aplicado
```sql
BEGIN;

-- APY: +385.000 (de 9.047.000 → 9.432.000)
INSERT INTO transactions (fund_id, concept, amount_in, amount_out, date, created_by)
VALUES (6, 'Ajuste de saldo - Reconciliación Excel', 385000, 0, '2024-12-31', 'system-reconciliation');

-- Caballeros: +230.000
INSERT INTO transactions (fund_id, concept, amount_in, amount_out, date, created_by)
VALUES (5, 'Ajuste de saldo - Reconciliación Excel', 230000, 0, '2024-12-31', 'system-reconciliation');

-- Damas: -937.500
INSERT INTO transactions (fund_id, concept, amount_in, amount_out, date, created_by)
VALUES (9, 'Ajuste de saldo - Reconciliación Excel', 0, 937500, '2024-12-31', 'system-reconciliation');

-- General: -2.825.600
INSERT INTO transactions (fund_id, concept, amount_in, amount_out, date, created_by)
VALUES (1, 'Ajuste de saldo - Reconciliación Excel', 0, 2825600, '2024-12-31', 'system-reconciliation');

-- IBA: -171.000
INSERT INTO transactions (fund_id, concept, amount_in, amount_out, date, created_by)
VALUES (7, 'Ajuste de saldo - Reconciliación Excel', 0, 171000, '2024-12-31', 'system-reconciliation');

-- Lazos de Amor: -6.432.500
INSERT INTO transactions (fund_id, concept, amount_in, amount_out, date, created_by)
VALUES (3, 'Ajuste de saldo - Reconciliación Excel', 0, 6432500, '2024-12-31', 'system-reconciliation');

-- Misión Posible: +219.300
INSERT INTO transactions (fund_id, concept, amount_in, amount_out, date, created_by)
VALUES (4, 'Ajuste de saldo - Reconciliación Excel', 219300, 0, '2024-12-31', 'system-reconciliation');

-- Misiones: +532.000
INSERT INTO transactions (fund_id, concept, amount_in, amount_out, date, created_by)
VALUES (2, 'Ajuste de saldo - Reconciliación Excel', 532000, 0, '2024-12-31', 'system-reconciliation');

-- Niños: +58.000
INSERT INTO transactions (fund_id, concept, amount_in, amount_out, date, created_by)
VALUES (8, 'Ajuste de saldo - Reconciliación Excel', 58000, 0, '2024-12-31', 'system-reconciliation');

-- Recalcular saldos almacenados
UPDATE funds f
SET current_balance = COALESCE((
  SELECT SUM(t.amount_in - t.amount_out)
  FROM transactions t
  WHERE t.fund_id = f.id
), 0),
updated_at = NOW();

COMMIT;
```

## Validación Post-Ajuste
```sql
SELECT
  f.name,
  f.current_balance,
  target.excel_target,
  f.current_balance - target.excel_target AS difference
FROM funds f
JOIN (
  VALUES
    ('APY', 9432000),
    ('Caballeros', 3612219),
    ('Damas', 15643690),
    ('General', -20731119),
    ('IBA', 924293),
    ('Lazos de Amor', -7011456),
    ('Mision Posible', 861952),
    ('Misiones', 12181240),
    ('Niños', 3927753)
) AS target(name, excel_target) ON target.name = f.name
ORDER BY f.name;
```

## Consideraciones
- No eliminar estos movimientos: constituyen la base oficial 2025.
- Cualquier ajuste futuro debe documentarse con concepto descriptivo y respaldo digital.
- Al migrar a otro entorno (staging/producción), ejecutar el script posterior a las migraciones de esquema.
