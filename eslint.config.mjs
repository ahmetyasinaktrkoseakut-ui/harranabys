import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "prefer-const": "warn"
    }
  },
  globalIgnores([
    ".next/**",
    ".vercel/**",
    "node_modules/**",
    "scripts/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "*.js",
    "*.mjs"
  ]),
]);

export default eslintConfig;
