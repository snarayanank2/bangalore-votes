import type { Partner } from '../types'

/**
 * DEMO PARTNER DATA — fictional (PRD §5.12). These are NOT real Bengaluru RWAs, NGOs, or press
 * outlets, and this is not a real partnership with anyone. Every name is deliberately generic
 * and carries an explicit "(fictional demo partner)" label, precisely so this prototype never
 * reads as claiming a relationship with an actual organisation — inventing a plausible-sounding
 * real-looking RWA/NGO name would do exactly that, which is why none of these resemble one.
 */
export const seedPartners: Partner[] = [
  {
    slug: 'demo-rwa-one',
    name: 'Sample Layout Residents Welfare Association (fictional demo partner)',
    kind: 'rwa',
    wardIds: ['koramangala'],
  },
  {
    slug: 'demo-civic-trust',
    name: 'Placeholder Civic Trust (fictional demo partner)',
    kind: 'ngo',
    wardIds: ['indiranagar', 'malleshwaram'],
  },
  {
    slug: 'demo-press-wire',
    name: 'Sample Press Wire (fictional demo partner)',
    kind: 'press',
    wardIds: [],
  },
]
