# GBA Elections Citizen Platform — Stakeholder Overview

**Status:** Draft v2 (for review) · **Scope:** Pre-election MVP · **Owner:** Product · **Domain:** `bangalore-votes.opencity.in` · **Date:** July 2026

> A high-level overview of the platform, its user roles, and what each role can do — for stakeholder alignment before detailed design and engineering. Full detail lives in the **PRD** and **Information Architecture** documents.

---

## 1. Purpose

Bengaluru is heading into its first ward-level (GBA / corporator) elections in roughly a decade. Citizen interviews showed people are willing to vote but blocked by a few specific gaps: they don't know which ward they now belong to, they can't find trustworthy information about local candidates, and existing sources feel biased or unreliable.

The platform makes trustworthy, ward-level election information easy to find, compare, and act on — and gives citizens a voice in which local issues matter. **This release is pre-election only.** Promise tracking, ward budgets, and a live civic-issue directory are deferred to a later phase.

---

## 2. What the platform does

At a high level, the platform lets a citizen:

- Find their **new GBA ward** and see who is standing there.
- Read neutral, **sourced candidate report cards** (track record, cases, assets, education, news coverage) and compare candidates side by side.
- See the **key issues** in their ward and **vote on the top 3** that matter to them.
- Handle the logistics: **check registration**, **issue or update a voter ID**, learn **how to vote**, and **find their polling booth**.
- Use everything in **English or Kannada**.

A small trusted team keeps the data accurate and governs access behind the scenes.

---

## 3. Roles at a glance

| Role | Who they are | Primary job |
|---|---|---|
| **Anonymous citizen** | Any visitor, no account | Find & read information; see (but not cast) flags and issue votes |
| **Registered citizen** | Signs up with email/WhatsApp + ward + language | Get updates; flag misinformation; vote on ward issues |
| **Data curator** | Trusted, vetted individual (ward/zone-scoped) | Upload & correct ward and candidate data; define ward issues; review flags |
| **Admin** | Small internal team | Manage roles, access, users, and oversight |

**One guiding principle:** the two citizen contributions — flagging an error and voting on issues — are **visible to everyone but require registration at the moment of submitting**. Anonymous users see the buttons; tapping one opens a quick sign-up popup, then the action continues.

---

## 4. Roles & key functionalities

### 4.1 Anonymous citizen
*Any visitor, no account — the vast majority of traffic. No login wall; pages are shareable so RWAs and community groups can forward them.*

- Search and browse all published information: find their new GBA ward, view candidate report cards, compare candidates, and read ward issues.
- Access voting logistics: check registration/eligibility, locate their polling booth, and read how-to-vote and voter-ID guidance.
- See public issue-vote results for any ward, and see the flag and vote buttons — tapping either prompts them to register.
- **Out of scope:** no subscriptions, no submitting, no editing. Fully read-only.

### 4.2 Registered citizen
*Signs up with email and/or WhatsApp, their ward, and a language preference. Everything the anonymous user can do, plus:*

- Receive **ward-scoped updates** (election date/notice, roll deadlines, candidate changes) by email / WhatsApp, in their preferred language.
- **Flag misinformation** on any ward or candidate — across **any ward**, via a popup.
- **Vote on their top 3 issues**, but only in their **registered home ward**.
- **Track the status of their submissions** — flags and corrections, each shown as pending / accepted / rejected with a reason.
- Set a **saved language preference** that also governs the language of their updates.

### 4.3 Data curator
*A trusted, vetted individual responsible for data accuracy, scoped to a set of wards or a zone. Because curators are trusted, their edits go live immediately — no second approval.*

- Create, upload, and correct ward and candidate information, including **links to news articles** about candidates.
- **Define the list of votable issues** for each ward (this powers citizen issue voting).
- Review the queue of citizen flags and corrections, and accept or reject them (rejections carry a reason back to the submitter).
- Attach a **source** to every record and change, so the public view can show its provenance.
- **Scope note:** with 369 wards, curators are assigned to a set of wards/zone rather than the whole city.

### 4.4 Admin
*A small internal team that governs people and access rather than day-to-day content.*

- Manage roles and access: invite and vet curators, grant/revoke the curator role, and set a curator's ward scope.
- Manage user accounts, including deactivating or banning abusive users.
- Act as an oversight super-user across all wards, able to correct or roll back any record.
- Access the full audit log of who changed what, when, and from which source.

---

## 5. How citizen contributions become live data

The correction loop connects citizens and curators. Both flagging and voting happen through **popups** that overlay the current page, so citizens never lose their place.

1. **Notice an error / want to vote** — anyone can tap Flag or Vote. Anonymous users see a sign-up popup first; registered users proceed.
2. **Submit** — a flag routes to the curator whose scope covers that ward; an issue vote is recorded for the user's home ward.
3. **Review** — the curator sees the flag, the current value, and the source, and accepts (edit + source) or rejects (with reason).
4. **Publish** — accepted edits go live immediately, because curators are trusted.
5. **Record** — every change is written to an immutable audit log; the submitter is notified.

---

## 6. Language & access highlights

- **Bilingual by default** — the whole platform works in **English and Kannada**, with a toggle available to everyone and a saved preference for registered users.
- **One simple login** — citizens, curators, and admins all sign in the same way, via **email / WhatsApp OTP** (no passwords, no 2FA).
- **No redirects** — registration and flagging are popups, so users stay on the page they were reading.
- **Distinct URLs** — every page has its own shareable link under `bangalore-votes.opencity.in`.

---

## 7. Locked decisions

| Decision | Resolution |
|---|---|
| Curator publish gate | Curators are trusted; edits go live immediately, no second approval. |
| Authentication | One OTP mechanism for all roles; no passwords, no 2FA. |
| Registration & flagging | Both are popups — no redirection. |
| Anonymous contribution | Sees flag and vote actions; prompted to register at submit. |
| Issue-vote visibility | Aggregated results are public, visible to anonymous citizens. |
| Issue-vote scope | Registered citizens vote only in their home ward. |
| Flagging scope | Registered citizens can flag across any ward. |
| Issue list ownership | Defined by the curator, per ward. |
| Report card content | Includes curator-maintained links to news articles. |
| Curator sourcing | Recruiting/vetting curators is an offline effort — tracked as a dependency. |

---

## 8. Key dependencies

- **Curator recruitment & vetting (offline)** — data quality depends on enough trusted curators with the right ward coverage. A hard dependency for launch.
- **Authoritative data sources** — reliable access to EC affidavits, official notifications, and ward-delimitation data.
- **WhatsApp delivery** — needs Business API access, approved templates, and opt-in; email is the baseline.
- **Election timeline** — candidate content can only be populated near the official notification; ward and logistics tools can launch earlier.

---

## 9. Out of scope (future phases)

Promise / accountability tracking, ward budget transparency, a live civic-issue officer directory, remote voting, and candidate outreach tooling.

---

## 10. Next steps

- Review and sign off on this overview, the PRD, and the IA with stakeholders.
- Resolve remaining open questions (see the PRD).
- Kick off offline curator recruitment in parallel (name an owner).
- Proceed to wireframe → hi-fi design and technical design.