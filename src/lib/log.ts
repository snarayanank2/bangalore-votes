/**
 * Structured-logging entry point. `logEvent` is the one place
 * request-handling code writes application log lines; since Task 63 it
 * emits through pino (`src/lib/logger.ts`) instead of a raw `console.log`
 * — the pino instance writes the same `{event, ...fields}`-shaped JSON to
 * stdout (now wrapped in pino's usual `{level, time, ...}` envelope), so
 * Compose logs stay parseable, and every field passed here is additionally
 * scrubbed by `scrubPii` before it's serialized (defense-in-depth: see
 * that module's docstring for the primary contract).
 *
 * PRIVACY (architecture.md §13): callers MUST NEVER pass a raw citizen
 * address (or any other free-text PII) into `fields`. Only opaque fields —
 * event name, result kind, ward/booth ids, counts — belong here. This is
 * enforced by convention/review, not by the type system; when reading a
 * call site, check the fields object by eye before trusting it.
 */
import { logger } from './logger';

export function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  logger.info({ event, ...fields });
}
