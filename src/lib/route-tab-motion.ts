"use client";

/* ---------------------------------------------------------------------------
   route-tab-motion — one value handed from the click to the pane.

   The click knows the DIRECTION (which tab in the strip was clicked, relative
   to the selected one). The pane knows WHEN it mounts. Neither can see the
   other, and threading a prop through a segment layout would mean editing
   every app. So the click writes the direction here and the pane that lands
   on that route reads it.

   ⚠️ THE READ IS PURE, AND IT HAS TO BE. The first version cleared the value
   on read ("take it once"), which looked tidy and made the motion play on
   roughly a third of tab clicks. React may call a component's render function
   more than once for a single commit — Strict Mode does it deliberately, and
   a render-phase state update re-runs it as well — so the second call took an
   already-emptied slot and the empty result was the one that stuck. Owner:
   "nothing changed at all."

   Keying by pathname is what makes re-reading safe: every render of the pane
   that landed on that route gets the same answer, no matter how many times it
   runs. Clearing is a separate, explicit act performed by the navigations
   that are NOT tab clicks, so a direction can never replay on a route reached
   some other way (a back button, a deep link, a redirect).

   Deliberately a plain module variable, not context or storage: the Hub is a
   single page app, so this module outlives every navigation, and there is no
   state to subscribe to.
   --------------------------------------------------------------------------- */

type Pending = { path: string; dir: string };

let pending: Pending = { path: "", dir: "" };

const strip = (p: string) => (p.length > 1 ? p.replace(/\/$/, "") : p);

/** Arm the direction for the route this click is about to land on. */
export function setRouteTabDir(path: string, dir: "kx-tab-fwd" | "kx-tab-back"): void {
  pending = { path: strip(path), dir };
}

/** Pure: the direction armed for `path`, or "" — safe to call on every render. */
export function readRouteTabDir(path: string): string {
  return pending.path === strip(path) ? pending.dir : "";
}

/** Any navigation that is not a tab click disarms it. */
export function clearRouteTabDir(): void {
  pending = { path: "", dir: "" };
}
