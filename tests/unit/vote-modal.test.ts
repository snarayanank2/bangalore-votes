// @vitest-environment jsdom
/**
 * Direct coverage for the Cast issue vote modal island
 * (src/islands/VoteModal.ts) — Task 33, IA §3.6/§7, PRD §5.5. Builds a DOM
 * fixture mirroring the exact markup src/components/VoteModal.astro
 * renders (same `data-vote-*`/`data-msg-*` hooks), plus a standalone
 * `[data-issue-bars]` fixture mirroring src/components/IssueBars.astro's
 * rendered `<ol>`/`<li>` shape (WardIssues.astro's results section), and
 * drives it via jsdom — mocking `fetch` for `/api/me`, `/api/issue-votes`
 * (GET precheck + PUT submit), and `window.bvOpenRegisterLogin` (Task 27's
 * own global opener) so the auth-gating + resume handoff can be exercised
 * without that modal's own markup. Same jsdom `<dialog>` polyfill as
 * tests/unit/flag-modal.test.ts (jsdom doesn't implement
 * showModal/close at all).
 *
 * MODULE STATE, PER TEST: the island caches the DOM elements it finds on
 * its first `openVoteModal`/`initVoteModal` call (module-level `els`), so
 * every test resets modules (`vi.resetModules()` + a fresh dynamic import)
 * against a freshly-built DOM fixture.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

if (!('showModal' in HTMLDialogElement.prototype)) {
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
    close(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
}

type VoteModalModule = typeof import('../../src/islands/VoteModal');
type VoteIssue = import('../../src/islands/VoteModal').VoteIssue;

const MSGS = {
  rateLimit: "You've re-cast your vote a lot recently. Please try again later.",
  genericError: 'Something went wrong. Please try again.',
  success: 'Your vote has been recorded.',
  submitTemplate: 'Vote ({n} of 3 selected)',
  homeWardTemplate: 'You can only vote in your registered home ward (Ward {wardId}).',
};

/** Mirrors src/components/VoteModal.astro's rendered markup. */
const MODAL_HTML = `
  <dialog data-vote-modal aria-labelledby="vote-modal-title">
    <div class="vote-modal-inner">
      <button type="button" data-modal-close aria-label="Close">&times;</button>
      <h2 id="vote-modal-title">Vote your top 3 issues</h2>

      <div data-vote-form-wrap>
        <p>Select up to three issues.</p>
        <form data-vote-form novalidate>
          <div data-vote-issue-options role="group" aria-label="This ward's issues"></div>
          <p data-vote-rate-limit-error hidden></p>
          <p data-vote-generic-error hidden></p>
          <button type="submit" data-vote-submit disabled>Vote (0 of 3 selected)</button>
        </form>
      </div>

      <div data-vote-home-ward-wrap hidden>
        <p data-vote-home-ward-message></p>
        <a data-vote-home-ward-link href="/account">Change your home ward</a>
      </div>
    </div>

    <span hidden data-msg-rate-limit>${MSGS.rateLimit}</span>
    <span hidden data-msg-generic-error>${MSGS.genericError}</span>
    <span hidden data-msg-success>${MSGS.success}</span>
    <span hidden data-msg-submit-template>${MSGS.submitTemplate}</span>
    <span hidden data-msg-home-ward-template>${MSGS.homeWardTemplate}</span>
  </dialog>
`;

/** Mirrors src/components/IssueBars.astro's rendered `<ol data-issue-bars>` (one existing bar, used as VoteModal's clone-template). */
const ISSUE_BARS_HTML = `
  <ol class="issue-bars" data-issue-bars>
    <li class="issue-bar">
      <div class="issue-bar-header">
        <span class="rank">1</span>
        <span class="issue-title">Roads</span>
        <span class="share">100%</span>
      </div>
      <div class="track"><div class="fill" style="width: 100%"></div></div>
    </li>
  </ol>
`;

function submit(form: HTMLFormElement): void {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

function jsonResponse(body: unknown, status = 200): { ok: boolean; status: number; json: () => Promise<unknown> } {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const WARD_ID = 57;
const ISSUES: VoteIssue[] = [
  { id: 1, title: 'Roads' },
  { id: 2, title: 'Water' },
  { id: 3, title: 'Waste' },
  { id: 4, title: 'Lighting' },
];

function checkbox(id: number): HTMLInputElement {
  return document.querySelector<HTMLInputElement>(`input[name="issueIds"][value="${id}"]`)!;
}

function submitButton(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('[data-vote-submit]')!;
}

function form(): HTMLFormElement {
  return document.querySelector<HTMLFormElement>('[data-vote-form]')!;
}

function dialog(): HTMLDialogElement {
  return document.querySelector<HTMLDialogElement>('[data-vote-modal]')!;
}

describe('VoteModal island (src/islands/VoteModal.ts)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let registerLoginSpy: ReturnType<typeof vi.fn>;
  let openVoteModal: VoteModalModule['openVoteModal'];
  let initialHref: string;

  beforeEach(async () => {
    document.body.innerHTML = MODAL_HTML + ISSUE_BARS_HTML;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    registerLoginSpy = vi.fn();
    (window as unknown as { bvOpenRegisterLogin?: unknown }).bvOpenRegisterLogin = registerLoginSpy;

    initialHref = location.href;

    vi.resetModules();
    ({ openVoteModal } = await import('../../src/islands/VoteModal'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as { bvOpenRegisterLogin?: unknown }).bvOpenRegisterLogin;
    delete (window as { bvOpenVoteModal?: unknown }).bvOpenVoteModal;
  });

  /** Opens authed, home ward matching `wardId`, with `selections` as the GET precheck response. */
  async function openMatchingHomeWard(selections: number[] = [], issues: VoteIssue[] = ISSUES): Promise<void> {
    fetchMock.mockResolvedValueOnce(jsonResponse({ anonymous: false, homeWardId: WARD_ID }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ issueIds: selections }));
    openVoteModal({ wardId: WARD_ID, issues });
    await flush();
  }

  it('ANONYMOUS: openVoteModal opens Register/Login FIRST, not the vote form', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ anonymous: true }));

    openVoteModal({ wardId: WARD_ID, issues: ISSUES });
    await flush();

    expect(fetchMock).toHaveBeenCalledWith('/api/me');
    expect(registerLoginSpy).toHaveBeenCalledTimes(1);
    expect(dialog().hasAttribute('open')).toBe(false);
  });

  it("ANONYMOUS: once Register/Login's onSuccess fires, the vote modal opens (now authed, pre-checked)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ anonymous: true }));

    openVoteModal({ wardId: WARD_ID, issues: ISSUES });
    await flush();

    const onSuccess = registerLoginSpy.mock.calls[0]![0].onSuccess as () => void;

    fetchMock.mockResolvedValueOnce(jsonResponse({ anonymous: false, homeWardId: WARD_ID }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ issueIds: [] }));
    onSuccess();
    await flush();

    expect(dialog().hasAttribute('open')).toBe(true);
    expect(document.querySelector('[data-vote-form-wrap]')).not.toHaveProperty('hidden', true);
  });

  describe('checkbox cap at 3', () => {
    it('a 4th checkbox is disabled once 3 are checked, and re-enabled when one is unchecked', async () => {
      await openMatchingHomeWard();

      checkbox(1).click();
      checkbox(2).click();
      checkbox(3).click();

      expect(checkbox(4).disabled).toBe(true);
      expect(checkbox(1).disabled).toBe(false); // already-checked boxes stay enabled (so they can be unchecked)

      checkbox(2).click(); // uncheck -> back to 2 selected

      expect(checkbox(4).disabled).toBe(false);
    });
  });

  describe('submit label counts down', () => {
    it('shows "Vote (2 of 3 selected)" once 2 are checked, and starts disabled at 0', async () => {
      await openMatchingHomeWard();

      expect(submitButton().disabled).toBe(true);
      expect(submitButton().textContent).toBe('Vote (0 of 3 selected)');

      checkbox(1).click();
      checkbox(2).click();

      expect(submitButton().textContent).toBe('Vote (2 of 3 selected)');
      expect(submitButton().disabled).toBe(false);
    });
  });

  describe('pre-check current selections', () => {
    it("a returning voter's existing picks (from the GET precheck) are checked on open", async () => {
      await openMatchingHomeWard([2, 3]);

      expect(checkbox(1).checked).toBe(false);
      expect(checkbox(2).checked).toBe(true);
      expect(checkbox(3).checked).toBe(true);
      expect(checkbox(4).checked).toBe(false);
      expect(submitButton().textContent).toBe('Vote (2 of 3 selected)');
    });
  });

  describe('home-ward mismatch', () => {
    it("shows the home-ward-only message (not the checkbox form) when the visitor's home ward differs", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ anonymous: false, homeWardId: 99 }));

      openVoteModal({ wardId: WARD_ID, issues: ISSUES });
      await flush();

      expect(dialog().hasAttribute('open')).toBe(true);
      expect((document.querySelector('[data-vote-form-wrap]') as HTMLElement).hidden).toBe(true);
      const wrap = document.querySelector('[data-vote-home-ward-wrap]') as HTMLElement;
      expect(wrap.hidden).toBe(false);
      const message = document.querySelector('[data-vote-home-ward-message]') as HTMLElement;
      expect(message.textContent).toBe('You can only vote in your registered home ward (Ward 99).');

      // No GET precheck should have been attempted — there's nothing to precheck against a doomed ward.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('submit outcomes', () => {
    it('200 -> splices fresh results into [data-issue-bars], shows a toast, and closes', async () => {
      await openMatchingHomeWard([], [{ id: 1, title: 'Roads' }]);
      checkbox(1).click();

      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          {
            ok: true,
            results: [{ issueId: 1, titleEn: 'Roads', titleKn: 'Roads (kn)', rank: 1, sharePct: 42 }],
          },
          200,
        ),
      );
      submit(form());
      await flush();

      const [url, init] = fetchMock.mock.calls.at(-1)!;
      expect(url).toBe('/api/issue-votes');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body)).toEqual({ wardId: WARD_ID, issueIds: [1] });

      expect(dialog().hasAttribute('open')).toBe(false);

      const bar = document.querySelector('[data-issue-bars] .issue-bar')!;
      expect(bar.querySelector('.share')?.textContent).toBe('42%');
      expect(bar.querySelector('.issue-title')?.textContent).toBe('Roads');
      expect((bar.querySelector('.fill') as HTMLElement).style.width).toBe('42%');

      const toast = document.querySelector('[data-vote-success-toast]');
      expect(toast?.textContent).toBe(MSGS.success);
    });

    it('429 -> shows the rate-limit message, modal stays open', async () => {
      await openMatchingHomeWard();
      checkbox(1).click();

      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'rate limit exceeded' }, 429));
      submit(form());
      await flush();

      expect(dialog().hasAttribute('open')).toBe(true);
      const rateLimitError = document.querySelector('[data-vote-rate-limit-error]') as HTMLElement;
      expect(rateLimitError.hidden).toBe(false);
      expect(rateLimitError.textContent).toBe(MSGS.rateLimit);
    });

    it('403 wrong_ward mid-submit -> switches to the home-ward-only message', async () => {
      await openMatchingHomeWard();
      checkbox(1).click();

      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'wrong_ward' }, 403));
      // The 403 handler re-checks /api/me for the current home ward to show in the message.
      fetchMock.mockResolvedValueOnce(jsonResponse({ anonymous: false, homeWardId: 12 }));
      submit(form());
      await flush();

      expect(dialog().hasAttribute('open')).toBe(true);
      expect((document.querySelector('[data-vote-form-wrap]') as HTMLElement).hidden).toBe(true);
      const message = document.querySelector('[data-vote-home-ward-message]') as HTMLElement;
      expect(message.textContent).toBe('You can only vote in your registered home ward (Ward 12).');
    });

    it('401 mid-submit: Register/Login opens (vote dialog left open), and onSuccess RE-PUTS the SAME captured selections', async () => {
      await openMatchingHomeWard();
      checkbox(1).click();
      checkbox(3).click();

      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'authentication required' }, 401));
      submit(form());
      await flush();

      expect(registerLoginSpy).toHaveBeenCalledTimes(1);
      expect(dialog().hasAttribute('open')).toBe(true); // left open across the handoff

      const onSuccess = registerLoginSpy.mock.calls[0]![0].onSuccess as () => void;
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ ok: true, results: [{ issueId: 1, titleEn: 'Roads', titleKn: null, rank: 1, sharePct: 50 }] }, 200),
      );
      onSuccess();
      await flush();

      const [url, init] = fetchMock.mock.calls.at(-1)!;
      expect(url).toBe('/api/issue-votes');
      expect(JSON.parse(init.body)).toEqual({ wardId: WARD_ID, issueIds: [1, 3] });
      expect(dialog().hasAttribute('open')).toBe(false); // resumed submit succeeded -> closes
    });
  });

  it('the URL never changes across the whole anonymous -> auth -> submit -> success flow', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ anonymous: true }));
    openVoteModal({ wardId: WARD_ID, issues: [{ id: 1, title: 'Roads' }] });
    await flush();

    const onSuccess = registerLoginSpy.mock.calls[0]![0].onSuccess as () => void;
    fetchMock.mockResolvedValueOnce(jsonResponse({ anonymous: false, homeWardId: WARD_ID }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ issueIds: [] }));
    onSuccess();
    await flush();

    checkbox(1).click();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: true, results: [{ issueId: 1, titleEn: 'Roads', titleKn: null, rank: 1, sharePct: 100 }] }, 200),
    );
    submit(form());
    await flush();

    expect(location.href).toBe(initialHref);
  });
});

describe('initVoteModal wiring ([data-vote-action], window.bvOpenVoteModal)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let initVoteModal: VoteModalModule['initVoteModal'];

  beforeEach(async () => {
    document.body.innerHTML = `
      <button
        type="button"
        data-vote-action
        data-ward-id="${WARD_ID}"
        data-vote-issues='${JSON.stringify(ISSUES)}'
      >Vote your top 3</button>
      ${MODAL_HTML}
      ${ISSUE_BARS_HTML}
    `;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    vi.resetModules();
    ({ initVoteModal } = await import('../../src/islands/VoteModal'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as { bvOpenVoteModal?: unknown }).bvOpenVoteModal;
  });

  it('exposes window.bvOpenVoteModal', () => {
    initVoteModal();
    expect(typeof window.bvOpenVoteModal).toBe('function');
  });

  it('clicking [data-vote-action] opens the modal with its data-ward-id/data-vote-issues, authed + matching ward', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ anonymous: false, homeWardId: WARD_ID }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ issueIds: [] }));
    initVoteModal();

    const button = document.querySelector('[data-vote-action]') as HTMLButtonElement;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    await flush();

    expect(event.defaultPrevented).toBe(true);
    expect(dialog().hasAttribute('open')).toBe(true);
    expect(checkbox(1)).toBeTruthy();
  });
});
