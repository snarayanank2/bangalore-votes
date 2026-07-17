# Security Hardening — Design

**Date:** 2026-07-17 · **Status:** Approved · **Scope:** Security mitigations layered onto the production architecture (`2026-07-17-production-architecture-design.md`)

A security review of the production architecture found six major gaps and five smaller ones. This document records the decided mitigation for each. It changes no product behaviour except one: sessions now expire after one hour idle. Everything else hardens the mechanisms the architecture already committed to.

---

## 1. CSRF

The architecture authenticates with cookies and takes curator/admin writes through plain form POSTs that publish immediately — a forged request from a curator's browser would publish attacker content onto live candidate pages.

- The session cookie carries `HttpOnly; Secure; SameSite=Lax`.
- One Astro middleware rejects every unsafe method (POST/PUT/DELETE) whose `Origin` / `Sec-Fetch-Site` headers are not same-origin. This covers all fetch-based API calls from the modals.
- Server-rendered forms (curator, admin, account, `/login` fallback) additionally carry a synchronizer CSRF token tied to the session, because the no-JS paths cannot rely on fetch metadata.

## 2. OTP brute force and pumping

The 6-digit code, 10-minute expiry, and hashed storage stand. Added:

- **Verify cap:** 5 attempts per code; the 6th invalidates the code and forces a new request. This closes the brute-force window that per-IP limits alone leave open to distributed guessing.
- **Per-destination request cooldown:** per email address or phone number, 1 request/minute, 5/hour, and a daily cap. Botnets defeat per-IP limits; per-destination limits are what stop SMS/WhatsApp pumping against Twilio/SendGrid.
- **Global send budget:** a daily send ceiling with an ops alarm, so a pumping attack costs a bounded amount before a human sees it.

## 3. Paid-API amplification (`/api/ward-lookup`)

Every lookup calls the paid Google Geocoding API, unauthenticated. Protection is cache + quota:

- **Derived-result cache:** normalized address → ward ID. The cache stores our own conclusion, never Google's coordinates or response content, so it stays inside the Maps ToS reading recorded in the dependency register §6.4.
- **Global daily geocode budget:** when exhausted, the endpoint degrades to the pincode path with the same message the architecture already specifies for geocode failure (§11).
- **Billing alerts** on the Google account (dependency register §6.5 already requires these).

The Anthropic API needs no equivalent guard: only authenticated curator publishes trigger it, never public traffic.

## 4. Backup encryption

Nightly `pg_dump` contains contact details, home wards, consent records, and identity-linked issue votes — DPDP-regulated personal data. The backup tool is **restic**, chosen over rclone specifically because it encrypts at rest by default. The repository key lives off-box with admin-only access. Retention stays an open question (PRD §17); this design does not invent a period.

## 5. XSS and security headers

Untrusted text reaches rendered HTML from four directions: citizen flag text shown in curator screens, curator-entered `source_url` values, machine-translated Kannada, and JSON-LD built from curator data.

- **Headers, set at nginx:** HSTS, `X-Content-Type-Options: nosniff`, `Content-Security-Policy` with `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **CSP with per-request nonces.** The design already commits to two inline scripts (the `?src` cookie writer and Google Analytics); both get nonces. No `unsafe-inline`.
- **Content rules:** flag text renders as text, always. `source_url` is validated to `http(s)` schemes at write time (kills `javascript:` links). JSON-LD is serialized with `<` escaped so curator data cannot close the script tag. MT output is stored and rendered as plain text through the same escaping as everything else.

## 6. Micro-cache invariant enforcement

"Public page HTML never varies by session" is load-bearing: one accidental personalization and nginx serves a logged-in user's page to everyone for 60 s. The invariant gets a mechanism, not a convention:

- **nginx strips the `Cookie` header** before proxying public-page routes. The app cannot personalize what it cannot see.
- **The cache key ignores the query string entirely** on public pages — this also kills cache-busting DoS (`?x=1,2,3…` would otherwise pour the spike onto the single Node process). The `?src` partner script reads `location.search` client-side, so attribution still works.
- **A route test asserts no `Set-Cookie`** and no session-dependent bytes on public GETs.
- **When the CDN arrives**, nginx accepts `X-Forwarded-For` only from the CDN's published ranges (`real_ip`), or per-IP rate limiting becomes spoofable.

## 7. Sessions

Sliding **1-hour idle timeout for all roles**; re-auth is the normal OTP flow. Decided against: separate lifetimes per role, session revocation on role change, and login notifications for privileged accounts — the uniform short timeout carries the weight instead. Cookie attributes are in §1.

## 8. Audit log: accepted limitation

The audit log stays an app-level append-only table. Anyone with database access can rewrite it; "immutable" (PRD §6) holds against application bugs and curator action, not against database compromise. The nightly encrypted backups are the only historical copies. This is a deliberate trade: hash chains and off-box audit streaming were considered and rejected as infrastructure the threat model doesn't yet justify.

## 9. Affidavit PDFs

Stored affidavits are public source links served from the VM's disk. At ingest, the file must match PDF magic bytes; nginx serves them with `Content-Type: application/pdf`, `Content-Disposition: inline; filename=…`, and `nosniff`. This keeps the affidavit store from becoming a hosting vector for other content types.

## 10. Secrets

One `.env` file outside the repository, mode 600, referenced by Compose. It holds the vendor keys (Anthropic, Google, Twilio, SendGrid), the session-signing key, and the restic repository key reference. Rotation is a documented ops runbook step, not automation. Custody is dependency register §6.10.

## 11. Prompt injection: accepted, mitigated

Affidavit PDFs and curator text are adversarial inputs to the Anthropic calls, and Kannada MT publishes unreviewed (locked decision, PRD §8). Mitigations already in the design carry this: translation returns text into fields that render escaped (§5), extraction returns a fixed field schema, AI-extracted values carry visible provenance markers, and citizen flags are the correction path. No further machinery.

## 12. Spec/doc changes made with this design

- `2026-07-17-production-architecture-design.md`: new §13 Security summarizing these decisions (the spec-changes section becomes §14); §5 cache bullets updated (cookie stripping, query-string-free cache key, CDN `real_ip`); §7 updated (cookie attributes, CSRF middleware, OTP caps and cooldowns, geocode cache and budget, 1-hour idle sessions); §10 backups now "restic (encrypted)"; §12 gains the no-`Set-Cookie` route test.
- `docs/prd.md` §10: sessions line now states the 1-hour idle timeout; §12 security NFR expanded (CSRF, security headers/CSP, OTP throttles, encrypted backups, session timeout).
- `docs/project-dependencies.md`: §6.4 records the derived-ward cache stance (no Google content stored); §6.9 backup line now says encrypted (restic).
