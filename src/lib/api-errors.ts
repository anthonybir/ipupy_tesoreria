import { NextResponse } from 'next/server';
import { buildCorsHeaders } from './cors';
import type { ApiResponse } from '@/types/utils';

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
    const response: ApiResponse<never> = {
      success: false,
      error: 'No tiene permisos para realizar esta operación',
      details: isDev ? pgError.message : undefined
    };
    return NextResponse.json(response, { status: 403, headers: buildCorsHeaders(origin) });
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

    const response: ApiResponse<never> = {
      success: false,
      error: `Ya existe un registro con este ${field}`,
      details: isDev ? pgError.detail : undefined
    };
    return NextResponse.json(response, { status: 409, headers: buildCorsHeaders(origin) });
  }

  // Foreign key violation
  if (pgError.code === '23503') {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Referencia inválida. Verifique que los registros relacionados existan',
      details: isDev ? pgError.detail : undefined
    };
    return NextResponse.json(response, { status: 400, headers: buildCorsHeaders(origin) });
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

    const response: ApiResponse<never> = {
      success: false,
      error: message,
      details: isDev ? pgError.message : undefined
    };
    return NextResponse.json(response, { status: 400, headers: buildCorsHeaders(origin) });
  }

  // Not null violation
  if (pgError.code === '23502') {
    const column = pgError.column || 'campo requerido';
    const response: ApiResponse<never> = {
      success: false,
      error: `El campo ${column} es obligatorio`,
      details: isDev ? pgError.message : undefined
    };
    return NextResponse.json(response, { status: 400, headers: buildCorsHeaders(origin) });
  }

  // Custom raised exceptions (from database functions)
  if (pgError.code === 'P0001') {
    const response: ApiResponse<never> = {
      success: false,
      error: pgError.message || 'Error de validación'
    };
    return NextResponse.json(response, { status: 400, headers: buildCorsHeaders(origin) });
  }

  // Syntax error (should not happen in production)
  if (pgError.code === '42601') {
    console.error(`SQL syntax error in ${context}:`, pgError.message);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Error de sintaxis en la consulta',
      details: isDev ? pgError.message : undefined
    };
    return NextResponse.json(response, { status: 500, headers: buildCorsHeaders(origin) });
  }

  // Undefined table/column
  if (pgError.code === '42P01' || pgError.code === '42703') {
    console.error(`Schema error in ${context}:`, pgError.message);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Error en la estructura de la base de datos',
      details: isDev ? pgError.message : undefined
    };
    return NextResponse.json(response, { status: 500, headers: buildCorsHeaders(origin) });
  }

  // Connection timeout
  if (pgError.message?.includes('timeout')) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'La operación tardó demasiado tiempo. Por favor intente nuevamente',
      details: isDev ? pgError.message : undefined
    };
    return NextResponse.json(response, { status: 504, headers: buildCorsHeaders(origin) });
  }

  // Generic database error (catch-all)
  console.error(`Unhandled database error in ${context}:`, error);
  const response: ApiResponse<never> = {
    success: false,
    error: 'Error interno del servidor',
    details: isDev ? (error instanceof Error ? error.message : String(error)) : undefined
  };
  return NextResponse.json(response, { status: 500, headers: buildCorsHeaders(origin) });
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
 * Returns ApiResponse<never> envelope: { success: false, error: string }
 *
 * @param error - Any error object
 * @param origin - Request origin for CORS
 * @param context - Context for logging
 * @returns NextResponse with ApiResponse envelope
 */
export function handleApiError(
  error: unknown,
  origin: string | null,
  context?: string
): NextResponse {
  // Custom validation errors
  if (error instanceof ValidationError) {
    const response: ApiResponse<never> = {
      success: false,
      error: error.message
    };
    return NextResponse.json(response, { status: 400, headers: buildCorsHeaders(origin) });
  }

  // Authentication errors
  if (error instanceof AuthenticationError) {
    const response: ApiResponse<never> = {
      success: false,
      error: error.message
    };
    return NextResponse.json(response, { status: 401, headers: buildCorsHeaders(origin) });
  }

  // Authorization errors
  if (error instanceof AuthorizationError) {
    const response: ApiResponse<never> = {
      success: false,
      error: error.message
    };
    return NextResponse.json(response, { status: 403, headers: buildCorsHeaders(origin) });
  }

  // Generic error with message
  if (error instanceof Error && error.message.includes('Autenticación requerida')) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Token inválido o expirado'
    };
    return NextResponse.json(response, { status: 401, headers: buildCorsHeaders(origin) });
  }

  // Delegate to database error handler (it will handle unknown types too)
  return handleDatabaseError(error, origin, context);
}
