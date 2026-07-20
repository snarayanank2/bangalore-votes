#!/usr/bin/env tsx
/**
 * Build data/pincode-wards.json — the pincode → ward-shortlist static
 * lookup table src/lib/pincode.ts serves at runtime (architecture.md §6:
 * "a build artifact, not a runtime table"; PRD §5.1: a pincode spans
 * multiple wards, so lookup returns a SHORTLIST — the hedge that ships
 * even if delimitation boundaries slip, project-dependencies.md Path B).
 *
 * ── Why this script has two modes instead of one ────────────────────────
 * We have ward polygons (data/gba.geojson) but NO postal/pincode-boundary
 * polygons, and no offline reverse-geocoding source. There is no way to
 * compute genuine pincode→ward coverage from what's in this repo — that
 * requires an actual postal-boundary dataset, which is unowned dependency
 * register item §4 (project-dependencies.md §4, "Official data sources").
 * Fabricating a plausible-looking one would put made-up ward answers in
 * front of real citizens, on a platform whose whole purpose is fighting
 * election misinformation. So:
 *
 * MODE 1 — real data, once dependency register §4 supplies it:
 *   npm run build-pincode -- <path/to/mapping.(csv|json)>
 *
 *   Expected input shape — one row per (pincode, ward) pair the source
 *   data supplies (a pincode covering several wards is several rows):
 *
 *     CSV (header required):
 *       pincode,ward_id,corporation_id
 *       560001,25,5
 *       560001,3,5
 *
 *     JSON (array of the same three fields):
 *       [
 *         { "pincode": "560001", "ward_id": 25, "corporation_id": 5 },
 *         { "pincode": "560001", "ward_id": 3, "corporation_id": 5 }
 *       ]
 *
 *   `ward_id` / `corporation_id` are the SOURCE fields as they appear in
 *   data/gba.geojson's `properties` (see scripts/seed-wards.ts's header for
 *   the full field investigation) — NOT the composite `wards.id`. This
 *   script derives the composite id itself (`corporation_id * 1000 +
 *   ward_id`) and validates every derived id against the real ids present
 *   in data/gba.geojson, so a typo'd ward_id/corporation_id fails the build
 *   loudly instead of silently committing a bad row.
 *
 * MODE 2 — placeholder (the default; what's committed right now):
 *   npm run build-pincode
 *   npm run build-pincode -- --placeholder
 *
 *   No real postal-boundary data exists yet, so this mode does not invent
 *   one. It emits exactly one sample row per GBA zone (the 10 `zone_name`
 *   values across data/gba.geojson's 369 features — see seed-wards.ts's
 *   header: 2 zones per corporation, 5 corporations), each keyed by a
 *   SYNTHETIC pincode in the 9xxxxx range and mapped to a small REAL sample
 *   of that zone's actual composite ward ids.
 *
 *   The 9xxxxx range is deliberate, not arbitrary: real Indian PIN codes
 *   only ever start with digits 1-8, so no genuine citizen's real pincode
 *   can ever collide with a placeholder row. A real 560xxx/562xxx query
 *   against the committed placeholder table correctly falls through to []
 *   (out of coverage) rather than returning a plausible-but-fabricated
 *   shortlist — the safe failure mode for an anti-misinformation platform.
 *
 *   Every ward id placed in the placeholder table is still real (validated
 *   against data/gba.geojson); only the pincode KEYS are synthetic. Output
 *   carries `"__placeholder": true` and a `"__note"` explaining this;
 *   src/lib/pincode.ts's loader ignores both `__`-prefixed keys and never
 *   treats them as a pincode.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadWardRows } from './seed-wards';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const OUTPUT_PATH = join(repoRoot, 'data', 'pincode-wards.json');

// First synthetic placeholder pincode. 999001..999010 (one per zone) — the
// 9-leading digit is what keeps these out of every real Indian PIN range.
const PLACEHOLDER_PINCODE_BASE = 999001;

type MappingRow = { pincode: string; wardId: number; corporationId: number };

/** All real composite wards.id values, per data/gba.geojson (seed-wards.ts's scheme). */
function validIds(): Set<number> {
  return new Set(loadWardRows().map((r) => r.id));
}

/** Real composite ward ids grouped by zone (administrative zone_name), sorted ascending. */
function idsByZone(): Map<string, number[]> {
  const byZone = new Map<string, number[]>();
  for (const row of loadWardRows()) {
    const list = byZone.get(row.zone) ?? [];
    list.push(row.id);
    byZone.set(row.zone, list);
  }
  for (const list of byZone.values()) list.sort((a, b) => a - b);
  return byZone;
}

/** MODE 2: build the clearly-marked placeholder table (see header for rationale). */
function buildPlaceholder(): Record<string, unknown> {
  const byZone = idsByZone();
  const zones = [...byZone.keys()].sort();

  const table: Record<string, unknown> = {};
  zones.forEach((zone, i) => {
    const ids = byZone.get(zone)!;
    // Sample up to 3 ward ids spread across the zone (first / middle / last)
    // rather than dumping the whole zone in — a real pincode shortlist is a
    // handful of wards, not dozens.
    const sample =
      ids.length <= 3 ? ids : [ids[0], ids[Math.floor(ids.length / 2)], ids[ids.length - 1]];
    const pincode = String(PLACEHOLDER_PINCODE_BASE + i);
    table[pincode] = sample;
  });

  table.__placeholder = true;
  table.__note =
    'PLACEHOLDER DATA — not a real pincode->ward mapping. No official ' +
    'postal-boundary dataset exists in this repo yet (project-dependencies.md ' +
    '§4, "Official data sources", unowned). These pincode KEYS are synthetic ' +
    '(999001-999010, one per GBA zone): real Indian PIN codes never start ' +
    'with 9, so no genuine citizen pincode can ever match one of these rows ' +
    '-- a real 560xxx/562xxx pincode correctly returns [] (out of coverage) ' +
    'until this table is regenerated from real data via ' +
    '`npm run build-pincode -- <mapping file>` (see this script\'s header ' +
    'for the expected CSV/JSON input format). The WARD ids in each row are ' +
    'real (validated against data/gba.geojson), sampled from one real GBA ' +
    'zone, purely to exercise the wardsForPincode() lookup path end-to-end.';

  return table;
}

function parseCsv(content: string): MappingRow[] {
  const lines = content.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = lines[0].split(',').map((h) => h.trim());
  const pincodeIdx = header.indexOf('pincode');
  const wardIdIdx = header.indexOf('ward_id');
  const corporationIdIdx = header.indexOf('corporation_id');
  if (pincodeIdx === -1 || wardIdIdx === -1 || corporationIdIdx === -1) {
    throw new Error(
      'build-pincode-table: CSV must have a header row with columns pincode,ward_id,corporation_id',
    );
  }

  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    return {
      pincode: cols[pincodeIdx]?.trim() ?? '',
      wardId: Number(cols[wardIdIdx]),
      corporationId: Number(cols[corporationIdIdx]),
    };
  });
}

function parseJson(content: string): MappingRow[] {
  const parsed = JSON.parse(content) as Array<{
    pincode: string | number;
    ward_id: number;
    corporation_id: number;
  }>;
  if (!Array.isArray(parsed)) {
    throw new Error(
      'build-pincode-table: JSON input must be an array of { pincode, ward_id, corporation_id }',
    );
  }
  return parsed.map((r) => ({
    pincode: String(r.pincode),
    wardId: Number(r.ward_id),
    corporationId: Number(r.corporation_id),
  }));
}

/** MODE 1: build the table from an external pincode->ward mapping file. */
function buildFromMappingFile(inputPath: string): Record<string, unknown> {
  const content = readFileSync(inputPath, 'utf8');
  const rows = inputPath.endsWith('.json') ? parseJson(content) : parseCsv(content);

  const valid = validIds();
  const table: Record<string, number[]> = {};

  for (const row of rows) {
    if (!/^\d{6}$/.test(row.pincode)) {
      throw new Error(`build-pincode-table: invalid pincode "${row.pincode}" (must be 6 digits)`);
    }
    if (!Number.isInteger(row.wardId) || !Number.isInteger(row.corporationId)) {
      throw new Error(
        `build-pincode-table: non-integer ward_id/corporation_id for pincode ${row.pincode}`,
      );
    }

    const compositeId = row.corporationId * 1000 + row.wardId;
    if (!valid.has(compositeId)) {
      throw new Error(
        `build-pincode-table: ward_id=${row.wardId} corporation_id=${row.corporationId} ` +
          `(composite id ${compositeId}) matches no feature in data/gba.geojson`,
      );
    }

    const existing = table[row.pincode] ?? [];
    if (!existing.includes(compositeId)) existing.push(compositeId);
    table[row.pincode] = existing;
  }

  for (const ids of Object.values(table)) ids.sort((a, b) => a - b);
  return table;
}

function main(): void {
  const arg = process.argv[2];
  const isPlaceholder = !arg || arg === '--placeholder';
  const table = isPlaceholder ? buildPlaceholder() : buildFromMappingFile(arg);

  writeFileSync(OUTPUT_PATH, JSON.stringify(table, null, 2) + '\n', 'utf8');

  const pincodeCount = Object.keys(table).filter((k) => !k.startsWith('__')).length;
  console.log(`build-pincode-table: wrote ${pincodeCount} pincode(s) to ${OUTPUT_PATH}`);
  if (isPlaceholder) {
    console.log(
      'MODE: placeholder (synthetic 9xxxxx keys, real ward ids). ' +
        'Not real pincode data — see the __note field or this script\'s header.',
    );
  } else {
    console.log(`MODE: real mapping file (${arg})`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { buildPlaceholder, buildFromMappingFile, parseCsv, parseJson };
