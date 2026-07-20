/**
 * Business logic behind the curator dashboard + review-queue pages (Task 34,
 * information-architecture.md §5.1/§5.2/§5.3; PRD §6.1/§7/§9.1). Mirrors the
 * split used by src/lib/account-flow.ts: this module owns state-loading and
 * the accept/reject mutation dispatch, the page route twins
 * (src/pages/curator/*) own the HTTP concerns a plain module cannot
 * (redirects, no-store, 403/404 status).
 *
 * SCOPE ENFORCEMENT (the security core of this task): every query here that
 * lists data is scoped to the caller's wards via `scopedWardIds` — a curator
 * with no matching `curator_scopes` row for a ward never sees that ward's
 * queue items, audit tail, or sign-off status. `null` from `scopedWardIds`
 * is the admin sentinel ("no ward filter — see every ward"), never confused
 * with an empty array ("this curator has zero assigned wards — see
 * nothing"). The single-item lookup (`loadQueueItem`) does NOT scope-check
 * on its own — the caller (src/pages/curator/queue/[id].astro) MUST call
 * `canEditWard` against the loaded item's `wardId` before showing or acting
 * on it; that per-item check is what makes an out-of-scope item 403 rather
 * than merely absent from the list.
 *
 * LANGUAGE: curator/admin routes have no `/kn/` twin (they're internal
 * tooling, not public bilingual content — see src/middleware.ts's noindex
 * list). UI strings still render bilingually, driven by the signed-in
 * user's OWN saved preference (`users.language`, the same column `/account`
 * writes) rather than the URL — there is no URL to derive it from. See
 * `loadCuratorLang` below.
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
  auditLog,
  candidateFields,
  candidates,
  curatorScopes,
  flagItems,
  flagSubmissions,
  users,
  wardReadiness,
  wards,
  type flagStatusEnum,
  type flagTargetEnum,
  type sourceTypeEnum,
  type langEnum,
} from '../db/schema';
import { resolveFlag } from './flags';
import type { Lang } from '../i18n';
import type { Role } from './session';

type FlagTargetType = (typeof flagTargetEnum.enumValues)[number];
type FlagStatus = (typeof flagStatusEnum.enumValues)[number];
type SourceType = (typeof sourceTypeEnum.enumValues)[number];
type AuthoredLang = (typeof langEnum.enumValues)[number];

/** Same shape `src/middleware.ts` puts on `locals.session` for an authed request. */
export type CuratorActor = { userId: number; role: 'curator' | 'admin' };

// ---------------------------------------------------------------------------
// Language (see module docstring)
// ---------------------------------------------------------------------------

/** The signed-in curator/admin's own saved UI language — defaults to 'en' for a user row that (defensively) no longer resolves. */
export async function loadCuratorLang(userId: number): Promise<Lang> {
  const [row] = await db.select({ language: users.language }).from(users).where(eq(users.id, userId));
  return row?.language ?? 'en';
}

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

/**
 * `null` = no ward filter (admin — every ward is in scope). An empty array
 * (curator with no `curator_scopes` rows) is a real, distinct value: it
 * means "in scope for nothing", not "unfiltered".
 */
export async function scopedWardIds(userId: number, role: Role): Promise<number[] | null> {
  if (role === 'admin') return null;
  const rows = await db.select({ wardId: curatorScopes.wardId }).from(curatorScopes).where(eq(curatorScopes.userId, userId));
  return rows.map((r) => r.wardId);
}

// ---------------------------------------------------------------------------
// Target ref parsing / labeling
// ---------------------------------------------------------------------------

/** Parses a `candidate_field` targetRef of the shape `candidate:<id>:<fieldKey>` (see src/lib/flags.ts's module docstring for the targetRef convention). `null` for anything else. */
export function parseCandidateFieldTargetRef(targetRef: string): { candidateId: number; fieldKey: string } | null {
  const match = /^candidate:(\d+):(.+)$/.exec(targetRef);
  if (!match) return null;
  return { candidateId: Number(match[1]), fieldKey: match[2]! };
}

/** A short, human-readable label for a queue item's target — used in the queue list and item view. Deliberately lightweight (no extra query): the item view additionally resolves the candidate's real name for candidate_field targets (see `loadQueueItem`). */
export function humanTargetLabel(targetType: FlagTargetType, targetRef: string): string {
  const parts = targetRef.split(':');
  if (targetType === 'candidate_field' && parts.length === 3) {
    return `Candidate #${parts[1]} — ${parts[2]}`;
  }
  if (targetType === 'ward_field' && parts.length === 3) {
    return `Ward #${parts[1]} — ${parts[2]}`;
  }
  if (targetType === 'ward_issue') {
    return `Ward issue — ${targetRef}`;
  }
  return targetRef;
}

// ---------------------------------------------------------------------------
// Dashboard (IA §5.1)
// ---------------------------------------------------------------------------

export interface DashboardAuditRow {
  id: number;
  action: string;
  entityType: string;
  entityId: string;
  wardId: number | null;
  createdAt: Date;
}

export interface AwaitingSignOffWard {
  wardId: number;
  nameEn: string;
  nameKn: string;
  /** true = this ward WAS signed off, but a later candidate-set change cleared it (IA §5.1: called out first — a curator who doesn't know a ward is held won't sign it off). */
  clearedByChange: boolean;
}

export interface DashboardData {
  queueCount: number;
  recentActivity: DashboardAuditRow[];
  awaitingSignOff: AwaitingSignOffWard[];
}

export async function loadDashboard(userId: number, role: Role): Promise<DashboardData> {
  const wardIds = await scopedWardIds(userId, role);
  if (wardIds !== null && wardIds.length === 0) {
    return { queueCount: 0, recentActivity: [], awaitingSignOff: [] };
  }

  const flagWardFilter = wardIds ? inArray(flagItems.wardId, wardIds) : undefined;
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(flagItems)
    .where(flagWardFilter ? and(eq(flagItems.status, 'pending'), flagWardFilter) : eq(flagItems.status, 'pending'));

  const auditWardFilter = wardIds ? inArray(auditLog.wardId, wardIds) : undefined;
  const recentActivity = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      wardId: auditLog.wardId,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(auditWardFilter)
    .orderBy(desc(auditLog.createdAt))
    .limit(10);

  const wardFilter = wardIds ? inArray(wards.id, wardIds) : undefined;
  const wardRows = await db
    .select({
      wardId: wards.id,
      nameEn: wards.nameEn,
      nameKn: wards.nameKn,
      signedOffAt: wardReadiness.signedOffAt,
      clearedAt: wardReadiness.clearedAt,
    })
    .from(wards)
    .leftJoin(wardReadiness, eq(wardReadiness.wardId, wards.id))
    .where(wardFilter);

  const awaitingSignOff: AwaitingSignOffWard[] = [];
  for (const row of wardRows) {
    const clearedByChange = row.clearedAt != null && row.signedOffAt != null && row.clearedAt > row.signedOffAt;
    const needsSignOff = row.signedOffAt == null || clearedByChange;
    if (needsSignOff) {
      awaitingSignOff.push({ wardId: row.wardId, nameEn: row.nameEn, nameKn: row.nameKn, clearedByChange });
    }
  }
  // Cleared-by-change wards FIRST (IA §5.1) — a stable sort keeps the
  // never-signed-off wards in their original (ward-id) order behind them.
  awaitingSignOff.sort((a, b) => Number(b.clearedByChange) - Number(a.clearedByChange));

  return { queueCount: Number(countRow?.count ?? 0), recentActivity, awaitingSignOff };
}

// ---------------------------------------------------------------------------
// Queue list (IA §5.2)
// ---------------------------------------------------------------------------

export type QueueSort = 'recent' | 'ward';

export interface QueueListItem {
  id: number;
  wardId: number;
  wardNameEn: string;
  wardNameKn: string;
  targetType: FlagTargetType;
  targetRef: string;
  targetLabel: string;
  submissionCount: number;
  createdAt: Date;
}

/**
 * PENDING flag_items in the caller's scoped wards ONLY (out-of-scope items
 * are simply never selected — this is the list-side half of the scope
 * test; src/pages/curator/queue/[id].astro's `canEditWard` check is the
 * other half, for direct navigation to an item's URL).
 */
export async function loadQueueList(userId: number, role: Role, sort: QueueSort = 'recent'): Promise<QueueListItem[]> {
  const wardIds = await scopedWardIds(userId, role);
  if (wardIds !== null && wardIds.length === 0) return [];

  const wardFilter = wardIds ? inArray(flagItems.wardId, wardIds) : undefined;
  const whereClause = wardFilter ? and(eq(flagItems.status, 'pending'), wardFilter) : eq(flagItems.status, 'pending');

  const rows = await db
    .select({
      id: flagItems.id,
      wardId: flagItems.wardId,
      wardNameEn: wards.nameEn,
      wardNameKn: wards.nameKn,
      targetType: flagItems.targetType,
      targetRef: flagItems.targetRef,
      createdAt: flagItems.createdAt,
      submissionCount: sql<number>`count(${flagSubmissions.id})::int`,
    })
    .from(flagItems)
    .innerJoin(wards, eq(wards.id, flagItems.wardId))
    .leftJoin(flagSubmissions, eq(flagSubmissions.flagItemId, flagItems.id))
    .where(whereClause)
    .groupBy(flagItems.id, wards.id)
    .orderBy(sort === 'ward' ? wards.nameEn : desc(flagItems.createdAt));

  return rows.map((row) => ({
    ...row,
    submissionCount: Number(row.submissionCount),
    targetLabel: humanTargetLabel(row.targetType, row.targetRef),
  }));
}

// ---------------------------------------------------------------------------
// Queue item (IA §5.3)
// ---------------------------------------------------------------------------

export interface FlagSubmissionRow {
  id: number;
  userId: number;
  detail: string;
  suggestedValue: string | null;
  sourceUrl: string | null;
  createdAt: Date;
}

export interface CandidateFieldContext {
  candidateId: number;
  candidateNameEn: string;
  fieldKey: string;
  valueEn: string | null;
  valueKn: string | null;
  notDeclared: boolean;
  sourceUrl: string | null;
  sourceType: SourceType;
  authoredLang: AuthoredLang;
}

export interface QueueItemDetail {
  id: number;
  wardId: number;
  wardNameEn: string;
  wardNameKn: string;
  targetType: FlagTargetType;
  targetRef: string;
  targetLabel: string;
  status: FlagStatus;
  resolutionReason: string | null;
  createdAt: Date;
  submissions: FlagSubmissionRow[];
  /** Only populated for a candidate_field target whose targetRef parses — the accept path (Task 34) only supports this target type; ward_field/ward_issue publish lands in Task 39. */
  candidateField: CandidateFieldContext | null;
}

/** `null` when no such flag_items row exists (the route twin turns that into a 404). Does NOT check scope — see module docstring. */
export async function loadQueueItem(id: number): Promise<QueueItemDetail | null> {
  const [item] = await db
    .select({
      id: flagItems.id,
      wardId: flagItems.wardId,
      wardNameEn: wards.nameEn,
      wardNameKn: wards.nameKn,
      targetType: flagItems.targetType,
      targetRef: flagItems.targetRef,
      status: flagItems.status,
      resolutionReason: flagItems.resolutionReason,
      createdAt: flagItems.createdAt,
    })
    .from(flagItems)
    .innerJoin(wards, eq(wards.id, flagItems.wardId))
    .where(eq(flagItems.id, id));
  if (!item) return null;

  const submissions = await db
    .select({
      id: flagSubmissions.id,
      userId: flagSubmissions.userId,
      detail: flagSubmissions.detail,
      suggestedValue: flagSubmissions.suggestedValue,
      sourceUrl: flagSubmissions.sourceUrl,
      createdAt: flagSubmissions.createdAt,
    })
    .from(flagSubmissions)
    .where(eq(flagSubmissions.flagItemId, id))
    .orderBy(flagSubmissions.createdAt);

  let candidateField: CandidateFieldContext | null = null;
  if (item.targetType === 'candidate_field') {
    const parsed = parseCandidateFieldTargetRef(item.targetRef);
    if (parsed) {
      const [candidate] = await db
        .select({ id: candidates.id, nameEn: candidates.nameEn })
        .from(candidates)
        .where(eq(candidates.id, parsed.candidateId));
      const [field] = await db
        .select()
        .from(candidateFields)
        .where(and(eq(candidateFields.candidateId, parsed.candidateId), eq(candidateFields.fieldKey, parsed.fieldKey)));

      candidateField = {
        candidateId: parsed.candidateId,
        candidateNameEn: candidate?.nameEn ?? `Candidate #${parsed.candidateId}`,
        fieldKey: parsed.fieldKey,
        valueEn: field?.valueEn ?? null,
        valueKn: field?.valueKn ?? null,
        notDeclared: field?.notDeclared ?? false,
        sourceUrl: field?.sourceUrl ?? null,
        sourceType: field?.sourceType ?? 'curator',
        authoredLang: field?.authoredLang ?? 'en',
      };
    }
  }

  return {
    ...item,
    targetLabel: humanTargetLabel(item.targetType, item.targetRef),
    submissions,
    candidateField,
  };
}

// ---------------------------------------------------------------------------
// Accept / reject (IA §5.3, PRD §6.1)
// ---------------------------------------------------------------------------

export type ResolveOutcome =
  | { kind: 'accepted' }
  | { kind: 'rejected' }
  | { kind: 'already_resolved' }
  | { kind: 'validation_error'; key: string };

/** True iff `value` parses as an absolute http: or https: URL — same rule as src/pages/api/flags.ts's `sourceUrl` validation, kept local so this module doesn't reach into an API route file. */
function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Handles the ACCEPT form (candidate_field targets only, for now — see
 * `QueueItemDetail.candidateField`'s docstring). Validates the required
 * source + at least one value (or explicit `notDeclared`), then calls
 * `resolveFlag`, which publishes the field and marks the item accepted
 * atomically. A `flag_already_resolved` throw (someone else resolved it
 * first, e.g. another curator covering the same ward) is caught here and
 * turned into a friendly outcome rather than propagating as a 500.
 */
export async function handleAccept(actor: CuratorActor, item: QueueItemDetail, form: FormData): Promise<ResolveOutcome> {
  if (item.targetType !== 'candidate_field' || !item.candidateField) {
    // ward_field/ward_issue accept-publish lands in Task 39 — see module
    // docstring. The UI disables this form for those target types, but a
    // direct POST is still rejected defensively rather than faking a publish.
    return { kind: 'validation_error', key: 'curator.queueItem.error.acceptUnsupported' };
  }

  const sourceUrl = String(form.get('sourceUrl') ?? '').trim();
  const sourceType: SourceType = String(form.get('sourceType') ?? '') === 'official' ? 'official' : 'curator';
  const authoredLang: AuthoredLang = String(form.get('authoredLang') ?? '') === 'kn' ? 'kn' : 'en';
  const notDeclared = form.get('notDeclared') != null;
  const valueEnRaw = String(form.get('valueEn') ?? '').trim();
  const valueKnRaw = String(form.get('valueKn') ?? '').trim();
  const confirmed = form.get('confirmPublish') != null;

  // Server-side belt-and-suspenders for the "publishes immediately to
  // /ward/{id}" confirmation checkbox (design-system.md §7.13) — the HTML
  // `required` attribute only stops a REAL browser submission; a direct POST
  // (or a future non-browser client) must not be able to skip it.
  if (!confirmed) {
    return { kind: 'validation_error', key: 'curator.queueItem.error.confirmRequired' };
  }
  if (!sourceUrl || !isHttpUrl(sourceUrl)) {
    return { kind: 'validation_error', key: 'curator.queueItem.error.sourceRequired' };
  }
  if (!notDeclared && !valueEnRaw && !valueKnRaw) {
    return { kind: 'validation_error', key: 'curator.queueItem.error.valueRequired' };
  }

  try {
    await resolveFlag(actor, item.id, {
      accept: true,
      publish: {
        candidateId: item.candidateField.candidateId,
        fieldKey: item.candidateField.fieldKey,
        valueEn: valueEnRaw || null,
        valueKn: valueKnRaw || null,
        notDeclared,
        sourceUrl,
        sourceType,
        authoredLang,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'flag_already_resolved') {
      return { kind: 'already_resolved' };
    }
    throw err;
  }

  return { kind: 'accepted' };
}

/** Handles the REJECT form — a reason is required (PRD §6.1 step 3); same `flag_already_resolved` handling as `handleAccept`. */
export async function handleReject(actor: CuratorActor, itemId: number, form: FormData): Promise<ResolveOutcome> {
  const reason = String(form.get('reason') ?? '').trim();
  if (!reason) {
    return { kind: 'validation_error', key: 'curator.queueItem.error.reasonRequired' };
  }

  try {
    await resolveFlag(actor, itemId, { accept: false, reason });
  } catch (err) {
    if (err instanceof Error && err.message === 'flag_already_resolved') {
      return { kind: 'already_resolved' };
    }
    throw err;
  }

  return { kind: 'rejected' };
}
