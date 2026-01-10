import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "www_static/assets/admin/**",
    "www_static/assets/oldplunger/**",
    "www_static/assets/selector/**",
  ]),
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ["frontend/**/*.{js,jsx,ts,tsx}"],
    extends: [pluginReact.configs.flat.recommended],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ["www_static/assets/booloader/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ["oldplunger/**/*.{js,ts}", "server/**/*.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // TODO: Remove the following two after migrating to TS
  {
    files: ["server/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "prefer-const": "error",
    },
  },
  {
    files: ["**/*.json"],
    plugins: { json },
    language: "json/json",
    extends: ["json/recommended"],
  },
  {
    files: ["**/*.jsonc"],
    plugins: { json },
    language: "json/jsonc",
    extends: ["json/recommended"],
  },
  {
    files: ["**/*.json5"],
    plugins: { json },
    language: "json/json5",
    extends: ["json/recommended"],
  },
  {
    files: ["**/*.md"],
    plugins: { markdown },
    language: "markdown/gfm",
    extends: ["markdown/recommended"],
  },
  {
    files: ["**/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"],
  },
]);
