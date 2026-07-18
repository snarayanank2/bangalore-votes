import type { Config } from 'tailwindcss'

// Design tokens per docs/design-system.md. Primitives (§2.1) are the raw hex values; components
// should reach for the primitive utility that matches the semantic use in §2.2's mapping table
// (e.g. a primary button is `bg-forest text-white`, a danger surface is `bg-brick-tint
// text-brick`) rather than inventing new colors. `gray` here REPLACES only shades 100/300/600 of
// Tailwind's default gray scale — those are the only three the system defines (§2.1); other gray
// shades are unused by this design and left at their Tailwind defaults to avoid surprises.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      sm: '480px', // §6.2 — large phones
      md: '768px', // tablet; type scale steps up (§5.2)
      lg: '1024px', // desktop; compare grid widens
    },
    extend: {
      colors: {
        ink: '#1a1a1a',
        forest: '#426133',
        'forest-tint': '#eef3ea',
        leaf: '#5e8b48',
        lime: '#c8e537',
        sun: '#ffd527',
        'sun-tint': '#fff8d6',
        brick: '#a62635',
        'brick-tint': '#faeceb',
        rose: '#d33a4c',
        gray: { 100: '#f0f0f0', 300: '#c1c1c1', 600: '#616161' },
      },
      fontFamily: {
        // Body is the default `font-sans` stack (§5.1); headings/buttons/figures opt in via
        // `font-heading`. Noto Sans Kannada rides in both stacks to cover glyphs Manrope/PT Sans
        // lack.
        sans: ['"PT Sans"', '"Noto Sans Kannada"', 'system-ui', 'sans-serif'],
        heading: ['Manrope', '"Noto Sans Kannada"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // §5.2 mobile-first scale. text-3xl/text-4xl grow further at `md` via the override in
        // index.css (Tailwind's fontSize theme has no per-breakpoint value, so that one step
        // lives in CSS instead of here).
        xs: ['13px', { lineHeight: '1.4' }],
        sm: ['14px', { lineHeight: '1.5' }],
        base: ['16px', { lineHeight: '1.5' }],
        lg: ['18px', { lineHeight: '1.5' }],
        xl: ['20px', { lineHeight: '1.3' }],
        '2xl': ['24px', { lineHeight: '1.25' }],
        '3xl': ['28px', { lineHeight: '1.2' }],
        '4xl': ['32px', { lineHeight: '1.1' }],
      },
      borderRadius: {
        sm: '6px', // buttons, inputs
        md: '8px', // cards, modals
        // `full` is already 9999px in Tailwind's default scale — chips/badges use `rounded-full`.
      },
      boxShadow: {
        // §6.3 — elevation is border-first. These are the ONLY two shadows in the system;
        // nothing else should reach for `shadow`/`shadow-md`/etc.
        sticky: '0 2px 4px rgba(26, 26, 26, 0.08)',
        modal: '0 8px 24px rgba(26, 26, 26, 0.18)',
      },
      maxWidth: {
        prose: '42rem', // guides, legal, about pages
        app: '64rem', // ward pages, compare, curator/admin tables
      },
    },
  },
  plugins: [],
} satisfies Config
