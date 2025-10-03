/**
 * lint-staged configuration for IPU PY Tesorería
 *
 * Runs before commits to enforce:
 * - TypeScript type safety
 * - ESLint code quality rules
 * - No warnings allowed
 *
 * This prevents broken code from being committed.
 */

module.exports = {
  // TypeScript/React files: Type check + lint with zero warnings
  '*.{ts,tsx}': (filenames) => [
    // Run ESLint with auto-fix on staged files only
    `eslint ${filenames.join(' ')} --fix --max-warnings 0`,

    // TypeScript type check - ensures no type errors are committed
    'tsc --noEmit',
  ],

  // JSON, CSS, Markdown: Just ensure they're properly formatted (optional)
  // Uncomment if you want to add prettier or other formatters
  // '*.{json,css,md}': 'prettier --write',
};
