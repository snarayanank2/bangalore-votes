import { describe, it, expect, vi } from 'vitest';

// Full control over the fixture tables so interpolation/missing-key edge
// cases don't depend on (and don't churn with) the real seed content in
// src/i18n/en.json / kn.json.
vi.mock('../../src/i18n/en.json', () => ({
  default: {
    'greeting.simple': 'Hello {name}',
    'greeting.repeat': '{name}, {name}, and {name} again',
    'greeting.multi': '{greeting} {name}, you owe {amount}',
    'only.in.en': 'English only string',
    __hints: { 'greeting.simple': 'a friendly greeting' },
  },
}));

vi.mock('../../src/i18n/kn.json', () => ({
  default: {
    'greeting.simple': 'ನಮಸ್ಕಾರ {name}',
    __hashes: { 'greeting.simple': 'deadbeef' },
  },
}));

const { t, localePath, otherLang } = await import('../../src/i18n/index');

describe('t()', () => {
  it('interpolates a single variable', () => {
    expect(t('en', 'greeting.simple', { name: 'Asha' })).toBe('Hello Asha');
  });

  it('interpolates multiple distinct variables', () => {
    expect(
      t('en', 'greeting.multi', { greeting: 'Hi', name: 'Ravi', amount: '₹50' }),
    ).toBe('Hi Ravi, you owe ₹50');
  });

  it('interpolates a variable repeated multiple times in the template', () => {
    expect(t('en', 'greeting.repeat', { name: 'X' })).toBe('X, X, and X again');
  });

  it('interpolates numeric values by stringifying them', () => {
    expect(t('en', 'greeting.multi', { greeting: 'Hi', name: 'Ravi', amount: 50 })).toBe(
      'Hi Ravi, you owe 50',
    );
  });

  it('resolves a translated string in kn', () => {
    expect(t('kn', 'greeting.simple', { name: 'Asha' })).toBe('ನಮಸ್ಕಾರ Asha');
  });

  it('throws in test env when the key is missing from the requested language table', () => {
    // 'only.in.en' exists in en but not kn — in dev/test this must throw
    // rather than silently falling back, so missing translations are caught
    // before they reach production.
    expect(() => t('kn', 'only.in.en')).toThrow(/only\.in\.en/);
  });

  it('throws in test env when the key is missing from every table', () => {
    expect(() => t('en', 'no.such.key')).toThrow(/no\.such\.key/);
  });

  it('ignores dunder keys like __hints and __hashes — they are never returned as strings', () => {
    expect(() => t('en', '__hints')).toThrow();
    expect(() => t('kn', '__hashes')).toThrow();
  });

  it('leaves unmatched placeholders literal when vars is partially provided', () => {
    // 'greeting.multi' template is '{greeting} {name}, you owe {amount}'
    // Supply only name and amount; greeting placeholder remains literal
    expect(t('en', 'greeting.multi', { name: 'Ravi', amount: 50 })).toBe(
      '{greeting} Ravi, you owe 50',
    );
  });

  it('leaves all placeholders literal when vars is omitted', () => {
    // 'greeting.multi' template is '{greeting} {name}, you owe {amount}'
    // Call with no vars; all placeholders remain literal
    expect(t('en', 'greeting.multi')).toBe('{greeting} {name}, you owe {amount}');
  });
});

describe('localePath()', () => {
  it('prefixes a kn path with /kn', () => {
    expect(localePath('kn', '/ward/57')).toBe('/kn/ward/57');
  });

  it('maps the kn root to /kn/', () => {
    expect(localePath('kn', '/')).toBe('/kn/');
  });

  it('leaves an en path unchanged', () => {
    expect(localePath('en', '/ward/57')).toBe('/ward/57');
  });

  it('leaves the en root unchanged', () => {
    expect(localePath('en', '/')).toBe('/');
  });

  it('throws on a non-root-relative path', () => {
    expect(() => localePath('kn', 'ward/57')).toThrow();
    expect(() => localePath('en', 'ward/57')).toThrow();
  });
});

describe('otherLang()', () => {
  it('flips en to kn', () => {
    expect(otherLang('en')).toBe('kn');
  });

  it('flips kn to en', () => {
    expect(otherLang('kn')).toBe('en');
  });
});
