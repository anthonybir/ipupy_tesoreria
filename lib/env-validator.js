/**
 * Environment Variable Validator
 * Ensures all environment variables are properly formatted without trailing whitespace/newlines
 */

const validateAndTrimEnvVars = () => {
  const envVars = {
    // Database
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,

    // Authentication
    JWT_SECRET: process.env.JWT_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

    // Admin
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD
  };

  const issues = [];
  const trimmed = {};

  Object.keys(envVars).forEach(key => {
    const value = envVars[key];
    if (value) {
      const trimmedValue = value.trim();
      trimmed[key] = trimmedValue;

      // Check for common issues
      if (value !== trimmedValue) {
        issues.push(`${key} has whitespace/newlines (fixed automatically)`);
        // Update the environment variable with trimmed value
        process.env[key] = trimmedValue;
      }

      // Check for specific formatting issues
      if (key.includes('URL') && trimmedValue.includes('\n')) {
        issues.push(`${key} contains embedded newlines`);
      }

      if (key === 'DATABASE_URL' || key === 'SUPABASE_DB_URL') {
        if (!trimmedValue.startsWith('postgresql://') && !trimmedValue.startsWith('postgres://')) {
          issues.push(`${key} has invalid format - should start with postgresql://`);
        }
      }

      if (key === 'GOOGLE_CLIENT_ID') {
        if (!trimmedValue.includes('.apps.googleusercontent.com')) {
          issues.push(`${key} appears to be malformed`);
        }
      }
    }
  });

  if (issues.length > 0) {
    console.log('Environment Variable Issues Detected:');
    issues.forEach(issue => console.log(`  - ${issue}`));
  }

  return {
    issues,
    trimmed,
    hasIssues: issues.length > 0
  };
};

module.exports = {
  validateAndTrimEnvVars
};