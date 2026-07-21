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
import { runCampaign } from '../src/lib/send/calendar';

export async function main(): Promise<void> {
  const now = new Date();
  const summary = await runCampaign(now);

  console.log(JSON.stringify({ event: 'campaign_run_summary', now: now.toISOString(), ...summary }));

  if (summary.guardrailTripped.length > 0) {
    console.error(
      `run-campaign: guardrail tripped for ${summary.guardrailTripped.join(', ')} — refused to send, see campaign_guardrail_tripped log lines`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => {
      // `runCampaign` goes through src/db/client.ts's shared, long-lived
      // connection pool (built for a persistent server process, not a
      // one-shot CLI invocation) — its open connections keep the event
      // loop alive indefinitely otherwise, so a cron-invoked one-shot job
      // must exit explicitly on success, not just fall off the end of main().
      process.exit(0);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
