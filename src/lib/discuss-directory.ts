/* ---------------------------------------------------------------------------
   Discuss profile directory (client).

   accounts/people are service-role-only since the P0 security lockdown, so the
   browser's anon client can no longer resolve message authors / DM peers via
   embedded joins — they all came back null and rendered as "Unknown" + "UN".

   This pulls the same internal-account directory the recipient picker uses
   (GET /api/discuss/recipients, service role, tenant-scoped, Discuss-gated) and
   exposes an id → profile map. Short-lived in-memory cache so the chat poller
   doesn't refetch it on every tick.
   --------------------------------------------------------------------------- */

export interface DiscussProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

const TTL_MS = 30_000;
let cache: { at: number; map: Map<string, DiscussProfile> } | null = null;
let inflight: Promise<Map<string, DiscussProfile>> | null = null;

/** id → {username, full_name, avatar_url} for messageable internal accounts.
 *  Cached for ~30s; returns the last good map on transient failure. */
export async function loadDiscussDirectory(force = false): Promise<Map<string, DiscussProfile>> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.map;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/discuss/recipients", { credentials: "include" });
      if (!res.ok) return cache?.map ?? new Map<string, DiscussProfile>();
      const j = (await res.json()) as { recipients?: DiscussProfile[] };
      const map = new Map<string, DiscussProfile>();
      for (const r of j.recipients ?? []) map.set(r.id, r);
      cache = { at: Date.now(), map };
      return map;
    } catch {
      return cache?.map ?? new Map<string, DiscussProfile>();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
