#!/usr/bin/env node

/**
 * Script de validación para el sistema IPU PY Tesorería
 * Verifica que toda la configuración esté correcta antes del despliegue
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validando configuración del sistema IPU PY Tesorería...\n');

const errors = [];
const warnings = [];

// Usar directorio raíz del proyecto (2 niveles arriba de scripts/utilities)
const PROJECT_ROOT = path.join(__dirname, '..', '..');

// 1. Verificar estructura de archivos
const requiredFiles = [
  'package.json',
  'vercel.json',
  '.env.example',
  'README.md',
  'lib/db.js',
  'api/auth.js',
  'api/churches.js',
  'api/financial.js',  // Consolidated: funds + transactions + church-transactions
  'api/data.js',       // Consolidated: import + export
  'api/reports.js',
  'public/index.html'
];

console.log('📁 Verificando estructura de archivos...');
requiredFiles.forEach(file => {
  if (fs.existsSync(path.join(PROJECT_ROOT, file))) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file}`);
    errors.push(`Archivo faltante: ${file}`);
  }
});

// 2. Verificar package.json
console.log('\n📦 Verificando package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));

  const requiredDeps = ['pg', 'cors', 'multer', 'xlsx', 'bcryptjs', 'jsonwebtoken', 'dotenv'];
  const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);

  if (missingDeps.length === 0) {
    console.log('  ✅ Todas las dependencias requeridas están presentes');
  } else {
    console.log(`  ❌ Dependencias faltantes: ${missingDeps.join(', ')}`);
    errors.push(`Dependencias faltantes: ${missingDeps.join(', ')}`);
  }

  if (packageJson.engines && packageJson.engines.node) {
    console.log(`  ✅ Versión de Node especificada: ${packageJson.engines.node}`);
  } else {
    console.log('  ⚠️  Versión de Node no especificada');
    warnings.push('Considere especificar la versión de Node en package.json');
  }

} catch (error) {
  console.log(`  ❌ Error al leer package.json: ${error.message}`);
  errors.push('Error al leer package.json');
}

// 3. Verificar vercel.json
console.log('\n⚡ Verificando configuración de Vercel...');
try {
  const vercelConfig = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'vercel.json'), 'utf8'));

  if (vercelConfig.version === 2) {
    console.log('  ✅ Versión de configuración correcta');
  } else {
    console.log('  ❌ Versión de configuración incorrecta');
    errors.push('vercel.json debe usar version: 2');
  }

  if (vercelConfig.functions && (vercelConfig.rewrites || vercelConfig.routes)) {
    console.log('  ✅ Configuración de functions y rewrites presente');
  } else {
    console.log('  ❌ Configuración de functions o rewrites faltante');
    errors.push('vercel.json debe incluir functions y rewrites para serverless');
  }

} catch (error) {
  console.log(`  ❌ Error al leer vercel.json: ${error.message}`);
  errors.push('Error al leer vercel.json');
}

// 4. Verificar archivos API
console.log('\n🔌 Verificando endpoints API...');
const apiFiles = ['auth.js', 'churches.js', 'dashboard.js', 'export.js', 'import.js', 'reports.js'];

apiFiles.forEach(file => {
  const filePath = path.join(PROJECT_ROOT, 'api', file);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');

      // Verificar export (CommonJS o ES6)
      if (content.includes('module.exports') || content.includes('export default async function handler')) {
        console.log(`  ✅ ${file} - Estructura correcta`);
      } else {
        console.log(`  ❌ ${file} - Estructura incorrecta`);
        errors.push(`${file} debe exportar una función handler`);
      }

      // Verificar CORS
      if (content.includes('Access-Control-Allow-Origin') || content.includes('setCORSHeaders')) {
        console.log(`  ✅ ${file} - CORS configurado`);
      } else {
        console.log(`  ⚠️  ${file} - CORS no configurado`);
        warnings.push(`${file} podría necesitar configuración CORS`);
      }

    } catch (error) {
      console.log(`  ❌ ${file} - Error al leer: ${error.message}`);
      errors.push(`Error al leer ${file}`);
    }
  }
});

// 5. Verificar configuración de base de datos
console.log('\n🗄️  Verificando configuración de base de datos...');
try {
  const dbContent = fs.readFileSync(path.join(PROJECT_ROOT, 'lib', 'db.js'), 'utf8');
  const dbSupabaseContent = fs.readFileSync(path.join(PROJECT_ROOT, 'lib', 'db-supabase.js'), 'utf8');

  if (dbContent.includes('const { Pool } = require(\'pg\')') || dbContent.includes('require(\'./db-supabase\')')) {
    console.log('  ✅ PostgreSQL configurado');
  } else {
    console.log('  ❌ PostgreSQL no configurado correctamente');
    errors.push('lib/db.js debe usar PostgreSQL (pg) o Supabase');
  }

  if (dbSupabaseContent.includes('process.env.DATABASE_URL') || dbSupabaseContent.includes('process.env.SUPABASE_DB_URL')) {
    console.log('  ✅ Variable de entorno de base de datos referenciada');
  } else {
    console.log('  ❌ Variable de entorno de base de datos no referenciada');
    errors.push('lib/db.js debe usar process.env.DATABASE_URL o process.env.SUPABASE_DB_URL');
  }

} catch (error) {
  console.log(`  ❌ Error al verificar db.js: ${error.message}`);
  errors.push('Error al verificar configuración de base de datos');
}

// 6. Verificar frontend
console.log('\n🎨 Verificando frontend...');
try {
  const appContent = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'index.html'), 'utf8');

  if (appContent.includes('tailwindcss.com') || appContent.includes('tailwind')) {
    console.log('  ✅ Tailwind CSS incluido');
  } else {
    console.log('  ⚠️  Tailwind CSS no detectado');
    warnings.push('Considere incluir Tailwind CSS para mejor UI');
  }

  if (appContent.includes('axios')) {
    console.log('  ✅ Axios configurado para API calls');
  } else {
    console.log('  ❌ Axios no configurado');
    errors.push('Frontend debe incluir Axios para llamadas API');
  }

  if (appContent.includes('API_BASE') || appContent.includes('/api/')) {
    console.log('  ✅ Referencias a API endpoints presentes');
  } else {
    console.log('  ❌ Referencias a API endpoints no encontradas');
    errors.push('Frontend debe referenciar los endpoints API');
  }

} catch (error) {
  console.log(`  ❌ Error al verificar index.html: ${error.message}`);
  errors.push('Error al verificar frontend');
}

// 7. Verificar variables de entorno de ejemplo
console.log('\n🔐 Verificando variables de entorno...');
try {
  const envExample = fs.readFileSync(path.join(PROJECT_ROOT, '.env.example'), 'utf8');

  const requiredVars = ['SUPABASE_DB_URL', 'JWT_SECRET', 'ADMIN_EMAIL', 'NODE_ENV'];
  const missingVars = requiredVars.filter(varName => !envExample.includes(varName));

  if (missingVars.length === 0) {
    console.log('  ✅ Todas las variables de entorno requeridas están documentadas');
  } else {
    console.log(`  ❌ Variables de entorno faltantes en .env.example: ${missingVars.join(', ')}`);
    errors.push(`Variables de entorno faltantes: ${missingVars.join(', ')}`);
  }

} catch (error) {
  console.log(`  ❌ Error al verificar .env.example: ${error.message}`);
  errors.push('Error al verificar variables de entorno');
}

// Resumen final
console.log('\n' + '='.repeat(60));
console.log('📋 RESUMEN DE VALIDACIÓN');
console.log('='.repeat(60));

if (errors.length === 0 && warnings.length === 0) {
  console.log('🎉 ¡TODO PERFECTO! El sistema está listo para desplegar en Vercel.');
  console.log('\n📝 Pasos siguientes:');
  console.log('  1. git add .');
  console.log('  2. git commit -m "Sistema listo para Vercel"');
  console.log('  3. git push origin main');
  console.log('  4. Conectar repositorio a Vercel');
  console.log('  5. Configurar variables de entorno en Vercel');
  console.log('  6. ¡Desplegar!');

  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log(`❌ ERRORES CRÍTICOS (${errors.length}):`);
    errors.forEach(error => console.log(`   • ${error}`));
    console.log('');
  }

  if (warnings.length > 0) {
    console.log(`⚠️  ADVERTENCIAS (${warnings.length}):`);
    warnings.forEach(warning => console.log(`   • ${warning}`));
    console.log('');
  }

  if (errors.length > 0) {
    console.log('🚫 Corrija los errores críticos antes de desplegar.');
    process.exit(1);
  } else {
    console.log('✅ No hay errores críticos. Puede proceder con el despliegue.');
    console.log('💡 Considere resolver las advertencias para mejorar el sistema.');
    process.exit(0);
  }
}