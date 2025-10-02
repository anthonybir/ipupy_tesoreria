import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // ===================================================================
      // TypeScript Strict Mode Rules - Enforce Maximum Type Safety
      // ===================================================================

      // Prohibit 'any' type - force explicit typing
      "@typescript-eslint/no-explicit-any": "error",

      // Prevent unsafe type operations that bypass type checking
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",

      // Require explicit return types on exported functions
      "@typescript-eslint/explicit-module-boundary-types": ["warn", {
        allowArgumentsExplicitlyTypedAsAny: false,
      }],

      // Enforce proper null/undefined checking
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-unnecessary-condition": "warn",

      // Prevent floating promises (async/await discipline)
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",

      // Enforce consistent type imports
      "@typescript-eslint/consistent-type-imports": ["error", {
        prefer: "type-imports",
        fixStyle: "inline-type-imports",
      }],

      // Prevent unused variables and imports
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],

      // ===================================================================
      // React/Next.js Specific Rules
      // ===================================================================

      // Enforce hook dependency arrays
      "react-hooks/exhaustive-deps": "warn",

      // ===================================================================
      // General Code Quality Rules
      // ===================================================================

      // Prevent console statements in production code (use proper logging)
      "no-console": ["warn", {
        allow: ["warn", "error"],
      }],

      // Enforce === over ==
      "eqeqeq": ["error", "always"],

      // Prevent var usage
      "no-var": "error",

      // Prefer const over let where possible
      "prefer-const": "error",
    },
  },
];

export default eslintConfig;
