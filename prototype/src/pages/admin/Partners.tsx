import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useData, useStoreVersion } from '../../context/DataContext'
import { Button } from '../../components/Button'
import type { WardReadiness } from '../../store/store'
import type { Interest, Partner, PartnerKind, User, Ward } from '../../types'

/** Reserved chip pattern (design-system.md §7.7): pending = neutral gray, accepted = forest on
 *  tint, rejected = brick on tint (rejected is a genuine "blocked" outcome, not a routine
 *  inactive toggle). */
function statusChipClass(status: Interest['status']): string {
  if (status === 'accepted') return 'bg-forest-tint text-forest'
  if (status === 'rejected') return 'bg-brick-tint text-brick'
  return 'bg-gray-100 text-gray-600'
}

const PARTNER_KINDS: PartnerKind[] = ['rwa', 'ngo', 'press', 'other']

/** Shared ward-checkbox fieldset for the "Add a partner" form and each roster row's inline
 *  editor — both need the exact same "which wards does this partner reach" control. Local draft
 *  set, applied by the caller's own Save/Add button (matches Roles.tsx's RoleRow explicit-save
 *  convention — nothing here writes to the store itself). */
function WardCoverageFieldset({
  legendId,
  idPrefix,
  wards,
  wardIds,
  onToggle,
}: {
  legendId: string
  idPrefix: string
  wards: Ward[]
  wardIds: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <fieldset className="space-y-1">
      <legend id={legendId} className="mb-1 text-sm font-medium text-ink">
        Ward coverage
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {wards.map((ward) => {
          const id = `${idPrefix}-${ward.id}`
          return (
            <div key={ward.id} className="flex items-center gap-1.5">
              <input
                id={id}
                type="checkbox"
                checked={wardIds.has(ward.id)}
                onChange={() => onToggle(ward.id)}
                className="h-4 w-4 rounded-sm border-gray-300 text-forest focus:ring-forest"
              />
              <label htmlFor={id} className="text-sm text-ink">
                {ward.name}
              </label>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

interface InterestRowProps {
  interest: Interest
  admin: User
}

/**
 * One expression-of-interest row (PRD §5.13). Nobody self-activates from this row alone:
 * - Accepting an `awareness` application calls `reviewInterest` (the moderation decision) AND
 *   `createPartner` (the actual provisioning) — two separate store calls for two separate acts,
 *   matching the IA's own framing ("granting a role is a different act from listing a partner").
 * - Accepting a `curation` application calls ONLY `reviewInterest`. The applicant is anonymous —
 *   there is no account to grant the curator role to yet — so this row is honest about what
 *   happened: the application is marked accepted, and a human must still vet the applicant and
 *   grant the role/ward scope at `/admin/roles` once they have a registered account. This page
 *   never fakes an automatic grant or invents an account.
 */
function InterestRow({ interest, admin }: InterestRowProps) {
  const data = useData()
  const [kind, setKind] = useState<PartnerKind>('other')
  const [error, setError] = useState<string | null>(null)

  function accept(): void {
    try {
      data.reviewInterest(interest.id, 'accepted', admin)
      if (interest.path === 'awareness') {
        data.createPartner(
          {
            name: interest.name,
            kind,
            wardIds: interest.wardId ? [interest.wardId] : [],
            interestId: interest.id,
          },
          admin,
        )
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept this application.')
    }
  }

  function reject(): void {
    try {
      data.reviewInterest(interest.id, 'rejected', admin)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject this application.')
    }
  }

  // Fix: `Partner.interestId` is a real foreign key back to this Interest (set by `accept()`
  // above, via `createPartner`'s `interestId` input) — NOT a name-match. A name-match would
  // silently collide once an admin can also add a partner directly (see the "Add a partner"
  // form below): two partners sharing a name, or a directly-added partner whose name happens to
  // match an applicant's, could no longer be told apart by `.find(p => p.name === ...)`.
  const provisionedPartner =
    interest.status === 'accepted' && interest.path === 'awareness'
      ? data.listPartners().find((p) => p.interestId === interest.id)
      : undefined

  return (
    <li className="space-y-2 rounded-md border border-gray-300 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{interest.name}</p>
          <p className="text-xs text-ink/60">{interest.contact}</p>
        </div>
        <span
          className={`rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium capitalize ${statusChipClass(interest.status)}`}
        >
          {interest.path} · {interest.status}
        </span>
      </div>

      {interest.wardId && (
        <p className="text-xs text-ink/60">
          Ward: {data.getWard(interest.wardId)?.name ?? interest.wardId}
        </p>
      )}
      {interest.note && <p className="text-sm text-ink/80">{interest.note}</p>}

      {error && (
        <p role="alert" className="rounded-sm bg-brick-tint px-3 py-2 text-sm text-brick">
          {error}
        </p>
      )}

      {interest.status === 'pending' && (
        <div className="flex flex-wrap items-center gap-3">
          {interest.path === 'awareness' && (
            <label className="flex items-center gap-1.5 text-sm text-ink">
              Partner type
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as PartnerKind)}
                aria-label={`Partner type for ${interest.name}`}
                className="rounded-sm border border-gray-300 px-2 py-1 text-sm focus:border-forest"
              >
                {PARTNER_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button type="button" variant="primary" onClick={accept}>
            Accept
          </Button>
          <Button type="button" variant="destructive" onClick={reject}>
            Reject
          </Button>
        </div>
      )}

      {interest.status === 'accepted' && interest.path === 'awareness' && (
        <p className="text-sm text-forest">
          {provisionedPartner ? (
            <>
              Partner kit provisioned:{' '}
              <Link
                to={`/partner/${provisionedPartner.slug}`}
                className="underline underline-offset-2 hover:no-underline"
              >
                /partner/{provisionedPartner.slug}
              </Link>
            </>
          ) : (
            'Accepted, but no matching partner record was found on this device.'
          )}
        </p>
      )}

      {interest.status === 'accepted' && interest.path === 'curation' && (
        <p className="text-sm text-ink/80">
          Accepted — applications are not access. This applicant has no account yet, so nothing
          was granted automatically. Next: vet them, then once they have a registered account,
          grant the curator role and ward scope at{' '}
          <Link to="/admin/roles" className="text-forest underline underline-offset-2">
            Roles &amp; access
          </Link>
          .
        </p>
      )}
    </li>
  )
}

interface AddPartnerFormProps {
  wards: Ward[]
  admin: User
}

/**
 * Free-form "add a partner" form (IA §6.4 — direct provisioning, independent of the EOI queue).
 * Reuses `createPartner` (no duplicated slug logic — see `slugifyPartnerName`/`uniquePartnerSlug`
 * in store.ts, both unchanged by this form). No `interestId` is passed: a partner added here has
 * no originating EOI, matching `Partner.interestId`'s "undefined for a directly-added partner"
 * contract.
 */
function AddPartnerForm({ wards, admin }: AddPartnerFormProps) {
  const data = useData()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<PartnerKind>('other')
  const [wardIds, setWardIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Partner | null>(null)

  function toggleWard(id: string): void {
    setCreated(null)
    setWardIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    if (!name.trim()) {
      setError('Enter a partner name.')
      setCreated(null)
      return
    }
    try {
      const partner = data.createPartner(
        { name: name.trim(), kind, wardIds: Array.from(wardIds) },
        admin,
      )
      setCreated(partner)
      setError(null)
      setName('')
      setKind('other')
      setWardIds(new Set())
    } catch (err) {
      setCreated(null)
      setError(err instanceof Error ? err.message : 'Could not add this partner.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Add a partner"
      className="space-y-3 rounded-md border border-gray-300 p-4"
    >
      <div>
        <label htmlFor="new-partner-name" className="mb-1 block text-sm font-medium text-ink">
          Partner name
        </label>
        <input
          id="new-partner-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setCreated(null)
          }}
          className="w-full min-h-[44px] rounded-sm border border-gray-300 px-3 py-2 text-base focus:border-forest"
        />
      </div>
      <div>
        <label htmlFor="new-partner-kind" className="mb-1 block text-sm font-medium text-ink">
          Partner type
        </label>
        <select
          id="new-partner-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as PartnerKind)}
          className="w-full max-w-xs min-h-[44px] rounded-sm border border-gray-300 px-3 py-2 text-base focus:border-forest"
        >
          {PARTNER_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <WardCoverageFieldset
        legendId="new-partner-wards-legend"
        idPrefix="new-partner-ward"
        wards={wards}
        wardIds={wardIds}
        onToggle={toggleWard}
      />
      {error && (
        <p role="alert" className="rounded-sm bg-brick-tint px-3 py-2 text-sm text-brick">
          {error}
        </p>
      )}
      {created && !error && (
        <p className="rounded-sm bg-forest-tint px-3 py-2 text-sm text-forest">
          Added —{' '}
          <Link
            to={`/partner/${created.slug}`}
            className="underline underline-offset-2 hover:no-underline"
          >
            /partner/{created.slug}
          </Link>
        </p>
      )}
      <Button type="submit" variant="primary">
        Add partner
      </Button>
    </form>
  )
}

interface PartnerRosterRowProps {
  partner: Partner
  wards: Ward[]
  admin: User
  registrationCount: number
}

/**
 * One partner roster row (IA §6.4). Read-only by default; "Edit" reveals an inline draft editor
 * (matches Roles.tsx's RoleRow explicit-save convention) for name/kind/ward coverage, saved via
 * `updatePartner`. The slug is never editable here — see `updatePartner`'s doc comment in
 * store.ts for why a rename must not change it (an already-shared `?src=`/`/partner/{slug}` link
 * must keep working). Also renders this partner's aggregate registration count (Fix: IA §6.4's
 * "registrations attributed per partner") — a plain number, never a citizen list.
 */
function PartnerRosterRow({ partner, wards, admin, registrationCount }: PartnerRosterRowProps) {
  const data = useData()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(partner.name)
  const [kind, setKind] = useState<PartnerKind>(partner.kind)
  const [wardIds, setWardIds] = useState<Set<string>>(new Set(partner.wardIds))
  const [error, setError] = useState<string | null>(null)

  function toggleWard(id: string): void {
    setWardIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startEdit(): void {
    setName(partner.name)
    setKind(partner.kind)
    setWardIds(new Set(partner.wardIds))
    setError(null)
    setEditing(true)
  }

  function handleSave(): void {
    if (!name.trim()) {
      setError('Enter a partner name.')
      return
    }
    try {
      data.updatePartner(
        partner.slug,
        { name: name.trim(), kind, wardIds: Array.from(wardIds) },
        admin,
      )
      setError(null)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this partner.')
    }
  }

  if (!editing) {
    return (
      <li className="rounded-sm border border-gray-300 px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Link
              to={`/partner/${partner.slug}`}
              className="font-medium text-forest underline underline-offset-2 hover:no-underline"
            >
              {partner.name}
            </Link>
            <span className="ml-2 text-xs text-ink/60">{partner.kind}</span>
          </div>
          <Button type="button" variant="secondary" onClick={startEdit} aria-label={`Edit ${partner.name}`}>
            Edit
          </Button>
        </div>
        <p className="text-xs text-ink/60">
          {partner.wardIds.length === 0
            ? 'No wards yet'
            : partner.wardIds.map((id) => wards.find((w) => w.id === id)?.name ?? id).join(', ')}
        </p>
        <p className="text-xs text-ink/60">
          {registrationCount} registration{registrationCount === 1 ? '' : 's'} attributed
        </p>
      </li>
    )
  }

  return (
    <li className="space-y-3 rounded-md border border-forest bg-forest-tint p-4 text-sm">
      <div>
        <label
          htmlFor={`edit-partner-name-${partner.slug}`}
          className="mb-1 block text-sm font-medium text-ink"
        >
          Partner name
        </label>
        <input
          id={`edit-partner-name-${partner.slug}`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full min-h-[44px] rounded-sm border border-gray-300 bg-white px-3 py-2 text-base focus:border-forest"
        />
      </div>
      <div>
        <label
          htmlFor={`edit-partner-kind-${partner.slug}`}
          className="mb-1 block text-sm font-medium text-ink"
        >
          Partner type
        </label>
        <select
          id={`edit-partner-kind-${partner.slug}`}
          value={kind}
          onChange={(e) => setKind(e.target.value as PartnerKind)}
          className="w-full max-w-xs min-h-[44px] rounded-sm border border-gray-300 bg-white px-3 py-2 text-base focus:border-forest"
        >
          {PARTNER_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <WardCoverageFieldset
        legendId={`edit-partner-wards-legend-${partner.slug}`}
        idPrefix={`edit-partner-ward-${partner.slug}`}
        wards={wards}
        wardIds={wardIds}
        onToggle={toggleWard}
      />
      {error && (
        <p role="alert" className="rounded-sm bg-brick-tint px-3 py-2 text-sm text-brick">
          {error}
        </p>
      )}
      <p className="text-xs text-ink/60">
        Slug stays <code>{partner.slug}</code> even after a rename — existing tagged links keep
        working.
      </p>
      <div className="flex gap-3">
        <Button type="button" variant="primary" onClick={handleSave}>
          Save
        </Button>
        <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </li>
  )
}

interface HeldWardRowProps {
  wardId: string
  wardName: string
  readiness: WardReadiness
  admin: User
}

/** One row of the held-wards work queue (PRD §9.1/§9.2 — held wards are visible to admins, with
 *  an admin override). A held ward is a curator-coverage gap needing fixing, not a silent skip —
 *  the reason string always says which half of readiness is missing. */
function HeldWardRow({ wardId, wardName, readiness, admin }: HeldWardRowProps) {
  const data = useData()
  const [error, setError] = useState<string | null>(null)

  // Fix 1: a zero-candidate ward is incomplete for a distinct, honest reason ("no candidates
  // filed") — not "report cards have gaps," which would misleadingly imply candidates exist with
  // missing fields.
  const completeness = data.wardCompleteness(wardId)
  const reason = readiness.clearedByCandidateChange
    ? 'Sign-off was cleared — the candidate list changed since the last sign-off.'
    : !readiness.complete
      ? completeness.candidateCount === 0
        ? 'No candidates have filed nominations in this ward yet.'
        : 'Not yet complete — one or more candidate report cards have gaps.'
      : 'Complete, but not yet signed off by a curator.'

  function override(): void {
    try {
      data.overrideHold(wardId, admin)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not override this hold.')
    }
  }

  return (
    <li className="space-y-2 rounded-md border border-gray-300 bg-sun-tint p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to={`/curator/ward/${wardId}`}
          className="font-semibold text-ink underline underline-offset-2 hover:no-underline"
        >
          {wardName}
        </Link>
        <span className="rounded-full border border-transparent bg-sun-tint px-2.5 py-0.5 text-xs font-medium text-ink">
          Held
        </span>
      </div>
      <p className="text-sm text-ink">{reason}</p>
      {error && (
        <p role="alert" className="rounded-sm bg-brick-tint px-3 py-2 text-sm text-brick">
          {error}
        </p>
      )}
      <Button type="button" variant="primary" onClick={override}>
        Override hold
      </Button>
    </li>
  )
}

/**
 * Partners & ward coverage (PRD §5.12 coverage view, §5.13 EOI review, §9.1 held wards; IA §6.4,
 * `/admin/partners`). Admin-only (`RoleGuard allow={['admin']}` in routes.tsx).
 *
 * WHY admin-only matters here specifically, more than on the other admin pages: `listInterests()`
 * is unguarded in the store (mirrors `listAudit()`'s precedent — see store.ts), and unlike
 * `listAudit()`'s system-authored strings, an `Interest` record carries an applicant's real name
 * and contact details (PII). The store is not a security boundary in this client-side prototype —
 * THIS PAGE'S RoleGuard is the actual enforcement point that keeps that PII off a non-admin's
 * screen. Do not remove the guard or add a second render path into this component.
 *
 * `useStoreVersion()` — this page renders mutable store data throughout (coverage, partners, EOI
 * queue, held wards), so it must re-render on every store mutation, including ones it triggers
 * itself (accept/reject/override).
 */
export default function Partners() {
  const { user } = useAuth()
  const data = useData()
  useStoreVersion()

  const coverage = data.partnerWardCoverage()
  const partners = data.listPartners()
  const interests = data.listInterests()
  const heldWards = data.listHeldWards()
  const wards = data.listWards()
  // Fix: IA §6.4's "registrations attributed per partner" — AGGREGATE counts only (see
  // `partnerRegistrationCounts`'s doc comment in store.ts for the privacy guarantee).
  const registrationCounts = new Map(
    data.partnerRegistrationCounts().map((row) => [row.slug, row.count]),
  )

  // IA §6.4: the EOI queue is split by PATH (spread awareness / curate data), not by status — a
  // resolved application stays visible in place (same list, same position) rather than being
  // hidden away, so accepting/rejecting it is a visible in-place status change, not a vanishing
  // row (matches UserRow/RoleRow's existing "stays on screen with updated status" convention).
  const awarenessInterests = interests.filter((i) => i.path === 'awareness')
  const curationInterests = interests.filter((i) => i.path === 'curation')

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8">
      <div>
        <h1 className="text-2xl text-ink sm:text-3xl">Partners &amp; ward coverage</h1>
        <p className="mt-1 text-sm text-ink/70">
          Distribution partner reach across the city, expressions of interest awaiting a decision,
          and wards currently held from candidate-referencing comms.
        </p>
      </div>

      <section aria-labelledby="coverage-heading" className="space-y-4">
        <div>
          <h2 id="coverage-heading" className="text-lg font-semibold text-ink">
            Ward coverage
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            {coverage.totalWards} wards city-wide (the real GBA count). Of this prototype&apos;s{' '}
            {coverage.byWard.length} seeded wards, {coverage.coveredWardIds.length} have at least
            one partner and {coverage.uncoveredWardIds.length} have none — reach that skews to a
            handful of wards is exactly the failure mode this view exists to catch.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">Partner roster</h3>
          {partners.length === 0 ? (
            <p className="mt-1 text-sm text-ink/70">No partners yet.</p>
          ) : (
            <ul aria-label="Partner roster" className="mt-2 space-y-2">
              {partners.map((p) => (
                <PartnerRosterRow
                  key={p.slug}
                  partner={p}
                  wards={wards}
                  admin={user}
                  registrationCount={registrationCounts.get(p.slug) ?? 0}
                />
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">Add a partner</h3>
          <p className="mt-1 text-sm text-ink/70">
            Provision a partner directly, without an expression-of-interest application.
          </p>
          <div className="mt-2">
            <AddPartnerForm wards={wards} admin={user} />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">Uncovered wards — work queue</h3>
          {coverage.uncoveredWardIds.length === 0 ? (
            <p className="mt-1 text-sm text-ink/70">Every ward on record has at least one partner.</p>
          ) : (
            <ul aria-label="Uncovered wards" className="mt-2 space-y-1">
              {coverage.uncoveredWardIds.map((id) => {
                const ward = coverage.byWard.find((w) => w.wardId === id)
                return (
                  <li
                    key={id}
                    className="rounded-sm border border-dashed border-gray-300 px-3 py-2 text-sm text-ink/80"
                  >
                    {ward?.wardName ?? id} — no partner
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="eoi-heading" className="space-y-4">
        <div>
          <h2 id="eoi-heading" className="text-lg font-semibold text-ink">
            Expressions of interest
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            Applications are not access — accepting only starts the hand-off below; nobody
            self-activates.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">Spread awareness</h3>
          {awarenessInterests.length === 0 ? (
            <p className="mt-1 text-sm text-ink/70">No applications yet.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {awarenessInterests.map((i) => (
                <InterestRow key={i.id} interest={i} admin={user} />
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">Curate data</h3>
          {curationInterests.length === 0 ? (
            <p className="mt-1 text-sm text-ink/70">No applications yet.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {curationInterests.map((i) => (
                <InterestRow key={i.id} interest={i} admin={user} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="held-heading" className="space-y-3">
        <h2 id="held-heading" className="text-lg font-semibold text-ink">
          Held wards (PRD §9.1)
        </h2>
        <p className="text-sm text-ink/70">
          A held ward is a curator-coverage gap needing fixing, not a silent skip. An admin can
          override the hold to let a candidate-referencing send go out anyway.
        </p>
        {heldWards.length === 0 ? (
          <p className="text-sm text-ink/70">No wards are currently held.</p>
        ) : (
          <ul aria-label="Held wards" className="space-y-3">
            {heldWards.map((row) => (
              <HeldWardRow
                key={row.wardId}
                wardId={row.wardId}
                wardName={row.wardName}
                readiness={row.readiness}
                admin={user}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
