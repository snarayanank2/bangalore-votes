import { getViteConfig } from 'astro/config';

// Uses Astro's `getViteConfig` (rather than plain vitest `defineConfig`) so
// that `.astro` files can be imported directly in tests — needed for
// tests/routes/layout.test.ts, which renders Base.astro/AppBar.astro/etc.
// via Astro's experimental container API. This still produces a normal
// Vite/vitest config for every other (plain .ts) test file.
export default getViteConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['prototype/**', 'node_modules/**', 'dist/**'],
  },
});
