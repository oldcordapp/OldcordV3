import css from '@eslint/css';
import js from '@eslint/js';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import { defineConfig, globalIgnores } from 'eslint/config';
import configPrettier from 'eslint-config-prettier';
import pluginJsxA11y from 'eslint-plugin-jsx-a11y';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    'www_static/assets/admin/**',
    'www_static/assets/oldplunger/**',
    'www_static/assets/selector/**',
    'www_dynamic/**',
  ]),
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    extends: [js.configs.recommended],
    plugins: {
      'simple-import-sort': pluginImportSort,
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
    extends: [pluginReact.configs.flat.recommended, pluginJsxA11y.flatConfigs.recommended],
    plugins: {
      'react-hooks': pluginReactHooks as any,
    },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
    },
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
  // TODO: Remove the following three after migrating to TS
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
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
    },
  },
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
