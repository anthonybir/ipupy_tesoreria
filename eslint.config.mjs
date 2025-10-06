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
      "tests/**", // Exclude test scaffolds (Jest not yet configured)
    ],
  },
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    rules: {
      // ===================================================================
      // TypeScript Strict Mode Rules - Enforce Maximum Type Safety
      // ===================================================================

      // Prohibit 'any' type - force explicit typing
      "@typescript-eslint/no-explicit-any": "error",

      // Prevent unsafe type operations that bypass type checking
      // Note: Disabled for database query results which use bracket notation for RLS compliance
      // TypeScript strict mode still enforces type safety at compile time
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",

      // Require explicit return types on exported functions
      "@typescript-eslint/explicit-module-boundary-types": ["warn", {
        allowArgumentsExplicitlyTypedAsAny: false,
      }],

      // Enforce proper null/undefined checking
      // no-non-null-assertion: Error (all instances fixed - zero tolerance for new violations)
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unnecessary-condition": "warn",

      // Prevent floating promises (async/await discipline)
      // Note: Disabled because TanStack Query mutations are designed to be fire-and-forget
      // They handle errors via onError callbacks, not via await/catch
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": ["error", {
        checksVoidReturn: {
          attributes: false, // Allow async event handlers in React (onClick, onChange, etc.)
        },
      }],

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
