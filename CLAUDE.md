# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

This is currently a **documentation / specification repository** — there is no application code, build system, package manifest, or tests yet. The only source of truth is the product specification in `docs/`, plus `LICENSE` (MIT). Any implementation work starts from a blank slate; there are no established build/lint/test commands to follow, and no framework, language, or infra has been chosen. Do not assume a stack — confirm choices before scaffolding.

## What is being built

**GBA Elections Citizen Platform** (`bangalore-votes.opencity.in`) — a pre-election MVP giving Bengaluru citizens trustworthy, ward-level information for the upcoming GBA (corporator) ward elections. Citizens find their new post-delimitation ward, read neutral sourced candidate report cards, compare candidates, vote on the top-3 local issues, and access voting logistics (registration check, voter-ID, how-to-vote, booth locator). Fully bilingual (English / Kannada).

**Explicitly out of scope this release:** promise/accountability tracking, ward budgets, civic-issue officer directory, remote voting, candidate outreach tooling.

## The three docs (read in this order)

- `docs/overview.md` — stakeholder-level summary of purpose, roles, and the contribution loop. Start here.
- `docs/prd.md` — the authoritative product requirements: per-feature requirements (§5), moderation flow (§6), permissions matrix (§7), NFRs (§12), and locked decisions (§14). **When a requirement is ambiguous, this document wins.**
- `docs/information-architecture.md` — every page and modal, with exact URLs, access level, purpose, and key elements. **Use this as the canonical URL/route map when building any page.**

## Core architecture concepts

These four ideas recur across all features — internalize them before implementing anything:

1. **Four roles, mostly read-only public.** Anonymous citizen (no account, vast majority of traffic, fully read-only) · Registered citizen (OTP account) · Data curator (OTP, **scoped to assigned wards/zone**) · Admin (OTP, city-wide). See the permissions matrix in `docs/prd.md` §7 — "Scope" in that matrix means curator actions are restricted to their assigned wards.

2. **Contribution is visible-to-all but gated-at-submit.** Both citizen contributions — *flagging misinformation* and *voting on issues* — show their buttons to anonymous users, but tapping opens a Register/Login popup first, and the original action **resumes in place** after auth. Flagging works across **any ward**; issue voting is restricted to the user's **registered home ward**.

3. **Pages vs modals.** Every page has its own distinct, shareable, deep-linkable URL (one URL → one screen); mobile-first; anonymous read paths must stay fast with **no login wall** (RWAs forward these links). The three actions that would break context are **modals** that overlay the current page without changing the URL: Register/Login (fallback page `/login`), Flag misinformation, Cast issue vote. Do not turn a modal into a routed page or vice versa.

4. **Trusted curators + provenance + audit.** Curator edits **go live immediately** — no second-person approval. Every data field carries a visible **source**, with official/affidavit data distinguished from curator-compiled context. Every published change writes to an **immutable audit log** supporting rollback. The flag→correction→publish→record loop is defined in `docs/prd.md` §6.

## Fixed decisions (don't relitigate without asking)

- **Auth:** a single **email / WhatsApp OTP** mechanism for *all* roles (citizen, curator, admin). No passwords, no 2FA.
- **Curator publish:** trusted; edits publish immediately with no approval gate.
- **Bilingual:** EN / Kannada throughout — session toggle for everyone, saved preference for registered users (also governs their notification language).
- **Scale target:** 369 wards, city-wide read traffic that spikes near election day; rate-limiting on all contribution actions.

The full "Locked decisions" tables live in `docs/prd.md` §14 and `docs/overview.md` §7. Open questions (still undecided) are tracked in one place — `docs/prd.md` §17 — check there before inventing an answer.
