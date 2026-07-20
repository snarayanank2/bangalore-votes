import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { wardsForPincode } from '../../src/lib/pincode';

const repoRoot = path.join(__dirname, '..', '..');
const TABLE_PATH = path.join(repoRoot, 'data', 'pincode-wards.json');
const GEOJSON_PATH = path.join(repoRoot, 'data', 'gba.geojson');

function loadRawTable(): Record<string, unknown> {
  return JSON.parse(readFileSync(TABLE_PATH, 'utf8')) as Record<string, unknown>;
}

/** The same composite-id formula as scripts/seed-wards.ts / src/lib/geo.ts. */
function validWardIds(): Set<number> {
  const geojson = JSON.parse(readFileSync(GEOJSON_PATH, 'utf8')) as {
    features: Array<{ properties: Record<string, unknown> }>;
  };
  return new Set(
    geojson.features.map((f) => Number(f.properties.corporation_id) * 1000 + Number(f.properties.ward_id)),
  );
}

describe('wardsForPincode', () => {
  it('returns [] for malformed input: non-digit string', () => {
    expect(wardsForPincode('abcde')).toEqual([]);
  });

  it('returns [] for a 5-digit string', () => {
    expect(wardsForPincode('12345')).toEqual([]);
  });

  it('returns [] for a 7-digit string', () => {
    expect(wardsForPincode('1234567')).toEqual([]);
  });

  it('returns [] for an empty string', () => {
    expect(wardsForPincode('')).toEqual([]);
  });

  it('returns [] for a string with an embedded space', () => {
    expect(wardsForPincode('56 001')).toEqual([]);
  });

  it('returns [] for null/undefined coerced through the string param', () => {
    expect(wardsForPincode(null as unknown as string)).toEqual([]);
    expect(wardsForPincode(undefined as unknown as string)).toEqual([]);
  });

  it('returns [] for an unknown-but-valid 6-digit pincode not in the table', () => {
    // 000000 is a syntactically valid 6-digit string but appears in no real
    // or placeholder row of the committed table.
    expect(wardsForPincode('000000')).toEqual([]);
  });

  it('never returns rows for __-prefixed metadata keys, even if queried directly', () => {
    const raw = loadRawTable();
    const metaKeys = Object.keys(raw).filter((k) => k.startsWith('__'));
    expect(metaKeys.length).toBeGreaterThan(0); // the committed table does carry metadata
    for (const key of metaKeys) {
      // A metadata key is never a valid 6-digit pincode string, so it must
      // already fail validation and return [] regardless of table contents.
      expect(wardsForPincode(key)).toEqual([]);
    }
  });

  it('returns the composite ward ids for a pincode present in the committed table', () => {
    const raw = loadRawTable();
    const realPincodes = Object.keys(raw).filter((k) => !k.startsWith('__'));
    expect(realPincodes.length).toBeGreaterThan(0);

    const sample = realPincodes[0];
    const expected = raw[sample] as number[];
    const result = wardsForPincode(sample);

    expect(result).toEqual(expected);
    expect(result.length).toBeGreaterThan(0);
    for (const id of result) {
      expect(typeof id).toBe('number');
    }
  });

  it('every id in the committed table is a real wards.id derived from data/gba.geojson', () => {
    const raw = loadRawTable();
    const valid = validWardIds();

    for (const [key, value] of Object.entries(raw)) {
      if (key.startsWith('__')) continue;
      expect(Array.isArray(value)).toBe(true);
      for (const id of value as unknown[]) {
        expect(typeof id).toBe('number');
        expect(valid.has(id as number)).toBe(true);
      }
    }
  });

  it('the committed table is explicitly marked as a placeholder pending official data', () => {
    const raw = loadRawTable();
    // This is a hard requirement, not an implementation detail: no real
    // postal-boundary data exists in this repo (dependency register §4), so
    // the committed artifact must not silently look authoritative.
    expect(raw.__placeholder).toBe(true);
    expect(typeof raw.__note).toBe('string');
    expect((raw.__note as string).length).toBeGreaterThan(0);
  });
});
