import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useData, useStoreVersion } from '../../context/DataContext'
import type { WardReadiness } from '../../store/store'
import type { Interest, PartnerKind, User } from '../../types'

const PARTNER_KINDS: PartnerKind[] = ['rwa', 'ngo', 'press', 'other']

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
          { name: interest.name, kind, wardIds: interest.wardId ? [interest.wardId] : [] },
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

  // `createPartner` writes `Partner.name` from `interest.name` verbatim (see store.ts's doc
  // comment on createPartner) — matching on name is how this row finds "its" provisioned kit
  // page without the store needing a dedicated Interest -> Partner foreign key.
  const provisionedPartner =
    interest.status === 'accepted' && interest.path === 'awareness'
      ? data.listPartners().find((p) => p.name === interest.name)
      : undefined

  return (
    <li className="space-y-2 rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{interest.name}</p>
          <p className="text-xs text-ink/60">{interest.contact}</p>
        </div>
        <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs font-medium capitalize text-ink/70">
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
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
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
                className="rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {PARTNER_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={accept}
            className="rounded border border-emerald-600 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={reject}
            className="rounded border border-red-600 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600"
          >
            Reject
          </button>
        </div>
      )}

      {interest.status === 'accepted' && interest.path === 'awareness' && (
        <p className="text-sm text-emerald-800">
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
          <Link to="/admin/roles" className="text-brand underline underline-offset-2">
            Roles &amp; access
          </Link>
          .
        </p>
      )}
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
    <li className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to={`/curator/ward/${wardId}`}
          className="font-semibold text-ink underline underline-offset-2 hover:no-underline"
        >
          {wardName}
        </Link>
        <span className="rounded-full border border-amber-400 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-amber-900">
          Held
        </span>
      </div>
      <p className="text-sm text-amber-900">{reason}</p>
      {error && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={override}
        className="rounded border border-slate-700 px-3 py-1.5 text-sm font-semibold text-ink hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand"
      >
        Override hold
      </button>
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

  // IA §6.4: the EOI queue is split by PATH (spread awareness / curate data), not by status — a
  // resolved application stays visible in place (same list, same position) rather than being
  // hidden away, so accepting/rejecting it is a visible in-place status change, not a vanishing
  // row (matches UserRow/RoleRow's existing "stays on screen with updated status" convention).
  const awarenessInterests = interests.filter((i) => i.path === 'awareness')
  const curationInterests = interests.filter((i) => i.path === 'curation')

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Partners &amp; ward coverage</h1>
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
                <li key={p.slug} className="rounded border border-slate-200 px-3 py-2 text-sm">
                  <Link
                    to={`/partner/${p.slug}`}
                    className="font-medium text-brand underline underline-offset-2 hover:no-underline"
                  >
                    {p.name}
                  </Link>
                  <span className="ml-2 text-xs uppercase tracking-wide text-ink/60">{p.kind}</span>
                  <p className="text-xs text-ink/60">
                    {p.wardIds.length === 0
                      ? 'No wards yet'
                      : p.wardIds.map((id) => data.getWard(id)?.name ?? id).join(', ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
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
                    className="rounded border border-dashed border-slate-300 px-3 py-2 text-sm text-ink/80"
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
