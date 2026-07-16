# Project Dependencies

**Date:** 2026-07-16
**Status:** Living document
**Scope:** Everything this project needs that **cannot be produced by writing code in this repository** — legal work, external account approvals, official data, people, money, and decisions. If a task can be closed by a pull request, it does not belong here.

This document exists because the binding constraints on this project are almost all outside the codebase. The application could be finished and the platform still could not launch: not without ward boundaries, not without a privacy policy, and not without curators.

Owners are listed as **unassigned** where nobody has been named. That is the honest state and the first thing to fix — an unowned dependency is not being worked on, whatever its due date says.

---

## 1. The three critical paths

These run in parallel and are independent. The project is gated by whichever finishes last, so all three must start now.

**Path A — Legal → privacy → WhatsApp.** The longest chain, and the least obvious:

```
retention decision → lawyer drafts /privacy → /privacy published
  → Meta business verification → WhatsApp API onboarding
  → ~28 templates submitted (14 sends × EN/KN) → Meta approval (weeks)
  → the comms plan can run
```

Every arrow is someone else's queue. The chain is measured in months, and it starts with a decision nobody has made (§2.1). This is the one most likely to be mistaken for launch-week paperwork.

**Path B — Ward delimitation data.** The teaser *is* the ward finder (GTM spec §2). Without post-delimitation boundaries there is no Phase 1 — not a degraded Phase 1, none. Ward-name and pincode lookup ship first and need no boundary polygons (stack spec §6), which buys a partial path, but address lookup and everything ward-scoped waits on this.

**Path C — People.** Curators gate ward data readiness, which gates candidate comms (PRD §9.1). Partners gate reach. Both are recruited in the same conversations (GTM spec §2), and both are slower than they look because vetting is a judgement, not a form.

---

## 2. Legal & compliance

| # | Dependency | Blocks | Owner |
|---|---|---|---|
| 2.1 | **Retention period decision** — how long citizen contact data is kept; a period or a deletion trigger | `/privacy`, therefore all of Path A | unassigned |
| 2.2 | **Legal counsel engaged** — to draft `/terms` and `/privacy` | Path A | unassigned |
| 2.3 | **DPDP Act 2023 compliance review** — consent notice, purpose limitation, data-principal rights | `/privacy` | unassigned |
| 2.4 | **Named grievance officer** — a real person, contactable, published | `/privacy` (DPDP requirement) | unassigned |
| 2.5 | **Contribution licensing** — terms under which citizen flags and issue votes are used | `/terms` | unassigned |
| 2.6 | **Future-use consent decision** — whether registration carries an optional "tell me about future civic tools" opt-in | Registration UI; the next phase's list | unassigned |
| 2.7 | **Oorvani Foundation entity details** — trust registration, signing authority, registered address for legal pages and Meta verification | `/privacy`, `/about`, Meta verification | unassigned |

**2.1 is the first domino.** It is a trust decision before it is a legal one, and it is currently unowned.

**On 2.5:** the platform publishes aggregated issue votes as public data and shows citizen flags to curators. Both need a licence citizens actually granted.

**Not a dependency, deliberately:** a legal opinion on RPA §126 (the election silence period). The GTM plan resolves this by going dark from E−3d rather than by testing the boundary (GTM spec §4), which converts a legal question into a scheduling decision. If anyone later proposes a send inside the final 48 hours, this becomes a dependency again.

---

## 3. Messaging & delivery

| # | Dependency | Blocks | Owner |
|---|---|---|---|
| 3.1 | **Meta Business verification** — legal entity documents for Oorvani; Meta's process, Meta's timeline | WhatsApp entirely | unassigned |
| 3.2 | **WhatsApp Business API access** via Meta Cloud API (stack spec §7) | WhatsApp OTP + all WhatsApp sends | unassigned |
| 3.3 | **Published `/privacy` URL** | 3.1 — Meta will not onboard without it | unassigned |
| 3.4 | **Dedicated phone number** for the WhatsApp Business account | 3.2 | unassigned |
| 3.5 | **~28 message templates** submitted and approved — 14 sends × EN/KN | The comms calendar | unassigned |
| 3.6 | **Template category classification** — Meta's Marketing vs Utility distinction | 3.5, and the budget in 3.7 | unassigned |
| 3.7 | **WhatsApp conversation budget** — see below | Whether the plan is affordable | unassigned |
| 3.8 | **Email service provider** + domain authentication (SPF, DKIM, DMARC) | The email baseline — i.e. everything, if WhatsApp slips | unassigned |
| 3.9 | **Sender reputation warm-up** | Deliverability of the first real send | unassigned |

**3.6 and 3.7 are not accounted for anywhere else, and they should be.** Meta classifies templates as Utility (transactional, cheap) or Marketing (announcements, dearer, and separately blockable by the user). Of our seven sends, only W1 is unambiguously Utility. The rest — candidates have filed, vote on your issues, report cards are complete — read as Marketing under Meta's definitions however civic their intent.

That has a price. At the Phase 1 target of 25,000 registered citizens × 7 sends ≈ **175,000 WhatsApp conversations**, and Indian marketing conversations are billed per conversation. Nobody has costed this, and it scales linearly with the success of the registration drive: hitting the target makes the bill bigger, not smaller. Worth resolving before Phase 0 exits, because the answer could reasonably change the channel mix — email carries no per-message fee.

**3.8 is the real baseline.** Email is not the fallback; it is the thing that works while Path A is still in Meta's queue. It deserves to be set up first and properly, not treated as the consolation prize.

---

## 4. Official data sources

| # | Dependency | Blocks | Owner |
|---|---|---|---|
| 4.1 | **Post-delimitation GBA ward boundaries** (GeoJSON, 369 wards) | Path B — Phase 1 entirely | unassigned |
| 4.2 | **Ward metadata** — names, numbers, zone mapping | Ward pages | unassigned |
| 4.3 | **EC notification** — official date and schedule | Anchor **N**; the whole calendar | unassigned |
| 4.4 | **Electoral roll deadline date** | R1, the highest-value send | unassigned |
| 4.5 | **Candidate nomination list** — from EC / returning officers, provisional then final | Phase 2, and C2 at E−2w | unassigned |
| 4.6 | **Candidate affidavits** (Form 26) — cases, assets, education | Report cards; the ward-readiness check (PRD §9.1) | unassigned |
| 4.7 | **Polling booth data** — address-accurate, with locations | `/voting-guide/find-booth`; the F2 send | unassigned |
| 4.8 | **Registration-check path** — EC service integration or documented manual route | `/check-registration` | unassigned |

**4.1 is the single largest technical risk in the project** and it is not a technical task. The stack spec (§6) is explicit: geocoding quality is solved, delimitation data is not. Ward-name and pincode lookup are the hedge.

**4.3 and 4.4 move independently.** The roll deadline is not derived from the election date and must be tracked separately — R1 is anchored to it, and R1 is the one message whose failure cannot be undone (GTM spec §4).

**4.6 has a shape problem worth knowing early.** Affidavits arrive as scanned PDFs, per candidate, on a returning officer's timeline. Across 369 wards that is a transcription operation with a deadline, not a data feed — and it is what curator capacity (§5.1) is actually spent on.

---

## 5. People & organisation

| # | Dependency | Blocks | Owner |
|---|---|---|---|
| 5.1 | **Curator recruitment & vetting** — enough, with ward coverage across 369 | Ward readiness → all candidate comms | unassigned |
| 5.2 | **Partner recruitment** — RWAs, civic organisations | Reach; the Phase 1 target | unassigned |
| 5.3 | **A named outreach owner** — one person owning 5.1 and 5.2 as one motion | Both of the above | unassigned |
| 5.4 | **Curator onboarding material** — what the standard is, what a source is, how to sign off | Data quality; the sign-off being real | unassigned |
| 5.5 | **Kannada translation review** — a person who checks machine output before it ships | Bilingual claim (PRD §8) | unassigned |
| 5.6 | **Named spokespeople** with approved quotes | `/press` | unassigned |
| 5.7 | **Moderation capacity** — someone works the flag queue near the election | The correction loop (PRD §6) | unassigned |

**5.3 is the cheapest item here and the one most likely to sink the plan.** Curator and partner recruitment are the same conversations with the same people (GTM spec §2). Split across two owners, the relationship gets asked twice and gives once. Unowned, it happens in whatever time is left over, which near an election is none.

**5.5 is not optional.** The stack machine-translates curator content into Kannada (stack spec §5). Unreviewed machine Kannada on a candidate's criminal record is exactly the kind of error the flag queue exists to catch — except it would be ours, published at scale, on a platform whose whole claim is accuracy.

---

## 6. Commercial accounts & infrastructure

| # | Dependency | Blocks | Owner |
|---|---|---|---|
| 6.1 | **Cloud hosting account + billing** — the VM running Compose (stack spec §4) | Any deployment | unassigned |
| 6.2 | **Google Cloud billing + Geocoding API key** | Address→ward lookup | unassigned |
| 6.3 | **Anthropic API key + billing** | Kannada auto-translation (stack spec §5) | unassigned |
| 6.4 | **CDN account** — absorbs election-day read traffic (stack spec §4) | The traffic spike | unassigned |
| 6.5 | **DNS for `bangalore-votes.opencity.in`** — delegated under Oorvani's `opencity.in` | Everything public | unassigned |
| 6.6 | **Off-box backup storage** + a rehearsed restore (stack spec §4) | Launch readiness | unassigned |
| 6.7 | **Secrets custody** — who holds the API keys, session signing key, mail credentials | Deployment; continuity | unassigned |
| 6.8 | **Total running budget** — 6.1–6.4 plus WhatsApp conversations (3.7) | Whether any of this is affordable | unassigned |

**6.8 is the gap.** Four metered services (geocoding, Anthropic, CDN, WhatsApp) plus hosting, and the two largest scale directly with success: more citizens means more sends and more geocodes. The stack spec caps geocoding spend (§6) but nothing caps the rest, and no total has been put on paper. This connects to the funding disclosure question (§7.3) — you cannot publish who pays for the platform without knowing what it costs.

**6.6 deserves its own line.** "An unrehearsed backup is not a backup" (stack spec §4) is a task with a date, not a principle. It is the kind of thing that is genuinely fine until the one day it is not, which for this project is a day that cannot be rescheduled.

---

## 7. Decisions blocking work

Not external dependencies, but non-code, unowned, and blocking. Listed so they are not mistaken for engineering tasks waiting on engineering.

| # | Decision | Blocks | Owner |
|---|---|---|---|
| 7.1 | Retention period (= 2.1, repeated because it blocks the most) | Path A | unassigned |
| 7.2 | Future-use consent at registration (= 2.6) | Registration UI; the next phase | unassigned |
| 7.3 | **Funding disclosure detail** — named funders and amounts, or categories only? | `/about` | unassigned |
| 7.4 | **Owned channels** — are Open City and Citizen Matters available for launch distribution? | Phase 0 and 1 planning | unassigned |
| 7.5 | **Press timing** — does the launch push go at N, or at E−2w when report cards are complete? | Press outreach | unassigned |
| 7.6 | **Legal-page localisation** — do `/terms` and `/privacy` ship in Kannada? | Legal drafting scope | unassigned |

**7.4 may be the highest-leverage open question in the project.** The GTM plan is written against a cold start: no list, no paid spend, everything earned through partners. If Oorvani's existing properties carry a Bengaluru civic readership, that assumption is wrong in the project's favour, and Phase 1 should be planned differently. It costs one conversation to find out and it is worth having before Phase 0 hardens.

---

## 8. How to use this document

Three things make it useful rather than decorative:

1. **Name an owner for every row.** The single highest-value edit anyone can make to this file. Every row currently says *unassigned*, which means every row is currently nobody's problem.
2. **Start Paths A, B and C now**, in parallel. They do not queue behind each other and they do not queue behind the code.
3. **Resolve §3.7 and §6.8 before Phase 0 exits.** They are the two places where a number nobody has written down could change the plan rather than just the invoice.

Related: `docs/superpowers/specs/2026-07-16-gtm-plan-design.md` (§10 dependencies), `docs/prd.md` (§15), `docs/overview.md` (§8), `docs/superpowers/specs/2026-07-16-production-stack-design.md`.
