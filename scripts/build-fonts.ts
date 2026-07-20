#!/usr/bin/env tsx
/**
 * Build the self-hosted font files the design system needs, as REAL glyph
 * subsets (design-system.md §5.1: "Self-host all three as subset woff2";
 * "Kannada subsetting must keep the full conjunct set; test with real ward
 * names, not lorem ipsum").
 *
 * Superseding scripts/copy-fonts.ts: that script copied the already-subset
 * @fontsource per-script files as-is (latin / kannada), which came to
 * 208,344 bytes — over the 150KB (153,600 byte) hard ceiling asserted by
 * tests/unit/tokens.test.ts. Those "latin"/"kannada" fontsource subsets
 * still carry glyph coverage this product never uses (e.g. PT Sans's latin
 * file covers dozens of Latin-script languages' diacritics). We re-subset
 * with fontTools down to exactly what this product renders.
 *
 * Latin faces (Manrope, PT Sans 400/700): basic Latin + Latin-1 Supplement
 * + general punctuation + the rupee sign — U+0000-00FF, U+2000-206F, U+20B9.
 * Manrope keeps its variable wght axis (200-800 range covers 500/700/800).
 *
 * Noto Sans Kannada (variable): the FULL Kannada Unicode block
 * (U+0C80-0CFF) so no conjunct is ever dropped, unioned with every
 * character this repo actually renders in Kannada — every ward_name_kn
 * (and sibling *_kn fields) in data/gba.geojson, every value in
 * src/i18n/kn.json, and every content/pages/kn/*.md file — passed via
 * --text-file so any out-of-block combining marks or punctuation the real
 * corpus uses are retained too. --layout-features='*' is kept (not
 * dropped) for Kannada: conjunct/vowel-sign shaping depends on GSUB/GPOS.
 *
 * Run: npm run build-fonts
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const destDir = join(repoRoot, 'public', 'fonts');

const LATIN_UNICODES = 'U+0000-00FF,U+2000-206F,U+20B9';
const KANNADA_UNICODES = 'U+0C80-0CFF,U+0000-00FF,U+2000-206F,U+20B9';

interface FontJob {
  label: string;
  src: string;
  dest: string;
  unicodes: string;
  /** Path to a text file of real corpus text (Kannada only). */
  textFile?: string;
}

/** Collect every Kannada-relevant string actually rendered by this repo. */
function collectKannadaText(): string {
  const chunks: string[] = [];

  // 1. Every *_kn property across all 369 ward features in data/gba.geojson
  //    (ward_name_kn, corporation_kn, ac_kn, and any other *_kn field).
  const geojsonPath = join(repoRoot, 'data', 'gba.geojson');
  const geojson = JSON.parse(readFileSync(geojsonPath, 'utf8')) as {
    features: Array<{ properties: Record<string, unknown> }>;
  };
  for (const feature of geojson.features) {
    for (const [key, value] of Object.entries(feature.properties)) {
      if (key.endsWith('_kn') && typeof value === 'string') {
        chunks.push(value);
      }
    }
  }

  // 2. Every value in src/i18n/kn.json (recursively — it's a flat key->string
  //    map today, but walk nested objects/arrays defensively).
  const knJsonPath = join(repoRoot, 'src', 'i18n', 'kn.json');
  const knJson: unknown = JSON.parse(readFileSync(knJsonPath, 'utf8'));
  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      chunks.push(value);
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  };
  walk(knJson);

  // 3. Every content/pages/kn/*.md file, verbatim (frontmatter + body — the
  //    Latin-only frontmatter keys are already covered by the Latin range).
  const knContentDir = join(repoRoot, 'content', 'pages', 'kn');
  for (const file of readdirSync(knContentDir).filter((f) => f.endsWith('.md'))) {
    chunks.push(readFileSync(join(knContentDir, file), 'utf8'));
  }

  return chunks.join('\n');
}

function subsetFont(job: FontJob): number {
  const srcPath = join(repoRoot, job.src);
  const destPath = join(destDir, job.dest);
  const args = [
    '-m',
    'fontTools.subset',
    srcPath,
    `--output-file=${destPath}`,
    '--flavor=woff2',
    `--unicodes=${job.unicodes}`,
    "--layout-features=*",
    '--no-hinting',
  ];
  if (job.textFile) {
    args.push(`--text-file=${job.textFile}`);
  }
  execFileSync('python3', args, { cwd: repoRoot, stdio: 'inherit' });
  return statSync(destPath).size;
}

function main(): void {
  mkdirSync(destDir, { recursive: true });

  const tmpDir = mkdtempSync(join(tmpdir(), 'gba-font-subset-'));
  const knTextFile = join(tmpDir, 'kannada-corpus.txt');
  writeFileSync(knTextFile, collectKannadaText(), 'utf8');

  const jobs: FontJob[] = [
    {
      label: 'Manrope (variable, wght 200-800 — covers 500/700/800)',
      src: 'node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2',
      dest: 'manrope-latin-wght-normal.woff2',
      unicodes: LATIN_UNICODES,
    },
    {
      label: 'PT Sans 400',
      src: 'node_modules/@fontsource/pt-sans/files/pt-sans-latin-400-normal.woff2',
      dest: 'pt-sans-latin-400-normal.woff2',
      unicodes: LATIN_UNICODES,
    },
    {
      label: 'PT Sans 700',
      src: 'node_modules/@fontsource/pt-sans/files/pt-sans-latin-700-normal.woff2',
      dest: 'pt-sans-latin-700-normal.woff2',
      unicodes: LATIN_UNICODES,
    },
    {
      label: 'Noto Sans Kannada (variable, wght 100-900 — covers 400/500/700/800; full Kannada block + repo corpus)',
      src: 'node_modules/@fontsource-variable/noto-sans-kannada/files/noto-sans-kannada-kannada-wght-normal.woff2',
      dest: 'noto-sans-kannada-kannada-wght-normal.woff2',
      unicodes: KANNADA_UNICODES,
      textFile: knTextFile,
    },
  ];

  let total = 0;
  console.log('Subsetting self-hosted font files into public/fonts/:\n');
  for (const job of jobs) {
    const size = subsetFont(job);
    total += size;
    console.log(`  ${job.dest.padEnd(42)} ${String(size).padStart(7)} bytes  — ${job.label}`);
  }

  rmSync(tmpDir, { recursive: true, force: true });

  const KB = 1024;
  console.log(`\nTotal: ${total} bytes (${(total / KB).toFixed(1)} KiB)`);
  console.log('Budget: design-system.md §11 targets ~120KB; hard ceiling is 150KB (153600 bytes).');
  if (total > 153_600) {
    console.log(`\nOVER the 150KB hard ceiling by ${total - 153_600} bytes.`);
    process.exitCode = 1;
  } else {
    console.log(`Under budget by ${153_600 - total} bytes.`);
  }
}

main();
