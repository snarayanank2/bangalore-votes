/**
 * `?src={partner-slug}` visit attribution (PRD §5.12). Any page accepts the param; the value must
 * survive the rest of the visit — including navigating to pages that no longer carry the query
 * string, and opening the Register/Login modal, which is mounted OUTSIDE the router tree (see
 * App.tsx) and so cannot read the URL itself via a router hook. sessionStorage is the natural
 * fit: it's read/write from anywhere (no Router context required, unlike useSearchParams), and it
 * scopes the value to "this visit" (cleared when the tab closes) rather than persisting
 * indefinitely across unrelated future visits the way localStorage would.
 *
 * Capture happens once, at the top of the route tree (`RootLayout` in routes.tsx, which — unlike
 * this module — DOES have router context) via `captureSrcFromSearch`. Read happens wherever
 * attribution needs to be applied — today, `RegisterLoginForm` at the moment registration
 * completes, so it can pass the value to `AuthContext.loginNew` -> `store.createUser`.
 */
const SRC_KEY = 'bv-src'

/** Persists a `?src=` value from the given search params, if present and non-empty. Silently a
 *  no-op otherwise (including on a later page with no `src` param at all) — an existing captured
 *  value keeps applying for the rest of the visit unless overwritten by a later, different
 *  `?src=` (last-touch attribution, matching how referral/campaign attribution ordinarily works
 *  when someone clicks a second tagged link in the same session). */
export function captureSrcFromSearch(search: URLSearchParams): void {
  const src = search.get('src')
  if (src && src.trim() !== '') sessionStorage.setItem(SRC_KEY, src.trim())
}

/** The partner slug (if any) attributed to this visit so far. Returns `undefined` if no `?src=`
 *  has ever been seen this visit. Does NOT validate the slug against `state.partners` — see the
 *  doc comment on `createUser`'s `src` param in store.ts for why an unrecognised value is still
 *  recorded as-is rather than dropped. */
export function getAttributedSrc(): string | undefined {
  return sessionStorage.getItem(SRC_KEY) ?? undefined
}
