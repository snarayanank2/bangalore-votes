/**
 * Cast issue vote modal — the client-side half of Task 33 (IA §3.6/§7, PRD
 * §5.5). Built on `ModalController` (src/islands/ModalShell.ts) over the
 * `<dialog>` markup `src/components/VoteModal.astro` renders once per page
 * (from Base.astro), and wired onto WardIssues.astro's "Vote your top 3"
 * `[data-vote-action]` button (its `data-ward-id` and `data-vote-issues` —
 * a JSON-encoded `{id, title}[]` of the ward's CURRENT issues — carry
 * everything `openVoteModal` needs), mirroring how `initFlagModal` wires
 * `[data-flag-action]`.
 *
 * GLOBAL OPENER + WIRING: `openVoteModal` is exported AND attached to
 * `window.bvOpenVoteModal`.
 *
 * AUTH GATING + RESUME (core concept 2; same shape as FlagModal):
 *   - ON OPEN: checks `/api/me` before showing anything. Anonymous ->
 *     `window.bvOpenRegisterLogin` opens FIRST, `onSuccess: () =>
 *     openVoteModal(opts, opener)` re-runs this, now authed.
 *   - HOME-WARD CHECK (PRD §5.5 — voting is home-ward-only): once authed,
 *     compares the visitor's `homeWardId` to `opts.wardId`. A mismatch
 *     shows the home-ward-only message (`[data-vote-home-ward-wrap]`,
 *     naming their actual home ward, with a link to `/account` to change
 *     it) INSTEAD of the checkbox form — there is no point letting them
 *     submit a request that can only ever come back 403.
 *   - PRE-CHECK: on a match, `GET /api/issue-votes?wardId=` loads the
 *     visitor's current active selections for THIS ward (empty if they've
 *     never voted here, or their active set is a different ward) so a
 *     returning voter sees their existing picks already ticked.
 *   - ON SUBMIT 401 (an idle-timed-out session mid-flow): the already-open
 *     vote dialog is deliberately left open (not closed) while
 *     `window.bvOpenRegisterLogin` opens on top of it — native `<dialog>`
 *     supports stacking. `onSuccess` re-PUTs the SAME captured
 *     `{wardId, issueIds}` (the checkboxes were never touched), a seamless
 *     resume with no retyping/re-checking needed.
 *   - ON SUBMIT 403 (`wrong_ward` — the visitor's home ward changed, e.g.
 *     in another tab, between open and submit): re-checks `/api/me` and
 *     swaps to the home-ward-only message, same as the open-time check.
 *
 * CHECKBOX CAP (design-system.md §7.9): the checklist is built entirely
 * client-side (`renderIssueOptions`) from `opts.issues`, capped at three —
 * once three are checked, every OTHER checkbox is `disabled` (a 4th tap is
 * simply impossible, not merely rejected after the fact). The submit
 * button's label counts down ("Vote (2 of 3 selected)") and is disabled at
 * zero selected.
 *
 * ON SUCCESS: splices the PUT response's fresh `results` into the page's
 * `<IssueBars>` (`[data-issue-bars]`, if present — WardIssues.astro's
 * public results section) via `updateIssueBars`, shows a success toast, and
 * closes. The URL never changes at any point in this flow.
 */
import { ModalController, type ModalDialogLike, type FocusTarget } from './ModalShell';

export interface VoteIssue {
  id: number;
  title: string;
}

export interface OpenVoteModalOptions {
  wardId: number;
  issues: VoteIssue[];
}

interface VoteFormState {
  wardId: number;
  issueIds: number[];
}

interface IssueResultLike {
  issueId: number;
  titleEn: string | null;
  titleKn: string | null;
  rank: number;
  sharePct: number;
}

type MeResponse =
  | { anonymous: true }
  | { anonymous: false; homeWardId: number | null; [key: string]: unknown };

type SelectionsResponse = { issueIds: number[] };

interface Elements {
  dialog: HTMLDialogElement;
  controller: ModalController;
  formWrap: HTMLElement;
  form: HTMLFormElement;
  optionsContainer: HTMLElement;
  rateLimitError: HTMLElement;
  genericError: HTMLElement;
  submitButton: HTMLButtonElement;
  homeWardWrap: HTMLElement;
  homeWardMessage: HTMLElement;
  msgRateLimit: string;
  msgGenericError: string;
  msgSuccess: string;
  msgSubmitTemplate: string;
  msgHomeWardTemplate: string;
}

const MAX_SELECTIONS = 3;

let els: Elements | null = null;
let currentWardId = 0;
let currentIssues: VoteIssue[] = [];

function text(root: ParentNode, selector: string): string {
  return root.querySelector(selector)?.textContent ?? '';
}

function findElements(root: ParentNode): Elements | null {
  const dialog = root.querySelector<HTMLDialogElement>('[data-vote-modal]');
  const formWrap = dialog?.querySelector<HTMLElement>('[data-vote-form-wrap]');
  const form = dialog?.querySelector<HTMLFormElement>('[data-vote-form]');
  const optionsContainer = dialog?.querySelector<HTMLElement>('[data-vote-issue-options]');
  const rateLimitError = dialog?.querySelector<HTMLElement>('[data-vote-rate-limit-error]');
  const genericError = dialog?.querySelector<HTMLElement>('[data-vote-generic-error]');
  const submitButton = form?.querySelector<HTMLButtonElement>('[data-vote-submit]');
  const homeWardWrap = dialog?.querySelector<HTMLElement>('[data-vote-home-ward-wrap]');
  const homeWardMessage = dialog?.querySelector<HTMLElement>('[data-vote-home-ward-message]');

  if (
    !dialog ||
    !formWrap ||
    !form ||
    !optionsContainer ||
    !rateLimitError ||
    !genericError ||
    !submitButton ||
    !homeWardWrap ||
    !homeWardMessage
  ) {
    return null;
  }

  return {
    dialog,
    controller: new ModalController(dialog as unknown as ModalDialogLike),
    formWrap,
    form,
    optionsContainer,
    rateLimitError,
    genericError,
    submitButton,
    homeWardWrap,
    homeWardMessage,
    msgRateLimit: text(dialog, '[data-msg-rate-limit]'),
    msgGenericError: text(dialog, '[data-msg-generic-error]'),
    msgSuccess: text(dialog, '[data-msg-success]'),
    msgSubmitTemplate: text(dialog, '[data-msg-submit-template]'),
    msgHomeWardTemplate: text(dialog, '[data-msg-home-ward-template]'),
  };
}

async function fetchMe(): Promise<MeResponse | null> {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) return null;
    return (await res.json()) as MeResponse;
  } catch {
    return null;
  }
}

async function fetchCurrentSelections(wardId: number): Promise<SelectionsResponse | null> {
  try {
    const res = await fetch(`/api/issue-votes?wardId=${wardId}`);
    if (!res.ok) return null;
    return (await res.json()) as SelectionsResponse;
  } catch {
    return null;
  }
}

async function putVote(state: VoteFormState): Promise<Response> {
  return fetch('/api/issue-votes', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(state),
  });
}

function clearErrors(): void {
  if (!els) return;
  els.rateLimitError.hidden = true;
  els.rateLimitError.textContent = '';
  els.genericError.hidden = true;
  els.genericError.textContent = '';
}

function showRateLimitError(): void {
  if (!els) return;
  els.rateLimitError.hidden = false;
  els.rateLimitError.textContent = els.msgRateLimit;
}

function showGenericError(): void {
  if (!els) return;
  els.genericError.hidden = false;
  els.genericError.textContent = els.msgGenericError;
}

function showSuccessToast(message: string): void {
  if (typeof document === 'undefined') return;
  const toast = document.createElement('div');
  toast.className = 'vote-success-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('data-vote-success-toast', '');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

/** Every checkbox currently rendered in the issue-options list. */
function getCheckboxes(): HTMLInputElement[] {
  if (!els) return [];
  return Array.from(els.optionsContainer.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
}

function getCheckedIds(): number[] {
  return getCheckboxes()
    .filter((cb) => cb.checked)
    .map((cb) => Number(cb.value));
}

/** Renders the checklist for `currentIssues`, pre-checking `checkedIds`. */
function renderIssueOptions(checkedIds: Set<number>): void {
  if (!els) return;
  els.optionsContainer.innerHTML = '';

  for (const issue of currentIssues) {
    const label = document.createElement('label');
    label.className = 'vote-issue-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'issueIds';
    checkbox.value = String(issue.id);
    checkbox.checked = checkedIds.has(issue.id);
    label.append(checkbox, document.createTextNode(issue.title));
    els.optionsContainer.append(label);
  }
}

/** Caps the list at three checked (disables every OTHER checkbox once at the cap), and updates the submit button's countdown label + disabled state (design-system.md §7.9). */
function refreshSelectionState(): void {
  if (!els) return;
  const checkboxes = getCheckboxes();
  const checkedCount = checkboxes.filter((cb) => cb.checked).length;

  for (const cb of checkboxes) {
    cb.disabled = !cb.checked && checkedCount >= MAX_SELECTIONS;
  }

  els.submitButton.textContent = els.msgSubmitTemplate.replace('{n}', String(checkedCount));
  els.submitButton.disabled = checkedCount === 0;
}

function showHomeWardMessage(homeWardId: number | null): void {
  if (!els) return;
  els.formWrap.hidden = true;
  els.homeWardWrap.hidden = false;
  els.homeWardMessage.textContent = els.msgHomeWardTemplate.replace('{wardId}', String(homeWardId ?? ''));
}

function showVoteForm(checkedIds: number[]): void {
  if (!els) return;
  els.homeWardWrap.hidden = true;
  els.formWrap.hidden = false;
  renderIssueOptions(new Set(checkedIds));
  refreshSelectionState();
}

function pickTitle(lang: string, en: string | null, kn: string | null): string {
  return lang === 'kn' ? (kn ?? en ?? '') : (en ?? kn ?? '');
}

/**
 * Splices fresh ranked results into the page's `<IssueBars>`
 * (`[data-issue-bars]`, WardIssues.astro), if present, by cloning one of
 * its OWN server-rendered `<li class="issue-bar">` nodes as a template —
 * this preserves Astro's scoped-style attribute (a plain
 * `document.createElement` node would not carry it, and the bars would
 * render unstyled) — and updating each clone's rank/title/share/fill.
 * Safe no-op if the page has no results section (e.g. this modal is opened
 * from somewhere else) or the ward had zero issues to begin with (no
 * template to clone from).
 */
function updateIssueBars(results: IssueResultLike[]): void {
  const container = document.querySelector<HTMLElement>('[data-issue-bars]');
  const template = container?.querySelector('.issue-bar');
  if (!container || !template) return;

  const lang = document.documentElement.lang === 'kn' ? 'kn' : 'en';

  const clones = results.map((result) => {
    const li = template.cloneNode(true) as HTMLElement;
    const rankEl = li.querySelector('.rank');
    const titleEl = li.querySelector('.issue-title');
    const shareEl = li.querySelector('.share');
    const fillEl = li.querySelector<HTMLElement>('.fill');
    if (rankEl) rankEl.textContent = String(result.rank);
    if (titleEl) titleEl.textContent = pickTitle(lang, result.titleEn, result.titleKn);
    if (shareEl) shareEl.textContent = `${result.sharePct}%`;
    if (fillEl) fillEl.style.width = `${result.sharePct}%`;
    return li;
  });

  container.replaceChildren(...clones);
}

function captureState(): VoteFormState | null {
  const issueIds = getCheckedIds();
  if (issueIds.length === 0) return null;
  return { wardId: currentWardId, issueIds };
}

/**
 * Submits `state` and handles every outcome, INCLUDING re-submitting it
 * automatically once auth resumes on a 401, and re-checking the home-ward
 * state on a 403 — see the module header's "AUTH GATING + RESUME" note.
 */
async function submitVoteState(state: VoteFormState): Promise<void> {
  let res: Response;
  try {
    res = await putVote(state);
  } catch {
    showGenericError();
    return;
  }

  if (res.status === 401) {
    window.bvOpenRegisterLogin?.({
      onSuccess: () => {
        void submitVoteState(state);
      },
    });
    return;
  }

  if (res.status === 403) {
    // The visitor's home ward changed between open and submit (e.g.
    // another tab) — re-check /api/me and show the home-ward message
    // instead of a bare error.
    const me = await fetchMe();
    showHomeWardMessage(me && !me.anonymous ? me.homeWardId : null);
    return;
  }

  if (res.status === 429) {
    showRateLimitError();
    return;
  }

  if (res.ok) {
    const body = (await res.json()) as { ok: true; results: IssueResultLike[] };
    updateIssueBars(body.results);
    els?.controller.close();
    if (els) showSuccessToast(els.msgSuccess);
    return;
  }

  showGenericError();
}

async function onSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!els) return;

  const state = captureState();
  if (!state) return;

  clearErrors();
  els.submitButton.disabled = true;
  try {
    await submitVoteState(state);
  } finally {
    // Only re-derive the button's disabled/label state if the form is
    // still the visible state (a success closes the dialog; a 403 switches
    // to the home-ward message, which has no submit button to re-enable).
    if (els && !els.formWrap.hidden) refreshSelectionState();
  }
}

function wireForm(e: Elements): void {
  e.form.addEventListener('submit', (event) => {
    void onSubmit(event);
  });
  e.optionsContainer.addEventListener('change', () => refreshSelectionState());
}

async function openAuthed(opts: OpenVoteModalOptions, opener: FocusTarget | null | undefined, homeWardId: number | null): Promise<void> {
  if (!els) return;

  currentWardId = opts.wardId;
  currentIssues = opts.issues;

  if (homeWardId !== opts.wardId) {
    showHomeWardMessage(homeWardId);
    els.controller.open(opener ?? undefined);
    return;
  }

  const current = await fetchCurrentSelections(opts.wardId);
  showVoteForm(current?.issueIds ?? []);
  els.controller.open(opener ?? undefined);
}

/**
 * Opens the Cast issue vote modal (IA §3.6/§7, PRD §5.5). Anonymous
 * visitors see Register/Login FIRST — this function re-runs as that flow's
 * `onSuccess`, so `opts` (the same ward/issues) is preserved across the
 * handoff. Safe no-op if the modal markup isn't present on this page.
 */
export function openVoteModal(opts: OpenVoteModalOptions, opener?: FocusTarget | null): void {
  if (!els) {
    els = findElements(document);
    if (!els) return;
    wireForm(els);
  }

  clearErrors();

  void fetchMe().then((me) => {
    if (!me || me.anonymous) {
      window.bvOpenRegisterLogin?.({
        onSuccess: () => openVoteModal(opts, opener),
      });
      return;
    }

    void openAuthed(opts, opener, me.homeWardId);
  });
}

declare global {
  interface Window {
    bvOpenVoteModal?: typeof openVoteModal;
  }
}

function parseIssues(raw: string | undefined): VoteIssue[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (issue): issue is VoteIssue => issue && typeof issue.id === 'number' && typeof issue.title === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * Wires every `[data-vote-action]` element on the page (WardIssues.astro's
 * "Vote your top 3" button today) to open this modal with its own
 * `data-ward-id`/`data-vote-issues` (JSON-encoded `VoteIssue[]`), and
 * exposes `window.bvOpenVoteModal` for anything else that wants to open it
 * directly.
 */
export function initVoteModal(root: ParentNode = document): void {
  window.bvOpenVoteModal = openVoteModal;

  for (const el of root.querySelectorAll<HTMLElement>('[data-vote-action]')) {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      const wardId = Number(el.dataset.wardId);
      const issues = parseIssues(el.dataset.voteIssues);
      if (!Number.isFinite(wardId) || issues.length === 0) return;
      openVoteModal({ wardId, issues }, el);
    });
  }
}
