# Register-for-updates CTA on ward pages — Design

**Status:** Approved · **Date:** 2026-07-16 · **Type:** Requirement addition (spec + prototype)

## Purpose

Today, an anonymous citizen who searches for their ward and lands on `/ward/{id}` (or its
candidates/compare/issues subpages) has no way to register for updates about that ward from
those pages — registration is only reachable via the app-bar "Sign in" control or by trying a
gated action (flag / vote). This adds a dedicated, ward-context-aware entry point: a citizen who
has just found their ward should be able to register for its updates right there, without first
finding an unrelated flag or vote button to trigger the modal.

This also cleans up a related inconsistency: the ward result page currently carries a "Set as my
ward" action for already-registered users, which duplicates the home-ward switch that already
lives on `/account` (IA §4.1). That duplication is removed as part of this change.

## Scope & placement

A single CTA/status slot appears in the same position on all four ward-scoped pages:
`/ward/{id}`, `/ward/{id}/candidates`, `/ward/{id}/compare`, `/ward/{id}/issues` — directly
below the ward name header on each. The slot is state-dependent and shows exactly one of three
things:

| Visitor state | Slot shows |
|---|---|
| Anonymous | **"Register for updates"** button → opens Register/Login modal |
| Registered, viewing their home ward | **"Receiving updates"** — plain status text, not a control |
| Registered, viewing a ward that is *not* their home ward | nothing |

Switching home ward stays exclusively an `/account` action (already implemented — home ward is
editable there). Nothing in this change adds a "switch home ward" affordance to any ward page.

## Modal integration

The Register/Login modal gains a new trigger, alongside "Sign in" and the existing gated actions
(flag / vote): the "Register for updates" button on a ward page. This trigger differs from the
other two in one way — it carries the ward being viewed into the modal, and the modal's final
step uses it instead of asking the visitor to pick a ward:

- The ward-selection step shows the viewed ward pre-filled and read-only (not a dropdown) when
  the modal was opened from this trigger.
- The language choice on that same step is unchanged.
- On success, the modal resumes in place (closes back onto the same ward page), and the slot
  immediately reflects the new state ("Receiving updates").
- Dismissing the modal without completing OTP behaves exactly as it does for every other
  trigger today (cancels, no side effect).

This is additive to the modal's existing trigger list — "Sign in" and gated flag/vote actions
are unaffected and continue to land on the normal ward-picker step.

## Removed

The "Set as my ward" button currently on `/ward/{id}` for already-registered, different-home-ward
visitors is removed. Home ward switching remains available, unchanged, on `/account`.

## Spec updates

- `docs/information-architecture.md` §3.2 (Ward result): replace the "'Set as my ward' prompt
  for registered users" key element with the three-state slot described above, and note it
  recurs on the candidates/compare/issues subpages.
- `docs/information-architecture.md` §3.3, §3.5, §3.6 (Candidates in ward, Compare candidates,
  Ward issues & voting): add the same slot to each page's key elements.
- `docs/information-architecture.md` §7.1 (Register/Login modal): add "Register for updates" to
  the **Trigger** bullet, and add a behavior note that this trigger pre-fills/locks the ward step
  to the ward being viewed.
- `docs/prd.md` §5.1: no substantive change needed — it already states the ward result page "is
  reused to set a registered user's home ward"; this design is the concrete mechanism for that.

## Prototype implementation

The prototype (`prototype/`) already implements all four ward pages and the Register/Login
modal, so this design also covers the code change, not just the docs:

- **New shared component** (e.g. `prototype/src/components/WardUpdatesCta.tsx`) implementing the
  three-state slot from a `wardId` prop. Read the current user's auth/home-ward state itself
  (`useAuth`), so each page just drops it in — no per-page state-plumbing.
- **`WardResult.tsx`**: remove the existing `isAuthed && (...)` block (the old "Set as my ward" /
  "This is your registered home ward" section) and render `<WardUpdatesCta wardId={ward.id} />`
  in its place.
- **`WardCandidates.tsx`, `CompareCandidates.tsx`, `WardIssues.tsx`**: render the same
  `<WardUpdatesCta wardId={ward.id} />` right after each page's ward-name header block.
- **`ModalContext.tsx`**: extend `openLogin` to accept an optional context, e.g.
  `openLogin: (ctx?: LoginContext) => void` where `LoginContext = { wardId: string }`, threaded
  through the `login` modal state alongside the existing `flag`/`vote` context pattern already
  used for `openFlag`/`openVote`.
- **`RegisterLogin.tsx` / `RegisterLoginForm`**: accept the optional `wardId` context; when
  present, the `ward` step renders the ward name read-only (pre-set `homeWardId` from the prop,
  no `<select>`) instead of the wards dropdown, and still collects language as today.
- **`Account.tsx`**: unchanged — it already supports changing home ward.

### Testing

- Existing tests covering `WardResult`'s old "Set as my ward" button
  (`WardResult.test.tsx`) update to cover the new slot's three states instead.
- New/updated tests for `WardCandidates`, `CompareCandidates`, `WardIssues` cover the slot
  appearing in each of the three states.
- `RegisterLogin.test.tsx` gains a case for the ward-context entry path (ward pre-filled/locked,
  language still selectable, resumes on the originating ward page with "Receiving updates"
  showing).

## Non-goals

- No change to the flag or cast-issue-vote gating flows.
- No change to `/account` or `/account/notifications`.
- No new consent copy — the existing Register/Login consent text (IA §7.1) already covers "ward
  election updates," which this trigger is a more direct path into.
