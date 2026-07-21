#!/usr/bin/env tsx
/**
 * Thin cron entrypoint for sitemap regeneration (Task 55; hourly per
 * deploy/crontab). All the actual work — which routes, which output
 * files, EN/KN — lives in src/lib/seo/sitemaps.ts's `regenerateSitemaps`
 * (MINIMAL today; Task 60 expands it to full ward/candidate coverage).
 * No database, no external API — this never needs an env-gate.
 */
import { pathToFileURL } from 'node:url';
import { regenerateSitemaps } from '../src/lib/seo/sitemaps';

export async function main(): Promise<void> {
  const result = regenerateSitemaps();
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
