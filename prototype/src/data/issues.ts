import type { Issue, IssueVote } from '../types'

export const seedIssues: Issue[] = [
  {
    id: 'kor-roads',
    wardId: 'koramangala',
    title: 'Road quality & potholes',
    description: 'Condition and repair of internal roads.',
  },
  {
    id: 'kor-water',
    wardId: 'koramangala',
    title: 'Water supply reliability',
    description: 'Frequency and pressure of Cauvery water supply to households.',
  },
  {
    id: 'kor-waste',
    wardId: 'koramangala',
    title: 'Garbage collection & segregation',
    description: 'Timeliness of door-to-door waste pickup and segregation compliance.',
  },
  {
    id: 'ind-traffic',
    wardId: 'indiranagar',
    title: 'Traffic congestion',
    description: 'Peak-hour bottlenecks on main commercial roads.',
  },
  {
    id: 'ind-trees',
    wardId: 'indiranagar',
    title: 'Tree cover & footpath encroachment',
    description: 'Loss of tree canopy and footpaths blocked by construction or parking.',
  },
  {
    id: 'ind-parking',
    wardId: 'indiranagar',
    title: 'Parking shortage',
    description: 'Inadequate parking near restaurants and shopping stretches.',
  },
  {
    id: 'mal-water',
    wardId: 'malleshwaram',
    title: 'Water supply reliability',
    description: 'Aging pipelines causing intermittent low-pressure supply.',
  },
  {
    id: 'mal-heritage',
    wardId: 'malleshwaram',
    title: 'Heritage building upkeep',
    description: 'Maintenance of older markets, temples, and building facades.',
  },
  {
    id: 'mal-waste',
    wardId: 'malleshwaram',
    title: 'Market area waste management',
    description: 'Waste buildup around markets and vendor clusters.',
  },
  {
    id: 'shi-drainage',
    wardId: 'shivajinagar',
    title: 'Stormwater drainage & flooding',
    description: 'Clogged drains causing waterlogging during monsoon.',
  },
  {
    id: 'shi-safety',
    wardId: 'shivajinagar',
    title: 'Street lighting & safety',
    description: 'Poorly lit stretches and public safety at night.',
  },
  {
    id: 'shi-vendors',
    wardId: 'shivajinagar',
    title: 'Street vendor regulation',
    description: 'Balancing vendor livelihoods with footpath access for pedestrians.',
  },
]

export const seedIssueVotes: IssueVote[] = [
  { userId: 'u-citizen', wardId: 'koramangala', issueIds: ['kor-roads', 'kor-water'] },
  { userId: 'seed-voter-1', wardId: 'koramangala', issueIds: ['kor-roads', 'kor-waste', 'kor-water'] },
  { userId: 'seed-voter-2', wardId: 'koramangala', issueIds: ['kor-water', 'kor-roads'] },
]
