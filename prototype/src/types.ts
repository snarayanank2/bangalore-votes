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

export interface AuditEntry {
  id: string
  at: string
  actorUserId: string
  action: string         // e.g. "candidate.trackRecord.updated"
  wardId?: string
  detail: string
}
