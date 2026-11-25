// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'coverage/', 'node_modules/', 'src/shared/db/generated/'],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-console': 'off',
    },
  },
  {
    // `expect.any(String)` and friends are typed `any` by Vitest.
    files: ['test/**/*.ts'],
    rules: { '@typescript-eslint/no-unsafe-assignment': 'off' },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  prettier,
);
