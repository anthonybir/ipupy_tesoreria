#!/usr/bin/env node
/**
 * Admin Setup Script for IPUPY Tesorería
 * Creates initial admin user and configures system for first use
 */

const bcrypt = require('bcryptjs');
const readline = require('readline');
const { validateEnvironment } = require('./validate-env');
const { runMigrations } = require('./migrate');
const { execute } = require('../src/lib/db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function promptPassword(message = 'Enter admin password: ') {
  let password;
  let confirmPassword;

  do {
    password = await prompt(message);
    if (password.length < 8) {
      console.log('❌ Password must be at least 8 characters long');
      continue;
    }

    if (password === 'admin123') {
      console.log('❌ Password cannot be "admin123" for security reasons');
      continue;
    }

    confirmPassword = await prompt('Confirm password: ');
    if (password !== confirmPassword) {
      console.log('❌ Passwords do not match. Please try again.');
    }
  } while (password !== confirmPassword || password.length < 8 || password === 'admin123');

  return password;
}

async function checkExistingAdmin() {
  try {
    const result = await execute('SELECT COUNT(*) AS count FROM users WHERE role = $1', ['admin']);
    return Number(result.rows[0].count) > 0;
  } catch {
    return false;
  }
}

async function createAdminUser(email, password) {
  try {
    console.log('\n🔑 Creating admin user...');
    const passwordHash = await bcrypt.hash(password, 12);

    await execute(
      `INSERT INTO users (email, password_hash, role, active)
       VALUES ($1, $2, 'admin', true)`,
      [email, passwordHash]
    );

    console.log('✅ Admin user created successfully');
    console.log(`   Email: ${email}`);
    console.log('   Role: admin');
    return true;
  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
    return false;
  }
}

async function verifyRequirements() {
  console.log('🔍 Verifying system requirements...\n');

  console.log('📋 Validating environment variables...');
  const envResult = validateEnvironment({ silent: true });

  if (!envResult.valid) {
    console.error('❌ Environment validation failed:');
    if (envResult.missing?.length > 0) {
      console.error('   Missing variables:', envResult.missing.join(', '));
    }
    envResult.warnings?.forEach((warning) => console.warn(`   Warning: ${warning}`));
    return false;
  }
  console.log('✅ Environment variables: OK');

  console.log('🔌 Testing database connection...');
  try {
    await execute('SELECT 1');
    console.log('✅ Database connection: OK');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('   Please check SUPABASE_DB_URL and credentials in .env.local');
    return false;
  }

  return true;
}

async function setupAdmin() {
  console.log('\n🚀 IPUPY Tesorería Admin Setup\n');
  console.log('=====================================\n');

  try {
    const requirementsMet = await verifyRequirements();
    if (!requirementsMet) {
      console.log('\n❌ Setup cannot continue due to missing requirements.');
      console.log('Please fix the issues above and try again.');
      process.exit(1);
    }

    console.log('\n📦 Running database migrations...');
    await runMigrations();
    console.log('✅ Migrations completed');

    const hasAdmin = await checkExistingAdmin();
    if (hasAdmin) {
      console.log('\n⚠️  Admin user already exists.');
      const overwrite = await prompt('Do you want to create additional admin user? (y/N): ');
      if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
        console.log('Setup cancelled.');
        rl.close();
        return;
      }
    }

    console.log('\n👤 Admin User Configuration');
    console.log('============================\n');

    let email;
    do {
      email = await prompt('Enter admin email: ');
      if (!email.includes('@')) {
        console.log('❌ Please enter a valid email address');
        email = null;
      }
    } while (!email);

    const password = await promptPassword();

    const success = await createAdminUser(email, password);
    if (!success) {
      console.log('\n❌ Admin setup failed');
      process.exit(1);
    }

    console.log('\n🔍 Verifying setup...');
    try {
      const churchResult = await execute('SELECT COUNT(*) AS count FROM churches');
      const adminResult = await execute('SELECT COUNT(*) AS count FROM users WHERE role = $1', ['admin']);

      console.log('✅ Setup verification completed:');
      console.log(`   📊 ${churchResult.rows[0].count} churches configured`);
      console.log(`   👑 ${adminResult.rows[0].count} admin user(s) created`);
      console.log('   🗄️  Database: Connected and ready');
    } catch (error) {
      console.log('⚠️  Setup completed but verification failed:', error.message);
    }

    console.log('\n🎉 Admin setup completed successfully!');
    rl.close();
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error(error);
    rl.close();
    process.exit(1);
  }
}

setupAdmin();
