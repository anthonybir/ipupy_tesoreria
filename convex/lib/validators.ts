/**
 * Input Validation Utilities
 * 
 * Common validation helpers for Convex functions.
 */

import { ValidationError } from "./errors";

/**
 * Validate email format
 */
export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError("Formato de email inválido");
  }
}

/**
 * Validate Paraguayan RUC (tax ID)
 * Format: 12345678-9 (8 digits + dash + 1 check digit)
 */
export function validateRUC(ruc: string): void {
  const rucRegex = /^\d{6,8}-\d$/;
  if (!rucRegex.test(ruc)) {
    throw new ValidationError(
      "Formato de RUC inválido. Debe ser: 12345678-9"
    );
  }
}

/**
 * Validate Paraguayan Cédula (national ID)
 * Format: 1234567 (numeric, 6-8 digits)
 */
export function validateCedula(cedula: string): void {
  const cedulaRegex = /^\d{6,8}$/;
  if (!cedulaRegex.test(cedula)) {
    throw new ValidationError(
      "Formato de cédula inválido. Debe ser numérico de 6-8 dígitos"
    );
  }
}

/**
 * Validate phone number
 * Format: flexible, but must be numeric and reasonable length
 */
export function validatePhone(phone: string): void {
  const cleanPhone = phone.replace(/[^\d]/g, "");
  if (cleanPhone.length < 6 || cleanPhone.length > 15) {
    throw new ValidationError(
      "Número de teléfono inválido. Debe tener entre 6-15 dígitos"
    );
  }
}

/**
 * Validate positive number
 */
export function validatePositiveNumber(value: number, fieldName: string): void {
  if (value < 0) {
    throw new ValidationError(`${fieldName} debe ser un número positivo`);
  }
}

/**
 * Validate non-negative number (allows zero)
 */
export function validateNonNegativeNumber(value: number, fieldName: string): void {
  if (value < 0) {
    throw new ValidationError(`${fieldName} no puede ser negativo`);
  }
}

/**
 * Validate required field
 */
export function validateRequired<T>(value: T | undefined | null, fieldName: string): asserts value is T {
  if (value === undefined || value === null || value === "") {
    throw new ValidationError(`${fieldName} es requerido`);
  }
}

/**
 * Validate month (1-12)
 */
export function validateMonth(month: number): void {
  if (month < 1 || month > 12) {
    throw new ValidationError("Mes inválido. Debe estar entre 1 y 12");
  }
}

/**
 * Validate year (reasonable range)
 */
export function validateYear(year: number): void {
  const currentYear = new Date().getFullYear();
  if (year < 2020 || year > currentYear + 1) {
    throw new ValidationError(
      `Año inválido. Debe estar entre 2020 y ${currentYear + 1}`
    );
  }
}

/**
 * Validate date range
 */
export function validateDateRange(startDate: number, endDate: number): void {
  if (startDate > endDate) {
    throw new ValidationError(
      "La fecha de inicio no puede ser posterior a la fecha de fin"
    );
  }
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: string,
  fieldName: string,
  min?: number,
  max?: number
): void {
  if (min !== undefined && value.length < min) {
    throw new ValidationError(
      `${fieldName} debe tener al menos ${min} caracteres`
    );
  }
  if (max !== undefined && value.length > max) {
    throw new ValidationError(
      `${fieldName} no puede exceder ${max} caracteres`
    );
  }
}
