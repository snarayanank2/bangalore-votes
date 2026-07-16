# Documentation Review

**Date:** 2026-07-16
**Status:** For discussion
**Scope:** Cross-review of `docs/overview.md`, `docs/gtm-plan.md`, `docs/prd.md`, `docs/information-architecture.md`, and `docs/project-dependencies.md` — defects, inconsistencies between and within documents, gaps, and open questions.

Findings are numbered for reference and grouped by severity. Overall the five documents are unusually well-aligned: the retention-period blocker, the silence-period decision, ward-readiness gating, the locked-decision tables, and the phase structure all agree across documents. The findings below are the exceptions.

---

## 1. Document defects (fix regardless of content decisions)

**R1. `docs/prd.md` is truncated at the top.** The file begins mid-sentence — *"they now belong to, they can't find trustworthy information…"* — with no title, no status header, and no opening of §1. Git history shows it has been in this state since its first commit, so the header was lost before the document ever landed. Every other document carries a title block (status, date, domain, scope); the authoritative document is the only one without it. Reconstruct the title, header, and the first sentence(s) of §1 from `docs/overview.md` §1, which covers the same ground.

> **Resolved (2026-07-16):** Title, status block, and §1 "Background" opening reconstructed from overview §1.

**R2. `docs/project-dependencies.md` cites a document that has been deleted.** It references the production stack spec (`docs/superpowers/specs/2026-07-16-production-stack-design.md`) roughly ten times — "stack spec §4" through "§7" — and lists it under Related in §8. That file is deleted in the working tree. Several load-bearing claims now rest on an unverifiable source: the Twilio/SendGrid single-vendor decision (§3), the machine-translation pipeline (§5.5, §6.6), the geocode-with-Google/render-with-MapLibre split and its licence analysis (§6.4), the geocoding spend cap (§6.5), and the Compose-on-a-VM hosting shape (§6.1). Either restore the spec, or move the surviving decisions into the dependencies doc itself and drop the citations.

> **Resolved (2026-07-16):** Deletion was intentional. All fifteen citations inlined as plain statements of the decided stack (Twilio/SendGrid, Google-geocodes/MapLibre-renders, machine-translated Kannada with review, single-VM Compose behind a CDN); a retirement note added to §8.

**R3. The PRD §5.2 field table is malformed markdown.** The table rows under "Standard fields" are indented progressively deeper (each row further right than the last), so the table will not render. Re-align the rows.

> **Resolved (2026-07-16):** Rows re-aligned to uniform indentation.

---

## 2. Contradictions between documents

**R4. Template count: 14 or 28?** Three different figures for the same deliverable:

- `gtm-plan.md` §9: "~14: seven sends × EN/KN"
- `overview.md` §8: "~14 templates across English and Kannada"
- `project-dependencies.md` §1 (Path A) and §3.7: "~28 templates (14 sends × EN/KN)"

The comms calendar defines **seven** sends (W1, R1, L1, C1, C2, C3, F2), so "14 sends" has no source anywhere. If the dependencies doc doubled the count to include transactional messages (see R14), it should say so; as written, the project's longest critical path carries a headline number that disagrees with the plan it implements by 2×.

> **Resolved (2026-07-16):** Actual count is **16** — 7 GTM sends plus the OTP login message, × EN/KN. There are no other transactional messages. All three documents updated.

**R5. Does WhatsApp template approval gate the teaser? Three answers.**

- `overview.md` §8 and §12: approval "must **start** before the teaser ships" / "its lead time, not the code, **gates the teaser**".
- `gtm-plan.md` §3, Phase 0 exit criteria: "templates **approved**" before Phase 1.
- `gtm-plan.md` §9, risk table: if approval slips, "Email is the baseline; WhatsApp is the **fast-follow**" — i.e. it does not gate anything.

These are three different launch policies. The risk-table posture (email baseline, WhatsApp fast-follow) is the only one that doesn't hand Meta's review queue a veto over the teaser date; whichever is chosen, the other two statements should be rewritten to match.

> **Resolved (2026-07-16):** Email-baseline posture adopted everywhere. Phase 0 exit is now "templates *submitted*"; overview and PRD §15 no longer say approval gates the teaser; PRD §9 and the IA register modal add a nudge for WhatsApp-first users to provide an email.

**R6. The PRD promises candidate-change notifications the comms calendar doesn't contain.** PRD §9 lists "changes to candidates in their ward" as an update registered users receive, and IA §4.2 gives `/account/notifications` a subscription toggle for candidate changes. But PRD §9.3 fixes the campaign at "a small, fixed set of ward-scoped sends (defined in the GTM spec)", and the GTM calendar's seven sends contain no ongoing candidate-change alert — candidate news arrives only via L1 (at N) and C2 (E−2w). Either the subscription toggle over-promises, or the calendar is missing a send type. This matters for template count (R4) and the WhatsApp budget (§3.9).

> **Resolved (2026-07-16):** No candidate-change alert stream exists — candidate news arrives only via L1/C2. PRD §9, IA §4.2, and overview §4.2 reworded to describe the fixed seven-send calendar; the notifications page now offers channel toggles only, no per-topic subscriptions.

**R7. L1's trigger contradicts its content.** `gtm-plan.md` §3 states the sequence: notification → nominations (~7 days) → scrutiny → withdrawal. L1 is triggered "At N" and reads "Candidates have filed in your ward (provisional)" — but at N the nomination window has just *opened*; nobody has filed. L1 should anchor to nomination close (≈N+7d) or scrutiny, not N. Related: the §9.1 readiness completeness check ("every candidate who has filed… has a report card") is vacuously satisfiable at N when zero candidates have filed, so the gate designed to stop empty-page sends would pass exactly when the page is guaranteed empty.

> **Resolved (2026-07-16):** L1 re-anchored to scrutiny complete (≈N+9d); a reasoning paragraph added to GTM §4. The site's candidate pages still open at N — only the send waits. Post-scrutiny, the completeness check runs against a real filed list, defusing the vacuous pass.

**R8. The ward-lookup fallback exists only in the dependencies doc.** `project-dependencies.md` Path B says "ward-name and pincode lookup ship first and need no boundary polygons" — the hedge against delimitation data (4.1, called "the single largest technical risk") arriving late. But PRD §5.1 and IA §3.1 specify lookup by **address and voter ID only**; pincode and ward-name search appear in no product document. The hedge for the project's biggest risk is not actually in the product spec.

> **Resolved (2026-07-16):** Ward lookup is now **address or pincode only** — voter-ID lookup dropped, ward-name search dropped. Pincode returns a shortlist of wards (no boundary data needed), making it the Path B hedge; PRD §5.1, IA §3.1, and deps Path B/§4.1 all updated. Voter-ID entry remains only where it belongs to EC-roll features: `/check-registration` and `/voting-guide/find-booth`.

**R9. Two different localisation models.** PRD §8 says curator content "supports both-language entry" and leaves the display fallback as an open question — a human-authored bilingual model. `project-dependencies.md` §5.5 and §6.6 say "the stack machine-translates curator content into Kannada" with a human reviewer checking machine output — an auto-translation model. These imply different curator workflows, different dependencies, and different failure modes (§5.5 itself flags unreviewed machine Kannada on a criminal-record field). The PRD should state which model is intended.

> **Resolved (2026-07-16):** Machine-translation model adopted: curators author in one language, Kannada is AI-generated with **no human review at all** — a decided trade, with the citizen flag flow as the correction path. PRD §8 rewritten; the "bilingual fallback" open question removed from PRD §17 and IA §9 (fallback = authored language with an indicator until translation lands). The deps §5.5 translation-review row deleted (people rows renumbered); the residual risk is recorded in deps §5, which now leans harder on moderation capacity.

**R10. The anonymous EOI form cites a rate-limit mechanism that can't apply to it.** GTM §6, PRD §5.13, and IA §3.15 all say the `/partner-with-us` form is "rate-limited (PRD §6.3)". But §6.3's entire anti-abuse mechanism is *identity via registration* — dedup and rate-limiting keyed to an account. The EOI form is deliberately anonymous, so §6.3 as written covers it not at all. §6.3 needs an explicit requirement for anonymous write paths (IP/device-based limiting, or similar), which is also the only anonymous write on the platform.

> **Resolved (2026-07-16):** CAPTCHA chosen over rate limiting. PRD §6.3 gains an anonymous-write bullet (CAPTCHA + admin triage as backstop); the "rate-limited" cross-references in PRD §5.13, GTM §6, and IA §3.15 now read "CAPTCHA-protected".

**R11. Curators are granted audit-log access with no page to see it on.** PRD §7 gives curators "View audit log — Scope", but the IA's only audit surface is `/admin/audit` (Admin access). Either add a scoped audit view to the curator area (or to `/curator/ward/{id}`), or remove the grant from the matrix.

> **Resolved (2026-07-16):** Grant removed — "View audit log" is admin-only in the PRD §7 matrix, matching the IA.

---

## 3. Gaps — things no document covers

**R12. WhatsApp OTP is gated on Path A, and nothing says so.** PRD §10 makes email/WhatsApp OTP the single auth mechanism for all roles. But sending an OTP over WhatsApp requires completed Meta onboarding plus an approved **Authentication-category** template — the whole of Path A. Consequences nowhere stated: (a) until Path A completes, auth is effectively email-OTP only, including for curators and admins working in Phase 0–1; (b) the OTP template (×2 languages) appears in no template count; (c) §3.8's category discussion covers only Utility vs Marketing — Authentication is a third category with its own pricing; (d) every login adds a metered message to the §3.9 budget, scaling with sessions, not with the seven-send calendar.

> **Resolved (2026-07-16):** PRD §10 now states email OTP is the baseline and WhatsApp OTP waits on the Business API; deps §3.8 adds the Authentication category; deps §3.9 notes OTP costs scale with sessions on top of the 175k campaign messages. (Template count was already fixed under R4.)

**R13. Registration captures no consent, but three requirements assume it does.** The Register/Login modal (IA §7.1) is "email or WhatsApp entry → OTP → confirm ward + language" — no consent step. Yet: §3.10 requires "recorded opt-in evidence" for WhatsApp as Meta policy; PRD §5.16 requires email/WhatsApp "consent and withdrawal" under DPDP; and the future-civic-tools checkbox (deps 2.6) would also live here. The modal spec needs a consent-capture element, and its wording is a legal-review input — i.e. it sits on Path A, not just in the UI backlog.

> **Resolved (2026-07-16):** No checkbox — registration itself is the consent act. The modal's confirm step links to `/terms`/`/privacy` plus a one-line purpose statement; the registration event (timestamp + wording version) is stored as the Meta opt-in evidence. IA §7.1, PRD §10, and deps §3.10 updated; wording flagged as legal-review input. The future-civic-tools checkbox remains open (deps 2.6).

**R14. Transactional messages are missing from the messaging plan.** Beyond the seven campaign sends: OTP delivery (R12), flag-outcome notifications ("the submitter is notified", PRD §6.1 step 5), and the W1 registration confirmation is per-user-triggered rather than a campaign send. On WhatsApp each of these needs an approved template; none appears in the calendar, the template count, or the message budget. This is plausibly where the 14-vs-28 confusion (R4) came from — reconcile all three documents against a single enumerated template list.

> **Resolved (2026-07-16):** No transactional messages exist beyond OTP (per R4). "Submitter is notified" reworded in PRD §6.1, IA §5.3, and overview §5: the flag outcome appears as status on `/account/submissions` only — no outbound message. Accepted trade: submitters learn outcomes only when they check back.

**R15. Old→new ward mapping has no data dependency.** PRD §5.1 and IA §3.2 promise "old-ward → new-ward mapping", which requires the *old* (pre-delimitation, 198-ward BBMP) boundaries or an official crosswalk. `project-dependencies.md` §4 lists only post-delimitation boundaries (4.1) and metadata (4.2). Add the old-ward source as a row — it may be easier or harder to obtain than 4.1, and someone has to own it.

> **Resolved (2026-07-16):** Feature dropped instead. Old→new mapping removed from PRD §5.1 and IA §3.2, with a note in the PRD recording the decision; no new data dependency needed.

**R16. The measurement plan has no analytics infrastructure behind it.** GTM §8 commits to a funnel (`/` visit → ward found → register → OTP confirmed), attribution per `src`, and ward-coverage tracking. Anonymous-visit and funnel measurement need an analytics capability, which appears nowhere: not in deps §6 (commercial accounts), not in the stack references, and not in `/privacy`'s disclosure list (PRD §5.16 lists email, phone, address→ward, language, `src` — no analytics/cookies). For a platform whose product is trust, undeclared analytics is its own risk. Decide the tool, add the dependency row, and add it to the privacy disclosure.

> **Resolved (2026-07-16):** Server-side measurement only — funnel steps counted as application events, visits from CDN/server logs; no client tracker, cookies, or third-party vendor. Stated in GTM §8; server logs added to the `/privacy` disclosure in PRD §5.16 and IA §3.18. No new dependency needed.

**R17. `/check-registration` is specified as two different things.** PRD §5.6 describes both "a single authoritative entry point to check whether the citizen is on the GBA electoral roll" (an on-platform lookup) and "link out to the official EC flow" (a referral page). Deps 4.8 honestly labels the path undecided ("EC service integration **or** documented manual route"), but the PRD reads as if the lookup is committed. The same question covers the home page's ward-search-by-voter-ID (IA §3.1), which also needs roll access. Mark it as an open question in the PRD or pick the referral model explicitly.

> **Resolved (2026-07-16):** Guided link-out chosen. PRD §5.6 and IA §3.7 rewritten (no voter details touched; the official source answers); deps 4.8 becomes "verify and monitor the official roll-lookup URL" rather than an integration.

**R18. Home-ward changes are unspecified, and they interact with vote integrity.** PRD §5.5 allows "one vote-set per registered user **per ward**" while restricting voting to the home ward. Can a registered user change their home ward? If yes, a user can vote, switch wards, and vote again — the "per ward" phrasing makes the accumulated vote-sets all valid, which is a cheap way to vote in several wards. If no, citizens who move mid-campaign are stuck with wrong-ward updates. No document addresses this. Suggested shape: ward changes allowed but rate-limited (once per campaign?), with previous-ward vote-sets retired.

> **Resolved (2026-07-16):** One *active* vote-set per user, in the current home ward. Ward changes allowed anytime and retire the previous ward's vote-set — hopping gains nothing, so no change limit. PRD §5.5, IA §7.3, and IA §4.1 updated.

**R19. Internal tooling has no phase assignments, and one public page has none either.** PRD §13.1 phases cover public pages only. Unassigned: `/ward/{id}/issues` (not in Phase 1 or 2 lists; GTM Phase 3 only says results reach scale there — yet C1 at E−3w drives citizens to it, and nothing says when the page ships or what it shows pre-N); all `/curator/*` pages (needed *before* N for data entry and readiness sign-off); `/admin/partners` (needed in Phase 0 — it holds the EOI queue the recruitment funnel feeds); `/account/*` and `/login` (needed the moment registration opens in Phase 1). Add these to §13.1 so the build order matches the operational order.

> **Resolved (2026-07-16):** `/ward/{id}/issues` ships in **Phase 1** with an empty state (stance rows appear with candidates); `/admin/*` and `/curator/*` assigned to Phase 0; `/account/*` and `/login` to Phase 1. PRD §13.1, GTM §3 (Phases 1 and 3), and IA §3.6 updated.

---

## 4. Internal issues within single documents

**R20. `project-dependencies.md` cross-reference errors.**
- §8 item 3: "Resolve **§3.7 and §6.8** before Phase 0 exits. They are the two places where a *number nobody has written down* could change the plan." §3.7 is the template list and §6.8 is DNS delegation — neither is an unwritten number. The intended references are almost certainly **§3.9** (message budget) and **§6.11** (total running budget).
- §6 narrative: "**6.6** deserves its own line. 'An unrehearsed backup is not a backup'…" — backups are **6.9**; 6.6 is the Anthropic API key.

> **Resolved (2026-07-16):** Both fixed — §8 item 3 now points at §3.9 and §6.11; the backup paragraph now says 6.9.

**R21. GTM phase triggers and exit criteria can disagree.** Phase 1's exit is the registration target (~25,000 / ≥50 in ≥300 wards), but Phase 2's trigger is N — an external event that arrives whether or not the target is met. The doc should say which governs (presumably N: the phases are event-triggered, and the "exit criteria" are really progress measures). As written, a reader can't tell whether missing the target delays anything.

> **Resolved (2026-07-16):** GTM §3 now states phases are event-triggered — N opens Phase 2 unconditionally, and exit figures are progress targets, not gates.

**R22. "Flags and corrections" implies two submission types; only one is specified.** PRD §6.2, `/account/submissions` (IA §4.3), and overview §4.2 all track "flags **and corrections**" as though distinct, but the only citizen-submission surface is the Flag modal (field + detail + optional source). Either "correction" is just a flag that suggests a value — in which case use one term — or a second submission type exists and is unspecified.

> **Resolved (2026-07-16):** One term. Citizen submissions are *flags* (optionally carrying a suggested value + source); the *correction* is the curator's response. Blurred phrasings fixed in PRD §6.2, IA §4.3/§5.2/§5.3, and overview §4.2/§4.3; the "flag → correction → live" loop name stays, as it correctly describes the sequence. PRD §3's "flag/correction workflow" also stays — it names the whole loop.

**R23. Send labels imply a deleted send.** The calendar runs W1, R1, L1, C1–C3, **F2** — there is no F1. The label pattern suggests an election-morning send (F1?) was cut when the go-dark decision was made, without renumbering. Cosmetic, but a fresh reader will hunt for F1; rename F2 or footnote it.

> **Resolved (2026-07-16):** Renamed F2 → F1 across the GTM calendar, §4 narrative, §9 risk table, §10 dependencies, and deps 4.7.

**R24. The PRD's "Accessibility" NFR isn't about accessibility.** PRD §12's accessibility bullet covers shareable URLs, mobile-first, and readability — distribution properties, not accessibility. For a stated low-digital-literacy, bilingual, first-time-voter audience there is no commitment on WCAG level, screen-reader support, contrast, or font scaling. Either add real accessibility requirements or retitle the bullet so the gap is at least visible.

> **Resolved (2026-07-16):** Retitled. The distribution items now sit under "Reach", and a new "Accessibility" bullet states plainly that no formal conformance target is committed this release — a recorded scope decision, not a mislabel.

**R25. Minor phase-list drift in the overview.** Overview §10's Teaser row omits `/about-election` and the partner kit (`/partner/{slug}`), both of which GTM §3 and PRD §13.1 place in Phase 1. The overview is a summary, but a stakeholder reading only it would misplan the teaser's content scope.

---

## 5. Open questions

### 5.1 Already tracked (consistent across PRD §17, IA §9, GTM §12, deps §7)

The four documents keep overlapping open-question lists that agree with each other. The consolidated set: retention period (the Phase 0 blocker — deps 2.1, unowned); future-use consent checkbox; funding disclosure detail (names vs categories); owned channels (is Citizen Matters an Oorvani property? — deps 7.4, flagged as highest-leverage); press timing (N vs E−2w); legal-page Kannada; partner kit / press / partner-with-us localisation; `/data` counting of held wards; issue-vote display format; curator scoping unit (ward vs zone); bilingual field fallback; mobile compare limit; news-link sourcing; `/login` fallback necessity; sign-off churn during the nomination window; home-page pre-notification state (IA only); readiness panel placement (IA only).

Two hygiene notes on these lists: they are maintained in four places and have already drifted slightly (the IA lacks the PRD's sign-off-churn question; the PRD lacks the IA's home-page-state question). Consider making the PRD the single home and pointing the others at it. And per `project-dependencies.md` §8, every one of these that blocks work is **unowned** — the lists record questions but not who answers them or by when.

> **Resolved (2026-07-16), list consolidation:** PRD §17 is now the single home for open questions. It absorbed the IA-only and GTM-only items (home-page pre-notification state, readiness-panel placement, Citizen Matters as owned channel); IA §9 and GTM §12 are now pointers; deps §7 keeps its rows as the owner-tracking view; project CLAUDE.md updated. Two items from the consolidated list were also closed during this review pass: bilingual field fallback (R9) and sign-off-churn framing partially (L1's move to scrutiny, R7, changes its premise — the question itself stays open). The remaining questions themselves are still undecided.

### 5.2 New questions raised by this review

> **Resolved (2026-07-16):** All ten were answered in the resolution pass — see the resolution notes on R2, R4–R6, R9, R12, R14–R19. In brief: issues page ships Phase 1 with an empty state; ward changes retire the old vote-set; the teaser does not wait for template approval; no candidate-change alerts; 16 templates (7 sends + OTP × EN/KN); AI-generated Kannada with no human review; `/check-registration` is a guided link-out; measurement is server-side only; old→new ward mapping dropped; the stack spec is retired with its decisions inlined into the dependency register.

- When does `/ward/{id}/issues` ship, and what does it show before curators have defined issues / before C1? (R19)
- Can a registered user change their home ward, and what happens to their existing issue votes? (R18)
- Is the teaser gated on WhatsApp template approval, or does it ship email-only if Meta is slow? (R5)
- Is candidate-change notification a real product commitment or does the toggle come out of `/account/notifications`? (R6)
- What is the full template inventory — campaign sends, OTP/auth, flag outcomes, welcome — and therefore the real Path A workload and message budget? (R4, R12, R14)
- Which localisation model is the product spec: bilingual curator entry, or machine translation with review? (R9)
- Is `/check-registration` an on-platform roll lookup or a guided link-out? (R17)
- What analytics tooling backs the GTM measurement plan, and does `/privacy` disclose it? (R16)
- Where does the old-ward boundary/crosswalk data come from, and who owns getting it? (R15)
- Is the production stack spec being restored, replaced, or intentionally retired? Every stack-dependent row in the dependency register cites it. (R2)

---

## 6. What was checked and found consistent

For completeness, the following were explicitly cross-checked and hold up: the locked-decision tables in overview §7 and PRD §14 (no contradictions); the 369-ward figure, the 25,000 / ≥50-in-≥300 target, and the E/N anchor arithmetic everywhere they appear; the silence-period posture (freeze as guardrail in PRD §9.2, go-dark-at-E−3d as the actual calendar) across all four narrative docs; ward-readiness gating (completeness + sign-off, sign-off cleared on candidate-set change) across PRD §9.1, GTM §2/§9, IA §5.1/§5.5/§6.4; the `/privacy`-gates-WhatsApp-gates-comms critical path in all five documents; the partner model (not a role, `?src=` attribution, unlisted kit, no self-service activation); the permissions matrix against the IA page inventory (one exception: R11); and the IA §8 coverage cross-check against PRD §5 (complete).
