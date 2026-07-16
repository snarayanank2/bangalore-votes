import type { Ward } from '../types'

export const seedWards: Ward[] = [
  {
    id: 'koramangala',
    number: 151,
    name: 'Koramangala',
    corporation: 'South',
    issueIds: ['kor-roads', 'kor-water', 'kor-waste', 'kor-lighting'],
  },
  {
    id: 'indiranagar',
    number: 80,
    name: 'Indiranagar',
    corporation: 'East',
    issueIds: ['ind-traffic', 'ind-trees', 'ind-parking'],
  },
  {
    id: 'malleshwaram',
    number: 45,
    name: 'Malleshwaram',
    corporation: 'West',
    issueIds: ['mal-water', 'mal-heritage', 'mal-waste'],
  },
  {
    id: 'shivajinagar',
    number: 92,
    name: 'Shivajinagar',
    corporation: 'Central',
    issueIds: ['shi-drainage', 'shi-safety', 'shi-vendors'],
  },
  {
    id: 'jayanagar',
    number: 178,
    name: 'Jayanagar',
    corporation: 'South',
    // No candidate data yet — candidate nomination data only lands near the official
    // notification (real-world constraint), so this ward exercises the Candidates page's
    // genuine empty state. No votable issues have been defined for it yet either.
    issueIds: [],
  },
]
