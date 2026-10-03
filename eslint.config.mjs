import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      "trash/**",
      "backups/**",
      "demo/**",
      "templates/**",
      "**/.next/**",
      "**/dist/**",
    ],
  },
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-empty-object-type": "error",
      "prefer-const": "error",
    },
  },
  {
    // The CLI, the bin and the plain-JS entries are untyped ESM.
    files: ["**/*.mjs", "**/*.js"],
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
];

export default eslintConfig;
