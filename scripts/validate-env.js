/**
 * Validación de variables de entorno requeridas
 * Se ejecuta antes del build y en desarrollo
 */

require('dotenv').config({ path: '.env.local' });

const REQUIRED_VARS = [
  'SUPABASE_DB_URL',
  'SUPABASE_URL',
  'JWT_SECRET'
];

const OPTIONAL_VARS = [
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_ANON_KEY',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'ALLOWED_ORIGINS',
  'NODE_ENV'
];

function validateEnvironment({ silent = false } = {}) {
  if (!silent) {
    console.log('🔍 Validando variables de entorno...');
  }

  let hasErrors = false;
  const missing = [];
  const warnings = [];

  for (const envVar of REQUIRED_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar);
      hasErrors = true;
    }
  }

  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_KEY);
  const hasAnonKey = Boolean(process.env.SUPABASE_ANON_KEY);

  if (!hasServiceKey && !hasAnonKey) {
    hasErrors = true;
    missing.push('SUPABASE_SERVICE_KEY o SUPABASE_ANON_KEY');
  } else if (!hasServiceKey) {
    warnings.push('Usando SUPABASE_ANON_KEY; configure SUPABASE_SERVICE_KEY para operaciones de escritura seguras');
  }

  if (process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      warnings.push('JWT_SECRET debe tener al menos 32 caracteres para seguridad');
    }
    if (process.env.JWT_SECRET === 'fallback_secret') {
      hasErrors = true;
      missing.push('JWT_SECRET válido (no usar fallback_secret)');
    }
  }

  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD === 'admin123') {
    warnings.push('Cambiar ADMIN_PASSWORD por defecto (admin123) en producción');
  }

  if (!silent) {
    if (missing.length > 0) {
      console.error('❌ Variables de entorno faltantes:');
      missing.forEach((envVar) => {
        console.error(`   - ${envVar}`);
      });
    }

    if (warnings.length > 0) {
      console.warn('⚠️  Advertencias:');
      warnings.forEach((warning) => {
        console.warn(`   - ${warning}`);
      });
    }

    const optionalFound = OPTIONAL_VARS.filter((envVar) => process.env[envVar]);
    if (optionalFound.length > 0) {
      console.log('✅ Variables opcionales configuradas:');
      optionalFound.forEach((envVar) => {
        console.log(`   - ${envVar}`);
      });
    }

    if (!hasErrors && warnings.length === 0) {
      console.log('\n✅ Todas las validaciones pasaron exitosamente');
    } else if (!hasErrors) {
      console.log('\n⚠️  Validación completada con advertencias');
    }
  }

  return {
    valid: !hasErrors,
    missing,
    warnings
  };
}

if (require.main === module) {
  try {
    const result = validateEnvironment();
    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Error durante validación:', error.message);
    process.exit(1);
  }
}

module.exports = {
  validateEnvironment
};
