import type { Ward } from '../types'

export const seedWards: Ward[] = [
  {
    id: 'koramangala',
    number: 151,
    name: 'Koramangala',
    corporation: 'South',
    oldWardsNote: 'Formed from parts of old wards 151 and 174.',
    issueIds: ['kor-roads', 'kor-water', 'kor-waste', 'kor-lighting'],
  },
  {
    id: 'indiranagar',
    number: 80,
    name: 'Indiranagar',
    corporation: 'East',
    oldWardsNote: 'Largely retains old ward 80 with minor boundary changes.',
    issueIds: ['ind-traffic', 'ind-trees', 'ind-parking'],
  },
  {
    id: 'malleshwaram',
    number: 45,
    name: 'Malleshwaram',
    corporation: 'West',
    oldWardsNote: 'Merged from old wards 45 and 46.',
    issueIds: ['mal-water', 'mal-heritage', 'mal-waste'],
  },
  {
    id: 'shivajinagar',
    number: 92,
    name: 'Shivajinagar',
    corporation: 'Central',
    oldWardsNote: 'Redrawn from old wards 92 and 93.',
    issueIds: ['shi-drainage', 'shi-safety', 'shi-vendors'],
  },
]
