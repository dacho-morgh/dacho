import { defineConfig } from 'oxfmt'

export default defineConfig({
  printWidth: 100,
  semi: false,
  singleQuote: true,
  ignorePatterns: ['migrations/*', '*.md', 'src/payload-types.ts'],
  sortImports: {
    ignoreCase: true,
    newlinesBetween: false,
    order: 'asc',
  },
  sortTailwindcss: {
    stylesheet: 'src/app/(frontend)/globals.css',
  },
})
