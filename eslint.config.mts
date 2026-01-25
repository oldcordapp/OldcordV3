import css from '@eslint/css';
import js from '@eslint/js';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import { defineConfig, globalIgnores } from 'eslint/config';
import configPrettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    'www_static/assets/admin/**',
    'www_static/assets/oldplunger/**',
    'www_static/assets/selector/**',
    'www_dynamic/**',
    '**/package-lock.json',
  ]),
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    extends: [js.configs.recommended],
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/exports': 'error',
      'simple-import-sort/imports': [
        'error',
        {
          // Keep css below
          groups: [
            ['^\\u0000'],
            ['^@?\\w'],
            ['^@oldcord(/.*|$)'],
            [
              '^\\.\\.(?!/?$)',
              '^\\.\\./?$',
              '^\\./(?=[^/]*?)(?!.*\\.css$)',
              '^\\.(?!/?$)',
              '^\\./?$',
            ],
            ['^.+\\.css$', '^\\u0000.*\\.css$'],
          ],
        },
      ],
      'prefer-const': 'error',
    },
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  {
    files: ['**/*.{ts,mts,cts,tsx}'],
    ignores: ['eslint.config.mts'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['frontend/**/*.{js,jsx,ts,tsx}'],
    extends: [
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    settings: {
      react: { version: 'detect' },
    },
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ['www_static/assets/bootloader/**/*.js', 'oldplunger/**/*.{js,ts}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ['server/**/*.{js,ts}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  // TODO: Remove the following two after migrating to TS
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'warn',
      'no-console': 'off',
      'no-debugger': 'warn',
      'no-unreachable': 'warn',
      'no-constant-condition': 'warn',
      'no-empty': 'warn',
      eqeqeq: 'warn',
      'no-unused-expressions': 'warn',
      'no-const-assign': 'warn',
      'no-func-assign': 'warn',
      'no-import-assign': 'warn',
    },
  },
  {
    files: ['**/*.{ts,mts,cts,tsx}'],
    ignores: ['eslint.config.mts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
    },
  },
  // DO NOT REMOVE THE FOLLOWING OR ELSE YOU CANNOT COMMIT LINTER CONFIG CHANGES!
  {
    files: ['eslint.config.mts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['**/*.json'],
    plugins: { json },
    language: 'json/json',
    extends: ['json/recommended'],
  },
  {
    files: ['**/*.jsonc'],
    plugins: { json },
    language: 'json/jsonc',
    extends: ['json/recommended'],
  },
  {
    files: ['**/*.json5'],
    plugins: { json },
    language: 'json/json5',
    extends: ['json/recommended'],
  },
  {
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/gfm',
    extends: ['markdown/recommended'],
  },
  {
    files: ['**/*.css'],
    plugins: { css },
    language: 'css/css',
    extends: ['css/recommended'],
    rules: {
      'css/no-important': 'off', // We need to override branding
    },
  },
  // Keep original changelogs for archival sake
  {
    files: ['frontend/selector/src/constants/buildChangelogs.js'],
    rules: {
      'no-useless-escape': 'off',
    },
  },
  configPrettier,
]);
