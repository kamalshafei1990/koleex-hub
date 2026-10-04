/* ---------------------------------------------------------------------------
   Is this failure the network dropping? One answer for the whole AI app.

   The chat had two copies of this test, and they disagreed (deep check,
   2026-09-24): the attachments path called ANY TypeError a dropped link,
   the send path required one of three messages, and neither knew Chrome's
   mid-stream "network error". Pure.
   --------------------------------------------------------------------------- */

const NETWORK_MESSAGE = /failed to fetch|networkerror|network error|load failed|network connection was lost|net::err|the operation was aborted/i;

export function isNetworkError(e: unknown): boolean {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  return NETWORK_MESSAGE.test(raw);
}
