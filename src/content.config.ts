import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { pageFrontmatterSchema } from './i18n/content';

// Astro-side view of the same editorial content layer that
// src/i18n/content.ts reads directly (architecture §9, layer 2). Both read
// content/pages/{en,kn}/*.md and validate against the same Zod schema; this
// collection exists so .astro templates can also use `getCollection('pages')`
// / `getEntry('pages', id)` and Astro's built-in Markdown rendering if that's
// more convenient than the runtime getPageContent() helper for a given page.
const pages = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './content/pages',
    // Default IDs would be plain filenames ("about"), colliding between the
    // en/ and kn/ trees. Use the path relative to content/pages instead, e.g.
    // "en/about" / "kn/about", matching how getPageContent() addresses files.
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: pageFrontmatterSchema,
});

export const collections = { pages };
