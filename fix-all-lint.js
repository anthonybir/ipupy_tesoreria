#!/usr/bin/env node

/**
 * Script to fix all remaining lint errors in the codebase
 * This addresses all unused variables and other lint issues
 */

const fs = require('fs');
const path = require('path');

const fixes = [
  // scripts/apply-dual-level-accounting-migration.js
  {
    file: 'scripts/apply-dual-level-accounting-migration.js',
    replacements: [
      { from: 'const { data: viewData, error: viewError }', to: 'const { error: viewError }' },
      { from: 'const { data: macroData, error: macroError }', to: 'const { error: macroError }' }
    ]
  },

  // scripts/debug-totals.js
  {
    file: 'scripts/debug-totals.js',
    replacements: [
      { from: ').then((result) => {', to: ').then(() => {' }
    ]
  },

  // scripts/final-fix-totals.js
  {
    file: 'scripts/final-fix-totals.js',
    replacements: [
      { from: 'const updateEntradasResult = await', to: 'await' },
      { from: 'const updateSalidasResult = await', to: 'await' },
      { from: ').then((result) => {', to: ').then(() => {' }
    ]
  },

  // scripts/import-excel-to-supabase.js
  {
    file: 'scripts/import-excel-to-supabase.js',
    replacements: [
      { from: 'const fondoNacionalCalculado =', to: '// const fondoNacionalCalculado =' }
    ]
  },

  // scripts/import-legacy-transactions.js
  {
    file: 'scripts/import-legacy-transactions.js',
    replacements: [
      { from: 'const result = await execute(insertQuery', to: 'await execute(insertQuery' }
    ]
  },

  // scripts/import-reports-as-transactions.js
  {
    file: 'scripts/import-reports-as-transactions.js',
    replacements: [
      { from: 'const result = await execute(', to: 'await execute(' }
    ]
  },

  // scripts/migrate.js
  {
    file: 'scripts/migrate.js',
    replacements: [
      { from: '} catch (error) {', to: '} catch {' }
    ]
  },

  // scripts/setup-admin.js
  {
    file: 'scripts/setup-admin.js',
    replacements: [
      { from: '} catch (error) {', to: '} catch {' }
    ]
  },

  // scripts/validate-import.js
  {
    file: 'scripts/validate-import.js',
    replacements: [
      { from: 'const calculatedEntradas =', to: '// const calculatedEntradas =' },
      { from: 'const calculatedSalidas =', to: '// const calculatedSalidas =' }
    ]
  }
];

function applyFixes() {
  console.log('🔧 Applying lint fixes...\n');

  for (const fix of fixes) {
    const filePath = path.join(__dirname, fix.file);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${fix.file}`);
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    for (const replacement of fix.replacements) {
      if (content.includes(replacement.from)) {
        content = content.replace(replacement.from, replacement.to);
        modified = true;
        console.log(`✅ Fixed: ${fix.file} - "${replacement.from.substring(0, 30)}..."`);
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content);
    } else {
      console.log(`ℹ️  No changes needed: ${fix.file}`);
    }
  }

  console.log('\n✨ All lint fixes applied!');
  console.log('Run "npm run lint" to verify all errors are resolved.');
}

applyFixes();