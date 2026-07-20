/**
 * WardMap — MapLibre GL JS island rendering a single ward's boundary
 * polygon (IA §3.2, design-system.md §8: "Maps (ward boundary, booth
 * locator) use a desaturated gray basemap with the boundary in
 * `--oc-forest` at 2px and `--forest-tint` fill at 30% — no red pins, no
 * party-colored anything on maps").
 *
 * BASEMAP NOTE: design-system.md §8 asks for a "desaturated gray basemap".
 * We have no tile-provider key/vendor wired up yet (architecture.md §3/§6
 * lists MapLibre as the decided renderer but doesn't provision a tile
 * source) — provisioning one is a deploy-time concern for a later task.
 * Until then this renders a plain neutral background layer (no raster
 * tiles) plus the ward polygon, which satisfies the boundary-styling rules
 * above without inventing a tile dependency this task wasn't scoped to add.
 *
 * Colors are read off the page's own CSS custom properties at init time
 * (`readMapColors`) rather than hardcoded — tests/unit/tokens.test.ts bans
 * hex color literals anywhere under src/ except tokens.css, and this keeps
 * the map in sync with the design system's single source of truth for
 * color. No markers/pins are ever added, and nothing here is keyed to
 * party/candidate data — this island only ever draws one neutral polygon.
 *
 * Lazy + progressive enhancement:
 *   - `initWardMap` wires every `[data-ward-map]` container but only
 *     constructs the actual MapLibre map once the container scrolls into
 *     view (IntersectionObserver), falling back to an immediate mount if
 *     IntersectionObserver isn't available.
 *   - The container's markup already carries a static fallback text ("Map
 *     of ward boundary" — Ward.astro) for no-JS visitors. If maplibre-gl,
 *     the geojson fetch, or the feature lookup fails for any reason, this
 *     module simply returns without touching the container — the fallback
 *     text is left exactly as the server rendered it. A working map is a
 *     bonus, never a requirement for the rest of the ward page to work.
 *
 * `maplibre-gl` (and its CSS) is imported only here — Ward.astro is the
 * only page that imports this module, so pages with no map never pull
 * MapLibre into their bundle.
 */
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ---------------------------------------------------------------------------
// Minimal GeoJSON shapes (we only ever read `properties.id` and
// `geometry.coordinates` — no need for the full @types/geojson surface).
// ---------------------------------------------------------------------------

export interface GeoJSONFeatureLike {
  type: 'Feature';
  properties: Record<string, unknown> | null;
  geometry: { type: string; coordinates: unknown };
}

export interface GeoJSONCollectionLike {
  type: 'FeatureCollection';
  features: GeoJSONFeatureLike[];
}

type Position = [number, number, ...number[]];
type LngLatBounds = [[number, number], [number, number]];

// ---------------------------------------------------------------------------
// Pure helpers — exported for direct unit testing (no MapLibre/WebGL/fetch
// involved). See tests/unit/ward-map-island.test.ts.
// ---------------------------------------------------------------------------

/**
 * Splits a `wardBoundaryUrl()`-shaped URL (`/data/gba.geojson#<ref>` — see
 * src/lib/geo.ts) into its fetchable path and the feature ref to look up
 * once fetched. A URL with no `#` is returned as-is with an empty ref.
 */
export function parseBoundaryUrl(url: string): { path: string; ref: string } {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return { path: url, ref: '' };
  return { path: url.slice(0, hashIndex), ref: url.slice(hashIndex + 1) };
}

/**
 * Finds the feature in `collection` whose `properties.id` matches `ref`
 * (the same composite feature-ref string data/gba.geojson uses, and that
 * `wards.boundaryRef` stores per row — see src/lib/geo.ts / src/db/schema.ts).
 */
export function findWardFeature(collection: GeoJSONCollectionLike, ref: string): GeoJSONFeatureLike | undefined {
  return collection.features.find((feature) => String(feature.properties?.id ?? '') === ref);
}

/** Recursively visits every [lng, lat, ...] position nested in a Polygon/MultiPolygon coordinates tree. */
function visitPositions(coords: unknown, visit: (pos: Position) => void): void {
  if (!Array.isArray(coords) || coords.length === 0) return;
  if (typeof coords[0] === 'number') {
    visit(coords as Position);
    return;
  }
  for (const child of coords as unknown[]) visitPositions(child, visit);
}

/**
 * Bounding box `[[minLng, minLat], [maxLng, maxLat]]` for a Polygon or
 * MultiPolygon feature — the shape MapLibre's `fitBounds()` expects.
 */
export function computeFeatureBounds(feature: GeoJSONFeatureLike): LngLatBounds {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  visitPositions(feature.geometry.coordinates, ([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

export interface WardMapColors {
  background: string;
  fill: string;
  line: string;
}

/**
 * Reads the three colors this map needs off `root`'s computed CSS custom
 * properties (design-system.md §8: `--gray-100` neutral background,
 * `--forest-tint` fill, `--oc-forest` boundary line). Never hardcodes a hex
 * value (tests/unit/tokens.test.ts bans hex literals outside tokens.css) —
 * the named-color fallbacks below are only reached if tokens.css somehow
 * failed to load, and are deliberately neutral (no red, no party hue).
 */
export function readMapColors(root: HTMLElement = document.documentElement): WardMapColors {
  const style = getComputedStyle(root);
  const read = (name: string, fallback: string): string => style.getPropertyValue(name).trim() || fallback;

  return {
    background: read('--gray-100', 'gainsboro'),
    fill: read('--forest-tint', 'gray'),
    line: read('--oc-forest', 'darkslategray'),
  };
}

/**
 * The minimal MapLibre style spec for the "no tile basemap yet" case (see
 * file header): just a flat background layer, no sources/raster tiles.
 */
export function buildBaseStyle(colors: WardMapColors): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': colors.background },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// DOM/MapLibre wiring
// ---------------------------------------------------------------------------

function addWardBoundaryLayers(map: maplibregl.Map, feature: GeoJSONFeatureLike, colors: WardMapColors): void {
  map.addSource('ward-boundary', { type: 'geojson', data: feature as GeoJSON.Feature });
  map.addLayer({
    id: 'ward-boundary-fill',
    type: 'fill',
    source: 'ward-boundary',
    paint: { 'fill-color': colors.fill, 'fill-opacity': 0.3 },
  });
  map.addLayer({
    id: 'ward-boundary-line',
    type: 'line',
    source: 'ward-boundary',
    paint: { 'line-color': colors.line, 'line-width': 2 },
  });
}

/**
 * Fetches the ward's boundary geojson, finds its feature, and mounts a
 * MapLibre map into `container`. Any failure along the way (missing
 * `data-boundary-url`, network error, non-2xx, bad JSON, feature not found)
 * simply returns without touching `container` — its server-rendered no-JS
 * fallback text stays in place. Exported for direct testing.
 */
export async function mountWardMap(container: HTMLElement): Promise<void> {
  const boundaryUrl = container.dataset.boundaryUrl;
  if (!boundaryUrl) return;

  const { path, ref } = parseBoundaryUrl(boundaryUrl);
  if (!path || !ref) return;

  let collection: GeoJSONCollectionLike;
  try {
    const res = await fetch(path);
    if (!res.ok) return;
    collection = (await res.json()) as GeoJSONCollectionLike;
  } catch {
    return;
  }

  const feature = findWardFeature(collection, ref);
  if (!feature) return;

  const colors = readMapColors();
  container.textContent = ''; // clear the static no-JS fallback now that the map is taking over

  const map = new maplibregl.Map({
    container,
    style: buildBaseStyle(colors),
    attributionControl: false,
  });

  map.on('load', () => {
    addWardBoundaryLayers(map, feature, colors);
    map.fitBounds(computeFeatureBounds(feature), { padding: 24, animate: false });
  });
}

/**
 * Wires every `[data-ward-map]` container under `root` (defaults to the
 * whole document — there is exactly one on the Ward page, but scoping to a
 * root keeps this testable against a fragment, matching WardLookup.ts's
 * pattern). Safe to call when no container is present (does nothing).
 *
 * Lazy: the real MapLibre map for a given container is only constructed
 * once that container scrolls into view, via IntersectionObserver — a ward
 * page whose map sits below the fold never pays MapLibre's init cost until
 * it's actually seen. Falls back to mounting immediately if
 * IntersectionObserver isn't available in this environment.
 */
export function initWardMap(root: ParentNode = document): void {
  const containers = Array.from(root.querySelectorAll<HTMLElement>('[data-ward-map]'));
  if (containers.length === 0) return;

  if (typeof IntersectionObserver === 'undefined') {
    for (const container of containers) void mountWardMap(container);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      void mountWardMap(entry.target as HTMLElement);
    }
  });

  for (const container of containers) observer.observe(container);
}
