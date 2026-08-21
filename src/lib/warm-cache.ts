"use client";

/* ---------------------------------------------------------------------------
   warm-cache — paint the screen from the last answer, then refresh.

   WHY THIS EXISTS. Measured on production 2026-08-22 across the ten screens
   the owner actually lives in: a route COMMITS in 63–493ms, but its data does
   not settle until 1.0–1.8s, because a single API request costs 400–920ms on
   this network path and the screen renders nothing until the first one
   returns. Request count is already low (2–10) and the waterfall is already
   flat, so there is nothing left to batch or parallelise — the only lever is
   to stop waiting for a request at all.

   So: hydrate state SYNCHRONOUSLY from the previous answer during the first
   render, show it immediately, and revalidate in the background.

   THE RULES THIS FILE ENFORCES, each one paid for:

   · sessionStorage, not localStorage. The contacts directory already
     outgrew the localStorage quota once and a full store fails SILENTLY,
     killing every warm start at once (storage-guard.ts exists because of
     that). Per-tab storage keeps this feature off that contended budget.
     The cost is that a brand-new tab cold-loads — which is the rarer case;
     the complaint was about moving BETWEEN apps all day.

   · Synchronous only. IndexedDB is async, so a value that arrives in an
     effect lands AFTER first paint — that is a content shift, not a warm
     start (the standing no-shift rule).

   · Keys start with `kx:` so session-caches.ts wipes them on sign-out.
     A cache holding one tenant's rows must never survive into another
     account's session. Do not invent a key outside this prefix.

   · Entries carry a timestamp and are refused past maxAge. Stale-forever is
     worse than a spinner: the operator would act on numbers with no idea
     how old they are.
   --------------------------------------------------------------------------- */

import { useSyncExternalStore } from "react";

const PREFIX = "kx:warm:";
/* Big enough for a list page, small enough that one screen cannot eat the
   per-tab budget and evict every other screen's warm start. */
const MAX_BYTES = 512_000;
/* Past this, a cached answer is not worth showing before the fresh one. */
export const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;

type Envelope<T> = { v: 1; at: number; d: T };

/** Read the last answer for `key`, or null when absent/stale/unusable. */
export function readWarm<T>(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    if (!env || env.v !== 1 || typeof env.at !== "number") return null;
    if (Date.now() - env.at > maxAgeMs) return null;
    return env.d;
  } catch {
    return null;
  }
}

/** Store the fresh answer for `key`. Silent no-op when it cannot be stored. */
export function writeWarm<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify({ v: 1, at: Date.now(), d: data } satisfies Envelope<T>);
    if (raw.length > MAX_BYTES) return;
    window.sessionStorage.setItem(PREFIX + key, raw);
    /* Keep the in-memory snapshot in step. The Hub is a single-page app, so
       this module outlives every navigation: without this line, coming back
       to a screen later in the same session would hand it the snapshot read
       on the FIRST visit and quietly ignore everything saved since. */
    snapshots.set(key, data);
  } catch {
    /* Quota or a non-serialisable value: the screen simply cold-loads next
       time. Never let a cache write break a render. */
  }
}

/* ── The React binding ────────────────────────────────────────────────────
   A warm value exists only on the client, and the server renders the
   spinner. Reading sessionStorage during the first client render would
   therefore contradict the server's HTML — a hydration mismatch, which is
   exactly the bug the HRApp-style `useState(() => sessionStorage…)` shortcut
   invites. useSyncExternalStore is the supported way to say "the server has
   nothing, the client has this": React hydrates against the server snapshot
   and swaps to the client one immediately afterwards, in the same tick,
   long before any network answer could arrive.

   getSnapshot must be referentially stable, so the parsed value is memoised
   per key for the life of the page. */
const snapshots = new Map<string, unknown>();
const NEVER_CHANGES = () => () => {};

function clientSnapshot<T>(key: string, maxAgeMs: number): T | null {
  if (!snapshots.has(key)) snapshots.set(key, readWarm<T>(key, maxAgeMs));
  return (snapshots.get(key) ?? null) as T | null;
}
const NO_SERVER_SNAPSHOT = () => null;

/** The previous answer for `key`, or null on the server and on a cold tab. */
export function useWarm<T>(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): T | null {
  return useSyncExternalStore<T | null>(
    NEVER_CHANGES,
    () => clientSnapshot<T>(key, maxAgeMs),
    NO_SERVER_SNAPSHOT,
  );
}

/** Drop one warm entry — after a mutation whose new shape we do not hold. */
export function dropWarm(key: string): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(PREFIX + key); } catch { /* noop */ }
}

/* HOW A SCREEN USES THIS — derive, never setState from the warm value:
 *
 *   const warm = useWarm<Shape>("purchase:home");
 *   const [fresh, setFresh] = useState<Shape | null>(null);   // the fetch fills this
 *   const shown = fresh ?? warm;                              // fresh always wins
 *   if (!shown) return <Spinner/>;                            // only a truly cold screen waits
 *
 * Deriving keeps one source of truth and avoids a setState-inside-an-effect,
 * which this codebase lints against for good reason. */
