they now belong to, they can't find trustworthy information about local candidates, and existing sources (mainstream media, WhatsApp, party workers) are seen as biased or unreliable.

This platform makes trustworthy, ward-level election information easy to find, compare, and act on. **This release is pre-election only.** Post-election capabilities (promise/accountability tracking, ward budgets, a live civic-issue officer directory) are deferred to a later phase.

---

## 2. Goals & non-goals

**Goals**

- Let any citizen identify their new GBA ward in seconds and see who is standing there.
- Present neutral, sourced candidate information that citizens can trust and compare side by side.
- Reduce logistical friction: registration/eligibility check, booth location, voter-ID issuance and updates, and how to vote.
- Give citizens a voice in which local issues matter, and surface that signal publicly.
- Work fully in English and Kannada.

**Non-goals (this release)**

- Tracking whether elected corporators keep their promises; ward budget transparency; a live officer/"who to contact" directory.
- Online/remote voting or any interaction with the official voting process itself.
- Editorial or opinion content — the platform presents facts and citizen signal, not endorsements.

---

## 3. Scope summary

| In scope (MVP) | Deferred (future phase) |
|---|---|
| Ward lookup; candidate report cards (with news links) & comparison; ward issues & citizen issue-voting; registration/eligibility check; election awareness; voter-ID issuance & update; how-to-vote; booth locator; English/Kannada; registration & notifications; flag/correction workflow; curator & admin tooling | Promise/accountability tracking; ward budgets; civic-issue officer directory; remote voting; candidate outreach tooling |

---

## 4. Users & roles

Four roles: a large, mostly read-only public, and a small, trusted group that maintains data and governs access.

| Role | Who | Primary job |
|---|---|---|
| **Anonymous citizen** | Any visitor, no account | Find & read information; see (but not cast) flags and issue votes |
| **Registered citizen** | Signs up: email/WhatsApp + ward + language | Get updates; flag misinformation (any ward); vote on issues (home ward) |
| **Data curator** | Trusted, vetted individual (ward/zone-scoped) | Upload & correct ward and candidate data; define ward issue list; review flags |
| **Admin** | Small internal team | Manage roles, access, scope, users, and oversight |

**Contribution principle.** Both citizen actions — flagging an error and voting on issues — are **visible to everyone but gated at the point of submission by registration**. Anonymous users see the buttons; tapping to act opens the Register/Login popup, after which the action resumes in place.

---

## 5. Feature requirements

Each feature notes its primary page(s); full page-level detail is in the IA document.

### 5.1 Ward identity lookup
*Pages: `/`, `/ward/{ward-id}`*

- Look up ward by address and/or voter ID; return new GBA ward name + number and corporation (N/S/E/W/Central).
- Show the ward boundary on a map and, where possible, the old-ward → new-ward mapping.
- The ward result is the anchor for candidate, issue, and logistics views, and is reused to set a registered user's home ward.

### 5.2 Candidate report card
*Page: `/candidate/{candidate-slug}`*

A structured, neutral, sourced profile for each candidate in a ward — the single most-requested feature.

- One page per candidate, with every field carrying a visible source.
- Standard fields:

  | Field | Primary source | Notes |
    |---|---|---|
      | Name, photo, party / independent | EC nomination | Party is secondary at ward level but shown |
        | Past track record for this ward | Curator-compiled, sourced | Highest-value field; ward-specific work |
	  | Criminal record / pending cases | EC affidavit | Often the first thing citizens look for |
	    | Declared assets | EC affidavit | Trusted primary disclosure |
	      | Education / qualifications | EC affidavit | Shown with the caveat it isn't the whole picture |
	        | Approachability | Curator-compiled | Lives in ward? public office? contactable? |
		  | **News & coverage** | Curator-compiled links | Links to news articles about the candidate |

- Clearly distinguish official/affidavit data from curator-compiled context.
- Carries the **Flag an error** action (opens the flag popup; see §6).

### 5.3 Candidate comparison view
*Page: `/ward/{ward-id}/compare`*

- Compare all candidates in a ward side by side in a column layout (not a scrolling feed).
- Comparison spans the same fields as the report card so rows line up cleanly.
- 2-up / horizontal scroll on mobile; more columns on wider screens.

### 5.4 Ward issues & candidate stance
*Page: `/ward/{ward-id}/issues`*

- The curator maintains a list of key issues per ward (roads, water, waste, safety, etc.).
- Where available, map each issue to what each candidate says they will do about it.
- Showing candidate stated positions is in scope; tracking delivery after election is deferred.

### 5.5 Citizen issue voting
*Page: `/ward/{ward-id}/issues` + Cast issue vote popup*

Let citizens signal which local issues matter most, and show that signal publicly per ward.

- The **curator defines** the list of votable issues in each ward (same source as 5.4).
- **Registered citizens vote for their top 3 issues**, and only in their **registered home ward**.
- Aggregated results are **public** — anonymous citizens can see the ranked top issues for a ward.
- The vote action opens as a **popup**; anonymous users are shown the Register/Login popup first.
- One vote-set per registered user per ward; changeable; de-duplicated by account.

### 5.6 Check registration / eligibility
*Page: `/check-registration`*

- Single authoritative entry point to check whether the citizen is on the GBA electoral roll, by voter ID / details.
- Link out to the official EC flow; surface the correct GBA roll link prominently.
- Make roll tools available early (citizens check months out) even before candidate data is populated.

### 5.7 Election awareness
*Page: `/about-election` (+ Home banner)*

- Prominent election status + date / official-notice countdown.
- Plain-language explainer: what a GBA corporator does and why this local vote matters.

### 5.8 Voter-ID issuance & update / transfer
*Page: `/voting-guide/voter-id`*

- Guided flows for new enrolment (Form 6) and for updating / transferring details when a citizen moves.
- Direct links into the official EC processes; clear step-by-step guidance.

### 5.9 How to vote
*Page: `/voting-guide/how-to-vote`*

- Simple step-by-step guide to the voting-day process, in both languages.
- Primary value is first-time voters and the less-digital / Kannada-first audience.

### 5.10 Polling-booth locator
*Page: `/voting-guide/find-booth`*

- Return an address-accurate booth location with a map, not just a booth name.

### 5.11 About us, funding & data sourcing (trust page)
*Page: `/about`*

- **Name the operator.** The platform is run in production by the **Oorvani Foundation**, the trust that operates `opencity.in`. This is stated plainly, not buried.
- Explain how data is sourced and verified, and the neutrality stance.
- **Disclose funding.** For a platform whose value rests entirely on neutrality, who pays for it is the first question a skeptical reader asks; the answer should not have to be requested. Disclosure detail is an open question (§17).
- **State the data commitments** in citizen-readable terms, mirroring `/privacy` (§5.16): Oorvani does not sell citizen data to third parties, and contact details are used for ward election updates and critical product updates only.
- Supports the trust requirement in §11; links to primary sources.
- This is also the "about us" page — team and mission live here rather than on a separate URL, because a citizen who doubts the platform wants who-runs-it and how-it-sources-data in one place.

### 5.12 Partner attribution & partner kit
*Page: `/partner/{partner-slug}`*

Distribution is partner-led and unpaid (§14), so the platform must equip partners to forward links and must measure what that forwarding achieves.

- **Attribution.** Any page accepts a `?src={partner-slug}` parameter. The value survives the visit and is **persisted onto the user record at registration**, so a signup can be attributed to the partner who sent it. Attribution is for measurement only — it grants no permissions and changes nothing the citizen sees.
- **Partner kit page.** An unlisted, anonymous-access page per partner carrying: their tagged link; ready-to-paste WhatsApp forward text in English and Kannada; a poster image sized for WhatsApp; and a short neutrality statement. Unlisted means not indexed and not linked from navigation — but not access-controlled, since it holds nothing sensitive and a login wall would defeat its purpose.
- **No new role.** Partners are not a role. The kit is a public page; partner records are managed by admins (§7).
- **Why the neutrality statement.** An RWA secretary forwarding an election link *will* be accused of campaigning. A partner who cannot answer that stops forwarding — so the answer ships with the kit.
- **Coverage view.** Admins can see partner → ward coverage against all 369 wards. The uncovered set is a work queue and the early warning for reach skewing to central Bengaluru.

### 5.13 Partner with us (recruitment funnel)
*Page: `/partner-with-us`*

Recruiting partners and curators is otherwise an offline motion (§15), which does not scale past the team's own network — and that network is where the central-Bengaluru skew originates. This page is its public front door.

- **Two paths**, matching the two roles the platform already has:
  - **Spread awareness** — forward ward links to your network. In return: a partner kit page (§5.12), a tagged link, and a report of what the forwarding achieved.
  - **Curate data** — own the accuracy of a ward's data. In return: assigned ward scope, onboarding, and publish-immediately trust (§14).
- Each path states its **time commitment** and the **vetting and neutrality expectation** up front.
- **One expression-of-interest form** covers both paths. The form is **anonymous — no account required.** Requiring registration before someone can volunteer taxes exactly the people the plan depends on, and an RWA as an institution does not map onto a citizen account with a home ward.
- Rate-limited as a public write path (§6.3).
- **Applications are not access.** Submissions land in an admin queue (§7); accepting an awareness applicant provisions a partner slug and kit, while a curation applicant hands off to the existing curator vetting path. Nobody self-activates.

### 5.14 Public data & key metrics
*Page: `/data`*

A platform that publishes other people's records should publish its own.

- **Coverage:** wards with published candidate data (against 369); report cards complete; active curators; sources cited.
- **Integrity:** flags raised; flags resolved; median time to resolve.
- **Citizen signal:** the city-wide issue roll-up aggregated across all wards; total issue votes cast; registered citizens.
- Every figure carries an **"as of" timestamp**.
- **Ships in Phase 2, not Phase 1** (§13.1). During the teaser this page honestly reads "14 of 369 wards" — damaging, and it hands critics a number. The issue roll-up says nothing until issue voting has volume.
- **Figures, not datasets.** Downloadable data and a public API are out of scope this release (§16).

### 5.15 Press kit
*Page: `/press`*

Press is an amplifier for the partner-led distribution model (§14), and journalists arrive at the EC notification whether or not anything is ready for them.

- Boilerplate at three lengths (50 / 100 / 200 words); current key stats drawn from §5.14; logos and screenshots for download; spokesperson bios and quotes; contact with a **stated response time**; the neutrality statement; a link to sourcing methodology (§5.11).
- **Ships in Phase 1**, though it is a Phase 2 asset — a press kit assembled at the notification is assembled too late.

### 5.16 Legal pages
*Pages: `/terms`, `/privacy`*

- **`/terms`** — acceptable use; contribution licensing (flags, issue votes); accuracy and liability disclaimers; account termination grounds, consistent with the admin ban capability (§7).
- **`/privacy`** — the operator is the **Oorvani Foundation**; what personal data is collected (email, phone, address→ward, language, `src` attribution) and why; email/WhatsApp consent and withdrawal; **DPDP Act 2023** notice, data-principal rights, and a named **grievance officer**; retention policy; the fact that issue votes are published in aggregate.
- **Data commitments (locked, §14).** Oorvani **does not sell or share citizen data with third parties**. Contact details are used for two purposes only: ward-scoped election updates (§9), and **critical product updates**.
- **"Critical product updates" is a narrow purpose, and must be written narrowly.** It means service-affecting notices — a breach, a material change to these terms, the platform shutting down. It is not a channel for announcing new features. This matters because the DPDP Act limits use to the purpose consented to, and because the deferred promise-tracking phase (§16) would be marketing a new product to a list gathered for an election. Using these contacts for it needs fresh consent, not this clause.
- **`/privacy` ships in Phase 0 — the earliest page on the critical path.** Meta requires a published privacy-policy URL to approve WhatsApp Business API onboarding, so this page gates template approval, which gates the comms plan (§9). It is not launch-week hygiene.
- Both need **legal review**; their content is outside a product spec's competence. `/privacy` is additionally blocked on an undecided retention policy (§17).

---

## 6. Contribution & moderation

### 6.1 Flag → correction → live

Flagging is done via a **popup** that overlays the current page (no redirect) and works across **any ward**.

| Step | Role | What happens |
|---|---|---|
| 1. Notice an error | Anonymous / Registered | Anyone can tap Flag. Anonymous is shown the Register/Login popup first; registered proceeds. |
| 2. Submit | Registered citizen | The flag popup captures the field/claim + detail + optional source, and routes to the curator whose scope covers that ward. |
| 3. Review | Data curator | On `/curator/queue/{submission-id}`: sees flag, current value, and source. Accepts (edit + attach source) or rejects (with reason). |
| 4. Publish | Data curator | Accepted edits go live immediately — no second approval, because curators are trusted. |
| 5. Record | System | Immutable audit-log entry; submitter is notified of the outcome. |

### 6.2 Submission visibility

Registered citizens can see the **status of everything they have submitted** — flags and corrections — on `/account/submissions`, each marked pending / accepted / rejected + reason.

### 6.3 Anti-abuse

- Registration-gating gives every flag and every issue vote an identity, enabling de-duplication and rate-limiting.
- Multiple flags on the same field collapse into one queue item with a count (a strong signal to the curator).

---

## 7. Roles & permissions matrix

| Capability | Anonymous | Registered | Curator | Admin |
|---|:--:|:--:|:--:|:--:|
| Search / read published info | ✅ | ✅ | ✅ | ✅ |
| View public issue-vote results | ✅ | ✅ | ✅ | ✅ |
| View a partner kit page | ✅ | ✅ | ✅ | ✅ |
| View public metrics, press kit, legal pages | ✅ | ✅ | ✅ | ✅ |
| Submit a partner/curator expression of interest | ✅ | ✅ | ✅ | ✅ |
| Switch language (session) | ✅ | ✅ | ✅ | ✅ |
| Save language preference | – | ✅ | ✅ | ✅ |
| Subscribe to ward updates | – | ✅ | ✅ | ✅ |
| Flag / submit correction (any ward) | – | ✅ | ✅ | ✅ |
| Vote on top-3 ward issues (home ward) | – | ✅ | ✅ | ✅ |
| View status of own submissions | – | ✅ | ✅ | ✅ |
| Define ward issue list | – | – | ✅ | ✅ |
| Mark a ward ready for candidate comms | – | – | Scope | All |
| Create / edit ward & candidate data | – | – | Scope | All |
| Publish live | – | – | ✅ | ✅ |
| Review submissions | – | – | Scope | All |
| Manage roles, scope & users | – | – | – | ✅ |
| Manage partners & view ward coverage | – | – | – | ✅ |
| Review expressions of interest | – | – | – | ✅ |
| Override ward comms hold | – | – | – | ✅ |
| View audit log | – | – | Scope | All |

---

## 8. Language & localization

- **Bilingual by default.** The entire interface and content are available in English and Kannada.
- **Session toggle for everyone.** Any user — anonymous or registered — can switch language on the fly from the app bar; the choice persists for the session.
- **Saved preference for registered users.** Registered users can set a preferred language (on `/account`) that persists across sessions and also governs the language of their email / WhatsApp updates.
- **Curator content.** Ward and candidate content supports both-language entry; define fallback behaviour when a field exists in only one language (assumption: show the available language with a subtle indicator — see Open questions).

---

## 9. Notifications & delivery
*Page: `/account/notifications`*

- Registered users receive ward-scoped updates: election date / official notice, roll deadlines, and changes to candidates in their ward.
- Channels: email and/or WhatsApp, per the user's contact details and language preference.
- Ward is the routing key; it is set via the address→ward lookup (not free text) so updates route correctly.

### 9.1 Ward data-readiness gating

- A ward-scoped send that references candidate data **must not go out to a ward whose data is not ready**. Each such send is gated per ward on a readiness check; unready wards are **held**, not sent.
- Rationale: sends are ward-scoped across 369 wards, and curator coverage will be uneven. Telling a citizen "your ward's report cards are complete" and landing them on an empty page is worse than sending nothing — and it would happen exactly when press attention peaks.

**A ward is ready when both of the following hold:**

1. **Completeness.** Every candidate who has filed a nomination in the ward has a report card record; each carries name and party/independent; cases, assets, and education are either populated or explicitly marked *not declared*; and every field has a source (§11). "Not declared" is a valid, complete answer — it is a fact about the affidavit, not a gap.
2. **Curator sign-off.** The ward's curator has explicitly marked it ready (§7). The mechanical check alone cannot tell a thin ward from a finished one; a person who knows the ward can.

**Sign-off is cleared automatically when the ward's candidate set materially changes** — a new nomination or a withdrawal. Otherwise a ward signed off at the notification would still count as ready at E−2w, when the list it was signed off against no longer exists. In practice this means C2 requires a fresh sign-off after withdrawals close.

- Held wards must be visible to admins (`/admin/partners`), since a held ward is a curator-coverage gap that needs fixing, not a silent skip. Admins can override a hold and release the send — consistent with their oversight role (§7).
- Sign-off and override are both published changes and are therefore written to the audit log (§11).

### 9.2 Election-silence content freeze

- From **48 hours before poll close** until polls close, outbound comms are restricted to logistics only: booth location, poll timings, ID to carry, and how to vote.
- **No candidate content, comparisons, or issue-vote results** may be sent in this window. Representation of the People Act §126 bans electioneering during it; neutral sourced report cards are not worth testing against that line.
- **The campaign in fact goes further and sends nothing at all in the final 48 hours** — the last send is logistics at E−3d. This costs the election-morning reminder, the highest-converting send in a typical get-out-the-vote programme, and delivers booth details three days before they are used. It buys a campaign that cannot be accused of electioneering, on a platform whose entire worth is its neutrality.
- The freeze above therefore remains as a **guardrail**, not a description of the calendar: any send added later must satisfy it.
- The freeze applies to outbound messaging only. **The site itself remains fully available**, so a citizen who wants their booth on election morning can still get it.

### 9.3 Send cadence

- The campaign is a small, fixed set of ward-scoped sends (defined in the GTM spec), not an open-ended stream. WhatsApp opt-outs are permanent, so send volume is a budget to spend, not a dial to turn up.
- Every send honours the user's saved language preference (§8) and their channel toggles on `/account/notifications`.

*Calendar, triggers, and per-message content: `docs/gtm-plan.md`.*

---

## 10. Authentication & access

- **One OTP mechanism for all roles.** Citizens, curators, and admins all authenticate via lightweight **email / WhatsApp OTP** — no passwords and **no 2FA**.
- **Registration/login is a popup.** It overlays the current page with no redirection, is openable directly from the **Sign in** control (available to unregistered visitors) or auto-triggered by a gated action, and **resumes the exact action** after auth. A `/login` fallback page exists for deep links / no-JS.
- **Role-based access control.** Curator edit/review rights are scoped to assigned wards/zone; admins have city-wide access.
- **Sessions.** Standard session handling; re-auth via OTP.

---

## 11. Trust, neutrality & data provenance

- Every data point shows its source; official/affidavit data is visibly distinguished from curator-compiled context.
- No editorial voice or endorsements; the platform presents facts and citizen signal only.
- Immutable audit trail on every published change supports both credibility and rollback.
- A public `/about` page explains sourcing and verification.

---

## 12. Non-functional requirements

- **Scale.** Must handle 369 wards and city-wide read traffic that spikes near the election date; anonymous read paths must stay fast with no login wall.
- **Authentication.** Single OTP mechanism (email / WhatsApp) across all roles; no passwords, no 2FA.
- **Security & integrity.** Role-based access control; curator edits scoped to assigned wards; full audit logging; rate-limiting on all contribution actions.
- **Accessibility.** Shareable, deep-linkable ward/candidate pages (for RWA forwarding); mobile-first; readable for a low-digital-literacy, bilingual audience.

---

## 13. Information architecture summary

Full detail is in the IA document. Each URL is a distinct page (one URL → one screen); modals overlay the current page with no URL change.

**Public:** `/` · `/ward/{id}` · `/ward/{id}/candidates` · `/candidate/{slug}` · `/ward/{id}/compare` · `/ward/{id}/issues` · `/check-registration` · `/about-election` · `/voting-guide` · `/voting-guide/voter-id` · `/voting-guide/how-to-vote` · `/voting-guide/find-booth` · `/about` · `/data` · `/partner-with-us` · `/press` · `/terms` · `/privacy` · `/partner/{partner-slug}` (unlisted)

The trust and legal pages (`/about`, `/data`, `/partner-with-us`, `/press`, `/terms`, `/privacy`) are reached from the **global footer**, not the app bar. None of them earn top-level space, but all must be one click from anywhere — the moment a citizen doubts the platform is the moment they go looking.

**Registered:** `/account` · `/account/notifications` · `/account/submissions`

**Curator:** `/curator` · `/curator/queue` · `/curator/queue/{submission-id}` · `/curator/candidate/{id}` · `/curator/ward/{id}` · `/curator/ward/{id}/issues`

**Admin:** `/admin` · `/admin/roles` · `/admin/users` · `/admin/audit` · `/admin/partners`

**Modals:** Register / Login (fallback `/login`) · Flag misinformation · Cast issue vote (top 3)

### 13.1 Phased launch

Pages do not all ship at once, because candidate data cannot exist before the EC notification (**N**).

- **Phase 0 (before the teaser).** `/privacy`, `/terms`. `/privacy` is the earliest page on the critical path — it gates WhatsApp onboarding, which gates the comms plan (§5.16).
- **Phase 1 (teaser).** `/`, `/ward/{id}`, `/check-registration`, `/about-election`, `/voting-guide/*`, `/about`, `/partner/{slug}`, `/partner-with-us`, `/press`. The ward finder is the public entry point and the thing partners forward.
- **Phase 2 (at N).** `/ward/{id}/candidates`, `/candidate/{slug}`, `/ward/{id}/compare`, `/data` open up.

Before N, the candidate routes show the pre-nomination empty state already specified in IA §3.3 rather than 404ing — the URLs are shareable and will be shared early.

`/data` is held to Phase 2 for a different reason: it would be accurate in Phase 1 and still damaging, reading "14 of 369 wards" to anyone who looked.

---

## 14. Locked decisions

| Decision | Resolution |
|---|---|
| Curator publish gate | Curators are trusted; edits go live immediately, no second-person approval. |
| Authentication | Single OTP mechanism for all roles (citizen, curator, admin); no passwords, no 2FA. |
| Registration & flagging UX | Both are popups that overlay the current page — no redirection. |
| Anonymous contribution | Anonymous users see flag and issue-vote actions but are prompted to register at submit. |
| Issue-vote visibility | Aggregated issue-vote results are public and visible to anonymous citizens. |
| Issue-vote scope | Registered citizens can vote only in their registered home ward. |
| Flagging scope | Registered citizens can flag misinformation across any ward. |
| Issue list ownership | The per-ward list of votable issues is defined by the curator. |
| Report card content | Includes curator-maintained links to news articles about the candidate. |
| Curator sourcing | Recruiting/vetting curators is an offline process, out of scope here — tracked as a dependency. |
| URLs | Every page has a distinct URL under `bangalore-votes.opencity.in`. |
| Launch phasing | Ward + logistics pages ship first; candidate pages open at the EC notification (§13.1). |
| Distribution | Partner-led and unpaid — RWAs, civic orgs, press. No paid acquisition, on both cost and neutrality grounds. |
| Teaser asset | The ward finder itself, not a standalone "notify me" page. Citizens don't know their new ward; the finder answers that and captures ward at registration. |
| Election-silence rule | Outbound comms are logistics-only from 48h before poll close (§9.2) — and the campaign goes dark entirely after a final logistics send at E−3d. The site stays up. |
| Public metrics | `/data` publishes coverage, integrity, and the city-wide issue roll-up (§5.14). Figures only — no dataset downloads or API this release. |
| Recruitment funnel | `/partner-with-us` collects anonymous expressions of interest for both paths; admins grant access. No self-service activation (§5.13). |
| Funding disclosure | `/about` states who funds the platform (§5.11). Neutrality is the product; its funding cannot be opaque. |
| Legal page sequencing | `/privacy` ships in **Phase 0**, before the teaser — it gates WhatsApp onboarding and therefore the comms plan (§5.16). |
| Ward send gating | Candidate-referencing sends are gated per ward on data readiness; unready wards are held (§9.1). |
| Ward readiness test | Field completeness **and** explicit curator sign-off. Sign-off clears when the ward's candidate set changes (§9.1). |
| Operator | The **Oorvani Foundation** runs the platform in production; named on `/about` and `/privacy`. |
| Citizen data use | Oorvani does not sell or share citizen data with third parties. Contacts are used for ward election updates and critical product updates only — the latter meaning service-affecting notices, not feature marketing (§5.16). |
| Partner model | Partners are not a role. Attribution is a `?src=` parameter; the kit is an unlisted public page (§5.12). |

---

## 15. Dependencies & assumptions

*Summarised here; the full register — with owners, and every non-code dependency including commercial accounts and infrastructure — is `docs/project-dependencies.md`.*

- **Curator recruitment & vetting (offline).** Data quality depends on enough trusted curators with the right ward coverage. Hard dependency for launch. Also the source of the partner network below — the same people, recruited in the same conversations.
- **Partner network (offline).** Reach depends on RWAs and civic orgs forwarding ward links. Hard dependency for launch: with no paid channel, there is no fallback if this doesn't materialise.
- **Authoritative data sources.** Reliable access to EC affidavits, official notifications, and ward-delimitation data.
- **WhatsApp delivery.** Requires Business API access, approved templates, and explicit opt-in; email is the baseline, WhatsApp a fast-follow. Template approval runs to **weeks of lead time** (~14 templates across EN/KN) and must start before the teaser ships — the lead time, not the code, gates the launch. Onboarding additionally requires a **published `/privacy` URL** (§5.16), which makes the privacy policy the first item on the critical path.
- **Legal review.** `/terms` and `/privacy` need a lawyer, for DPDP Act 2023 compliance and contribution licensing. Not a product-spec deliverable, and it blocks Phase 0.
- **Press assets.** Logos, screenshots, and named spokespeople with approved quotes, for `/press` in Phase 1.
- **Electoral roll deadline.** Anchors the roll-deadline alert, the most time-critical send in the campaign. Moves independently of the notification and election dates, so it must be tracked separately.
- **Booth-level data.** The E−3d logistics send is only worth making if booth location resolves per citizen (§5.10). Without it, it and the E−1w send degrade to ward-level.
- **Election timeline.** Candidate content can only be populated near the official notification; ward and logistics tools can launch earlier.

---

## 16. Out of scope (future phases)

Promise / accountability tracking against elected corporators, ward budget transparency, a live civic-issue officer / "who to contact" directory, remote voting, and candidate outreach tooling.

Also out of scope this release: **open data downloads and a public API** — `/data` publishes figures, not datasets — and **self-service partner or curator activation**, since `/partner-with-us` collects applications that admins act on.

---

## 17. Open questions

- Issue-vote results display: raw counts, percentages, or ranked order only?
- Curator scoping unit: per-ward vs per-zone (affects `/curator` navigation).
- Bilingual fallback: how a field authored in only one language displays in the other.
- Candidate comparison: maximum number of candidates shown at once on mobile.
- News links: curator-added only, or auto-suggested for curator approval?
- Is the `/login` fallback page necessary, or is the popup sufficient for all entry paths?
- Does clearing sign-off on every candidate-set change (§9.1) create too much curator churn during the nomination window, when the set changes daily? A possible refinement: suspend gating entirely until withdrawals close, since no candidate-referencing send falls in that window except L1.
- Is the partner kit page itself bilingual, or English-only with bilingual assets inside it? Same for `/press` and `/partner-with-us`.
- Press timing: does the launch push go out at the notification, or at E−2w when report cards are actually complete?
- **Retention period** (§5.16): Oorvani's commitments settle *who* may use the data (nobody else) and *for what* (election updates, critical product notices). They do not settle **for how long**. `/privacy` must state a period or a deletion trigger, and this remains a Phase 0 blocker.
- **Re-consent path for the next phase** (§5.16, §16): if promise tracking ships, the election list cannot simply be reused. Is re-consent collected during this release — an optional "tell me about future civic tools" checkbox at registration — or sought later against a list that has gone cold? Deciding now costs one checkbox; deciding later may cost the list.
- Funding disclosure detail (§5.11): does `/about` name funders and amounts, or only funder categories? Anything less than names invites the question the disclosure was meant to close.
- Do `/data` coverage figures count a ward whose data exists but is held from comms by the §9.1 readiness check? The honest answer and the flattering answer differ.
- Do `/terms` and `/privacy` need Kannada versions at launch, or is English acceptable for legal text on an otherwise bilingual product?

