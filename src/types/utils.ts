/**
 * Type safety utilities for IPU PY Tesorería
 *
 * Provides strict type guards and utilities to prevent type errors
 * and enforce safe data access patterns.
 */

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API error response
 */
export type ApiErrorResponse = {
  success: false;
  error: string;
  details?: unknown;
};

/**
 * Standard API success response with data
 */
export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

/**
 * Discriminated union for API responses
 * Use this for all API route return types
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================================
// Branded Types for Type Safety
// ============================================================================

/**
 * Branded integer type - guarantees valid integer
 */
export type SafeInteger = number & { readonly __brand: 'SafeInteger' };

/**
 * Branded church ID - guarantees valid positive church ID
 */
export type ChurchId = number & { readonly __brand: 'ChurchId' };

/**
 * Branded user ID - guarantees valid UUID string
 */
export type UserId = string & { readonly __brand: 'UserId' };

/**
 * Branded fund ID - guarantees valid positive fund ID
 */
export type FundId = number & { readonly __brand: 'FundId' };

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if value is a valid integer
 */
export function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/**
 * Type guard to check if value is a positive integer
 */
export function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
}

/**
 * Type guard to check if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Type guard to check if value is a valid UUID
 */
export function isUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

// ============================================================================
// Safe Parsers with Branded Types
// ============================================================================

/**
 * Safely parse integer with strict validation
 * Returns null if parsing fails or result is not a valid integer
 */
export function parseIntegerStrict(value: unknown): SafeInteger | null {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || !Number.isInteger(parsed)) {
    return null;
  }
  return parsed as SafeInteger;
}

/**
 * Parse and validate church ID
 * Returns null if invalid or not a positive integer
 */
export function parseChurchId(value: unknown): ChurchId | null {
  const parsed = parseIntegerStrict(value);
  if (parsed === null || parsed <= 0) {
    return null;
  }
  return parsed as unknown as ChurchId;
}

/**
 * Parse and validate fund ID
 * Returns null if invalid or not a positive integer
 */
export function parseFundId(value: unknown): FundId | null {
  const parsed = parseIntegerStrict(value);
  if (parsed === null || parsed <= 0) {
    return null;
  }
  return parsed as unknown as FundId;
}

/**
 * Parse and validate user ID (UUID format)
 * Returns null if not a valid UUID string
 */
export function parseUserId(value: unknown): UserId | null {
  if (!isUUID(value)) {
    return null;
  }
  return value as UserId;
}

/**
 * Safely parse floating point number with fallback
 */
export function parseNumberSafe(value: unknown, fallback = 0): number {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

// ============================================================================
// Safe String Operations
// ============================================================================

/**
 * Sanitize string - returns null for empty/whitespace strings
 */
export function sanitizeString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Convert value to non-null string with fallback
 */
export function toStringOrDefault(value: unknown, defaultValue = ''): string {
  const sanitized = sanitizeString(value);
  return sanitized ?? defaultValue;
}

// ============================================================================
// Database Result Type Safety
// ============================================================================

/**
 * Type-safe database query result
 * Use this to ensure query results have proper types
 */
export type QueryResult<T> = {
  rows: T[];
  rowCount: number;
};

/**
 * Extract first row from query result safely
 */
export function getFirstRow<T>(result: QueryResult<T>): T | null {
  return result.rows[0] ?? null;
}

/**
 * Extract first row or throw error if not found
 */
export function requireFirstRow<T>(result: QueryResult<T>, errorMessage: string): T {
  const row = getFirstRow(result);
  if (row === null) {
    throw new Error(errorMessage);
  }
  return row;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Make specific keys required in a type
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific keys optional in a type
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Extract non-nullable values from a type
 */
export type NonNullableFields<T> = {
  [K in keyof T]: NonNullable<T[K]>;
};

/**
 * Type for pagination parameters
 */
export type PaginationParams = {
  limit: number;
  offset: number;
};

/**
 * Type for pagination metadata in responses
 */
export type PaginationMeta = PaginationParams & {
  total: number;
  hasMore: boolean;
};

/**
 * Create pagination metadata from params and total
 */
export function createPaginationMeta(
  params: PaginationParams,
  total: number
): PaginationMeta {
  return {
    ...params,
    total,
    hasMore: params.offset + params.limit < total,
  };
}
