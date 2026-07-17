import { Link, useParams } from 'react-router-dom'
import { useData, useStoreVersion } from '../../context/DataContext'

/** The production domain (PRD §14: "every page has a distinct URL under
 *  bangalore-votes.opencity.in"). Used only to build a display-only tagged link — this prototype
 *  makes no network call to it. */
const SITE_ORIGIN = 'https://bangalore-votes.opencity.in'

/**
 * Partner kit (PRD §5.12, IA §3.19, `/partner/{partner-slug}`) — UNLISTED (no route here is
 * linked from the app bar or footer, and it's not meant to be indexed) but explicitly NOT
 * access-controlled: it carries nothing sensitive, and a login wall would defeat the entire point
 * of a page built for someone who hasn't registered yet. Anonymous, matches PRD §7's permissions
 * matrix ("View a partner kit page" — ✅ for every role including anonymous).
 *
 * An unknown/mistyped slug must never crash this page — it degrades to a friendly "not found"
 * message instead (this route has no RoleGuard and no 404 redirect, unlike role-gated pages).
 */
export default function PartnerKit() {
  const { partnerSlug } = useParams<{ partnerSlug: string }>()
  const data = useData()
  useStoreVersion()

  const partner = partnerSlug ? data.getPartner(partnerSlug) : undefined

  if (!partner) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Partner kit not found</h1>
        <p className="text-sm text-ink/80">
          We don&apos;t recognise this partner link. If you were sent this page, double-check the
          link, or visit{' '}
          <Link to="/" className="text-brand underline underline-offset-2">
            the home page
          </Link>{' '}
          to find your ward directly.
        </p>
      </div>
    )
  }

  const taggedLink = `${SITE_ORIGIN}/?src=${partner.slug}`
  const enForwardText = `Bengaluru has new GBA ward boundaries. Find your ward, read neutral, sourced candidate report cards, and see what your neighbours say matters most — all in one place: ${taggedLink}`

  // PRD §5.12/§5.17: the second ready-to-paste variant — aimed at first-time voters, tagged to
  // the /voting-guide checklist hub rather than the home page.
  const firstTimeVoterLink = `${SITE_ORIGIN}/voting-guide?src=${partner.slug}`
  const enFirstTimeVoterText = `Voting in your first Bengaluru ward election? This checklist walks you through it step by step — check you're on the roll, get or transfer your Voter ID before the deadline, find your new ward, and know exactly what happens at the booth: ${firstTimeVoterLink}`

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/60">Partner kit</p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{partner.name}</h1>
      </div>

      <section
        aria-labelledby="demo-partner-heading"
        className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4"
      >
        <h2
          id="demo-partner-heading"
          className="text-sm font-semibold uppercase tracking-wide text-amber-900"
        >
          Demo partner — fictional
        </h2>
        <p className="text-sm text-amber-900">
          {partner.name} is a fictional demo organisation used to show how this page works. It is
          not a real Bengaluru RWA, NGO, or press outlet, and this is not a real partnership with
          anyone.
        </p>
      </section>

      <section aria-labelledby="link-heading" className="space-y-2">
        <h2 id="link-heading" className="text-lg font-semibold text-ink">
          Your tagged link
        </h2>
        <p className="text-sm text-ink/80">
          Forwards through this link are attributed to you for measurement only — it doesn&apos;t
          change anything the person who clicks it sees or can do.
        </p>
        <input
          type="text"
          readOnly
          value={taggedLink}
          aria-label="Your tagged link"
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-ink"
        />
      </section>

      <section aria-labelledby="forward-heading" className="space-y-3">
        <h2 id="forward-heading" className="text-lg font-semibold text-ink">
          Ready-to-paste WhatsApp message
        </h2>
        <div>
          <h3 className="text-sm font-semibold text-ink">English — general message</h3>
          <p className="mt-1 whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-sm text-ink/90">
            {enForwardText}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">English — first-time voter message</h3>
          <p className="mt-1 whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-sm text-ink/90">
            {enFirstTimeVoterText}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">ಕನ್ನಡ (Kannada)</h3>
          <p className="text-sm text-ink/70">
            A reviewed Kannada translation of these messages is not yet available in this
            prototype. This is a real forward-text asset that ships to real partners, unlike the
            app&apos;s UI strings — a wrong or unnatural machine translation here is worse than
            none, so we are not inventing one. Until a genuine Kannada version is ready, use the
            English texts above.
          </p>
        </div>
      </section>

      <section aria-labelledby="poster-heading" className="space-y-2">
        <h2 id="poster-heading" className="text-lg font-semibold text-ink">
          Poster (WhatsApp-sized)
        </h2>
        <div
          role="img"
          aria-label="Placeholder poster image — final artwork not yet produced"
          className="flex aspect-square w-full max-w-xs flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">
            Poster placeholder
          </p>
          <p className="text-xs text-ink/50">
            1080 × 1080 — sized for a WhatsApp status. No final artwork exists yet in this
            prototype.
          </p>
        </div>
      </section>

      <section aria-labelledby="neutrality-heading" className="space-y-2 border-t border-slate-200 pt-6">
        <h2 id="neutrality-heading" className="text-lg font-semibold text-ink">
          &quot;Isn&apos;t forwarding this campaigning?&quot;
        </h2>
        <p className="text-sm text-ink/80">
          No. Bangalore Votes doesn&apos;t endorse, rank, or promote any candidate — every
          candidate&apos;s report card uses identical neutral formatting, and nothing on this kit
          page names or favours a candidate. Forwarding this link shares a neutral information
          tool that helps your neighbours find accurate, sourced facts about their own ward
          election; it is not campaign material for anyone. See{' '}
          <Link to="/about" className="text-brand underline underline-offset-2">
            how we source data
          </Link>{' '}
          for more.
        </p>
      </section>
    </div>
  )
}
