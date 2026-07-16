export type Corporation = 'North' | 'South' | 'East' | 'West' | 'Central'
export type SourceType = 'affidavit' | 'curator'

export interface Source { type: SourceType; label: string; url?: string }
/** A value paired with its provenance. */
export interface Sourced<T> { value: T; source: Source }

export interface Ward {
  id: string            // slug, e.g. "koramangala"
  number: number
  name: string
  corporation: Corporation
  oldWardsNote: string  // human description of old→new mapping
  issueIds: string[]    // curator-defined votable issues for this ward
}

export interface NewsLink { title: string; url: string; publisher: string }

export interface Candidate {
  id: string
  slug: string
  wardId: string
  name: string
  photoUrl: string      // placeholder avatar URL
  party: string         // "Independent" if none
  trackRecord: Sourced<string>
  pendingCases: Sourced<string>
  assets: Sourced<string>
  education: Sourced<string>
  approachability: Sourced<string>
  news: NewsLink[]      // curator-compiled
}

export interface Issue { id: string; wardId: string; title: string; description: string }
export interface IssueVote { userId: string; wardId: string; issueIds: string[] } // up to 3

export type Role = 'anonymous' | 'citizen' | 'curator' | 'admin'

/** A registered user's notification preferences (IA §4.2). Purely a personal setting — never
 * written to the audit log (see the "no audit" comment on setNotificationPrefs in store.ts). */
export interface NotificationPrefs {
  emailEnabled: boolean
  whatsappEnabled: boolean
  subscriptions: {
    electionNotice: boolean   // election date / official notice updates
    rollDeadlines: boolean    // voter roll deadline reminders
    candidateChanges: boolean // candidate profile changes in the user's ward
  }
}

export interface User {
  id: string
  name: string
  contact: string       // email or WhatsApp
  role: Role
  homeWardId?: string
  language: 'en' | 'kn'
  curatorWardIds?: string[] // scope for curators
  active: boolean
  notificationPrefs?: NotificationPrefs // undefined until the user visits /account/notifications
  /** The partner slug (if any) this registration was attributed to via `?src=` (PRD §5.12).
   *  MEASUREMENT ONLY — never read to grant a permission or change what the citizen sees. Set
   *  once at registration (createUser) and never changed afterwards. */
  src?: string
}

/** The kind of organisation a partner is (PRD §5.12) — free enough to cover the partner-led
 *  distribution channels named in the PRD (RWAs, civic orgs, press) without over-modelling. */
export type PartnerKind = 'rwa' | 'ngo' | 'press' | 'other'

/**
 * A distribution/recruitment partner (PRD §5.12). NOT a role (§14 locked decision) — a Partner
 * record carries no login, no permissions, and is unrelated to `Role`. Partner records are
 * managed by admins; this prototype only seeds a few fixed demo partners (see
 * `src/data/partners.ts`) and provides read selectors — no admin CRUD UI yet (later task).
 */
export interface Partner {
  slug: string       // URL-safe id, used in ?src={slug} and /partner/{slug}
  name: string
  kind: PartnerKind
  wardIds: string[]  // wards this partner is understood to reach/represent
}

export type SubmissionStatus = 'pending' | 'accepted' | 'rejected'
export interface Submission {
  id: string
  kind: 'flag'
  wardId: string
  candidateId?: string
  field: string          // which claim/field is flagged
  detail: string
  sourceUrl?: string
  submittedByUserId: string
  status: SubmissionStatus
  reason?: string        // rejection reason
  count: number          // deduped flag count on same field
  createdAt: string      // ISO string (seed-fixed; new ones use a monotonic stamp)
}

export type InterestPath = 'awareness' | 'curation'
export type InterestStatus = 'pending' | 'accepted' | 'rejected'

/**
 * An anonymous expression of interest submitted via `/partner-with-us` (PRD §5.13). No account
 * is required to submit — see `submitInterest`'s doc comment in store.ts. Lands as `pending`;
 * only an admin's `reviewInterest` decision changes its status. Nobody self-activates: accepting
 * an `awareness` application is what later provisions a partner slug/kit, and accepting a
 * `curation` application hands off to the existing curator vetting path — neither happens
 * automatically from this record alone.
 */
export interface Interest {
  id: string
  path: InterestPath
  name: string
  contact: string
  wardId?: string   // which ward the applicant cares about/would cover (mainly relevant to `curation`)
  note: string
  status: InterestStatus
  createdAt: string
}

export interface AuditEntry {
  id: string
  at: string
  actorUserId: string
  action: string         // e.g. "candidate.trackRecord.updated"
  wardId?: string
  detail: string
}
