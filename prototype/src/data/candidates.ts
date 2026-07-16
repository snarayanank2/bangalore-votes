import type { Candidate } from '../types'

const affidavit = (label = 'EC affidavit') => ({ type: 'affidavit' as const, label })
const curatorSrc = (label = 'Curator-compiled') => ({ type: 'curator' as const, label })
const photo = (name: string) => `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`

export const seedCandidates: Candidate[] = [
  {
    id: 'c-kor-1',
    slug: 'koramangala-r-menon',
    wardId: 'koramangala',
    name: 'Radhika Menon',
    photoUrl: photo('Radhika Menon'),
    party: 'Nagarika Party',
    trackRecord: {
      value: 'Two-term corporator focused on stormwater drain desilting and footpath repairs across the ward.',
      source: curatorSrc(),
    },
    pendingCases: {
      value: 'One pending case relating to a land-use dispute filed in 2022, currently in trial stage.',
      source: affidavit(),
    },
    assets: {
      value: 'Declared movable and immovable assets totalling approximately Rs 1.8 crore.',
      source: affidavit(),
    },
    education: {
      value: 'B.Com, Bangalore University (1998).',
      source: affidavit(),
    },
    approachability: {
      value: 'Holds a weekly Saturday grievance camp at the ward office; responds to calls within a day per resident feedback.',
      source: curatorSrc(),
    },
    news: [
      { title: 'Corporator pushes for faster drain desilting ahead of monsoon', url: '#', publisher: 'Deccan Herald' },
    ],
  },
  {
    id: 'c-kor-2',
    slug: 'koramangala-s-gowda',
    wardId: 'koramangala',
    name: 'Suresh Gowda',
    photoUrl: photo('Suresh Gowda'),
    party: "Citizens' Front",
    trackRecord: {
      value: 'First-time contestant; ran a residents-welfare association for six years focused on waste segregation drives.',
      source: curatorSrc(),
    },
    pendingCases: {
      value: 'No pending criminal cases declared.',
      source: affidavit(),
    },
    assets: {
      value: 'Declared movable and immovable assets totalling approximately Rs 65 lakh.',
      source: affidavit(),
    },
    education: {
      value: 'B.E. Mechanical Engineering, Visvesvaraya Technological University (2005).',
      source: affidavit(),
    },
    approachability: {
      value: 'Active on a ward WhatsApp group; residents report replies typically within a few hours.',
      source: curatorSrc(),
    },
    news: [
      { title: 'RWA leader announces bid for corporator seat', url: '#', publisher: 'Bangalore Mirror' },
      { title: 'Local campaign focuses on segregation compliance', url: '#', publisher: 'The Hindu' },
    ],
  },
  {
    id: 'c-kor-3',
    slug: 'koramangala-independent-rao',
    wardId: 'koramangala',
    name: 'Vinay Rao',
    photoUrl: photo('Vinay Rao'),
    party: 'Independent',
    trackRecord: {
      value: 'Retired municipal engineer contesting independently; has previously advised on ward road-repair contracts as a volunteer.',
      source: curatorSrc(),
    },
    pendingCases: {
      value: 'No pending criminal cases declared.',
      source: affidavit(),
    },
    assets: {
      value: 'Declared movable and immovable assets totalling approximately Rs 2.4 crore.',
      source: affidavit(),
    },
    education: {
      value: 'Diploma in Civil Engineering, Government Polytechnic (1985).',
      source: affidavit(),
    },
    approachability: {
      value: 'No fixed office hours reported yet; contactable via phone per campaign materials.',
      source: curatorSrc(),
    },
    news: [
      { title: 'Retired engineer enters ward race as independent', url: '#', publisher: 'Citizen Matters' },
    ],
  },
  {
    id: 'c-ind-1',
    slug: 'indiranagar-p-shetty',
    wardId: 'indiranagar',
    name: 'Priya Shetty',
    photoUrl: photo('Priya Shetty'),
    party: 'Nagarika Party',
    trackRecord: {
      value: 'One-term corporator; led a footpath-widening pilot on the ward\'s main commercial stretch.',
      source: curatorSrc(),
    },
    pendingCases: {
      value: 'One pending case relating to a motor vehicle violation filed in 2021.',
      source: affidavit(),
    },
    assets: {
      value: 'Declared movable and immovable assets totalling approximately Rs 3.1 crore.',
      source: affidavit(),
    },
    education: {
      value: 'M.A. Public Administration, Bangalore University (2010).',
      source: affidavit(),
    },
    approachability: {
      value: 'Runs a monthly town-hall style ward meeting; minutes are shared publicly per curator review.',
      source: curatorSrc(),
    },
    news: [
      { title: 'Footpath pilot to expand to two more roads', url: '#', publisher: 'The New Indian Express' },
    ],
  },
  {
    id: 'c-ind-2',
    slug: 'indiranagar-a-khan',
    wardId: 'indiranagar',
    name: 'Arif Khan',
    photoUrl: photo('Arif Khan'),
    party: 'Namma Ward Party',
    trackRecord: {
      value: 'First-time contestant; runs a local traders\' association and has campaigned on parking regulation.',
      source: curatorSrc(),
    },
    pendingCases: {
      value: 'No pending criminal cases declared.',
      source: affidavit(),
    },
    assets: {
      value: 'Declared movable and immovable assets totalling approximately Rs 90 lakh.',
      source: affidavit(),
    },
    education: {
      value: 'B.A. Economics, Christ College (2008).',
      source: affidavit(),
    },
    approachability: {
      value: 'Available most evenings at the traders\' association office; no formal grievance camp yet.',
      source: curatorSrc(),
    },
    news: [
      { title: 'Traders\' association head to contest ward polls', url: '#', publisher: 'Deccan Herald' },
    ],
  },
  {
    id: 'c-ind-3',
    slug: 'indiranagar-independent-fernandes',
    wardId: 'indiranagar',
    name: 'Clara Fernandes',
    photoUrl: photo('Clara Fernandes'),
    party: 'Independent',
    trackRecord: {
      value: 'Contesting for the first time; previously coordinated a tree-planting initiative along the ward\'s inner roads.',
      source: curatorSrc(),
    },
    pendingCases: {
      value: 'No pending criminal cases declared.',
      source: affidavit(),
    },
    assets: {
      value: 'Declared movable and immovable assets totalling approximately Rs 40 lakh.',
      source: affidavit(),
    },
    education: {
      value: 'B.Sc. Environmental Science, Mount Carmel College (2014).',
      source: affidavit(),
    },
    approachability: {
      value: 'Active on social media; hosts open walks around the ward on weekends per campaign updates.',
      source: curatorSrc(),
    },
    news: [
      { title: 'Environmentalist announces independent run for corporator seat', url: '#', publisher: 'Citizen Matters' },
    ],
  },
  {
    id: 'c-mal-1',
    slug: 'malleshwaram-k-iyer',
    wardId: 'malleshwaram',
    name: 'Kavitha Iyer',
    photoUrl: photo('Kavitha Iyer'),
    party: "Citizens' Front",
    trackRecord: {
      value: 'Two-term corporator; oversaw restoration work on two heritage market buildings.',
      source: curatorSrc(),
    },
    pendingCases: {
      value: 'No pending criminal cases declared.',
      source: affidavit(),
    },
    assets: {
      value: 'Declared movable and immovable assets totalling approximately Rs 2.9 crore.',
      source: affidavit(),
    },
    education: {
      value: 'B.A. History, Maharani\'s College (1995).',
      source: affidavit(),
    },
    approachability: {
      value: 'Holds office hours twice a week; residents describe response times as moderate.',
      source: curatorSrc(),
    },
    news: [
      { title: 'Heritage market restoration nears completion', url: '#', publisher: 'The Hindu' },
    ],
  },
  {
    id: 'c-mal-2',
    slug: 'malleshwaram-independent-bhat',
    wardId: 'malleshwaram',
    name: 'Ganesh Bhat',
    photoUrl: photo('Ganesh Bhat'),
    party: 'Independent',
    trackRecord: {
      value: 'First-time contestant; long-time resident welfare volunteer focused on pipeline replacement advocacy.',
      source: curatorSrc(),
    },
    pendingCases: {
      value: 'One pending case relating to a public nuisance complaint filed in 2023, currently under investigation.',
      source: affidavit(),
    },
    assets: {
      value: 'Declared movable and immovable assets totalling approximately Rs 55 lakh.',
      source: affidavit(),
    },
    education: {
      value: 'Diploma in Electrical Engineering, Government Polytechnic (1999).',
      source: affidavit(),
    },
    approachability: {
      value: 'Known locally for door-to-door visits during the campaign period.',
      source: curatorSrc(),
    },
    news: [
      { title: 'Long-time RWA volunteer files nomination as independent', url: '#', publisher: 'Bangalore Mirror' },
    ],
  },
  {
    id: 'c-shi-1',
    slug: 'shivajinagar-f-dsouza',
    wardId: 'shivajinagar',
    name: 'Farida D\'Souza',
    photoUrl: photo('Farida D\'Souza'),
    party: 'Nagarika Party',
    trackRecord: {
      value: 'One-term corporator; introduced a street-lighting upgrade programme in the ward\'s inner lanes.',
      source: curatorSrc(),
    },
    pendingCases: {
      value: 'No pending criminal cases declared.',
      source: affidavit(),
    },
    assets: {
      value: 'Declared movable and immovable assets totalling approximately Rs 1.2 crore.',
      source: affidavit(),
    },
    education: {
      value: 'B.Com, St. Joseph\'s College (2001).',
      source: affidavit(),
    },
    approachability: {
      value: 'Runs a daily morning grievance window at the ward office per curator review.',
      source: curatorSrc(),
    },
    news: [
      { title: 'Street-lighting upgrade completed in phase one', url: '#', publisher: 'Deccan Herald' },
    ],
  },
  {
    id: 'c-shi-2',
    slug: 'shivajinagar-t-ahmed',
    wardId: 'shivajinagar',
    name: 'Tariq Ahmed',
    photoUrl: photo('Tariq Ahmed'),
    party: 'Progress Alliance',
    trackRecord: {
      value: 'First-time contestant; organised a vendor-registration drive as part of a local traders\' collective.',
      source: curatorSrc(),
    },
    pendingCases: {
      value: 'No pending criminal cases declared.',
      source: affidavit(),
    },
    assets: {
      value: 'Declared movable and immovable assets totalling approximately Rs 30 lakh.',
      source: affidavit(),
    },
    // PRD §9.1: an explicit "not declared" answer — the nomination affidavit's education field
    // was left blank (education is optional on Form 26, unlike assets and pending cases). This
    // is a complete, sourced fact about the affidavit, not a gap — see `Sourced.notDeclared`'s
    // doc comment in types.ts, and CandidateReportCard.tsx's neutral "Not declared" rendering.
    education: {
      value: '',
      source: affidavit('EC affidavit — Form 26, education field left blank'),
      notDeclared: true,
    },
    approachability: {
      value: 'Contactable via a public phone line advertised on campaign posters; response times not yet reviewed.',
      source: curatorSrc(),
    },
    news: [
      { title: 'Traders\' collective member enters ward contest', url: '#', publisher: 'Citizen Matters' },
    ],
  },
]
