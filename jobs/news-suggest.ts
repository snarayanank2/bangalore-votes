#!/usr/bin/env tsx
/**
 * Thin cron entrypoint for the news-link suggestion pipeline (Task 55;
 * the actual logic — the domain allowlist match, the per-query budget
 * gate, the dedupe insert — lives in src/lib/news-suggest.ts, where it's
 * unit-tested against an INJECTED search function. This file's only job
 * is to build the real, network-touching pieces (the Google Programmable
 * Search HTTP call, the allowlist file, the daily budget) and hand them
 * to `suggestNews`.
 *
 * ENV-GATED, same graceful-skip posture as src/lib/send/sendgrid.ts: if
 * EITHER `GOOGLE_SEARCH_API_KEY` or `GOOGLE_SEARCH_CX` is unset, this logs
 * one line and exits 0 — no query is attempted, no candidate is touched.
 * This is the expected state until Programmable Search is provisioned,
 * not a degraded fallback.
 *
 * Cadence: every ~2 days (deploy/crontab) — architecture §7's "a few
 * hundred queries/day at a 2-3 day refresh" budget shape.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { suggestNews, type NewsSearchResult } from '../src/lib/news-suggest';
import { captureException } from '../src/lib/logger';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(SCRIPT_DIR, '..');
const ALLOWLIST_PATH = path.join(REPO_ROOT, 'data/news-domains.json');

/** Default matches architecture §7's "a few hundred queries/day" shape at ~1,500 contesting candidates city-wide, with headroom. */
const DEFAULT_NEWS_QUERY_DAILY_BUDGET = 500;

const GOOGLE_SEARCH_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

/** Standard Google Programmable Search JSON API response shape — https://developers.google.com/custom-search/v1/reference/rest/v1/Search#Result. Assumed, not verified against a live account; the env-gate means this no-ops safely until GOOGLE_SEARCH_API_KEY/GOOGLE_SEARCH_CX are configured and this can be checked for real. */
interface GoogleSearchResponse {
  items?: { title?: string; link?: string }[];
}

function buildGoogleSearch(apiKey: string, cx: string): (query: string) => Promise<NewsSearchResult[]> {
  return async (query: string): Promise<NewsSearchResult[]> => {
    const url = new URL(GOOGLE_SEARCH_ENDPOINT);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', cx);
    url.searchParams.set('q', query);

    const res = await fetch(url.toString());
    if (!res.ok) {
      return [];
    }
    const body = (await res.json()) as GoogleSearchResponse;
    return (body.items ?? [])
      .filter((item): item is { title: string; link: string } => Boolean(item.title && item.link))
      .map((item) => ({ title: item.title, link: item.link }));
  };
}

export async function main(): Promise<void> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx) {
    console.log('news-suggest: search not configured, skipping');
    return;
  }

  const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf-8')) as string[];
  const budgetLimit = Number(process.env.NEWS_QUERY_DAILY_BUDGET ?? DEFAULT_NEWS_QUERY_DAILY_BUDGET);

  const summary = await suggestNews({
    search: buildGoogleSearch(apiKey, cx),
    allowlist,
    budgetLimit,
  });

  console.log(JSON.stringify({ event: 'news_suggest_run_summary', ...summary }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => {
      // Same reasoning as jobs/run-campaign.ts: the shared DB pool
      // (src/db/client.ts) keeps the event loop alive past a one-shot
      // cron job's natural end, so this must exit explicitly.
      process.exit(0);
    })
    .catch((err) => {
      captureException(err);
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
