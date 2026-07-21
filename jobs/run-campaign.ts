#!/usr/bin/env tsx
/**
 * Thin cron entrypoint for the campaign calendar runner (Task 54's
 * `runCampaign`, src/lib/send/calendar.ts). Task 55 wires this into the
 * jobs container's cron schedule — this file stays minimal on purpose: all
 * of the actual scheduling/gating/audience/send logic lives in
 * calendar.ts, where it's unit-tested; this is just "call it, log a
 * summary, exit non-zero on fatal error" so Task 55 can point cron at it
 * unchanged.
 *
 * Never logs PII (module docstring, calendar.ts) — the summary this prints
 * carries only codes/counts.
 */
import { pathToFileURL } from 'node:url';
import { runCampaign, type CampaignRunSummary } from '../src/lib/send/calendar';
import { captureException } from '../src/lib/logger';

/**
 * The process exit code for a completed run (calendar.ts:419-427's
 * exit-nonzero-on-errors contract): NON-ZERO when the run recorded any
 * `errors` (a per-user/per-ward/per-code failure that runCampaign caught,
 * logged, and continued past), so exit-code monitoring — cron mail, the
 * container log driver — catches a run that partially or fully failed instead
 * of it silently reporting success. A guardrail trip is a deliberate REFUSAL,
 * not an error, so it does NOT flip the exit code on its own (it's already
 * alarmed via `campaign_guardrail_tripped` + the stderr warning in `main`);
 * only `errors > 0` does. Kept as a pure, exported helper so the exit
 * decision is unit-testable without spawning the process.
 */
export function exitCodeForSummary(summary: CampaignRunSummary): number {
  return summary.errors > 0 ? 1 : 0;
}

export async function main(): Promise<CampaignRunSummary> {
  const now = new Date();
  const summary = await runCampaign(now);

  console.log(JSON.stringify({ event: 'campaign_run_summary', now: now.toISOString(), ...summary }));

  if (summary.guardrailTripped.length > 0) {
    console.error(
      `run-campaign: guardrail tripped for ${summary.guardrailTripped.join(', ')} — refused to send, see campaign_guardrail_tripped log lines`,
    );
  }
  if (summary.errors > 0) {
    console.error(`run-campaign: ${summary.errors} error(s) during the run — see campaign_send_error/campaign_code_error log lines`);
  }

  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((summary) => {
      // `runCampaign` goes through src/db/client.ts's shared, long-lived
      // connection pool (built for a persistent server process, not a
      // one-shot CLI invocation) — its open connections keep the event
      // loop alive indefinitely otherwise, so a cron-invoked one-shot job
      // must exit explicitly, not just fall off the end of main(). Exit
      // NON-ZERO when the run recorded errors (see exitCodeForSummary) so a
      // fully/partially failed run doesn't report success to cron/monitoring.
      process.exit(exitCodeForSummary(summary));
    })
    .catch((err) => {
      captureException(err);
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
