import enTable from './en.json';
import knTable from './kn.json';

export type Lang = 'en' | 'kn';

// Both JSON tables are flat `{ key: string }` maps that also carry optional
// top-level `__`-prefixed metadata blocks (`__hints` in en.json, `__hashes`
// in kn.json — see architecture §9 / the Task 9 translate script). Typing
// the import as `Record<string, unknown>` lets `lookup` filter those out
// without the compiler assuming every value is a string.
const tables: Record<Lang, Record<string, unknown>> = {
  en: enTable,
  kn: knTable,
};

function isDunderKey(key: string): boolean {
  return key.startsWith('__');
}

function lookup(lang: Lang, key: string): string | undefined {
  if (isDunderKey(key)) return undefined;
  const value = tables[lang][key];
  return typeof value === 'string' ? value : undefined;
}

// Production is only assumed when *both* signals agree — Astro's build-time
// `import.meta.env.PROD` and the process's `NODE_ENV`. Anything short of
// that (local dev, test runs, a misconfigured deploy) throws on a missing
// key instead of silently shipping untranslated/placeholder text.
function isProduction(): boolean {
  const metaEnv = (import.meta as ImportMeta & { env?: { PROD?: boolean } }).env;
  return metaEnv?.PROD === true && process.env.NODE_ENV === 'production';
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      return String(vars[name]);
    }
    return match;
  });
}

export function t(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let value = lookup(lang, key);

  if (value === undefined) {
    if (!isProduction()) {
      throw new Error(`i18n: missing translation key "${key}" for lang "${lang}"`);
    }
    value = lookup('en', key) ?? key;
  }

  return interpolate(value, vars);
}

export function localePath(lang: Lang, path: string): string {
  if (!path.startsWith('/')) {
    throw new Error(`localePath: path must be root-relative (start with "/"), got "${path}"`);
  }
  if (lang === 'en') return path;
  return path === '/' ? '/kn/' : `/kn${path}`;
}

export function otherLang(lang: Lang): Lang {
  return lang === 'en' ? 'kn' : 'en';
}
