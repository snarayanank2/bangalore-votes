import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['prototype/**', 'node_modules/**', 'dist/**'],
  },
});
