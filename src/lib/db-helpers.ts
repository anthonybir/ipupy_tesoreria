/**
 * Type-Safe Database Query Result Helpers
 *
 * Utilities for safely accessing database query results with proper null/undefined handling.
 * All functions enforce type safety for `noUncheckedIndexedAccess` compliance.
 *
 * @module db-helpers
 */

import type { QueryResult, QueryResultRow } from 'pg';

/**
 * Custom error for database query result expectations
 */
export class DatabaseResultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseResultError';
  }
}

/**
 * Expects exactly one row from query result. Throws if zero or multiple rows.
 *
 * Use when query MUST return exactly one row (e.g., SELECT by unique ID).
 *
 * @throws {DatabaseResultError} If not exactly 1 row
 *
 * @example
 * const result = await executeWithContext(auth, 'SELECT * FROM churches WHERE id = $1', [id]);
 * const church = expectOne(result.rows); // ✅ Type: ChurchRow
 */
export function expectOne<T extends QueryResultRow>(rows: T[]): T {
  if (rows.length === 0) {
    throw new DatabaseResultError('Expected exactly 1 row, but got 0 rows');
  }
  if (rows.length > 1) {
    throw new DatabaseResultError(`Expected exactly 1 row, but got ${rows.length} rows`);
  }
  // Safe: We've verified length === 1, so first element exists
  const firstRow = rows[0];
  if (firstRow === undefined) {
    throw new DatabaseResultError('Unexpected undefined row after length check');
  }
  return firstRow;
}

/**
 * Expects at least one row from query result. Throws if zero rows.
 *
 * Use when query MUST return data but may return multiple rows.
 *
 * @throws {DatabaseResultError} If 0 rows
 *
 * @example
 * const result = await executeWithContext(auth, 'SELECT * FROM churches WHERE active = true');
 * const churches = expectAtLeastOne(result.rows); // ✅ Type: ChurchRow[]
 */
export function expectAtLeastOne<T extends QueryResultRow>(rows: T[]): T[] {
  if (rows.length === 0) {
    throw new DatabaseResultError('Expected at least 1 row, but got 0 rows');
  }
  return rows;
}

/**
 * Gets first row or returns null if no rows.
 *
 * Use when query may or may not return data.
 *
 * @example
 * const result = await executeWithContext(auth, 'SELECT * FROM churches WHERE id = $1', [id]);
 * const church = firstOrNull(result.rows); // ✅ Type: ChurchRow | null
 * if (!church) {
 *   return NextResponse.json({ error: 'Church not found' }, { status: 404 });
 * }
 */
export function firstOrNull<T extends QueryResultRow>(rows: T[]): T | null {
  const first = rows[0];
  return first !== undefined ? first : null;
}

/**
 * Gets first row or returns default value if no rows.
 *
 * Use when you want a fallback value instead of null.
 *
 * @example
 * const result = await executeWithContext(auth, 'SELECT COUNT(*) as count FROM churches');
 * const count = firstOrDefault(result.rows, { count: 0 }); // ✅ Always defined
 */
export function firstOrDefault<T extends QueryResultRow>(rows: T[], defaultValue: T): T {
  const first = rows[0];
  return first !== undefined ? first : defaultValue;
}

/**
 * Type-safe wrapper for query results that need transformation.
 *
 * Maps each row through a transformation function, preserving type safety.
 *
 * @example
 * const result = await executeWithContext(auth, 'SELECT * FROM churches');
 * const churchNames = mapRows(result.rows, (row) => row.name); // ✅ Type: string[]
 */
export function mapRows<T extends QueryResultRow, U>(
  rows: T[],
  mapper: (row: T) => U
): U[] {
  return rows.map(mapper);
}

/**
 * Safe query result unwrapper - extracts rows with null check.
 *
 * Use for queries where you want to work with rows array directly.
 *
 * @example
 * const result = await executeWithContext(auth, 'SELECT * FROM churches');
 * const churches = unwrapRows(result); // ✅ Type: ChurchRow[]
 */
export function unwrapRows<T extends QueryResultRow>(result: QueryResult<T>): T[] {
  return result.rows;
}

/**
 * Checks if query result has any rows.
 *
 * @example
 * const result = await executeWithContext(auth, 'SELECT * FROM churches WHERE id = $1', [id]);
 * if (!hasRows(result)) {
 *   return NextResponse.json({ error: 'Not found' }, { status: 404 });
 * }
 */
export function hasRows<T extends QueryResultRow>(result: QueryResult<T>): boolean {
  return result.rows.length > 0;
}

/**
 * Gets count of rows in result.
 *
 * @example
 * const result = await executeWithContext(auth, 'SELECT * FROM churches');
 * console.log(`Found ${rowCount(result)} churches`);
 */
export function rowCount<T extends QueryResultRow>(result: QueryResult<T>): number {
  return result.rows.length;
}

/**
 * Type guard for checking if query returned expected number of rows.
 *
 * @example
 * const result = await executeWithContext(auth, 'DELETE FROM churches WHERE id = $1', [id]);
 * if (!hasExpectedRowCount(result, 1)) {
 *   throw new Error('Church not found or already deleted');
 * }
 */
export function hasExpectedRowCount<T extends QueryResultRow>(
  result: QueryResult<T>,
  expected: number
): boolean {
  return result.rowCount === expected;
}

/**
 * Safely extract a single field from first row.
 *
 * Common pattern for COUNT(*), SUM(), etc. queries.
 *
 * @throws {DatabaseResultError} If no rows returned
 *
 * @example
 * const result = await executeWithContext(auth, 'SELECT COUNT(*) as total FROM churches');
 * const total = extractField(result, 'total'); // ✅ Type: number | string | null (depends on DB)
 */
export function extractField<T extends QueryResultRow, K extends keyof T>(
  result: QueryResult<T>,
  field: K
): T[K] {
  const row = firstOrNull(result.rows);
  if (!row) {
    throw new DatabaseResultError(`Cannot extract field '${String(field)}' from empty result`);
  }
  return row[field];
}

/**
 * Safely extract a single numeric field from first row with type coercion.
 *
 * PostgreSQL often returns counts/sums as strings, this helper converts to number.
 *
 * @throws {DatabaseResultError} If no rows or field is not a valid number
 *
 * @example
 * const result = await executeWithContext(auth, 'SELECT COUNT(*) as total FROM churches');
 * const total = extractNumber(result, 'total'); // ✅ Type: number
 */
export function extractNumber<T extends QueryResultRow, K extends keyof T>(
  result: QueryResult<T>,
  field: K
): number {
  const value = extractField(result, field);

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new DatabaseResultError(
    `Field '${String(field)}' is not a valid number: ${String(value)}`
  );
}
