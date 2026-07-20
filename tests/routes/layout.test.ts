import { describe, it, expect, beforeAll } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Base from '../../src/layouts/Base.astro';
import { localePath, otherLang, type Lang } from '../../src/i18n';

const SITE_ORIGIN = 'https://bangalore-votes.opencity.in';

/**
 * The container API (run in dev mode) decorates every element with
 * `data-astro-source-file="..."`/`data-astro-source-loc="..."` debug
 * attributes and Astro's JSX-like whitespace can leave incidental spaces
 * around text nodes. Neither is meaningful to these assertions (they don't
 * appear in a production `astro build`), so strip/collapse them before
 * checking content.
 */
function normalize(html: string): string {
  return html
    .replace(/\s+data-astro-cid-\w+/g, '')
    .replace(/\s+data-astro-(?:source-file|source-loc)="[^"]*"/g, '')
    .replace(/>\s+/g, '>')
    .replace(/\s+</g, '<')
    .replace(/\s+/g, ' ');
}

async function renderBase(lang: Lang, path: string, extraProps: Record<string, unknown> = {}) {
  const container = await AstroContainer.create({
    astroConfig: {
      site: SITE_ORIGIN,
      i18n: { locales: ['en', 'kn'], defaultLocale: 'en', routing: { prefixDefaultLocale: false } },
    },
  });
  const html = await container.renderToString(Base, {
    partial: false,
    props: {
      lang,
      title: 'Test page',
      description: 'Test description',
      path,
      ...extraProps,
    },
  });
  return normalize(html);
}

describe('Base layout (design-system.md §7.1/§7.2, IA §1)', () => {
  let enHtml: string;
  let knHtml: string;

  beforeAll(async () => {
    enHtml = await renderBase('en', '/ward/57');
    knHtml = await renderBase('kn', '/ward/57');
  });

  it('sets <html lang> to the page language', () => {
    expect(enHtml).toMatch(/<html lang="en"/);
    expect(knHtml).toMatch(/<html lang="kn"/);
  });

  it('emits a canonical link built from SITE_ORIGIN + path, never a Host header', () => {
    expect(enHtml).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/ward/57">`);
    expect(knHtml).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/kn/ward/57">`);
  });

  it('emits en, kn, and x-default hreflang alternates, kn URL under /kn/', () => {
    for (const html of [enHtml, knHtml]) {
      expect(html).toContain(`<link rel="alternate" hreflang="en" href="${SITE_ORIGIN}/ward/57">`);
      expect(html).toContain(`<link rel="alternate" hreflang="kn" href="${SITE_ORIGIN}/kn/ward/57">`);
      expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/ward/57">`);
    }
  });

  it('emits OG tags in the page language, including og:locale', () => {
    expect(enHtml).toContain('<meta property="og:locale" content="en_IN">');
    expect(knHtml).toContain('<meta property="og:locale" content="kn_IN">');
    expect(enHtml).toContain(`<meta property="og:url" content="${SITE_ORIGIN}/ward/57">`);
    expect(knHtml).toContain(`<meta property="og:url" content="${SITE_ORIGIN}/kn/ward/57">`);
  });

  it('omits the robots meta by default, and emits it when noindex is set', async () => {
    expect(enHtml).not.toMatch(/name="robots"/);
    const noindexHtml = await renderBase('en', '/x', { noindex: true });
    expect(noindexHtml).toContain('<meta name="robots" content="noindex">');
  });

  it('renders the language toggle pointing at the other language for the same path, both scripts always present', () => {
    expect(enHtml).toContain(`href="${localePath(otherLang('en'), '/ward/57')}"`);
    expect(knHtml).toContain(`href="${localePath(otherLang('kn'), '/ward/57')}"`);
    expect(enHtml).toMatch(/>EN</);
    expect(enHtml).toMatch(/>ಕನ್ನಡ</);
    expect(knHtml).toMatch(/>EN</);
    expect(knHtml).toMatch(/>ಕನ್ನಡ</);
  });

  it('renders all 7 footer links with locale-correct hrefs and labels', () => {
    const enLinks: Array<[string, string]> = [
      ['/about', 'About this project'],
      ['/voting-guide', 'Voting guide'],
      ['/data', 'Our data &amp; sources'],
      ['/partner-with-us', 'Partner with us'],
      ['/press', 'Press'],
      ['/terms', 'Terms of use'],
      ['/privacy', 'Privacy policy'],
    ];
    for (const [path, label] of enLinks) {
      expect(enHtml).toContain(`href="${path}">${label}<`);
      expect(knHtml).toContain(`href="/kn${path}">`);
    }
  });

  it('renders the Sign in control anonymously with the MeSlot hook', () => {
    expect(enHtml).toMatch(/data-me-slot[^>]*>Sign in</);
    expect(enHtml).toContain(`href="${localePath('en', '/login')}"`);
    expect(knHtml).toContain('data-me-slot');
    expect(knHtml).toContain(`href="${localePath('kn', '/login')}"`);
  });

  it('renders the skip link and a main landmark with matching id', () => {
    expect(enHtml).toContain('href="#main-content"');
    expect(enHtml).toMatch(/<main id="main-content"/);
  });
});
