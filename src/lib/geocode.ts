/**
 * Server-side address → ward lookup via the Google Geocoding API.
 *
 * ============================================================================
 * GOOGLE MAPS PLATFORM TERMS CONSTRAINT — READ BEFORE CHANGING THIS FILE
 * ============================================================================
 * Dependency register §6.4: Google Maps Platform's terms restrict using
 * Google Maps content — geocoding results included — in an application
 * that displays a NON-GOOGLE map. This platform's map is MapLibre (see
 * src/lib/geo.ts), which is exactly the pattern that restriction targets.
 * The way this stays compliant is that geocoding runs SERVER-SIDE and
 * returns A WARD, NEVER COORDINATES — the cache (`geocode_cache`, see
 * src/db/schema.ts) stores normalized-address → ward-ID ONLY, the
 * platform's own derived conclusion, never Google's coordinates or any
 * other part of its response content (architecture.md §13, "cost
 * amplification").
 *
 * Concretely: `lookupWardByAddress` below MUST NOT return a lat/lng to its
 * caller, and MUST NOT persist a lat/lng anywhere (cache row, log line,
 * etc). The Google response's `geometry.location` is read into a local
 * variable, fed straight into `wardForPoint`, and discarded. A future
 * change that "helpfully" returns the point, or logs the raw Google
 * response, breaks this compliance line — don't.
 * ============================================================================
 *
 * A daily geocode budget (architecture.md §13; dependency register §6.5)
 * degrades the caller's endpoint to pincode lookup (src/lib/pincode.ts)
 * once exhausted — see the `budget_exhausted` result below, backed by
 * src/lib/budgets.ts's shared counter.
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { geocodeCache } from '../db/schema';
import { consumeBudget } from './budgets';
import { wardForPoint } from './geo';

export type WardLookupResult =
  | { kind: 'ward'; wardId: number }
  | { kind: 'out_of_coverage' }
  | { kind: 'ambiguous' }
  | { kind: 'budget_exhausted' }
  | { kind: 'failed' };

/** Daily cap on Google Geocoding API calls (architecture.md §13 / dependency §6.5). */
export const GEOCODE_DAILY_BUDGET = Number(process.env.GEOCODE_DAILY_BUDGET ?? 2000);

const GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

const BENGALURU_RE = /bengaluru|bangalore/i;

/**
 * Deterministic normalization used as the geocode_cache primary key: trim,
 * collapse internal whitespace, lowercase, then append ", bengaluru" unless
 * the address already names Bengaluru/Bangalore (case-insensitively). This
 * keeps "MG Road", "  mg   road ", and "MG Road, Bengaluru" all resolving to
 * the same cache row and the same single API call.
 */
export function normalizeAddress(address: string): string {
  const collapsed = address.trim().replace(/\s+/g, ' ').toLowerCase();
  if (BENGALURU_RE.test(collapsed)) return collapsed;
  return `${collapsed}, bengaluru`;
}

type GoogleGeocodeResult = {
  geometry?: { location?: { lat: number; lng: number } };
  partial_match?: boolean;
};

type GoogleGeocodeResponse = {
  status: string;
  results?: GoogleGeocodeResult[];
};

function buildGeocodeUrl(normalizedAddress: string): string {
  const url = new URL(GEOCODE_ENDPOINT);
  url.searchParams.set('address', normalizedAddress);
  url.searchParams.set('components', 'locality:Bengaluru|administrative_area:Karnataka|country:IN');
  url.searchParams.set('key', process.env.GOOGLE_GEOCODING_API_KEY ?? '');
  return url.toString();
}

/** Cache a resolved lookup: normalized address -> ward id, or null for "known out of coverage". */
async function cacheResult(normalizedAddress: string, wardId: number | null): Promise<void> {
  await db.insert(geocodeCache).values({ normalizedAddress, wardId }).onConflictDoNothing();
}

/**
 * Resolve a free-text address to a ward. Cache-first, budget-guarded,
 * never surfaces or stores coordinates (see the ToS notice at the top of
 * this file).
 *
 * Order of operations:
 *  1. Normalize (cache key).
 *  2. Cache hit -> return immediately. No API call, no budget spend.
 *  3. Cache miss -> consume one unit of today's geocode budget. Exhausted
 *     -> `budget_exhausted` WITHOUT calling Google (caller degrades to
 *     pincode lookup).
 *  4. Call Google Geocoding, server-side only. ZERO_RESULTS is cached as
 *     "out of coverage" (null). Multiple results, or a single result Google
 *     itself flags as a `partial_match`, are `ambiguous` and NOT cached
 *     (the answer might change on a retry with a clearer address). A
 *     single confident result is resolved to a ward via in-memory
 *     point-in-polygon (src/lib/geo.ts) and that ward id (or null) is
 *     cached. Any network error or a non-OK/non-ZERO_RESULTS status is
 *     `failed` and NOT cached (transient failures shouldn't calcify into a
 *     wrong cache entry).
 */
export async function lookupWardByAddress(address: string): Promise<WardLookupResult> {
  const normalizedAddress = normalizeAddress(address);

  const [cached] = await db
    .select()
    .from(geocodeCache)
    .where(eq(geocodeCache.normalizedAddress, normalizedAddress));

  if (cached) {
    return cached.wardId !== null ? { kind: 'ward', wardId: cached.wardId } : { kind: 'out_of_coverage' };
  }

  const withinBudget = await consumeBudget('geocode', GEOCODE_DAILY_BUDGET);
  if (!withinBudget) {
    return { kind: 'budget_exhausted' };
  }

  let response: GoogleGeocodeResponse;
  try {
    const res = await fetch(buildGeocodeUrl(normalizedAddress));
    if (!res.ok) {
      return { kind: 'failed' };
    }
    response = (await res.json()) as GoogleGeocodeResponse;
  } catch {
    return { kind: 'failed' };
  }

  if (response.status === 'ZERO_RESULTS') {
    await cacheResult(normalizedAddress, null);
    return { kind: 'out_of_coverage' };
  }

  if (response.status !== 'OK') {
    return { kind: 'failed' };
  }

  const results = response.results ?? [];
  if (results.length !== 1 || results[0].partial_match === true) {
    return { kind: 'ambiguous' };
  }

  const location = results[0].geometry?.location;
  if (!location) {
    return { kind: 'failed' };
  }

  // `lat`/`lng` live only in this local scope: fed to wardForPoint and
  // discarded. Never added to the returned object, never passed to
  // cacheResult. See the ToS notice at the top of this file.
  const { lat, lng } = location;
  const wardId = wardForPoint(lat, lng);

  await cacheResult(normalizedAddress, wardId);
  return wardId !== null ? { kind: 'ward', wardId } : { kind: 'out_of_coverage' };
}
