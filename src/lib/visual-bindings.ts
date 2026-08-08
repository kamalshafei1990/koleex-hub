"use client";

/* ---------------------------------------------------------------------------
   visual-bindings — the ONE client resolver for the Semantic Icon Registry.

   Every surface that shows a semantic icon (product record rows, spec
   fields, classification tiles, …) resolves through here, so an icon
   changed in Database › Visual Library propagates everywhere within the
   60s cache window. Module-level cache + in-flight dedupe: many mounts,
   one request.
   --------------------------------------------------------------------------- */

export type BindingsMap = Record<string, string>;

/* SYS-4: Turbopack duplicates this small module into several chunks (3 in
   the 2026-08-08 build), so plain module-level state becomes 3 independent
   caches firing parallel duplicate fetches. Anchoring the singleton on
   globalThis makes every copy share ONE cache and ONE in-flight promise. */
interface VbState {
  cache: { at: number; map: BindingsMap } | null;
  inflight: Promise<BindingsMap> | null;
}
const g = globalThis as typeof globalThis & { __kxVisualBindings?: VbState };
const state: VbState = g.__kxVisualBindings ?? (g.__kxVisualBindings = { cache: null, inflight: null });
const TTL = 60_000;
const LS_KEY = "kx_vb_v1";

/* Warm-start (owner-reported "two layers of icons"): the map used to live
   only in memory, so EVERY full page load painted the inline fallbacks
   first and swapped to the registry icons ~a network round-trip later.
   Mirroring the map in localStorage and seeding it SYNCHRONOUSLY at module
   load means the very first render already knows the registry URLs — no
   swap. The mirror is refreshed after every successful fetch and cleared
   with the rest of client storage on sign-out. */
if (!state.cache && typeof window !== "undefined") {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) {
      const map = JSON.parse(raw) as BindingsMap;
      /* at: 0 → served instantly but treated as stale, so a background
         refresh fires on the first fetchIconBindings() call. */
      if (map && typeof map === "object") state.cache = { at: 0, map };
    }
  } catch { /* corrupt mirror — cold-start as before */ }
}

function persist(map: BindingsMap): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch { /* quota — mirror is best-effort */ }
}

/** Synchronous read of the current map (may be the warm-started mirror).
 *  Lets icon components resolve their URL on the FIRST render. */
export function getIconBindingSync(semanticKey: string): string | undefined {
  return state.cache?.map[semanticKey];
}

export async function fetchIconBindings(): Promise<BindingsMap> {
  if (state.cache && Date.now() - state.cache.at < TTL) return state.cache.map;
  if (state.inflight) {
    /* Stale-while-revalidate: hand the stale map to the caller NOW instead
       of making it await the network — the refresh below updates state for
       the next reader. */
    return state.cache ? state.cache.map : state.inflight;
  }
  state.inflight = (async () => {
    try {
      const res = await fetch("/api/visual-bindings", { credentials: "include" });
      const json = (await res.json().catch(() => null)) as { bindings?: BindingsMap } | null;
      const map = json?.bindings ?? {};
      state.cache = { at: Date.now(), map };
      persist(map);
      return map;
    } catch {
      return state.cache?.map ?? {};
    } finally {
      state.inflight = null;
    }
  })();
  if (state.cache) {
    /* Serve stale instantly; the in-flight refresh replaces it quietly. */
    void state.inflight;
    return state.cache.map;
  }
  return state.inflight;
}

/** Drop the cache after a PUT so the editing screen sees its own write. */
export function invalidateIconBindings(): void {
  state.cache = null;
}

export function resolveIcon(map: BindingsMap, semanticKey: string): string | undefined {
  return map[semanticKey];
}
