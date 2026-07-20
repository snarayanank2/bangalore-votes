import { describe, it, expect } from 'vitest';
import { renderContentHtml, splitMarkdownSections } from '../../src/lib/render-content';

describe('renderContentHtml (src/lib/render-content.ts)', () => {
  it('renders Markdown headings/paragraphs/lists to HTML', () => {
    const html = renderContentHtml('## A question heading?\n\nSome body text.\n\n- one\n- two\n', 'en');
    expect(html).toContain('<h2>A question heading?</h2>');
    expect(html).toContain('<p>Some body text.</p>');
    expect(html).toContain('<li>one</li>');
  });

  it('strips HTML comments (INPUT NEEDED / CONFIRM markers) entirely from the output', () => {
    const md = 'Visible before.\n\n<!-- INPUT NEEDED: secret official URL -->\n\nVisible after.\n\n<!-- CONFIRM: something -->\n';
    const html = renderContentHtml(md, 'en');
    expect(html).not.toContain('INPUT NEEDED');
    expect(html).not.toContain('CONFIRM');
    expect(html).not.toContain('<!--');
    expect(html).toContain('Visible before.');
    expect(html).toContain('Visible after.');
  });

  it('leaves EN internal links unprefixed', () => {
    const html = renderContentHtml('[link](/check-registration) and [home](/)', 'en');
    expect(html).toContain('href="/check-registration"');
    expect(html).toContain('href="/"');
  });

  it('rewrites internal links with the /kn prefix for lang=kn (including root "/")', () => {
    const html = renderContentHtml('[link](/check-registration) and [home](/)', 'kn');
    expect(html).toContain('href="/kn/check-registration"');
    expect(html).toContain('href="/kn/"');
  });

  it('leaves external (http/https) links untouched for both languages', () => {
    const md = '[ext](https://example.com/path)';
    expect(renderContentHtml(md, 'en')).toContain('href="https://example.com/path"');
    expect(renderContentHtml(md, 'kn')).toContain('href="https://example.com/path"');
  });
});

describe('splitMarkdownSections (src/lib/render-content.ts)', () => {
  it('splits a preamble + 3 headings into 4 chunks, each starting at its own heading', () => {
    const md = 'Intro para.\n\n## First?\n\nBody one.\n\n## Second?\n\nBody two.\n\n## Third?\n\nBody three.\n';
    const chunks = splitMarkdownSections(md);
    expect(chunks).toHaveLength(4);
    expect(chunks[0]).toBe('Intro para.\n\n');
    expect(chunks[1].startsWith('## First?')).toBe(true);
    expect(chunks[2].startsWith('## Second?')).toBe(true);
    expect(chunks[3].startsWith('## Third?')).toBe(true);
    // Rejoining reproduces the original body exactly.
    expect(chunks.join('')).toBe(md);
  });

  it('omits the preamble chunk when the body starts directly with a heading', () => {
    const md = '## Only heading\n\nBody.\n';
    const chunks = splitMarkdownSections(md);
    expect(chunks).toEqual(['## Only heading\n\nBody.\n']);
  });

  it('returns the whole body as a single chunk when there are no ## headings', () => {
    const md = 'Just a paragraph, no headings at all.\n';
    expect(splitMarkdownSections(md)).toEqual([md]);
  });

  it('a subsection heading (###) does not create a new chunk boundary', () => {
    const md = '## Section\n\nBody.\n\n### Subsection\n\nMore body.\n\n## Next section\n\nX.\n';
    const chunks = splitMarkdownSections(md);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain('### Subsection');
  });
});
