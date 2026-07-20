import { describe, it, expect } from 'vitest';
import { getPageContent } from '../../src/i18n/content';

const ALL_SLUGS = [
  'about',
  'about-election',
  'check-registration',
  'voting-guide',
  'voter-id',
  'how-to-vote',
  'find-booth',
  'terms',
  'privacy',
  'partner-with-us',
  'press',
  'home-intro',
];

describe('getPageContent()', () => {
  it('returns an entry with a non-empty title for a known EN slug', () => {
    const entry = getPageContent('en', 'about');
    expect(entry).not.toBeNull();
    expect(entry?.title).toBeTruthy();
    expect(typeof entry?.title).toBe('string');
  });

  it('resolves all 12 EN slugs', () => {
    for (const slug of ALL_SLUGS) {
      const entry = getPageContent('en', slug);
      expect(entry, `expected an EN entry for slug "${slug}"`).not.toBeNull();
      expect(entry?.title).toBeTruthy();
      expect(entry?.description).toBeTruthy();
      expect(entry?.body.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('falls back to the EN entry when the KN file is missing (Task 9 has not generated it yet)', () => {
    const en = getPageContent('en', 'about');
    const kn = getPageContent('kn', 'about');
    expect(kn).not.toBeNull();
    expect(kn?.title).toBe(en?.title);
    expect(kn?.lang).toBe('en');
    expect(kn?.fallback).toBe(true);
  });

  it('returns null for an unknown slug', () => {
    expect(getPageContent('en', 'no-such-page')).toBeNull();
    expect(getPageContent('kn', 'no-such-page')).toBeNull();
  });

  it('marks a genuine EN entry as not a fallback', () => {
    const entry = getPageContent('en', 'about');
    expect(entry?.fallback).toBe(false);
  });
});
