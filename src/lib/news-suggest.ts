/**
 * News-link suggestion pipeline (Task 55; PRD §5.2 "News & coverage";
 * architecture §7 "News-link suggestions"). A `jobs` task (jobs/news-suggest.ts)
 * runs this every 2-3 days, N->E, over every filed/contesting candidate:
 * one Google Programmable Search query per candidate (name + ward), kept
 * results filtered through a repo-committed domain allowlist
 * (data/news-domains.json — the neutrality control, reviewable in a PR
 * like any other change), stored as `candidate_news_links` suggestions
 * (`origin: 'auto'`, `status: 'suggested'`). Suggestions render ONLY on
 * the curator editor (src/lib/news.ts's module docstring) — nothing here
 * publishes anything.
 *
 * WHY THE SEARCH FUNCTION IS INJECTED: this module never calls `fetch`
 * itself. The real Google Programmable Search HTTP call lives in
 * jobs/news-suggest.ts's `googleSearch`, built only when both
 * `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_CX` are set (graceful-skip
 * posture, same as src/lib/send/sendgrid.ts when `SENDGRID_API_KEY` is
 * absent). Keeping the HTTP call out of this file, and taking `search` as
 * a plain injected function, is what lets tests/unit/news-suggest.test.ts
 * assert the ONLY network-shaped call the whole suggestion path makes is
 * that one injected function — never a `fetch` to an article URL. This
 * is also *why* it's safe: the suggestion pipeline stores exactly the
 * title+link the search API returns, and never fetches the article page
 * itself, so it is not a second SSRF surface (architecture §7).
 *
 * ALLOWLIST MATCH RULE (the one place this decision is made — read before
 * touching `isAllowedDomain`): a result's domain is kept iff it equals an
 * allowlist entry OR is a strict, dot-anchored SUBDOMAIN of one
 * (`x.endsWith('.' + allowed)`). This is intentionally NOT a bare
 * substring/suffix check — `notthehindu.com` and `thehindu.com.evil.com`
 * must never match `thehindu.com`, and both are rejected under this rule
 * because neither equals `thehindu.com` nor ends with the literal string
 * `.thehindu.com`. A leading `www.` is stripped before comparison so
 * `www.thehindu.com` and `thehindu.com` are treated as the same outlet.
 *
 * BUDGET: `consumeBudget('news_query', budgetLimit)` (src/lib/budgets.ts)
 * is consulted BEFORE every search query, one call per candidate. The
 * moment it returns `false` (today's budget is exhausted), the loop stops
 * immediately — no further `search` calls, no further stores — and the
 * run's summary reports `budgetExhausted: true`. Budget consumption
 * itself, not this module, is the ops-alarm signal (budgets.ts docstring).
 *
 * DEDUPE: inserts use `onConflictDoNothing` on the `news_link_uq`
 * (candidateId, url) unique index, so re-running this job (its whole
 * point, every 2-3 days) never creates duplicate rows for a link it's
 * already suggested.
 */
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { candidateNewsLinks, candidates, wards } from '../db/schema';
import { consumeBudget } from './budgets';

const ACTIVE_CANDIDATE_STATUSES = ['filed', 'contesting'] as const;

/** The shape the search API returns per hit — title + link ONLY, exactly what the API gives us; nothing here ever fetches the link itself. */
export interface NewsSearchResult {
  title: string;
  link: string;
}

/** Injected: the Google Programmable Search call (or a test double). See module docstring for why this is the ONLY network-shaped call this module makes. */
export type NewsSearchFn = (query: string) => Promise<NewsSearchResult[]>;

export interface SuggestNewsParams {
  search: NewsSearchFn;
  allowlist: string[];
  budgetLimit: number;
}

export interface SuggestNewsSummary {
  candidatesConsidered: number;
  queriesRun: number;
  budgetExhausted: boolean;
  resultsSeen: number;
  resultsAllowed: number;
  resultsInserted: number;
}

/**
 * Extracts the lowercase hostname from a search result's `link`, with a
 * leading `www.` stripped. Returns `null` for a link that doesn't parse
 * as an absolute URL — such a result is dropped, never stored (defensive:
 * the search API is expected to return well-formed links, but this is
 * untrusted external input all the same).
 */
function extractDomain(link: string): string | null {
  try {
    const hostname = new URL(link).hostname.toLowerCase();
    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  } catch {
    return null;
  }
}

/** See module docstring's ALLOWLIST MATCH RULE section. */
export function isAllowedDomain(domain: string, allowlist: string[]): boolean {
  return allowlist.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}

/**
 * Runs one suggestion pass over every filed/contesting candidate. Never
 * throws on a per-candidate/per-result basis — a malformed link is just
 * dropped (see `extractDomain`); the only early exit is budget
 * exhaustion, which is a normal, expected stop, not an error.
 */
export async function suggestNews(params: SuggestNewsParams): Promise<SuggestNewsSummary> {
  const { search, allowlist, budgetLimit } = params;

  const activeCandidates = await db
    .select({
      id: candidates.id,
      nameEn: candidates.nameEn,
      wardNameEn: wards.nameEn,
    })
    .from(candidates)
    .innerJoin(wards, eq(candidates.wardId, wards.id))
    .where(inArray(candidates.status, ACTIVE_CANDIDATE_STATUSES));

  const summary: SuggestNewsSummary = {
    candidatesConsidered: activeCandidates.length,
    queriesRun: 0,
    budgetExhausted: false,
    resultsSeen: 0,
    resultsAllowed: 0,
    resultsInserted: 0,
  };

  for (const candidate of activeCandidates) {
    const withinBudget = await consumeBudget('news_query', budgetLimit);
    if (!withinBudget) {
      summary.budgetExhausted = true;
      break;
    }

    summary.queriesRun += 1;
    const query = `${candidate.nameEn} ${candidate.wardNameEn} GBA ward corporator candidate`;
    const results = await search(query);
    summary.resultsSeen += results.length;

    for (const result of results) {
      const domain = extractDomain(result.link);
      if (!domain || !isAllowedDomain(domain, allowlist)) {
        continue;
      }
      summary.resultsAllowed += 1;

      const inserted = await db
        .insert(candidateNewsLinks)
        .values({
          candidateId: candidate.id,
          url: result.link,
          title: result.title,
          domain,
          origin: 'auto',
          status: 'suggested',
        })
        .onConflictDoNothing({ target: [candidateNewsLinks.candidateId, candidateNewsLinks.url] })
        .returning({ id: candidateNewsLinks.id });

      if (inserted.length > 0) {
        summary.resultsInserted += 1;
      }
    }
  }

  return summary;
}
