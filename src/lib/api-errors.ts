import { NextResponse } from 'next/server';
import { buildCorsHeaders } from './cors';

type PostgresError = {
  code?: string;
  message?: string;
  detail?: string;
  constraint?: string;
  table?: string;
  column?: string;
  severity?: string;
};

/**
 * Centralized database error handler
 * Maps Postgres error codes to user-friendly HTTP responses
 *
 * @param error - The error object (typically from pg or Supabase)
 * @param origin - Request origin for CORS headers
 * @param context - Optional context for logging (e.g., "POST /api/churches")
 * @returns NextResponse with appropriate status code and message
 */
export function handleDatabaseError(
  error: unknown,
  origin: string | null,
  context?: string
): NextResponse {
  const pgError = error as PostgresError;
  const isDev = process.env['NODE_ENV'] === 'development';

  // Log full error in development or for debugging
  if (isDev && context) {
    console.error(`[${context}] Database error:`, {
      code: pgError.code,
      message: pgError.message,
      detail: pgError.detail,
      constraint: pgError.constraint
    });
  } else if (context) {
    console.error(`[${context}] Database error code: ${pgError.code}`);
  }

  // RLS policy violation (insufficient privileges)
  if (pgError.code === '42501') {
    return NextResponse.json(
      {
        error: 'No tiene permisos para realizar esta operación',
        code: 'INSUFFICIENT_PRIVILEGES',
        details: isDev ? pgError.message : undefined
      },
      { status: 403, headers: buildCorsHeaders(origin) }
    );
  }

  // Unique constraint violation
  if (pgError.code === '23505') {
    // Extract field name from constraint (e.g., "churches_name_key" -> "nombre")
    let field = pgError.constraint?.replace(/_pkey$|_key$|_unique$/g, '') || 'valor';

    // Map database column names to user-friendly Spanish names
    const fieldMap: Record<string, string> = {
      name: 'nombre',
      email: 'correo electrónico',
      ruc: 'RUC',
      phone: 'teléfono',
      document: 'documento',
      pastor_ruc: 'RUC del pastor'
    };

    field = fieldMap[field] || field;

    return NextResponse.json(
      {
        error: `Ya existe un registro con este ${field}`,
        code: 'DUPLICATE_ENTRY',
        field: pgError.constraint,
        details: isDev ? pgError.detail : undefined
      },
      { status: 409, headers: buildCorsHeaders(origin) }
    );
  }

  // Foreign key violation
  if (pgError.code === '23503') {
    return NextResponse.json(
      {
        error: 'Referencia inválida. Verifique que los registros relacionados existan',
        code: 'FOREIGN_KEY_VIOLATION',
        details: isDev ? pgError.detail : undefined
      },
      { status: 400, headers: buildCorsHeaders(origin) }
    );
  }

  // Check constraint violation
  if (pgError.code === '23514') {
    let message = 'Los datos no cumplen con las restricciones del sistema';

    // Provide more specific messages for known constraints
    if (pgError.constraint?.includes('positive')) {
      message = 'El valor debe ser mayor a cero';
    } else if (pgError.constraint?.includes('date')) {
      message = 'Formato de fecha inválido';
    } else if (pgError.constraint?.includes('email')) {
      message = 'Formato de correo electrónico inválido';
    }

    return NextResponse.json(
      {
        error: message,
        code: 'CHECK_CONSTRAINT_VIOLATION',
        constraint: pgError.constraint,
        details: isDev ? pgError.message : undefined
      },
      { status: 400, headers: buildCorsHeaders(origin) }
    );
  }

  // Not null violation
  if (pgError.code === '23502') {
    const column = pgError.column || 'campo requerido';
    return NextResponse.json(
      {
        error: `El campo ${column} es obligatorio`,
        code: 'NOT_NULL_VIOLATION',
        details: isDev ? pgError.message : undefined
      },
      { status: 400, headers: buildCorsHeaders(origin) }
    );
  }

  // Custom raised exceptions (from database functions)
  if (pgError.code === 'P0001') {
    return NextResponse.json(
      {
        error: pgError.message || 'Error de validación',
        code: 'VALIDATION_ERROR'
      },
      { status: 400, headers: buildCorsHeaders(origin) }
    );
  }

  // Syntax error (should not happen in production)
  if (pgError.code === '42601') {
    console.error(`SQL syntax error in ${context}:`, pgError.message);
    return NextResponse.json(
      {
        error: 'Error de sintaxis en la consulta',
        code: 'SYNTAX_ERROR',
        details: isDev ? pgError.message : undefined
      },
      { status: 500, headers: buildCorsHeaders(origin) }
    );
  }

  // Undefined table/column
  if (pgError.code === '42P01' || pgError.code === '42703') {
    console.error(`Schema error in ${context}:`, pgError.message);
    return NextResponse.json(
      {
        error: 'Error en la estructura de la base de datos',
        code: 'SCHEMA_ERROR',
        details: isDev ? pgError.message : undefined
      },
      { status: 500, headers: buildCorsHeaders(origin) }
    );
  }

  // Connection timeout
  if (pgError.message?.includes('timeout')) {
    return NextResponse.json(
      {
        error: 'La operación tardó demasiado tiempo. Por favor intente nuevamente',
        code: 'TIMEOUT_ERROR',
        details: isDev ? pgError.message : undefined
      },
      { status: 504, headers: buildCorsHeaders(origin) }
    );
  }

  // Generic database error (catch-all)
  console.error(`Unhandled database error in ${context}:`, error);
  return NextResponse.json(
    {
      error: 'Error interno del servidor',
      code: 'DATABASE_ERROR',
      details: isDev ? (error instanceof Error ? error.message : String(error)) : undefined
    },
    { status: 500, headers: buildCorsHeaders(origin) }
  );
}

/**
 * Custom error class for business logic validation
 * Use this for explicit validation errors that should return 400
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Custom error class for authentication errors
 * Use this when auth is required but missing/invalid
 */
export class AuthenticationError extends Error {
  constructor(message = 'Autenticación requerida') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Custom error class for authorization errors
 * Use this when user is authenticated but lacks permissions
 */
export class AuthorizationError extends Error {
  constructor(message = 'No tiene permisos para realizar esta operación') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Unified error handler for API routes
 * Handles both database errors and custom application errors
 *
 * @param error - Any error object
 * @param origin - Request origin for CORS
 * @param context - Context for logging
 * @returns NextResponse with appropriate status
 */
export function handleApiError(
  error: unknown,
  origin: string | null,
  context?: string
): NextResponse {
  // Custom validation errors
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.message, code: 'VALIDATION_ERROR' },
      { status: 400, headers: buildCorsHeaders(origin) }
    );
  }

  // Authentication errors
  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      { error: error.message, code: 'AUTHENTICATION_REQUIRED' },
      { status: 401, headers: buildCorsHeaders(origin) }
    );
  }

  // Authorization errors
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: error.message, code: 'AUTHORIZATION_FAILED' },
      { status: 403, headers: buildCorsHeaders(origin) }
    );
  }

  // Generic error with message
  if (error instanceof Error && error.message.includes('Autenticación requerida')) {
    return NextResponse.json(
      { error: 'Token inválido o expirado', code: 'INVALID_TOKEN' },
      { status: 401, headers: buildCorsHeaders(origin) }
    );
  }

  // Delegate to database error handler (it will handle unknown types too)
  return handleDatabaseError(error, origin, context);
}
