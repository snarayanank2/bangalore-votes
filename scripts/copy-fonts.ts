#!/usr/bin/env tsx
/**
 * Copy the exact self-hosted font files the design system needs from their
 * npm (@fontsource) packages into public/fonts/, so they can be committed
 * and served as static assets with hand-written @font-face rules in
 * src/styles/global.css (see docs/design-system.md §5.1, §11).
 *
 * We do NOT run pyftsubset/glyphhanger here — the fontsource packages ship
 * already-subset per-script woff2 files (latin / kannada / cyrillic / ...),
 * and per the controller decision for this task we take those as-is rather
 * than re-subsetting them ourselves. Variable-font files are preferred
 * wherever available because they replace several static weight files
 * with one smaller file (verified against the static equivalents below).
 *
 * Weights required (design-system.md §5.1):
 *   Manrope             500, 700, 800  -> single variable file (wght 200-800)
 *   PT Sans             400, 700       -> no variable version exists upstream;
 *                                         two static weight files
 *   Noto Sans Kannada   400, 500, 700, 800 -> single variable file (wght 100-900)
 *
 * Run: npm run copy-fonts
 */
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const destDir = join(repoRoot, 'public', 'fonts');

interface FontFile {
  label: string;
  src: string;
  dest: string;
}

const files: FontFile[] = [
  {
    label: 'Manrope (variable, latin, wght 200-800 — covers 500/700/800)',
    src: 'node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2',
    dest: 'manrope-latin-wght-normal.woff2',
  },
  {
    label: 'PT Sans 400 (static, latin)',
    src: 'node_modules/@fontsource/pt-sans/files/pt-sans-latin-400-normal.woff2',
    dest: 'pt-sans-latin-400-normal.woff2',
  },
  {
    label: 'PT Sans 700 (static, latin)',
    src: 'node_modules/@fontsource/pt-sans/files/pt-sans-latin-700-normal.woff2',
    dest: 'pt-sans-latin-700-normal.woff2',
  },
  {
    label: 'Noto Sans Kannada (variable, kannada, wght 100-900 — covers 400/500/700/800)',
    src: 'node_modules/@fontsource-variable/noto-sans-kannada/files/noto-sans-kannada-kannada-wght-normal.woff2',
    dest: 'noto-sans-kannada-kannada-wght-normal.woff2',
  },
];

mkdirSync(destDir, { recursive: true });

let total = 0;
console.log('Copying self-hosted font files into public/fonts/:\n');
for (const file of files) {
  const srcPath = join(repoRoot, file.src);
  const destPath = join(destDir, file.dest);
  copyFileSync(srcPath, destPath);
  const { size } = statSync(destPath);
  total += size;
  console.log(`  ${file.dest.padEnd(42)} ${String(size).padStart(7)} bytes  — ${file.label}`);
}

const KB = 1024;
console.log(`\nTotal: ${total} bytes (${(total / KB).toFixed(1)} KiB)`);
console.log('Budget: design-system.md §11 targets ~120KB; hard ceiling is 150KB (153600 bytes).');
if (total > 153_600) {
  console.log(
    `\nOVER the 150KB hard ceiling by ${total - 153_600} bytes. See task-11-report.md for the DONE_WITH_CONCERNS writeup.`,
  );
}
