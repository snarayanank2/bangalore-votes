import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1a2233', brand: '#0b5c8a', accent: '#c2410c',
        official: '#0b5c8a', curated: '#6b7280',
      },
    },
  },
  plugins: [],
} satisfies Config
