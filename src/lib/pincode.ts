/**
 * Pincode → ward shortlist lookup (PRD §5.1; architecture.md §6).
 *
 * A pincode spans multiple wards, so lookup returns a SHORTLIST of
 * candidate wards to pick from (unlike address lookup, which resolves to a
 * single ward via src/lib/geo.ts's point-in-polygon). Pincode lookup needs
 * no boundary polygons, which is exactly why PRD §5.1 / project-dependencies
 * Path B treat it as the hedge that ships even if delimitation boundary
 * data (dependency register §4.1) slips.
 *
 * The runtime source is the COMMITTED data/pincode-wards.json —
 * "a build artifact, not a runtime table" (architecture.md §6). It is
 * produced by scripts/build-pincode-table.ts and regenerated only via a
 * reviewable PR, never written to at request time. See that script's
 * header for exactly how the committed file was produced, and why it is
 * currently a clearly-marked PLACEHOLDER pending official postal-boundary
 * data (dependency register §4, project-dependencies.md).
 *
 * The JSON may carry `__`-prefixed metadata keys (currently `__placeholder`,
 * `__note`) alongside real pincode keys. Those are never pincodes and are
 * always ignored here — both when the table is loaded and when a caller
 * passes one directly to wardsForPincode (it fails the 6-digit-numeric
 * format check regardless).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/lib/pincode.ts -> src/lib -> src -> project root -> data/pincode-wards.json
const DEFAULT_DATA_PATH = path.join(__dirname, '..', '..', 'data', 'pincode-wards.json');

const PINCODE_RE = /^\d{6}$/;

// Module-level cache. Populated on first call to wardsForPincode(); loaded
// once per process, mirroring src/lib/geo.ts's loadWardPolygons() pattern
// (this table is small enough to not need an explicit async loader).
let cachedTable: Record<string, number[]> | null = null;

function loadTable(): Record<string, number[]> {
  if (cachedTable !== null) return cachedTable;

  const raw = JSON.parse(readFileSync(DEFAULT_DATA_PATH, 'utf8')) as Record<string, unknown>;

  const table: Record<string, number[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('__')) continue; // metadata (__placeholder, __note, ...), not a pincode
    if (!Array.isArray(value)) continue; // defensive: ignore any malformed row rather than throw
    table[key] = value.map((id) => Number(id));
  }

  cachedTable = table;
  return table;
}

/**
 * Return the shortlist of composite `wards.id` values (the
 * `corporation_id * 1000 + ward_id` scheme shared with scripts/seed-wards.ts
 * and src/lib/geo.ts) that a 6-digit pincode maps to, per the committed
 * data/pincode-wards.json.
 *
 * An invalid input (wrong length, non-digit characters, empty, or a
 * non-string value) and a syntactically valid but unknown pincode both
 * return `[]` — "out of coverage is an answer, not an error" (PRD §5.1).
 * This function does not distinguish the two cases; the caller decides how
 * to phrase that to the citizen.
 */
export function wardsForPincode(pin: string): number[] {
  if (typeof pin !== 'string' || !PINCODE_RE.test(pin)) return [];

  const table = loadTable();
  return table[pin] ?? [];
}
