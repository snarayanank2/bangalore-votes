#!/usr/bin/env tsx
/**
 * Thin cron entrypoint for sitemap regeneration (Task 55/57; hourly per
 * deploy/crontab). All the actual work — which routes, which output
 * files, EN/KN, ward/candidate coverage with real lastmod — lives in
 * src/lib/seo/sitemaps.ts's `regenerateSitemaps`. It queries the DB (same
 * always-on `DATABASE_URL` dependency as the rest of the app, so no
 * separate env-gate is needed here), which is why this awaits it.
 */
import { pathToFileURL } from 'node:url';
import { regenerateSitemaps } from '../src/lib/seo/sitemaps';

export async function main(): Promise<void> {
  const result = await regenerateSitemaps();
  console.log(JSON.stringify({ event: 'regen_sitemaps_run_summary', ...result }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
