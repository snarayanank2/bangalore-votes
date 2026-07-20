/**
 * POST /api/ward-lookup — address → single ward, or pincode → shortlist
 * (PRD §5.1; architecture.md §7 endpoint table, §11 degradation).
 *
 * Two mutually-exclusive input modes in one endpoint:
 *  - `{ address }` — resolves via src/lib/geocode.ts (Google geocode,
 *    cached, budget-guarded, point-in-polygon). "Out of coverage" is a
 *    normal 200 answer, not an error (PRD §5.1). Every non-`ward` result
 *    from the geocoder that ISN'T out-of-coverage degrades the client to
 *    the pincode path via `{result:'use_pincode', reason}` — this endpoint
 *    never 500s just because Google/the budget misbehaved.
 *  - `{ pincode }` — resolves via src/lib/pincode.ts, a pure in-memory
 *    lookup over a committed build artifact. NEVER calls the geocoder and
 *    NEVER spends geocode budget — this is the low-cost hedge path.
 *
 * Always `cache-control: no-store` (per-citizen lookup, not cacheable) and
 * never sets a cookie — this is a public, unauthenticated endpoint and
 * must not become a cache-key or session hazard.
 *
 * PRIVACY: the raw address is never passed to logEvent — only the mode and
 * result kind (see src/lib/log.ts).
 */
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { wards } from '../../db/schema';
import { lookupWardByAddress } from '../../lib/geocode';
import { wardsForPincode } from '../../lib/pincode';
import { logEvent } from '../../lib/log';

const bodySchema = z
  .object({
    address: z.string().trim().min(1).optional(),
    pincode: z.string().trim().min(1).optional(),
  })
  .refine((b) => Boolean(b.address) !== Boolean(b.pincode), {
    message: 'Provide exactly one of address or pincode',
  });

const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' } as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

type WardRow = { id: number; nameEn: string; nameKn: string; corporation: string };

function wardPayload(row: WardRow) {
  return { id: row.id, nameEn: row.nameEn, nameKn: row.nameKn, corporation: row.corporation };
}

export const POST: APIRoute = async ({ request }) => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'provide exactly one of address or pincode' }, 400);
  }

  const { address, pincode } = parsed.data;

  if (pincode !== undefined) {
    // Pincode path never geocodes and never touches the geocode budget.
    const wardIds = wardsForPincode(pincode);

    if (wardIds.length === 0) {
      logEvent('ward_lookup', { mode: 'pincode', result: 'out_of_coverage' });
      return json({ result: 'out_of_coverage' });
    }

    const rows = await db
      .select()
      .from(wards)
      .where(inArray(wards.id, wardIds))
      .orderBy(asc(wards.id));

    logEvent('ward_lookup', { mode: 'pincode', result: 'shortlist', count: rows.length });
    return json({ result: 'shortlist', wards: rows.map(wardPayload) });
  }

  // address path
  const lookup = await lookupWardByAddress(address!);

  switch (lookup.kind) {
    case 'ward': {
      const [row] = await db.select().from(wards).where(eq(wards.id, lookup.wardId));
      if (!row) {
        // Data-integrity mismatch (a ward id the geocoder resolved to isn't
        // seeded) — degrade the caller to pincode rather than surface a
        // 500 for what is, to the citizen, a lookup problem.
        logEvent('ward_lookup', {
          mode: 'address',
          result: 'error',
          reason: 'ward_not_in_db',
          wardId: lookup.wardId,
        });
        return json({ result: 'use_pincode', reason: 'failed' });
      }
      logEvent('ward_lookup', { mode: 'address', result: 'ward', wardId: row.id });
      return json({ result: 'ward', ward: wardPayload(row) });
    }
    case 'out_of_coverage':
      logEvent('ward_lookup', { mode: 'address', result: 'out_of_coverage' });
      return json({ result: 'out_of_coverage' });
    case 'ambiguous':
      logEvent('ward_lookup', { mode: 'address', result: 'use_pincode', reason: 'ambiguous' });
      return json({ result: 'use_pincode', reason: 'ambiguous' });
    case 'budget_exhausted':
      logEvent('ward_lookup', { mode: 'address', result: 'use_pincode', reason: 'budget' });
      return json({ result: 'use_pincode', reason: 'budget' });
    case 'failed':
      logEvent('ward_lookup', { mode: 'address', result: 'use_pincode', reason: 'failed' });
      return json({ result: 'use_pincode', reason: 'failed' });
  }
};
