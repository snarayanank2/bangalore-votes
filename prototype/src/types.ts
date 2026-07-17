export type Corporation = 'North' | 'South' | 'East' | 'West' | 'Central'
export type SourceType = 'affidavit' | 'curator'

export interface Source { type: SourceType; label: string; url?: string }
/** A value paired with its provenance.
 *  `notDeclared` (PRD §9.1): marks this field as an EXPLICIT "not declared" answer — a valid,
 *  COMPLETE fact about the underlying affidavit (e.g. "the candidate declared no pending cases"
 *  is different from "nobody has looked yet"), not a gap. Meaningful primarily for the three
 *  affidavit-derived candidate fields (`pendingCases`, `assets`, `education`); the store's
 *  ward-readiness completeness check (`wardCompleteness` in store.ts) treats a field with
 *  `notDeclared: true` as complete regardless of whether `value` is empty. A `notDeclared` field
 *  still MUST carry a real `source` — "not declared" is a fact about the affidavit, so it still
 *  needs sourcing to that affidavit; `updateCandidate`'s sourcing guard applies unchanged.
 *  `aiExtracted` (PRD §5.2): set by the store's `ingestAffidavit` on the affidavit fields it
 *  populates — the field is PUBLISHED (visible to citizens) but carries a visible "AI-extracted"
 *  marker until a curator confirms or edits it. Cleared implicitly: any later curator save
 *  (`updateCandidate`) replaces the whole Sourced object without the flag. Mirrors the
 *  machine-translation trade (§8): publish immediately, flag flow is the correction net. */
export interface Sourced<T> { value: T; source: Source; notDeclared?: boolean; aiExtracted?: boolean }

export interface Ward {
  id: string            // slug, e.g. "koramangala"
  number: number
  name: string
  corporation: Corporation
  issueIds: string[]    // curator-defined votable issues for this ward
  /** PRD §9.1 ward data-readiness gating — curator sign-off that this ward is ready for a
   *  candidate-referencing send. Present only once a curator has explicitly marked the ward
   *  ready via `signOffWard`; cleared automatically by `addCandidate`/`withdrawCandidate` in
   *  store.ts whenever the ward's candidate set materially changes (see
   *  `signOffClearedByCandidateChange` below) — a sign-off given against one candidate list must
   *  never silently apply to a different one. */
  readySignOff?: { by: string; at: string }
  /** True once a sign-off above has been cleared automatically by a candidate-set change, and no
   *  fresh sign-off has happened since (a fresh `signOffWard` resets this to `false`). Lets the
   *  curator dashboard call these wards out ahead of wards that were simply never signed off. */
  signOffClearedByCandidateChange?: boolean
  /** PRD §9.1 admin override of a comms hold — lets a candidate-referencing send go out for this
   *  ward despite it not being (mechanically complete AND signed off), e.g. a known
   *  curator-coverage gap an admin has chosen not to block a send on. Admin-only
   *  (`overrideHold`). NOT auto-cleared by a candidate-set change — §9.1 only specifies
   *  auto-clearing for `readySignOff`. */
  holdOverride?: { by: string; at: string }
}

export interface NewsLink { title: string; url: string; publisher: string }

/** The affidavit a candidate's official fields were AI-extracted from (PRD §5.2). The platform's
 *  stored copy (`storedUrl`) — not the EC's own URL, which can move or rot — is the public
 *  source link on affidavit-sourced fields. In this prototype `storedUrl` is an inert `#…`
 *  placeholder: no real file is stored, matching the project's placeholder-link convention. */
export interface CandidateAffidavit {
  providedFileName?: string
  providedEcUrl?: string
  storedUrl: string
  ingestedAt: string
}

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
  affidavit?: CandidateAffidavit
}

export interface Issue { id: string; wardId: string; title: string; description: string }
export interface IssueVote { userId: string; wardId: string; issueIds: string[] } // up to 3

export type Role = 'anonymous' | 'citizen' | 'curator' | 'admin'

/** A registered user's notification preferences (IA §4.2). Purely a personal setting — never
 * written to the audit log (see the "no audit" comment on setNotificationPrefs in store.ts).
 *
 * Channel toggles only — no per-topic subscriptions. The campaign is a small, fixed calendar of
 * ward-scoped sends (PRD §9.3), not an open-ended stream a user picks topics from; the only real
 * choice is how to receive it, or not at all. */
export interface NotificationPrefs {
  emailEnabled: boolean
  whatsappEnabled: boolean
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
  /** PRD §10 / IA §7.1: registration is the affirmative consent act for ward election updates.
   *  Recorded once at `createUser` as the opt-in evidence WhatsApp policy requires — `at` is a
   *  stamp (see lib/stamps.ts) and `wordingVersion` names which consent copy was shown, so a
   *  later wording change never gets misattributed to consent given under the old text. */
  registrationConsent?: { at: string; wordingVersion: string }
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
  slug: string       // URL-safe id, used in ?src={slug} and /partner/{slug}. Immutable once set —
                      // `updatePartner` (store.ts) can rename `name` without ever changing `slug`,
                      // so an already-shared `?src=` link or `/partner/{slug}` URL never breaks.
  name: string
  kind: PartnerKind
  wardIds: string[]  // wards this partner is understood to reach/represent
  /** The `Interest.id` this partner was provisioned from, if it was created by accepting an
   *  `awareness` expression of interest (PRD §5.13) — a real foreign key, not a name-match, so
   *  two partners that happen to share a name (or a directly-added partner that collides with an
   *  EOI applicant's chosen name) can never be confused with one another. Undefined for a
   *  seeded demo partner or one added directly by an admin (no originating EOI). */
  interestId?: string
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
