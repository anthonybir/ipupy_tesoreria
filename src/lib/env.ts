type EnvIssues = {
  issues: string[];
  trimmed: Record<string, string>;
  hasIssues: boolean;
};

const trackedKeys = [
  'DATABASE_URL',
  'SUPABASE_DB_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_KEY',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'NEXTAUTH_SECRET'
] as const;

type TrackedKey = (typeof trackedKeys)[number];

type EnvSnapshot = Partial<Record<TrackedKey, string | undefined>>;

export const validateAndTrimEnvVars = (): EnvIssues => {
  const envVars: EnvSnapshot = {};
  trackedKeys.forEach((key) => {
    envVars[key] = process.env[key];
  });

  const issues: string[] = [];
  const trimmed: Record<string, string> = {};

  Object.entries(envVars).forEach(([key, value]) => {
    if (!value) {
      return;
    }

    const trimmedValue = value.trim();
    trimmed[key] = trimmedValue;

    if (value !== trimmedValue) {
      issues.push(`${key} has whitespace/newlines (fixed automatically)`);
      process.env[key] = trimmedValue;
    }

    if (key.includes('URL') && trimmedValue.includes('\n')) {
      issues.push(`${key} contains embedded newlines`);
    }

    if ((key === 'DATABASE_URL' || key === 'SUPABASE_DB_URL') &&
      !trimmedValue.startsWith('postgresql://') &&
      !trimmedValue.startsWith('postgres://')) {
      issues.push(`${key} has invalid format - should start with postgresql://`);
    }

    if (key === 'GOOGLE_CLIENT_ID' && !trimmedValue.includes('.apps.googleusercontent.com')) {
      issues.push(`${key} appears to be malformed`);
    }
  });

  if (issues.length > 0) {
    console.log('Environment Variable Issues Detected:');
    issues.forEach((issue) => console.log(`  - ${issue}`));
  }

  return { issues, trimmed, hasIssues: issues.length > 0 };
};
