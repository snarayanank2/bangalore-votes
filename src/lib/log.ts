/**
 * Minimal structured-logging shim.
 *
 * Task 63 swaps this for pino. Until then, `logEvent` is the one place
 * request-handling code writes application log lines, so that swap only
 * touches this file.
 *
 * PRIVACY (architecture.md §13): callers MUST NEVER pass a raw citizen
 * address (or any other free-text PII) into `fields`. Only opaque fields —
 * event name, result kind, ward/booth ids, counts — belong here. This is
 * enforced by convention/review, not by the type system; when reading a
 * call site, check the fields object by eye before trusting it.
 */
export function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ event, ...fields }));
}
