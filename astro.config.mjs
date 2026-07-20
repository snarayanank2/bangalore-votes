import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  site: process.env.SITE_ORIGIN ?? 'https://bangalore-votes.opencity.in',
  i18n: { locales: ['en', 'kn'], defaultLocale: 'en', routing: { prefixDefaultLocale: false } },
  security: {
    // Astro's Node standalone adapter refuses to trust ANY incoming Host
    // header (direct or X-Forwarded-Host) unless it matches an entry here —
    // without this, `security.checkOrigin`'s same-origin check (on by
    // default) always computes the server-side origin as `http://localhost`
    // and 403s every real POST, including the no-JS ward-lookup form
    // fallback (Home.astro) submitted from a real browser on either of this
    // platform's two locked-in hostnames (architecture.md §14: production +
    // staging on one Droplet, both behind the shared nginx).
    allowedDomains: [
      { hostname: 'bangalore-votes.opencity.in', protocol: 'https' },
      { hostname: 'staging.bangalore-votes.opencity.in', protocol: 'https' },
    ],
  },
});
