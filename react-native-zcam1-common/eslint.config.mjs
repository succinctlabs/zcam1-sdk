import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";

export default tseslint.config(
  // Recommended rules (matches Biome recommended)
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // React recommended (matches Biome react domain)
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],

  // Disable formatting rules handled by Prettier
  prettier,

  {
    plugins: {
      "react-hooks": reactHooks,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      // React hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Import organization (matches Biome organizeImports)
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // Allow underscore-prefixed variables to be unused (common convention)
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
    },
    settings: {
      react: { version: "detect" },
    },
  },

  // Ignores tailored for React Native packages
  {
    ignores: [
      "node_modules/",
      "lib/",
      "dist/",
      "ios/",
      "android/",
      "cpp/",
      "generated/",
      "**/*.xcframework/",
    ],
  }
);
