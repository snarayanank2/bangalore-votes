# GBA Elections Citizen Platform — Information Architecture

**Status:** Draft v3 · **Frame:** Mobile-first · **Domain:** `bangalore-votes.opencity.in` · **Date:** July 2026

This document defines every page and modal in the pre-election MVP. Each URL is a distinct page (one URL → one screen). Modals overlay the current page and do not have their own URL. Priority tags have been removed — the full scope is in build.

---

## 1. Conventions

- **Base domain:** all paths below are under `https://bangalore-votes.opencity.in`.
- **Global elements (present on every page):** app bar with logo, **language toggle (EN | ಕನ್ನಡ)**, and a **Sign in / Account** control; footer with links to About and the voting guide.
- **Pages vs modals:** a *page* has its own URL and can be deep-linked and shared. A *modal* is a popup that overlays whatever page the user is on, so the user never loses context and the URL does not change.
- **Access levels:** Anonymous (no account) · Registered (OTP account) · Curator (OTP, ward/zone-scoped) · Admin (OTP). Curators and admins use the **same OTP login** as citizens — no separate password or 2FA.
- **Contribution rule:** flag and issue-vote actions are visible to everyone but gated at submit — an anonymous user is shown the Register/Login popup first, then the action resumes.

---

## 2. Site map

```
bangalore-votes.opencity.in
│
├─ PUBLIC (anonymous, read-only)
│   ├─ /                                 Home / Landing
│   ├─ /ward/{ward-id}                   Ward result
│   ├─ /ward/{ward-id}/candidates        Candidates in ward
│   ├─ /candidate/{candidate-slug}       Candidate report card
│   ├─ /ward/{ward-id}/compare           Compare candidates
│   ├─ /ward/{ward-id}/issues            Ward issues & voting
│   ├─ /check-registration               Check registration / eligibility
│   ├─ /about-election                   Election info / explainer
│   ├─ /voting-guide                     Voting guide (hub)
│   ├─ /voting-guide/voter-id            Voter-ID issuance & update
│   ├─ /voting-guide/how-to-vote         How to vote
│   ├─ /voting-guide/find-booth          Find polling booth
│   └─ /about                            About & how we source data
│
├─ REGISTERED CITIZEN (OTP)
│   ├─ /account                          My account (profile & language)
│   ├─ /account/notifications            Notification settings
│   └─ /account/submissions              My submissions (status)
│
├─ CURATOR (OTP, scoped)
│   ├─ /curator                          Curator dashboard
│   ├─ /curator/queue                    Review queue
│   ├─ /curator/queue/{submission-id}    Submission review
│   ├─ /curator/candidate/{id}           Edit candidate
│   ├─ /curator/ward/{id}                Edit ward
│   └─ /curator/ward/{id}/issues         Define ward issue list
│
├─ ADMIN (OTP)
│   ├─ /admin                            Admin console
│   ├─ /admin/roles                      Roles & access
│   ├─ /admin/users                      Manage users
│   └─ /admin/audit                      Audit log
│
└─ MODALS (overlay current page, no dedicated URL)
    ├─ Register / Login          (fallback page: /login)
    ├─ Flag misinformation
    └─ Cast issue vote (top 3)
```

---

## 3. Public pages

### 3.1 Home / Landing
- **URL:** `/`
- **Access:** Anonymous
- **Purpose:** Entry point; get the citizen to their ward and orient them to the election.
- **Key elements:** ward search (address or voter ID); election status + date countdown; shortcuts to Check registration and the voting guide; **Sign in** in app bar.
- **Links to:** Ward result, Check registration, Voting guide, About-election; Register/Login modal.

### 3.2 Ward result
- **URL:** `/ward/{ward-id}`
- **Access:** Anonymous
- **Purpose:** Show the citizen their post-delimitation GBA ward and act as the hub for that ward.
- **Key elements:** new ward name + number + corporation (N/S/E/W/Central); old→new ward mapping; boundary map; “Set as my ward” prompt for registered users.
- **Links to:** Candidates in ward, Ward issues & voting, Voting guide.

### 3.3 Candidates in ward
- **URL:** `/ward/{ward-id}/candidates`
- **Access:** Anonymous
- **Purpose:** List all candidates standing in the ward.
- **Key elements:** candidate rows (photo, name, party/independent); Compare entry point; empty-state before nomination window.
- **Links to:** Candidate report card, Compare candidates.

### 3.4 Candidate report card
- **URL:** `/candidate/{candidate-slug}`
- **Access:** Anonymous
- **Purpose:** A structured, neutral, sourced profile of a single candidate — the most-requested feature.
- **Key elements:** name/photo/party; ward track record; criminal record / pending cases; declared assets; education; approachability; **links to news articles about the candidate**; source shown on every field (affidavit vs curator-compiled distinguished); **Flag an error** action.
- **Links to:** Compare candidates, Ward issues; opens Flag modal.

### 3.5 Compare candidates
- **URL:** `/ward/{ward-id}/compare`
- **Access:** Anonymous
- **Purpose:** Compare candidates side by side.
- **Key elements:** column layout (not a feed); same field rows as the report card so they line up; 2-up / horizontal scroll on mobile.
- **Links to:** Candidate report card.

### 3.6 Ward issues & voting
- **URL:** `/ward/{ward-id}/issues`
- **Access:** Anonymous (view results) · Registered (vote, home ward only)
- **Purpose:** Show the ward’s key issues, candidate stances, and citizen issue-voting results.
- **Key elements:** curator-defined issue list; candidate stance per issue (where available); **public ranked results** of citizen votes; “Vote your top 3” action.
- **Links to:** Candidate report card; opens Cast issue vote modal (and Register/Login modal if anonymous).
- **Notes:** voting is limited to the user’s **registered home ward**.

### 3.7 Check registration / eligibility
- **URL:** `/check-registration`
- **Access:** Anonymous
- **Purpose:** Single authoritative place to confirm the citizen is on the GBA electoral roll.
- **Key elements:** lookup by voter ID / details; result state; prominent link out to the official EC roll flow.
- **Notes:** available early, before candidate data is populated.

### 3.8 Election info / explainer
- **URL:** `/about-election`
- **Access:** Anonymous
- **Purpose:** Explain the election to the “didn’t know this existed” segment.
- **Key elements:** election status + official-notice countdown; plain-language explainer of what a GBA corporator does and why the local vote matters.

### 3.9 Voting guide (hub)
- **URL:** `/voting-guide`
- **Access:** Anonymous
- **Purpose:** Index for the three logistics guides.
- **Key elements:** cards linking to Voter-ID, How to vote, Find polling booth.
- **Links to:** the three pages below.

### 3.10 Voter-ID issuance & update
- **URL:** `/voting-guide/voter-id`
- **Access:** Anonymous
- **Purpose:** Guide new enrolment and updating/transferring details when a citizen moves.
- **Key elements:** step-by-step for new voter (Form 6) and for address change/transfer; deep links into official EC processes.

### 3.11 How to vote
- **URL:** `/voting-guide/how-to-vote`
- **Access:** Anonymous
- **Purpose:** Step-by-step guide to the voting-day process.
- **Key elements:** simple numbered steps; bilingual; aimed at first-time and less-digital voters.

### 3.12 Find polling booth
- **URL:** `/voting-guide/find-booth`
- **Access:** Anonymous
- **Purpose:** Return the citizen’s correct, address-accurate polling booth.
- **Key elements:** lookup by address/voter ID; booth location + map (not just a name).

### 3.13 About & how we source data
- **URL:** `/about`
- **Access:** Anonymous
- **Purpose:** Establish trust — explain who runs the platform, how data is sourced and verified, and the neutrality stance.
- **Key elements:** sourcing/verification explanation; contact; links to primary sources.
- **Notes:** *Added from the PRD cross-check (trust & provenance, §10) — see Section 7.*

---

## 4. Registered citizen pages

### 4.1 My account (profile & language)
- **URL:** `/account`
- **Access:** Registered
- **Purpose:** Manage identity and language.
- **Key elements:** **saved language preference** (persists across sessions and sets the language of updates); home ward; basic profile.
- **Links to:** Notification settings, My submissions.

### 4.2 Notification settings
- **URL:** `/account/notifications`
- **Access:** Registered
- **Purpose:** Control what updates the user receives and how.
- **Key elements:** channel toggles (email / WhatsApp); ward-update subscriptions (election date/notice, roll deadlines, candidate changes).
- **Notes:** *Split out from the old combined account screen so each URL is one page.*

### 4.3 My submissions
- **URL:** `/account/submissions`
- **Access:** Registered
- **Purpose:** Let the user track everything they’ve submitted.
- **Key elements:** list of flags and corrections with **status — pending / accepted / rejected + reason**.

---

## 5. Curator pages

*All curator pages are scoped to the curator’s assigned wards/zone.*

### 5.1 Curator dashboard
- **URL:** `/curator`
- **Access:** Curator
- **Purpose:** Home for a curator’s work.
- **Key elements:** review-queue count, recent activity, quick entry to edit candidates/wards and define issues.
- **Links to:** Review queue, Edit candidate, Edit ward, Define ward issue list.

### 5.2 Review queue
- **URL:** `/curator/queue`
- **Access:** Curator
- **Purpose:** Work through citizen-submitted flags/corrections.
- **Key elements:** queue items (deduped, with counts) for the curator’s wards; filter/sort.
- **Links to:** Submission review.

### 5.3 Submission review
- **URL:** `/curator/queue/{submission-id}`
- **Access:** Curator
- **Purpose:** Review one submission and act on it.
- **Key elements:** the flag/correction, current value, source; **accept** (edit + attach source) or **reject** (with reason); on accept, change publishes immediately and is audit-logged; submitter is notified.
- **Notes:** *Added from the PRD cross-check (contribution/moderation, §6).*

### 5.4 Edit candidate
- **URL:** `/curator/candidate/{id}`
- **Access:** Curator
- **Purpose:** Create/correct a candidate record.
- **Key elements:** all report-card fields; **manage news-article links**; **source required per field**; edits publish immediately.

### 5.5 Edit ward
- **URL:** `/curator/ward/{id}`
- **Access:** Curator
- **Purpose:** Maintain ward-level information.
- **Key elements:** ward metadata, boundary/mapping data, ward issues content; source per field.
- **Links to:** Define ward issue list.

### 5.6 Define ward issue list
- **URL:** `/curator/ward/{id}/issues`
- **Access:** Curator
- **Purpose:** Set the list of issues that citizens vote on for this ward.
- **Key elements:** add/edit/remove issues; this list powers the public Ward issues & voting page.

---

## 6. Admin pages

### 6.1 Admin console
- **URL:** `/admin`
- **Access:** Admin
- **Purpose:** Governance home.
- **Links to:** Roles & access, Manage users, Audit log.

### 6.2 Roles & access
- **URL:** `/admin/roles`
- **Access:** Admin
- **Purpose:** Manage the curator/admin roster and scope.
- **Key elements:** invite/vet curators; grant/revoke roles; assign/adjust curator ward scope.

### 6.3 Manage users
- **URL:** `/admin/users`
- **Access:** Admin
- **Purpose:** Manage citizen accounts and abuse.
- **Key elements:** search users; deactivate/ban accounts; view submission history.
- **Notes:** *Added from the PRD cross-check (admin deactivate/ban, §4/§7).*

### 6.4 Audit log
- **URL:** `/admin/audit`
- **Access:** Admin
- **Purpose:** Immutable record of all changes.
- **Key elements:** who changed what, when, and from which source; across all wards; supports rollback.

---

## 7. Modals

Modals overlay the current page and never change the URL, so the citizen never loses their place.

### 7.1 Register / Login
- **Trigger:** the **Sign in** control (available to any unregistered visitor) or any gated action (flag / vote).
- **Fallback page:** `/login` (for deep links / no-JS).
- **Key elements:** email or WhatsApp entry → **OTP** → confirm ward + language. No passwords, no 2FA.
- **Behaviour:** on success, **resumes the exact action** the user attempted, in place.

### 7.2 Flag misinformation
- **Trigger:** the Flag action on a candidate report card or a ward page — **on any ward** (not just the home ward).
- **Key elements:** pick the field/claim that’s wrong; free-text detail + optional source; submit.
- **Behaviour:** if anonymous, the Register/Login modal shows first, then this reopens; on submit the flag routes to the curator whose scope covers that ward and is audit-logged.

### 7.3 Cast issue vote (top 3)
- **Trigger:** the “Vote your top 3” action on the Ward issues page.
- **Key elements:** select up to three issues from the curator-defined list; submit; changeable later.
- **Behaviour:** if anonymous, Register/Login modal shows first; voting is restricted to the user’s **registered home ward**; one vote-set per user.

---

## 8. PRD coverage cross-check

Confirms every PRD capability maps to a page/modal, and highlights the four pages/modals added while doing this check.

| PRD reference | Covered by |
|---|---|
| 5.1 Ward identity lookup | `/`, `/ward/{id}` |
| 5.2 Candidate report card (incl. news links) | `/candidate/{slug}` |
| 5.3 Candidate comparison | `/ward/{id}/compare` |
| 5.4 Ward issues & candidate stance | `/ward/{id}/issues` |
| 5.5 Citizen issue voting | `/ward/{id}/issues` + Cast issue vote modal |
| 5.6 Roll / eligibility check | `/check-registration` |
| 5.7 Election awareness | `/about-election` (+ Home banner) |
| 5.8 Voter-ID issuance & update/transfer | `/voting-guide/voter-id` |
| 5.9 How to vote | `/voting-guide/how-to-vote` |
| 5.10 Polling-booth locator | `/voting-guide/find-booth` |
| §6 Contribution & moderation | Flag modal, `/curator/queue`, `/curator/queue/{id}` |
| §7 Roles & permissions | Auth across all curator/admin pages |
| §8 Language toggle & saved preference | Global toggle + `/account` |
| §9 Notifications & delivery | `/account/notifications` |
| §10 Trust, neutrality & provenance | Sources on report card; `/about`; `/admin/audit` |
| Registration | Register/Login modal (`/login` fallback) |
| Curator: define issues | `/curator/ward/{id}/issues` |
| Admin: roles & scope | `/admin/roles` |
| Admin: deactivate/ban | `/admin/users` |
| Admin: audit | `/admin/audit` |

**Gaps found and added this revision:** `/about` (trust/sourcing page), `/account/notifications` (split from account), `/curator/queue/{submission-id}` (submission review), `/admin/users` (account moderation).

---

## 9. Open questions

- Issue-vote results display: raw counts, percentages, or ranked order only?
- Curator scoping unit: per-ward vs per-zone (affects `/curator` navigation).
- Bilingual fallback: how a field authored in only one language displays in the other.
- Compare: maximum number of candidates shown at once on mobile.
- News links on the report card: curator-added only, or auto-suggested for curator approval?
- Do we need a public `/login` fallback page, or is the modal sufficient for all entry paths?