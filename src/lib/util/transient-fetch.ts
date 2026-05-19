/* ===========================================================================
   transient-fetch — helpers for noisy background pollers.

   Background pollers (Inbox unread, Discuss memberships, etc.) used
   to call console.error on every failed fetch. With 10–60 s
   intervals, a single 30 s outage flooded the console with hundreds
   of identical errors and buried real bugs.

   Use isTransientFetch() to identify obviously transient browser
   fetch errors (offline, timeout, "Failed to fetch") and
   warnOnce(key, msg) to log them at most once per page session.
   ========================================================================== */

const TRANSIENT_RX =
  /failed to fetch|fetch failed|networkerror|load failed|net::err|aborterror|the operation was aborted|connect timeout|timed out/i;

export function isTransientFetch(message: string | null | undefined): boolean {
  if (!message) return false;
  return TRANSIENT_RX.test(message);
}

const _seen = new Set<string>();

/** Log the message only the first time this key is seen in the
 *  current page session. Resets on full reload. */
export function warnOnce(key: string, message: string): void {
  if (_seen.has(key)) return;
  _seen.add(key);
  // eslint-disable-next-line no-console
  console.warn(message);
}
