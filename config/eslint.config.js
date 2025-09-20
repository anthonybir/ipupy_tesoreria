const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    ignores: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.node,
        module: 'writable',
        exports: 'writable'
      }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': 'error',
      'curly': 'error',
      'no-trailing-spaces': 'error',
      'no-multiple-empty-lines': ['error', { max: 2 }],
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { allowTemplateLiterals: true }],
      'indent': ['error', 2],
      'comma-dangle': ['error', 'never'],
      'no-undef': 'error',
      'no-implicit-globals': 'error',
      'no-redeclare': 'error'
    }
  },
  {
    files: ['public/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        CustomEvent: 'readonly',
        ABSD: 'writable'
      }
    }
  },
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        performance: 'readonly'
      }
    }
  }
];