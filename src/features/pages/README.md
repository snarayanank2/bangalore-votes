# Route twins — Bilingual page architecture

Every screen is one `.astro` component in `src/features/pages/` accepting a `lang: 'en' | 'kn'` prop for language context.

Route files (thin wrappers) at `src/pages/<path>.astro` render it with `lang="en"`; `src/pages/kn/<path>.astro` with `lang="kn"`. This dual URL structure (`/path` for English, `/kn/path` for Kannada) stays fast, keeps URLs shareable, and maintains hreflang links for SEO.

API routes and `/media` are not localized — they sit outside `src/pages/`.
