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

export async function fetchIconBindings(): Promise<BindingsMap> {
  if (state.cache && Date.now() - state.cache.at < TTL) return state.cache.map;
  if (state.inflight) return state.inflight;
  state.inflight = (async () => {
    try {
      const res = await fetch("/api/visual-bindings", { credentials: "include" });
      const json = (await res.json().catch(() => null)) as { bindings?: BindingsMap } | null;
      const map = json?.bindings ?? {};
      state.cache = { at: Date.now(), map };
      return map;
    } catch {
      return state.cache?.map ?? {};
    } finally {
      state.inflight = null;
    }
  })();
  return state.inflight;
}

/** Drop the cache after a PUT so the editing screen sees its own write. */
export function invalidateIconBindings(): void {
  state.cache = null;
}

export function resolveIcon(map: BindingsMap, semanticKey: string): string | undefined {
  return map[semanticKey];
}
