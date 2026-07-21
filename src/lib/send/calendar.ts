/**
 * The campaign calendar runner (Task 54; docs/prd.md §9.3, §9.2; IA's send
 * calendar). Fires the seven scheduled campaign sends (W1 excepted — that
 * one fires from the registration flow, src/lib/auth-flow.ts, not here)
 * over the election timeline, gated per ward by data readiness.
 *
 * THREE LAYERS, kept deliberately separate so the scheduling/guardrail math
 * is unit-testable with no DB at all:
 *
 *   1. PURE SCHEDULING (`scheduleFor`, `dueSends`, `guardrailViolations`) —
 *      given the anchor date strings read from `app_settings`, compute each
 *      code's fire date and whether it's due `now`. A missing/unparseable
 *      anchor simply omits the codes that depend on it (never an error —
 *      an admin who hasn't set `scrutiny_complete_date` yet just means L1
 *      isn't scheduled yet, not that the job should crash).
 *
 *   2. THE 48H GUARDRAIL (PRD §9.2) — the election-silence rule: nothing
 *      may go out within 48h of poll close (electorally, "poll close" is
 *      taken as the parsed `election_date` itself — this runner doesn't
 *      know the exact end-of-polling clock time, only the date). With the
 *      calendar's own fixed offsets (C1..F1 are all >=3 days before
 *      election day) this can never trip from a correctly-configured
 *      calendar; it exists to catch an admin MISCONFIGURING `roll_deadline`
 *      or `scrutiny_complete_date` close enough to election day that R1/L1
 *      would land inside the freeze window. A tripped guardrail refuses the
 *      send and alarms (`logEvent('campaign_guardrail_tripped', ...)`)
 *      rather than silently sending or silently dropping.
 *
 *   3. `runCampaign` — the DB-touching orchestrator: resolves the audience
 *      AT SEND TIME (PRD §9: not a snapshot taken when the anchor was set),
 *      gates L1/C2/C3 per ward on `isWardReadyForComms` (R1/C1/F1 are
 *      ungated — they carry no candidate-specific content), builds each
 *      code's template vars per user (language + home ward determine
 *      them), and calls `sendToUser` once per eligible user. A ward that
 *      isn't ready for a gated code is HELD — `recordWardHeld` writes a
 *      `'held'` campaign_sends row per eligible (user, channel) as an audit
 *      trail of what this run held back, WITHOUT sending. `send.ts`'s
 *      `existingSend` already treats `'held'` as "not yet sent", so once
 *      the ward clears, the NEXT run's `sendToUser` call actually sends —
 *      and `recordSend`'s held->terminal UPGRADE (this task's fix to
 *      send.ts) ensures that real send is recorded exactly once, not
 *      resent on every subsequent run.
 *
 * F1's CONTENT GAP (booth name/address + poll open/close time, docs/
 * messages.md §10): this platform has no per-citizen booth resolution (a
 * citizen's home ward is known; their exact polling booth is not — `booths`
 * is a ward-keyed list, often many rows per ward, and PRD §15/§17 tracks
 * "booth-level data" as a still-unresolved external dependency) and no
 * poll-hours fact anywhere in the schema (poll hours are a single citywide
 * constant, not stored). Rather than invent either (a false "your booth is
 * X" for a ward with several real booths would be actively misleading, and
 * a guessed opening time would be an invented election fact), F1's var
 * builder DEFERS: it only fills `booth` when the ward has EXACTLY ONE
 * `booths` row (the one case a single, correct answer exists) and only
 * fills `openTime`/`closeTime` when the new `poll_open_time`/
 * `poll_close_time` app_settings keys (added in this task, see
 * settings.ts) are set. Absent either, F1 is skipped for that
 * ward/this run entirely — same "missing anchor -> omitted" philosophy the
 * pure scheduler already uses, just applied at the content layer. See the
 * Task 54 report for the full writeup.
 */
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { booths, campaignSends, candidates, users, wards } from '../../db/schema';
import type { Lang } from '../../i18n';
import { localePath } from '../../i18n';
import { logEvent } from '../log';
import { isWardReadyForComms } from '../readiness';
import { getSettings } from '../settings';
import type { Channel, SendCode } from './render';
import { sendToUser, type SendToUserUser } from './send';

const SITE_ORIGIN = process.env.SITE_ORIGIN ?? 'https://bangalore-votes.opencity.in';

function absoluteUrl(lang: Lang, path: string): string {
  return SITE_ORIGIN + localePath(lang, path);
}

// ---------------------------------------------------------------------------
// 1. Pure scheduling
// ---------------------------------------------------------------------------

/** The subset of app_settings this module reads, as raw strings (or null/undefined when unset) — exactly what `getSettings` returns for these keys. */
export interface CalendarSettings {
  roll_deadline?: string | null;
  scrutiny_complete_date?: string | null;
  election_date?: string | null;
}

export interface ScheduledSend {
  code: SendCode;
  fireAt: Date;
}

/** L1/C2/C3 carry candidate-specific content and are gated on `isWardReadyForComms`; R1/C1/F1 carry no candidate content and are ungated. */
const GATED_CODES: ReadonlySet<SendCode> = new Set(['L1', 'C2', 'C3']);

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const GUARDRAIL_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * Parses an app_settings anchor value into a Date, deterministically. Plain
 * `YYYY-MM-DD` values (the format every anchor is stored as today) are
 * anchored to UTC midnight so `daysBefore`/comparisons are exact-day
 * arithmetic, not shifted by the server's local timezone; a value that
 * already carries a time component (`T...`) is parsed as-is. Returns
 * `undefined` for a missing or unparseable value — the caller's job to
 * treat that as "omit", never to throw.
 */
function parseAnchor(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const iso = value.includes('T') ? value : `${value}T00:00:00.000Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getTime() - days * MS_PER_DAY);
}

/**
 * Computes every scheduled send's fire date from the anchors present in
 * `settings`. A code whose anchor is missing/unparseable is simply absent
 * from the result (not an error) — R1 depends on `roll_deadline`, L1 on
 * `scrutiny_complete_date`, C1-F1 on `election_date`.
 */
export function scheduleFor(settings: CalendarSettings): ScheduledSend[] {
  const rollDeadline = parseAnchor(settings.roll_deadline);
  const scrutinyComplete = parseAnchor(settings.scrutiny_complete_date);
  const electionDate = parseAnchor(settings.election_date);

  const result: ScheduledSend[] = [];
  if (rollDeadline) result.push({ code: 'R1', fireAt: daysBefore(rollDeadline, 7) });
  if (scrutinyComplete) result.push({ code: 'L1', fireAt: scrutinyComplete });
  if (electionDate) {
    result.push({ code: 'C1', fireAt: daysBefore(electionDate, 21) });
    result.push({ code: 'C2', fireAt: daysBefore(electionDate, 14) });
    result.push({ code: 'C3', fireAt: daysBefore(electionDate, 7) });
    result.push({ code: 'F1', fireAt: daysBefore(electionDate, 3) });
  }
  return result;
}

/** Codes whose fire date has arrived (fireAt <= now) — before that instant, not due; on/after, due. */
export function dueSends(now: Date, settings: CalendarSettings): SendCode[] {
  const nowMs = now.getTime();
  return scheduleFor(settings)
    .filter((s) => s.fireAt.getTime() <= nowMs)
    .map((s) => s.code);
}

/**
 * The 48h election-silence guardrail (PRD §9.2): poll close is taken as the
 * parsed `election_date`. Any scheduled send (due or not) whose fireAt
 * falls strictly after `pollClose - 48h` — i.e. inside the 48h freeze
 * window, or after poll close itself — is a violation. Returns `[]` when
 * `election_date` isn't set (no reference to check against).
 */
export function guardrailViolations(settings: CalendarSettings): SendCode[] {
  const pollClose = parseAnchor(settings.election_date);
  if (!pollClose) return [];
  const windowStart = pollClose.getTime() - GUARDRAIL_WINDOW_MS;
  return scheduleFor(settings)
    .filter((s) => s.fireAt.getTime() > windowStart)
    .map((s) => s.code);
}

// ---------------------------------------------------------------------------
// 2. Held rows (the ward-readiness hold's audit trail)
// ---------------------------------------------------------------------------

/**
 * Writes a `'held'` campaign_sends row for every (user, channel) in
 * `wardUsers` that WOULD be eligible for `code` — same eligibility rule
 * `sendToUser` uses (email if `email && emailEnabled`, whatsapp if
 * `phone && whatsappEnabled`) — so the row set matches exactly what a
 * later real send would touch.
 *
 * `onConflictDoNothing`: a held write must never disturb an existing row —
 * in particular it must never downgrade an already-'sent' row back to
 * 'held' (e.g. a re-run after the ward already cleared and sent earlier in
 * the same job invocation). Only an absent row gets the 'held' insert.
 */
async function recordWardHeld(code: SendCode, wardUsers: SendToUserUser[], wardId: number): Promise<void> {
  const rows: {
    code: SendCode;
    userId: number;
    wardId: number;
    channel: Channel;
    language: Lang;
    status: 'held';
  }[] = [];

  for (const user of wardUsers) {
    if (user.email && user.emailEnabled) {
      rows.push({ code, userId: user.id, wardId, channel: 'email', language: user.language, status: 'held' });
    }
    if (user.phone && user.whatsappEnabled) {
      rows.push({ code, userId: user.id, wardId, channel: 'whatsapp', language: user.language, status: 'held' });
    }
  }
  if (rows.length === 0) return;

  await db
    .insert(campaignSends)
    .values(rows)
    .onConflictDoNothing({ target: [campaignSends.code, campaignSends.userId, campaignSends.channel] });

  logEvent('campaign_ward_held', { code, wardId, userCount: wardUsers.length });
}

// ---------------------------------------------------------------------------
// 3. Per-user template vars
// ---------------------------------------------------------------------------

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
// Standard Gregorian-calendar Kannada month names (as used in official
// Kannada-language government communication) — not machine-translated.
const KN_MONTHS = [
  'ಜನವರಿ', 'ಫೆಬ್ರವರಿ', 'ಮಾರ್ಚ್', 'ಏಪ್ರಿಲ್', 'ಮೇ', 'ಜೂನ್',
  'ಜುಲೈ', 'ಆಗಸ್ಟ್', 'ಸೆಪ್ಟೆಂಬರ್', 'ಅಕ್ಟೋಬರ್', 'ನವೆಂಬರ್', 'ಡಿಸೆಂಬರ್',
];

/**
 * Deterministic `D Month YYYY` formatting (e.g. "8 August 2026" /
 * "8 ಆಗಸ್ಟ್ 2026") from a fixed month-name table — deliberately NOT
 * `toLocaleDateString`/`Intl.DateTimeFormat`, whose output can vary by the
 * runtime's ICU data, which would make template rendering (and its tests)
 * environment-dependent.
 */
function formatDate(date: Date, lang: Lang): string {
  const months = lang === 'kn' ? KN_MONTHS : EN_MONTHS;
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function wardDisplayName(ward: { nameEn: string; nameKn: string }, lang: Lang): string {
  return lang === 'kn' ? ward.nameKn : ward.nameEn;
}

/** Active (filed/contesting) candidate statuses — the same set L1's "candidates filed so far" count is scoped to (PRD §9.3/§5.2: withdrawn/rejected candidates never count). */
const ACTIVE_STATUSES = ['filed', 'contesting'] as const;

/** Per-run memoized DB lookups shared across every user's vars build, so a ward/candidate-count/booth query happens once per ward per run, not once per user. */
interface BuildContext {
  rollDeadline?: Date;
  pollOpenTime: string | null;
  pollCloseTime: string | null;
  getWard(wardId: number): Promise<{ nameEn: string; nameKn: string } | undefined>;
  getCandidateCount(wardId: number): Promise<number>;
  /** Only returns a booth when the ward has EXACTLY ONE — see module docstring on why an ambiguous ward defers rather than guesses. */
  getUniqueBooth(wardId: number): Promise<{ nameEn: string; nameKn: string | null; address: string } | undefined>;
}

function createBuildContext(settings: CalendarSettings, pollOpenTime: string | null, pollCloseTime: string | null): BuildContext {
  const wardCache = new Map<number, Promise<{ nameEn: string; nameKn: string } | undefined>>();
  const countCache = new Map<number, Promise<number>>();
  const boothCache = new Map<number, Promise<{ nameEn: string; nameKn: string | null; address: string } | undefined>>();

  return {
    rollDeadline: parseAnchor(settings.roll_deadline),
    pollOpenTime,
    pollCloseTime,
    getWard(wardId) {
      if (!wardCache.has(wardId)) {
        wardCache.set(
          wardId,
          db
            .select({ nameEn: wards.nameEn, nameKn: wards.nameKn })
            .from(wards)
            .where(eq(wards.id, wardId))
            .then((rows) => rows[0]),
        );
      }
      return wardCache.get(wardId)!;
    },
    getCandidateCount(wardId) {
      if (!countCache.has(wardId)) {
        countCache.set(
          wardId,
          db
            .select({ id: candidates.id })
            .from(candidates)
            .where(and(eq(candidates.wardId, wardId), inArray(candidates.status, ACTIVE_STATUSES)))
            .then((rows) => rows.length),
        );
      }
      return countCache.get(wardId)!;
    },
    getUniqueBooth(wardId) {
      if (!boothCache.has(wardId)) {
        boothCache.set(
          wardId,
          db
            .select({ nameEn: booths.nameEn, nameKn: booths.nameKn, address: booths.address })
            .from(booths)
            .where(eq(booths.wardId, wardId))
            .then((rows) => (rows.length === 1 ? rows[0] : undefined)),
        );
      }
      return boothCache.get(wardId)!;
    },
  };
}

/**
 * Builds `code`'s template vars for `user` (the union of its email/whatsapp
 * `vars`, per templates.ts) from real, sourced data — never invented.
 * Returns `undefined` when the data a code needs genuinely isn't available
 * yet (today, only possible for F1 — see module docstring); the caller
 * skips that user/code rather than sending with placeholder content or
 * letting `renderMessage` throw `missing_var` at send time.
 */
async function buildVars(code: SendCode, user: SendToUserUser, ctx: BuildContext): Promise<Record<string, string> | undefined> {
  const wardId = user.homeWardId;
  if (wardId == null) return undefined;

  const notificationsLink = absoluteUrl(user.language, '/account/notifications');
  // Same URL for both — /account/notifications is the one control surface
  // for both managing and fully unsubscribing (per Task 54 brief).
  const unsubscribeLink = notificationsLink;

  switch (code) {
    case 'R1': {
      if (!ctx.rollDeadline) return undefined;
      return {
        deadline: formatDate(ctx.rollDeadline, user.language),
        checkRegistrationLink: absoluteUrl(user.language, '/check-registration'),
        guideLink: absoluteUrl(user.language, '/voting-guide/voter-id'),
      };
    }
    case 'L1': {
      const ward = await ctx.getWard(wardId);
      if (!ward) return undefined;
      const count = await ctx.getCandidateCount(wardId);
      return {
        ward: wardDisplayName(ward, user.language),
        candidateCount: String(count),
        candidatesLink: absoluteUrl(user.language, `/ward/${wardId}/candidates`),
        notificationsLink,
        unsubscribeLink,
      };
    }
    case 'C1': {
      const ward = await ctx.getWard(wardId);
      if (!ward) return undefined;
      return {
        ward: wardDisplayName(ward, user.language),
        issuesLink: absoluteUrl(user.language, `/ward/${wardId}/issues`),
        notificationsLink,
        unsubscribeLink,
      };
    }
    case 'C2': {
      const ward = await ctx.getWard(wardId);
      if (!ward) return undefined;
      // reportCardsLink (email) and candidatesLink (whatsapp) are the same
      // page — the ward's candidate list, each entry linking to its own
      // report card (docs/messages.md §7's WhatsApp variables line).
      const candidatesLink = absoluteUrl(user.language, `/ward/${wardId}/candidates`);
      return {
        ward: wardDisplayName(ward, user.language),
        candidatesLink,
        reportCardsLink: candidatesLink,
        compareLink: absoluteUrl(user.language, `/ward/${wardId}/compare`),
        notificationsLink,
        unsubscribeLink,
      };
    }
    case 'C3': {
      const ward = await ctx.getWard(wardId);
      if (!ward) return undefined;
      return {
        ward: wardDisplayName(ward, user.language),
        compareLink: absoluteUrl(user.language, `/ward/${wardId}/compare`),
        issuesLink: absoluteUrl(user.language, `/ward/${wardId}/issues`),
        boothLink: absoluteUrl(user.language, '/voting-guide/find-booth'),
        notificationsLink,
        unsubscribeLink,
      };
    }
    case 'F1': {
      if (!ctx.pollOpenTime || !ctx.pollCloseTime) return undefined; // no citywide poll-hours fact set yet — defer, don't invent
      const booth = await ctx.getUniqueBooth(wardId);
      if (!booth) return undefined; // no single resolvable booth for this ward yet — defer, don't guess
      const boothName = user.language === 'kn' ? (booth.nameKn ?? booth.nameEn) : booth.nameEn;
      return {
        booth: `${boothName}, ${booth.address}`,
        openTime: ctx.pollOpenTime,
        closeTime: ctx.pollCloseTime,
        boothGuideLink: absoluteUrl(user.language, '/voting-guide/find-booth'),
      };
    }
    default:
      return undefined; // W1 never reaches this module
  }
}

// ---------------------------------------------------------------------------
// 4. runCampaign
// ---------------------------------------------------------------------------

export interface CodeRunSummary {
  sent: number;
  held: number;
  /** Users skipped because `buildVars` deferred (today: only possible for F1's content gap) — distinct from `held`, which is a ward-readiness gate. */
  deferred: number;
}

export interface CampaignRunSummary {
  due: SendCode[];
  guardrailTripped: SendCode[];
  perCode: Partial<Record<SendCode, CodeRunSummary>>;
}

/**
 * Runs one campaign pass at instant `now`: reads the election anchors,
 * computes which codes are due, refuses+alarms any guardrail violation,
 * resolves the registered-citizen audience AT SEND TIME, gates L1/C2/C3 per
 * ward on `isWardReadyForComms`, and sends. Never logs PII — the summary
 * and every `logEvent` call carry only codes/counts/ids.
 */
export async function runCampaign(now: Date): Promise<CampaignRunSummary> {
  const settingsRows = await getSettings([
    'roll_deadline',
    'scrutiny_complete_date',
    'election_date',
    'poll_open_time',
    'poll_close_time',
  ]);
  const settings: CalendarSettings = {
    roll_deadline: settingsRows.roll_deadline,
    scrutiny_complete_date: settingsRows.scrutiny_complete_date,
    election_date: settingsRows.election_date,
  };

  const due = dueSends(now, settings);
  const violations = new Set(guardrailViolations(settings));
  const ctx = createBuildContext(settings, settingsRows.poll_open_time, settingsRows.poll_close_time);

  const summary: CampaignRunSummary = { due, guardrailTripped: [], perCode: {} };

  for (const code of due) {
    if (violations.has(code)) {
      logEvent('campaign_guardrail_tripped', { code });
      summary.guardrailTripped.push(code);
      continue;
    }

    // Audience resolved fresh on every code, at send time (PRD §9) — a
    // user who registered between runs (or between two codes in the same
    // run) is included.
    const audienceRows = await db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        language: users.language,
        emailEnabled: users.emailEnabled,
        whatsappEnabled: users.whatsappEnabled,
        homeWardId: users.homeWardId,
      })
      .from(users)
      .where(and(eq(users.status, 'active'), isNotNull(users.homeWardId)));
    const audience: SendToUserUser[] = audienceRows;

    if (GATED_CODES.has(code)) {
      const byWard = new Map<number, SendToUserUser[]>();
      for (const user of audience) {
        const wardId = user.homeWardId!;
        if (!byWard.has(wardId)) byWard.set(wardId, []);
        byWard.get(wardId)!.push(user);
      }

      let sent = 0;
      let held = 0;
      let deferred = 0;
      for (const [wardId, wardUsers] of byWard) {
        const ready = await isWardReadyForComms(wardId);
        if (!ready) {
          await recordWardHeld(code, wardUsers, wardId);
          held += wardUsers.length;
          continue;
        }
        for (const user of wardUsers) {
          const vars = await buildVars(code, user, ctx);
          if (!vars) {
            deferred++;
            continue;
          }
          await sendToUser(user, code, vars);
          sent++;
        }
      }
      summary.perCode[code] = { sent, held, deferred };
    } else {
      let sent = 0;
      let deferred = 0;
      for (const user of audience) {
        const vars = await buildVars(code, user, ctx);
        if (!vars) {
          deferred++;
          continue;
        }
        await sendToUser(user, code, vars);
        sent++;
      }
      summary.perCode[code] = { sent, held: 0, deferred };
    }
  }

  return summary;
}
