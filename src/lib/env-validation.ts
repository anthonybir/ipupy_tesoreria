/**
 * Environment Variable Validation
 *
 * This module validates all required environment variables at startup
 * and provides type-safe access throughout the application.
 */

// Define required and optional environment variables
interface EnvConfig {
  required: {
    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  };
  optional: {
    // Database
    DATABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;

    // Authentication
    NEXTAUTH_URL?: string;
    NEXTAUTH_SECRET?: string;

    // Google OAuth
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;

    // Email
    SMTP_HOST?: string;
    SMTP_PORT?: string;
    SMTP_USER?: string;
    SMTP_PASSWORD?: string;
    EMAIL_FROM?: string;
    TREASURY_NOTIFICATION_EMAIL?: string;

    // Application
    NODE_ENV?: 'development' | 'test' | 'production';
    VERCEL_ENV?: 'development' | 'preview' | 'production';
    VERCEL_URL?: string;

    // Feature Flags
    ENABLE_RATE_LIMITING?: string;
    ENABLE_AUDIT_LOGGING?: string;

    // Security
    ALLOWED_ORIGINS?: string;
    MAX_LOGIN_ATTEMPTS?: string;
    SESSION_TIMEOUT_MINUTES?: string;
  };
}

// Combined type for all environment variables
export type Env = EnvConfig['required'] & EnvConfig['optional'];

const OPTIONAL_ENV_KEYS: (keyof EnvConfig['optional'])[] = [
  'DATABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'EMAIL_FROM',
  'TREASURY_NOTIFICATION_EMAIL',
  'NODE_ENV',
  'VERCEL_ENV',
  'VERCEL_URL',
  'ENABLE_RATE_LIMITING',
  'ENABLE_AUDIT_LOGGING',
  'ALLOWED_ORIGINS',
  'MAX_LOGIN_ATTEMPTS',
  'SESSION_TIMEOUT_MINUTES',
];

// Validation errors
interface ValidationError {
  type: 'missing' | 'invalid';
  key: string;
  message: string;
}

/**
 * Validate environment variables
 */
function validateEnv(): { env: Env; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const env: Partial<Env> = {};

  // Check required variables
  const requiredKeys: (keyof EnvConfig['required'])[] = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  for (const key of requiredKeys) {
    const value = process.env[key];
    if (!value) {
      errors.push({
        type: 'missing',
        key,
        message: `Required environment variable ${key} is not set`,
      });
    } else {
      env[key] = value;
    }
  }

  // Validate URLs
  const urlKeys: Array<keyof Env> = ['NEXT_PUBLIC_SUPABASE_URL', 'DATABASE_URL', 'NEXTAUTH_URL'];
  for (const key of urlKeys) {
    const value = process.env[key];
    if (value) {
      try {
        new URL(value);
        (env as Record<string, unknown>)[key] = value;
      } catch {
        errors.push({
          type: 'invalid',
          key,
          message: `${key} must be a valid URL`,
        });
      }
    }
  }

  // Validate email addresses
  const emailKeys: Array<keyof Env> = ['EMAIL_FROM', 'TREASURY_NOTIFICATION_EMAIL'];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const key of emailKeys) {
    const value = process.env[key];
    if (value && !emailRegex.test(value)) {
      errors.push({
        type: 'invalid',
        key,
        message: `${key} must be a valid email address`,
      });
    } else if (value) {
      (env as Record<string, unknown>)[key] = value;
    }
  }

  // Validate numeric values
  const numericKeys: Array<keyof Env> = ['SMTP_PORT', 'MAX_LOGIN_ATTEMPTS', 'SESSION_TIMEOUT_MINUTES'];
  for (const key of numericKeys) {
    const value = process.env[key];
    if (value && Number.isNaN(Number(value))) {
      errors.push({
        type: 'invalid',
        key,
        message: `${key} must be a number`,
      });
    } else if (value) {
      (env as Record<string, unknown>)[key] = value;
    }
  }

  // Copy remaining optional values
  for (const key of OPTIONAL_ENV_KEYS) {
    if (env[key] !== undefined) {
      continue;
    }

    const value = process.env[key];
    if (value !== undefined) {
      (env as Record<string, unknown>)[key] = value;
    }
  }

  // Set NODE_ENV default
  if (!env.NODE_ENV) {
    env.NODE_ENV = 'development';
  }

  return { env: env as Env, errors };
}

// Singleton instance of validated environment
let cachedEnv: Env | null = null;
let validationRun = false;

/**
 * Get validated environment variables
 * @returns Type-safe environment configuration
 */
export function getEnv(): Env {
  if (!cachedEnv) {
    const { env, errors } = validateEnv();

    if (errors.length > 0 && !validationRun) {
      validationRun = true;
      console.error('❌ Environment Variable Validation Issues:');

      const missing = errors.filter(e => e.type === 'missing');
      const invalid = errors.filter(e => e.type === 'invalid');

      if (missing.length > 0) {
        console.error('\n📋 Missing required variables:');
        missing.forEach(err => console.error(`   - ${err.key}`));
      }

      if (invalid.length > 0) {
        console.error('\n⚠️  Invalid variables:');
        invalid.forEach(err => console.error(`   - ${err.key}: ${err.message}`));
      }

      console.error('\n💡 Please check your .env.local file and ensure all required variables are set correctly.');

      // Don't throw during build - env vars are injected at runtime by Vercel
      // Only warn during development
      if (process.env['NODE_ENV'] === 'development' && missing.length > 0) {
        console.warn('⚠️  Development mode: continuing with missing environment variables');
      }
    }

    cachedEnv = env;
  }

  return cachedEnv;
}

/**
 * Get the base URL for the application
 * Handles different deployment environments
 */
export function getBaseUrl(): string {
  const env = getEnv();

  // Vercel deployment
  if (env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`;
  }

  // NextAuth URL
  if (env.NEXTAUTH_URL) {
    return env.NEXTAUTH_URL;
  }

  // Development default
  return 'http://localhost:3000';
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: 'rateLimiting' | 'auditLogging'): boolean {
  const env = getEnv();

  switch (feature) {
    case 'rateLimiting':
      return env.ENABLE_RATE_LIMITING === 'true';
    case 'auditLogging':
      return env.ENABLE_AUDIT_LOGGING === 'true';
    default:
      return false;
  }
}

/**
 * Get security configuration
 */
export function getSecurityConfig(): {
  allowedOrigins: string[];
  maxLoginAttempts: number;
  sessionTimeoutMinutes: number;
} {
  const env = getEnv();

  return {
    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()) ?? [],
    maxLoginAttempts: env.MAX_LOGIN_ATTEMPTS ? Number.parseInt(env.MAX_LOGIN_ATTEMPTS, 10) : 5,
    sessionTimeoutMinutes: env.SESSION_TIMEOUT_MINUTES
      ? Number.parseInt(env.SESSION_TIMEOUT_MINUTES, 10)
      : 30,
  };
}

/**
 * Get email configuration
 */
export function getEmailConfig(): {
  host: string;
  port: number;
  auth?: { user: string; pass: string };
  from: string;
  treasuryEmail?: string;
} | null {
  const env = getEnv();

  if (!env.SMTP_HOST || !env.SMTP_PORT) {
    return null; // Email not configured
  }

  const config: {
    host: string;
    port: number;
    auth?: { user: string; pass: string };
    from: string;
    treasuryEmail?: string;
  } = {
    host: env.SMTP_HOST,
    port: Number.parseInt(env.SMTP_PORT, 10),
    from: env.EMAIL_FROM ?? 'noreply@ipupy.org.py',
  };

  if (env.SMTP_USER && env.SMTP_PASSWORD) {
    config.auth = {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    };
  }

  if (env.TREASURY_NOTIFICATION_EMAIL) {
    config.treasuryEmail = env.TREASURY_NOTIFICATION_EMAIL;
  }

  return config;
}

/**
 * Get Supabase configuration
 * Works on both client and server by accessing NEXT_PUBLIC_* variables statically
 */
export function getSupabaseConfig(): {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
} {
  // Access NEXT_PUBLIC_* variables statically for client-side compatibility
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  // During build, these may be undefined - use placeholder values
  // Vercel injects real values at runtime
  const config: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  } = {
    url: url || 'https://placeholder.supabase.co',
    anonKey: anonKey || 'placeholder-anon-key',
  };

  // Service role key is server-only
  if (typeof window === 'undefined') {
    const env = getEnv();
    if (env.SUPABASE_SERVICE_ROLE_KEY) {
      config.serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    }
  }

  return config;
}

// Validate on module load (server-side only)
if (typeof window === 'undefined') {
  getEnv();
}

// Export singleton instance (server-side only to prevent client bundle issues)
export const env = typeof window === 'undefined' ? getEnv() : ({} as Env);