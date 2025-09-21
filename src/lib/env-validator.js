/**
 * Environment Variable Validation for IPU PY Tesorería
 * Validates all critical environment variables at startup
 * Prevents application from starting with insecure configuration
 */

const crypto = require('crypto');

class EnvironmentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.requiredVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'ADMIN_EMAIL',
      'ADMIN_PASSWORD',
      'NODE_ENV'
    ];
    this.optionalVars = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_KEY',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'SMTP_HOST',
      'SMTP_USER',
      'SMTP_PASS'
    ];
  }

  /**
   * Validates all environment variables
   * @returns {Object} { isValid: boolean, errors: Array, warnings: Array }
   */
  validate() {
    console.log('🔍 Validating environment configuration...');

    this.validateRequired();
    this.validateDatabase();
    this.validateJWTSecret();
    this.validateAdminCredentials();
    this.validateSecurity();
    this.validateCORS();
    this.validateOptionalServices();

    const isValid = this.errors.length === 0;

    this.printSummary();

    return {
      isValid,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  /**
   * Validates all required environment variables are present
   */
  validateRequired() {
    console.log('📋 Checking required environment variables...');

    this.requiredVars.forEach(varName => {
      const value = process.env[varName];

      if (!value || value.trim() === '') {
        this.addError(`Missing required environment variable: ${varName}`);
      } else {
        console.log(`  ✅ ${varName}`);
      }
    });
  }

  /**
   * Validates database configuration
   */
  validateDatabase() {
    console.log('🗄️  Validating database configuration...');

    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl || dbUrl.trim() === '') {
      this.addError('DATABASE_URL is required');
      return;
    }

    const trimmedUrl = dbUrl.trim();
    const initialErrorCount = this.errors.length;
    let parsedUrl;

    try {
      parsedUrl = new URL(trimmedUrl);
    } catch (error) {
      this.addError('DATABASE_URL must be a valid PostgreSQL connection string');
      return;
    }

    if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
      this.addError('DATABASE_URL must use the postgres:// or postgresql:// protocol');
    }

    if (!parsedUrl.username) {
      this.addError('DATABASE_URL must include a username');
    }

    if (!parsedUrl.hostname) {
      this.addError('DATABASE_URL must include a hostname');
    }

    const databaseName = parsedUrl.pathname.replace(/^\//, '');
    if (!databaseName) {
      this.addError('DATABASE_URL must include a database name');
    }

    if (parsedUrl.port) {
      const portNumber = Number(parsedUrl.port);
      if (Number.isNaN(portNumber) || portNumber <= 0 || portNumber > 65535) {
        this.addError('DATABASE_URL port must be a valid number between 1 and 65535');
      }
    } else {
      this.addWarning('DATABASE_URL does not specify a port; the default (usually 5432) will be used');
    }

    if (this.errors.length === initialErrorCount) {
      console.log('  ✅ Database URL format is valid');
    }

    // Check for common security issues
    if (trimmedUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
      this.addWarning('Using localhost database in production environment');
    }

    if (trimmedUrl.includes('password') || trimmedUrl.includes('123456')) {
      this.addWarning('Database URL appears to contain weak credentials');
    }
  }

  /**
   * Validates JWT secret strength
   */
  validateJWTSecret() {
    console.log('🔐 Validating JWT secret...');

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      this.addError('JWT_SECRET is required');
      return;
    }

    // Check minimum length (64 characters recommended)
    if (jwtSecret.length < 32) {
      this.addError('JWT_SECRET must be at least 32 characters long');
    } else if (jwtSecret.length < 64) {
      this.addWarning('JWT_SECRET should be at least 64 characters for better security');
    } else {
      console.log('  ✅ JWT secret length is sufficient');
    }

    // Check entropy (basic check for randomness)
    const uniqueChars = new Set(jwtSecret).size;
    if (uniqueChars < 16) {
      this.addWarning('JWT_SECRET appears to have low entropy, consider using a more random secret');
    }

    // Check for common weak patterns
    if (/^(.)\1+$/.test(jwtSecret) || jwtSecret === 'your-secret-key') {
      this.addError('JWT_SECRET appears to be a placeholder or weak pattern');
    }
  }

  /**
   * Validates admin credentials
   */
  validateAdminCredentials() {
    console.log('👤 Validating admin credentials...');

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    // Validate admin email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(adminEmail)) {
      this.addError('ADMIN_EMAIL must be a valid email address');
    } else {
      console.log('  ✅ Admin email format is valid');
    }

    // Validate admin password strength
    if (adminPassword.length < 8) {
      this.addError('ADMIN_PASSWORD must be at least 8 characters long');
    } else if (adminPassword.length < 12) {
      this.addWarning('ADMIN_PASSWORD should be at least 12 characters for better security');
    }

    // Check password complexity
    const hasUppercase = /[A-Z]/.test(adminPassword);
    const hasLowercase = /[a-z]/.test(adminPassword);
    const hasNumbers = /\d/.test(adminPassword);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(adminPassword);

    if (!hasUppercase || !hasLowercase || !hasNumbers) {
      this.addWarning('ADMIN_PASSWORD should contain uppercase, lowercase, and numbers');
    }

    if (!hasSpecialChars) {
      this.addWarning('ADMIN_PASSWORD should contain special characters for better security');
    }

    if (hasUppercase && hasLowercase && hasNumbers && hasSpecialChars) {
      console.log('  ✅ Admin password complexity is good');
    }
  }

  /**
   * Validates security configuration
   */
  validateSecurity() {
    console.log('🛡️  Validating security configuration...');

    const nodeEnv = process.env.NODE_ENV;
    const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const rateLimitRequests = parseInt(process.env.RATE_LIMIT_REQUESTS) || 100;

    // Validate NODE_ENV
    if (!['development', 'production', 'test'].includes(nodeEnv)) {
      this.addWarning('NODE_ENV should be "development", "production", or "test"');
    } else {
      console.log(`  ✅ NODE_ENV is set to "${nodeEnv}"`);
    }

    // Validate bcrypt rounds
    if (bcryptRounds < 10) {
      this.addWarning('BCRYPT_ROUNDS should be at least 10 for security');
    } else if (bcryptRounds > 15) {
      this.addWarning('BCRYPT_ROUNDS above 15 may cause performance issues');
    } else {
      console.log(`  ✅ BCRYPT_ROUNDS is set to ${bcryptRounds}`);
    }

    // Validate rate limiting
    if (rateLimitRequests > 1000) {
      this.addWarning('RATE_LIMIT_REQUESTS might be too high for production');
    } else {
      console.log(`  ✅ Rate limiting configured: ${rateLimitRequests} requests`);
    }
  }

  /**
   * Validates CORS configuration
   */
  validateCORS() {
    console.log('🌐 Validating CORS configuration...');

    const allowedOrigins = process.env.ALLOWED_ORIGINS;

    if (!allowedOrigins) {
      this.addWarning('ALLOWED_ORIGINS not configured, will use default CORS settings');
      return;
    }

    // Check for wildcard (security risk)
    if (allowedOrigins.includes('*')) {
      this.addError('ALLOWED_ORIGINS should not contain wildcards (*) in production');
    }

    // Check for localhost in production
    if (allowedOrigins.includes('localhost') && process.env.NODE_ENV === 'production') {
      this.addWarning('ALLOWED_ORIGINS contains localhost in production environment');
    }

    const origins = allowedOrigins.split(',').map(o => o.trim());
    console.log(`  ✅ CORS configured for ${origins.length} origins`);
  }

  /**
   * Validates optional service configurations
   */
  validateOptionalServices() {
    console.log('⚙️  Checking optional service configurations...');

    // Google OAuth
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (googleClientId && googleClientSecret) {
      console.log('  ✅ Google OAuth configured');
    } else if (googleClientId || googleClientSecret) {
      this.addWarning('Google OAuth partially configured (both CLIENT_ID and CLIENT_SECRET required)');
    }

    // SMTP Configuration
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      console.log('  ✅ SMTP email configuration complete');
    } else if (smtpHost || smtpUser || smtpPass) {
      this.addWarning('SMTP email partially configured (HOST, USER, and PASS all required)');
    }

    // Supabase Configuration
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      console.log('  ✅ Supabase configuration complete');
    } else if (supabaseUrl || supabaseAnonKey) {
      this.addWarning('Supabase partially configured');
    }
  }

  /**
   * Adds an error to the validation results
   * @param {string} message
   */
  addError(message) {
    this.errors.push(message);
    console.log(`  ❌ ERROR: ${message}`);
  }

  /**
   * Adds a warning to the validation results
   * @param {string} message
   */
  addWarning(message) {
    this.warnings.push(message);
    console.log(`  ⚠️  WARNING: ${message}`);
  }

  /**
   * Prints validation summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 ENVIRONMENT VALIDATION SUMMARY');
    console.log('='.repeat(60));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('🎉 Environment configuration is perfect!');
    } else {
      if (this.errors.length > 0) {
        console.log(`❌ CRITICAL ERRORS (${this.errors.length}):`);
        this.errors.forEach(error => console.log(`   • ${error}`));
        console.log('');
      }

      if (this.warnings.length > 0) {
        console.log(`⚠️  WARNINGS (${this.warnings.length}):`);
        this.warnings.forEach(warning => console.log(`   • ${warning}`));
        console.log('');
      }

      if (this.errors.length > 0) {
        console.log('🚫 Application cannot start with critical errors.');
        console.log('💡 Please fix the errors above and restart the application.');
      } else {
        console.log('✅ No critical errors found. Application can start.');
        console.log('💡 Consider addressing warnings for better security.');
      }
    }
    console.log('='.repeat(60) + '\n');
  }

  /**
   * Validates environment and exits if critical errors found
   */
  static validateOrExit() {
    const validator = new EnvironmentValidator();
    const result = validator.validate();

    if (!result.isValid) {
      console.error('🚨 Critical environment validation errors detected.');
      console.error('Application startup aborted for security.');
      process.exit(1);
    }

    return result;
  }
}

module.exports = EnvironmentValidator;