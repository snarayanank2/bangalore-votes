/// <reference types="astro/client" />

// `npm run typecheck` runs `astro check && tsc --noEmit`. `astro check`
// understands `.astro` imports via the Astro language-service plugin, but
// plain `tsc` does not — it needs an ambient module declaration. This is
// only exercised by test files that import `.astro` components directly for
// Astro's container API (e.g. tests/routes/layout.test.ts); Astro pages/
// layouts/components themselves never import each other this way outside
// of `.astro` files (where the compiler handles it).
declare module '*.astro' {
  import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

  const Component: AstroComponentFactory;
  export default Component;
}
