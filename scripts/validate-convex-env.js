#!/usr/bin/env node
/**
 * Validate Convex Environment Variables
 * 
 * Checks that all required environment variables for Convex migration are set.
 * Run this before deploying to ensure proper configuration.
 * 
 * Usage:
 *   node scripts/validate-convex-env.js
 */

const requiredVars = {
  // Convex Backend
  'NEXT_PUBLIC_CONVEX_URL': {
    description: 'Convex deployment URL (client-side)',
    example: 'https://dashing-clownfish-472.convex.cloud',
    required: true,
    public: true
  },
  'CONVEX_DEPLOYMENT': {
    description: 'Convex deployment identifier (server-side)',
    example: 'dev:dashing-clownfish-472 or prod:dashing-clownfish-472',
    required: true,
    public: false
  },
  
  // NextAuth v5
  'NEXTAUTH_SECRET': {
    description: 'NextAuth session encryption key (min 32 chars)',
    example: 'Generate with: openssl rand -base64 32',
    required: true,
    public: false
  },
  'NEXTAUTH_URL': {
    description: 'Application base URL for OAuth callbacks',
    example: 'http://localhost:3000 or https://yourdomain.com',
    required: true,
    public: false
  },
  
  // Google OAuth
  'GOOGLE_CLIENT_ID': {
    description: 'Google OAuth client ID (server-side)',
    example: 'xxxxx.apps.googleusercontent.com',
    required: true,
    public: false
  },
  'GOOGLE_CLIENT_SECRET': {
    description: 'Google OAuth client secret',
    example: 'GOCSPX-xxxxx',
    required: true,
    public: false
  },
  'NEXT_PUBLIC_GOOGLE_CLIENT_ID': {
    description: 'Google OAuth client ID (public for Convex auth.config.ts)',
    example: 'xxxxx.apps.googleusercontent.com',
    required: true,
    public: true
  }
};

const optionalVars = {
  'SYSTEM_OWNER_EMAIL': {
    description: 'Admin email address',
    example: 'admin@example.com',
    default: 'administracion@ipupy.org.py'
  },
  'ORGANIZATION_NAME': {
    description: 'Organization name',
    example: 'My Organization',
    default: 'Iglesia Pentecostal Unida del Paraguay'
  }
};

console.log('🔍 Validating Convex Environment Variables...\n');

let hasErrors = false;
let hasWarnings = false;

// Check required variables
console.log('📋 Required Variables:');
console.log('─'.repeat(80));

for (const [varName, config] of Object.entries(requiredVars)) {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  
  if (!value) {
    hasErrors = true;
    console.log(`${status} ${varName}`);
    console.log(`   Description: ${config.description}`);
    console.log(`   Example: ${config.example}`);
    console.log(`   Scope: ${config.public ? 'Client-side (NEXT_PUBLIC_*)' : 'Server-side only'}`);
    console.log('');
  } else {
    console.log(`${status} ${varName}`);
    
    // Validate format
    if (varName === 'NEXT_PUBLIC_CONVEX_URL' && !value.startsWith('https://')) {
      console.log(`   ⚠️  Warning: Should start with https://`);
      hasWarnings = true;
    }
    if (varName === 'CONVEX_DEPLOYMENT' && !value.match(/^(dev|prod):/)) {
      console.log(`   ⚠️  Warning: Should start with dev: or prod:`);
      hasWarnings = true;
    }
    if (varName === 'NEXTAUTH_SECRET' && value.length < 32) {
      console.log(`   ⚠️  Warning: Should be at least 32 characters`);
      hasWarnings = true;
    }
    if (varName === 'NEXTAUTH_URL' && !value.match(/^https?:\/\//)) {
      console.log(`   ⚠️  Warning: Should start with http:// or https://`);
      hasWarnings = true;
    }
    
    // Check if GOOGLE_CLIENT_ID matches NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (varName === 'NEXT_PUBLIC_GOOGLE_CLIENT_ID') {
      const serverClientId = process.env['GOOGLE_CLIENT_ID'];
      if (serverClientId && value !== serverClientId) {
        console.log(`   ⚠️  Warning: Should match GOOGLE_CLIENT_ID value`);
        hasWarnings = true;
      }
    }
  }
}

console.log('');

// Check optional variables
console.log('📋 Optional Variables:');
console.log('─'.repeat(80));

for (const [varName, config] of Object.entries(optionalVars)) {
  const value = process.env[varName];
  const status = value ? '✅' : '⚪';
  
  console.log(`${status} ${varName}`);
  if (!value && config.default) {
    console.log(`   Using default: ${config.default}`);
  }
}

console.log('');
console.log('─'.repeat(80));

// Summary
if (hasErrors) {
  console.log('❌ VALIDATION FAILED: Missing required environment variables');
  console.log('');
  console.log('To fix:');
  console.log('1. Copy .env.example to .env.local');
  console.log('2. Fill in the missing values');
  console.log('3. For production, add variables to Vercel:');
  console.log('   vercel env add VARIABLE_NAME production');
  console.log('');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  VALIDATION PASSED WITH WARNINGS');
  console.log('Please review the warnings above.');
  console.log('');
  process.exit(0);
} else {
  console.log('✅ VALIDATION PASSED');
  console.log('All required environment variables are set correctly.');
  console.log('');
  process.exit(0);
}

