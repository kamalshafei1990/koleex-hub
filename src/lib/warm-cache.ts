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

   · localStorage, through storage-guard's setCache. This started on
     sessionStorage to stay off the quota that the contacts directory had
     already exhausted once — a full store fails SILENTLY and kills every
     warm start at the same moment. The reasoning was sound and the
     conclusion was wrong: sessionStorage is per browser TAB, so the cache
     was empty every time the Hub was opened fresh, and the first visit to
     each screen still showed a spinner. Owner, after the sweep landed:
     "no it still load and show the loading sign."
     The quota problem has its own answer and it is not "use a smaller
     store" — setCache prunes and retries on QuotaExceededError and reports
     whether the value actually landed, which is precisely the silent
     failure this rule was avoiding. So: the durable store, with the guard
     that makes it safe.

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

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { setCache } from "@/lib/storage-guard";

const PREFIX = "kx:warm:";
/* Big enough for a list page, small enough that one screen cannot eat the
   budget and evict every other screen's warm start. */
const MAX_BYTES = 512_000;
/* Past this, a cached answer is not worth showing before the fresh one.
   TWELVE HOURS, NOT TEN MINUTES — the old value was chosen when the cache
   died with the browser tab anyway, so nothing outlived it. On a durable
   store a ten-minute ceiling would mean the Hub cold-loads every screen each
   morning, which is the complaint this file exists to answer.
   The exposure is not what it looks like: every screen revalidates on mount,
   so a stale entry is only ever on the glass for the second the fresh answer
   takes to arrive — the same second a ten-minute-old entry would be. What
   changes with age is how WRONG it could be during that second, so a screen
   that cannot tolerate that passes its own, shorter maxAgeMs. */
export const DEFAULT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
/* Below this age, a stored answer is trusted outright and no request is made.
   Sixty seconds is chosen against how the Hub is actually used: tabs get
   flipped in bursts of seconds, and refetching eight screens' worth of data
   because someone walked across their own tab bar is the churn the owner felt
   as lag. Anything older refreshes on the next visit, and any screen that
   needs tighter freshness passes its own value. */
export const DEFAULT_STALE_MS = 60 * 1000;

type Envelope<T> = { v: 1; at: number; d: T };

/** Read the last answer for `key`, or null when absent/stale/unusable. */
export function readWarm<T>(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    if (!env || env.v !== 1 || typeof env.at !== "number") return null;
    if (Date.now() - env.at > maxAgeMs) return null;
    return env.d;
  } catch {
    return null;
  }
}

/** Age of the stored answer in ms, or Infinity when there isn't one. */
export function warmAge(key: string): number {
  if (typeof window === "undefined") return Infinity;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return Infinity;
    const env = JSON.parse(raw) as Envelope<unknown>;
    if (!env || env.v !== 1 || typeof env.at !== "number") return Infinity;
    return Date.now() - env.at;
  } catch {
    return Infinity;
  }
}

/** Store the fresh answer for `key`. Silent no-op when it cannot be stored. */
export function writeWarm<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify({ v: 1, at: Date.now(), d: data } satisfies Envelope<T>);
    if (raw.length > MAX_BYTES) return;
    /* setCache, never a bare setItem: it prunes and retries on a full store
       and REPORTS whether the value landed. A bare write would fail silently
       here, and a silently-empty warm cache looks exactly like a working one
       until someone measures — which is how Inventory's Returns tab stayed
       slow while every tab around it went instant. */
    if (!setCache(PREFIX + key, raw, MAX_BYTES)) return;
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
   spinner. Reading localStorage during the first client render would
   therefore contradict the server's HTML — a hydration mismatch, which is
   exactly the bug the HRApp-style `useState(() => localStorage…)` shortcut
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

/** The previous answer for `key`, or null on the server and on a cold tab.
 *  An empty key means "this view must not be warmed" and always returns null. */
export function useWarm<T>(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): T | null {
  return useSyncExternalStore<T | null>(
    NEVER_CHANGES,
    () => (key ? clientSnapshot<T>(key, maxAgeMs) : null),
    NO_SERVER_SNAPSHOT,
  );
}

/** Drop one warm entry — after a mutation whose new shape we do not hold. */
export function dropWarm(key: string): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(PREFIX + key); } catch { /* noop */ }
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

/* ── useWarmData — the whole pattern in one call ──────────────────────────
   The block above is the contract, and writing it out by hand in every
   screen is how it gets subtly wrong: a warm value copied into state instead
   of derived, a fetch that forgets to persist, an error response cached as
   if it were data. Fifty-odd tab screens need this, so it exists once.

   `load` MUST be referentially stable (wrap it in useCallback) — it is an
   effect dependency, and an inline function refetches on every render.

   WHAT IT DELIBERATELY DOES NOT DO:

   · It never caches a failed load. `load` should throw (or the caller should
     throw) on a bad response; a rejected promise leaves the warm entry
     untouched, so the screen keeps showing the last answer it trusted rather
     than memorising an empty list as the truth.

   · It has no opinion about FILTERED requests, and callers must. This cache
     is keyed by name, not by query: warming a server-filtered list would
     repaint someone's search result as if it were the whole catalogue on the
     next open. Warm the DEFAULT view only — pass an EMPTY key the moment a
     filter is applied and the screen loads normally, showing nothing rather
     than something untrue. An empty key neither reads nor writes.

   · Results arriving after unmount are dropped. A tab switched away from
     mid-flight must not push state into a component that is gone, and its
     answer must not overwrite a newer screen's warm entry.

   · It does NOT refetch an answer it only just fetched. `staleMs` is the
     second half of the owner's complaint and the half a cache alone cannot
     fix: the screens painted instantly and still felt laggy, because every
     single tab visit fired the whole revalidate again. Measured on one lap
     of the Inventory strip — Movements 23 requests after the route
     committed, Transfers 17 — on a network where a request is most of a
     second. The page was up and then churned underneath itself.
     So a warm entry younger than staleMs is simply trusted: no request at
     all. Flipping between tabs costs nothing, and the moment the data is
     older than the window the next visit refreshes it. reload() always
     goes to the network, so anything that follows a mutation is unaffected. */
export function useWarmData<T>(
  key: string,
  load: () => Promise<T>,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  staleMs = DEFAULT_STALE_MS,
): { data: T | null; loading: boolean; error: unknown; reload: () => Promise<void> } {
  const warm = useWarm<T>(key, maxAgeMs);
  /* The fetched value is STAMPED WITH THE KEY IT ANSWERED. Holding it bare
     was a correctness bug the moment a key could change: switch the
     reconciliation filter or the statement period and `fresh` still holds the
     previous question's answer, so the screen shows the rejected pile under
     "Active" — and because a warm screen is never `loading`, there is no
     spinner covering it any more. Stamped, a stale answer simply does not
     match and the warm value for the NEW key takes over until the refetch
     lands. */
  const [fresh, setFresh] = useState<{ k: string; d: T } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const reload = useCallback(async () => {
    try {
      const d = await load();
      if (!aliveRef.current) return;
      if (key) writeWarm(key, d);
      setFresh({ k: key, d });
      setError(null);
    } catch (e) {
      if (!aliveRef.current) return;
      setError(e);
    }
  }, [key, load]);

  /* set-state-in-effect follows `reload` into its body, finds setFresh, and
     reports a synchronous update. It is not one: every setState in there sits
     behind `await load()`, so the earliest it can run is a later task, long
     after this effect returns. The rule cannot see past the await, and the
     revalidate has to start from an effect — that is what "fetch after paint"
     means. */
  /* The initial revalidate is SKIPPED while the stored answer is younger
     than staleMs — see the note above. Deliberately not `reload` itself, so
     a caller's explicit reload() after a mutation is never skipped. */
  useEffect(() => {
    if (key && warmAge(key) < staleMs) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload, key, staleMs]);

  const data = (fresh && fresh.k === key ? fresh.d : null) ?? warm;
  /* Loading means "nothing to show yet" — NOT "a request is in flight".
     A warm screen is never loading, which is the entire point: the revalidate
     runs behind a fully painted page. */
  return { data, loading: data == null && error == null, error, reload };
}
