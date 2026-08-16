import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: ['nextjs'],
  rules: {
    'no-warning-comments': 'off',
    'no-inline-comments': 'off',
    'sort-keys': 'off',
    'func-style': 'off',
    'typescript/no-unsafe-assignment': 'off',
    'typescript/no-unsafe-call': 'off',
    'typescript/no-unsafe-member-access': 'off',
    'typescript/strict-boolean-expressions': 'off',
    'typescript/consistent-type-definitions': ['error', 'type'],
    'typescript/no-misused-promises': 'off',
    'typescript/strict-void-return': 'off',
    'typescript/prefer-regexp-exec': 'off',
    'unicorn/filename-case': 'off',
  },
  options: {
    reportUnusedDisableDirectives: 'warn',
  },
})
