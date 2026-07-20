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

// Populated by src/middleware.ts (Task 26) on every request — the single
// session/CSRF/authorization enforcement point (architecture.md §7, §13).
declare namespace App {
  interface Locals {
    /** 'kn' for any /kn/* URL, 'en' otherwise (mirrors the URL, not a saved preference). */
    lang: import('./i18n').Lang;
    /** null for anonymous visitors; never touched on publicly-cached anonymous GETs. */
    session: { userId: number; role: import('./lib/session').Role } | null;
    /** Currently identical to `session` — kept as a separate field per the middleware's documented locals shape, in case it grows a fuller user row later. */
    user: { userId: number; role: import('./lib/session').Role } | null;
    /** Synchronizer CSRF token for this session (''  for anonymous requests) — embed as a hidden `csrf_token` field in server-rendered forms under /account, /curator, /admin (src/lib/csrf.ts). */
    csrfToken: string;
    /** Per-request nonce (base64) for CSP script-src allowlisting (architecture §13; nginx/Base wiring is a later task). */
    cspNonce: string;
  }
}
