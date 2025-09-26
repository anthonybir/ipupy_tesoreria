#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', '..', 'node_modules', 'math-intrinsics', 'package.json');

try {
  const pkgJson = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(pkgJson);
  if (pkg.exports && typeof pkg.exports === 'object') {
    let mutated = false;
    for (const key of Object.keys(pkg.exports)) {
      if (Object.prototype.hasOwnProperty.call(pkg.exports, `${key}.js`)) {
        continue;
      }
      const target = pkg.exports[key];
      if (typeof target === 'string' && !key.endsWith('.js')) {
        pkg.exports[`${key}.js`] = target;
        mutated = true;
      }
    }
    if (mutated) {
      fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
      console.info('[postinstall] Patched math-intrinsics exports for Next lint compatibility.');
    }
  }
} catch (error) {
  if (error.code !== 'ENOENT') {
    console.warn('[postinstall] Unable to adjust math-intrinsics exports:', error.message);
  }
}
