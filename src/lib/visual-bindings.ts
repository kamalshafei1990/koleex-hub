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

let cache: { at: number; map: BindingsMap } | null = null;
let inflight: Promise<BindingsMap> | null = null;
const TTL = 60_000;

export async function fetchIconBindings(): Promise<BindingsMap> {
  if (cache && Date.now() - cache.at < TTL) return cache.map;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/visual-bindings", { credentials: "include" });
      const json = (await res.json().catch(() => null)) as { bindings?: BindingsMap } | null;
      const map = json?.bindings ?? {};
      cache = { at: Date.now(), map };
      return map;
    } catch {
      return cache?.map ?? {};
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Drop the cache after a PUT so the editing screen sees its own write. */
export function invalidateIconBindings(): void {
  cache = null;
}

export function resolveIcon(map: BindingsMap, semanticKey: string): string | undefined {
  return map[semanticKey];
}
