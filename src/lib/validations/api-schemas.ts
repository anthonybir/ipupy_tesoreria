/**
 * Zod Validation Schemas for API Routes
 *
 * Provides runtime type validation for API request bodies, query parameters,
 * and response data to ensure type safety at runtime.
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const monthYearSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2030),
});

// ============================================================================
// Church Schemas
// ============================================================================

export const createChurchSchema = z.object({
  name: z.string().min(1).max(200),
  district_name: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  pastor_name: z.string().min(1).max(200),
  pastor_phone: z.string().max(50).optional(),
  pastor_email: z.string().email().optional(),
});

export const updateChurchSchema = createChurchSchema.partial();

// ============================================================================
// Report Schemas
// ============================================================================

export const createReportSchema = z.object({
  church_id: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2030),
  diezmos: z.number().nonnegative(),
  ofrendas: z.number().nonnegative(),
  misiones: z.number().nonnegative(),
  otros_ingresos: z.number().nonnegative(),
  total_entradas: z.number().nonnegative(),
  fondo_nacional: z.number().nonnegative(),
  deposito_fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  deposito_numero: z.string().max(100).optional(),
  deposito_comprobante_url: z.string().url().optional(),
  observaciones: z.string().max(1000).optional(),
});

export const updateReportSchema = createReportSchema.partial().extend({
  id: z.number().int().positive(),
});

// ============================================================================
// Fund Event Schemas
// ============================================================================

export const createFundEventSchema = z.object({
  fund_id: z.number().int().positive(),
  event_name: z.string().min(1).max(200),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(1000).optional(),
  budget_items: z.array(z.object({
    description: z.string().min(1).max(500),
    projected_amount: z.number().positive(),
  })).min(1),
});

export const updateFundEventSchema = z.object({
  event_name: z.string().min(1).max(200).optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'pending_revision']).optional(),
});

export const createEventActualSchema = z.object({
  line_type: z.enum(['income', 'expense']),
  description: z.string().min(1).max(500),
  amount: z.number().nonnegative(),
  receipt_url: z.string().url().optional(),
  notes: z.string().max(1000).optional(),
});

// ============================================================================
// Transaction Schemas
// ============================================================================

export const createTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fund_id: z.number().int().positive(),
  church_id: z.number().int().positive().optional(),
  report_id: z.number().int().positive().optional(),
  concept: z.string().min(1).max(500),
  provider: z.string().max(200).optional(),
  provider_id: z.number().int().positive().optional(),
  document_number: z.string().max(100).optional(),
  amount_in: z.number().nonnegative().optional(),
  amount_out: z.number().nonnegative().optional(),
}).refine(
  (data) => (data.amount_in ?? 0) > 0 || (data.amount_out ?? 0) > 0,
  { message: 'Either amount_in or amount_out must be greater than 0' }
);

export const bulkCreateTransactionsSchema = z.array(createTransactionSchema).min(1);

// ============================================================================
// Provider Schemas
// ============================================================================

export const createProviderSchema = z.object({
  nombre: z.string().min(1).max(200),
  ruc: z.string().max(50).optional(),
  telefono: z.string().max(50).optional(),
  email: z.string().email().optional(),
  direccion: z.string().max(500).optional(),
  categoria: z.string().max(100).optional(),
  church_id: z.number().int().positive(),
});

export const updateProviderSchema = createProviderSchema.partial().extend({
  id: z.number().int().positive(),
});

// ============================================================================
// User/Auth Schemas
// ============================================================================

export const updateUserRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['admin', 'fund_director', 'pastor', 'treasurer', 'church_manager', 'secretary']),
  church_id: z.number().int().positive().optional(),
  assigned_funds: z.array(z.number().int().positive()).optional(),
});

// ============================================================================
// Configuration Schemas
// ============================================================================

export const updateConfigSchema = z.object({
  section: z.enum(['system', 'financial', 'security', 'integration', 'notification', 'funds', 'roles']),
  config_data: z.record(z.string(), z.unknown()),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates request body against a Zod schema
 * @throws {z.ZodError} if validation fails
 */
export function validateRequestBody<T>(schema: z.ZodType<T>, body: unknown): T {
  return schema.parse(body);
}

/**
 * Validates request body and returns validation result
 */
export function safeValidateRequestBody<T>(
  schema: z.ZodType<T>,
  body: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Formats Zod validation errors for API responses
 */
export function formatValidationError(error: z.ZodError): Record<string, unknown> {
  return {
    error: 'Validation failed',
    details: error.issues.map((err: z.ZodIssue) => ({
      path: err.path.join('.'),
      message: err.message,
    })),
  };
}
