/**
 * Custom Error Types for Convex Functions
 * 
 * Provides consistent error handling across the application.
 */

/**
 * Base error class for Convex functions
 */
export class ConvexError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "ConvexError";
  }
}

/**
 * Authentication/Authorization errors
 */
export class AuthError extends ConvexError {
  constructor(message: string) {
    super(message, "AUTH_ERROR");
    this.name = "AuthError";
  }
}

/**
 * Validation errors (bad input)
 */
export class ValidationError extends ConvexError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

/**
 * Not found errors
 */
export class NotFoundError extends ConvexError {
  constructor(resource: string) {
    super(`${resource} no encontrado`, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

/**
 * Conflict errors (duplicate, state conflict)
 */
export class ConflictError extends ConvexError {
  constructor(message: string) {
    super(message, "CONFLICT");
    this.name = "ConflictError";
  }
}

/**
 * Business logic errors
 */
export class BusinessError extends ConvexError {
  constructor(message: string) {
    super(message, "BUSINESS_ERROR");
    this.name = "BusinessError";
  }
}

/**
 * Authorization errors (alias for AuthError for compatibility)
 */
export class AuthorizationError extends AuthError {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}
