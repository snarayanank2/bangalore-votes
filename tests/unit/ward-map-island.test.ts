// @vitest-environment jsdom
/**
 * Coverage for src/islands/WardMap.ts. Per the task-19 brief: a real
 * MapLibre map needs a WebGL canvas context jsdom doesn't provide, so this
 * file exercises the pure geometry/style helpers directly (no map
 * construction involved) and the container-selection/lazy-init wiring with
 * `maplibre-gl`'s `Map` class mocked out entirely — never a full map render.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// `vi.mock` factories are hoisted above the rest of the file, so anything
// they reference must be created through `vi.hoisted` rather than a plain
// top-level `const` (which would still be in the temporal dead zone at the
// point the hoisted factory runs).
const { addSource, addLayer, fitBounds, onHandlers, MapMock } = vi.hoisted(() => {
  const onHandlers: Record<string, () => void> = {};
  const addSource = vi.fn();
  const addLayer = vi.fn();
  const fitBounds = vi.fn();
  const on = vi.fn((event: string, cb: () => void) => {
    onHandlers[event] = cb;
  });
  const MapMock = vi.fn().mockImplementation(() => ({ addSource, addLayer, fitBounds, on }));
  return { addSource, addLayer, fitBounds, onHandlers, on, MapMock };
});

vi.mock('maplibre-gl', () => ({
  default: { Map: MapMock },
}));
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

import {
  parseBoundaryUrl,
  findWardFeature,
  computeFeatureBounds,
  readMapColors,
  buildBaseStyle,
  mountWardMap,
  initWardMap,
  type GeoJSONCollectionLike,
  type GeoJSONFeatureLike,
} from '../../src/islands/WardMap';

describe('parseBoundaryUrl (pure)', () => {
  it('splits path and ref on the fragment', () => {
    expect(parseBoundaryUrl('/data/gba.geojson#ward_369_final.1')).toEqual({
      path: '/data/gba.geojson',
      ref: 'ward_369_final.1',
    });
  });

  it('returns an empty ref when there is no fragment', () => {
    expect(parseBoundaryUrl('/data/gba.geojson')).toEqual({ path: '/data/gba.geojson', ref: '' });
  });
});

describe('findWardFeature (pure)', () => {
  const collection: GeoJSONCollectionLike = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { id: 'a' }, geometry: { type: 'Polygon', coordinates: [] } },
      { type: 'Feature', properties: { id: 'b' }, geometry: { type: 'Polygon', coordinates: [] } },
    ],
  };

  it('finds the feature whose properties.id matches the ref', () => {
    expect(findWardFeature(collection, 'b')).toBe(collection.features[1]);
  });

  it('returns undefined when no feature matches', () => {
    expect(findWardFeature(collection, 'ghost')).toBeUndefined();
  });
});

describe('computeFeatureBounds (pure)', () => {
  it('computes the bbox of a simple Polygon', () => {
    const feature: GeoJSONFeatureLike = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.5, 12.9],
            [77.6, 12.9],
            [77.6, 13.0],
            [77.5, 13.0],
            [77.5, 12.9],
          ],
        ],
      },
    };
    expect(computeFeatureBounds(feature)).toEqual([
      [77.5, 12.9],
      [77.6, 13.0],
    ]);
  });

  it('computes the bbox across all polygons of a MultiPolygon', () => {
    const feature: GeoJSONFeatureLike = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [77.5, 12.9],
              [77.55, 12.95],
              [77.5, 12.9],
            ],
          ],
          [
            [
              [78.0, 13.5],
              [78.1, 13.6],
              [78.0, 13.5],
            ],
          ],
        ],
      },
    };
    expect(computeFeatureBounds(feature)).toEqual([
      [77.5, 12.9],
      [78.1, 13.6],
    ]);
  });
});

describe('readMapColors / buildBaseStyle (pure, neutrality guard)', () => {
  it('reads colors from CSS custom properties, not hardcoded, and never red/party colors', () => {
    const fakeRoot = {} as HTMLElement;
    const getPropertyValue = vi.fn((name: string) => {
      const values: Record<string, string> = {
        '--gray-100': '#f0f0f0',
        '--forest-tint': '#eef3ea',
        '--oc-forest': '#426133',
      };
      return values[name] ?? '';
    });
    const spy = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ getPropertyValue } as unknown as CSSStyleDeclaration);

    const colors = readMapColors(fakeRoot);
    expect(colors).toEqual({ background: '#f0f0f0', fill: '#eef3ea', line: '#426133' });
    expect(getPropertyValue).toHaveBeenCalledWith('--gray-100');
    expect(getPropertyValue).toHaveBeenCalledWith('--forest-tint');
    expect(getPropertyValue).toHaveBeenCalledWith('--oc-forest');

    const style = buildBaseStyle(colors);
    expect(style.layers).toHaveLength(1);
    expect(style.layers[0]).toMatchObject({ id: 'background', type: 'background' });
    expect(JSON.stringify(style)).not.toMatch(/red|#ff0000|party/i);

    // Only restore THIS spy — `vi.restoreAllMocks()` would also wipe the
    // shared, file-scoped `maplibre-gl` mock (MapMock/addSource/etc. from
    // `vi.hoisted` above), breaking every test in the describe blocks below.
    spy.mockRestore();
  });

  it('falls back to neutral named colors (never a hardcoded hex) when a custom property is unset', () => {
    const fakeRoot = {} as HTMLElement;
    const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration);

    const colors = readMapColors(fakeRoot);
    expect(colors.background).toBe('gainsboro');
    expect(colors.fill).toBe('gray');
    expect(colors.line).toBe('darkslategray');

    spy.mockRestore();
  });
});

describe('mountWardMap (DOM wiring, maplibre-gl mocked)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    MapMock.mockClear();
    addSource.mockClear();
    addLayer.mockClear();
    fitBounds.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  function buildContainer(boundaryUrl?: string): HTMLElement {
    document.body.innerHTML = `<div data-ward-map ${
      boundaryUrl ? `data-boundary-url="${boundaryUrl}"` : ''
    }><p class="map-fallback">Map of ward boundary</p></div>`;
    return document.querySelector('[data-ward-map]')!;
  }

  const collection: GeoJSONCollectionLike = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { id: 'ward-x' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } }],
  };

  it('does nothing when data-boundary-url is absent — fallback text stays', async () => {
    const container = buildContainer();
    await mountWardMap(container);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Map of ward boundary');
    expect(MapMock).not.toHaveBeenCalled();
  });

  it('does nothing on a non-ok fetch response — fallback text stays', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    const container = buildContainer('/data/gba.geojson#ward-x');
    await mountWardMap(container);
    expect(container.textContent).toContain('Map of ward boundary');
    expect(MapMock).not.toHaveBeenCalled();
  });

  it('does nothing on a fetch rejection — fallback text stays', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network error'));
    const container = buildContainer('/data/gba.geojson#ward-x');
    await mountWardMap(container);
    expect(container.textContent).toContain('Map of ward boundary');
    expect(MapMock).not.toHaveBeenCalled();
  });

  it('does nothing when the ref matches no feature — fallback text stays', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => collection });
    const container = buildContainer('/data/gba.geojson#ghost-ref');
    await mountWardMap(container);
    expect(container.textContent).toContain('Map of ward boundary');
    expect(MapMock).not.toHaveBeenCalled();
  });

  it('constructs the map, clears the fallback text, and adds the boundary source/layers once the matching feature is found', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => collection });
    const container = buildContainer('/data/gba.geojson#ward-x');

    await mountWardMap(container);

    expect(fetchMock).toHaveBeenCalledWith('/data/gba.geojson');
    expect(container.textContent).not.toContain('Map of ward boundary');
    expect(MapMock).toHaveBeenCalledTimes(1);
    expect(MapMock.mock.calls[0][0]).toMatchObject({ container });

    // The 'load' handler wires the source/layers/fitBounds — invoke it as
    // MapLibre itself would once the style has loaded.
    onHandlers['load']?.();
    expect(addSource).toHaveBeenCalledWith('ward-boundary', { type: 'geojson', data: collection.features[0] });
    expect(addLayer).toHaveBeenCalledTimes(2);
    expect(fitBounds).toHaveBeenCalledTimes(1);
  });
});

describe('initWardMap (container selection + lazy IntersectionObserver wiring)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    fetchGlobalCleanup();
  });

  function fetchGlobalCleanup() {
    // no-op placeholder kept symmetrical with the other describe's afterEach
  }

  it('does nothing (does not throw) when no [data-ward-map] container is present', () => {
    document.body.innerHTML = '<p>no map here</p>';
    expect(() => initWardMap()).not.toThrow();
  });

  it('mounts immediately when IntersectionObserver is unavailable', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'FeatureCollection', features: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const original = (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
    // @ts-expect-error deliberately removing it for this test
    delete globalThis.IntersectionObserver;

    document.body.innerHTML = '<div data-ward-map data-boundary-url="/data/gba.geojson#x"></div>';
    initWardMap();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith('/data/gba.geojson');

    (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver = original;
  });

  it('defers mounting until the container intersects, when IntersectionObserver is available', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'FeatureCollection', features: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    let capturedCallback: ((entries: Array<{ isIntersecting: boolean; target: Element }>) => void) | null = null;
    const unobserve = vi.fn();
    const observe = vi.fn();
    class FakeIntersectionObserver {
      constructor(cb: (entries: Array<{ isIntersecting: boolean; target: Element }>) => void) {
        capturedCallback = cb;
      }
      observe = observe;
      unobserve = unobserve;
    }
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);

    document.body.innerHTML = '<div data-ward-map data-boundary-url="/data/gba.geojson#x"></div>';
    const container = document.querySelector('[data-ward-map]')!;

    initWardMap();
    expect(observe).toHaveBeenCalledWith(container);
    expect(fetchMock).not.toHaveBeenCalled();

    capturedCallback!([{ isIntersecting: true, target: container }]);
    await Promise.resolve();
    await Promise.resolve();

    expect(unobserve).toHaveBeenCalledWith(container);
    expect(fetchMock).toHaveBeenCalledWith('/data/gba.geojson');
  });
});
