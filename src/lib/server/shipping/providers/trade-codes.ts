import "server-only";

/* ---------------------------------------------------------------------------
   Shipping — the code a PARTICULAR provider wants, resolved for that provider
   only.

   ── ⚠️ WHY THIS IS NOT IN THE ENGINE ──────────────────────────────────────
   It was. The engine built one trade-code map and handed it to every adapter
   through the provider context, so a single spelling was applied globally.
   That is the wrong shape for two reasons:

     · It quietly overwrites an official identifier for everyone. The Shanghai
       seaport is CNSGH. The ocean trade books it as CNSHA, which UN/LOCODE
       assigns to Shanghai Hongqiao AIRPORT. Rewriting CNSGH → CNSHA before
       the request leaves the engine means the canonical code has been
       replaced system-wide on the strength of one provider's habit.
     · Providers disagree. The day one accepts CNSGH and another demands
       CNSHA, a shared map cannot express it, and whichever was written first
       silently wins for both.

   So the mapping lives here and an ADAPTER asks for it, by name, for itself.
   The canonical code is what the engine stores, caches and displays; a
   provider spelling exists for exactly the width of one outbound request.

   ── Adding a provider ─────────────────────────────────────────────────────
   Give it an entry in PROVIDER_CODE_POLICY. `"canonical"` means send the
   UN/LOCODE or IATA code unchanged — the correct default, and the one to keep
   until a provider is OBSERVED to need something else. `"ocean_trade"` means
   apply the trade spelling for ocean lanes, which is what the two Chinese-lane
   providers documented today expect.

   ⚠️ Neither of those has been confirmed against a live response. Both
   adapters are disabled pending credentials, and the first authenticated call
   is what settles which policy each one actually needs.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ShippingMode } from "@/lib/shipping/types";

export type CodePolicy = "canonical" | "ocean_trade";

export const PROVIDER_CODE_POLICY: Record<string, CodePolicy> = {
  /* Its lane URLs and examples are written as cnsha/egaly — UNVERIFIED against
     an authenticated response, because there is no account yet. */
  awice: "ocean_trade",
  /* The public calculator was called successfully with CNSHA on 15 Sep 2026,
     before the IP went into cool-off. One observation, not a contract. */
  freightos_public: "ocean_trade",
  /* Reads Koleex's own records, which store canonical codes. */
  koleex_landed_cost: "canonical",
};

/* The trade spellings, cached per process. Small (2 rows today) and static
   between reference rebuilds. */
let tradeCache: { at: number; map: Map<string, string> } | null = null;
const TTL_MS = 60 * 60_000;

async function tradeSpellings(): Promise<Map<string, string>> {
  if (tradeCache && Date.now() - tradeCache.at < TTL_MS) return tradeCache.map;
  const map = new Map<string, string>();
  const { data, error } = await supabaseServer
    .from("shipping_port_aliases")
    .select("raw, shipping_ports!inner(locode)")
    .eq("kind", "trade_code");
  if (!error) {
    for (const row of (data ?? []) as unknown as { raw: string; shipping_ports: { locode: string | null } }[]) {
      const canonical = row.shipping_ports?.locode?.toUpperCase();
      if (canonical && row.raw) map.set(canonical, row.raw.toUpperCase());
    }
    tradeCache = { at: Date.now(), map };
  }
  return map;
}

/**
 * The code to put in THIS provider's request for THIS endpoint.
 *
 * Returns the canonical code unless the provider's policy says otherwise, and
 * never touches an IATA code — the trade-spelling habit is an ocean one, and
 * an airport's identifier has no alternative spelling to apply.
 */
export async function providerCodeFor(
  providerId: string,
  canonicalCode: string,
  system: "unlocode" | "iata",
  mode: ShippingMode,
): Promise<string> {
  const policy = PROVIDER_CODE_POLICY[providerId] ?? "canonical";
  if (policy !== "ocean_trade") return canonicalCode;
  if (system !== "unlocode" || mode === "air") return canonicalCode;
  const map = await tradeSpellings();
  return map.get(canonicalCode.toUpperCase()) ?? canonicalCode;
}

/** Both ends at once, so an adapter makes one lookup per search. */
export async function providerCodes(
  providerId: string,
  ends: { code: string; system: "unlocode" | "iata" }[],
  mode: ShippingMode,
): Promise<string[]> {
  return Promise.all(ends.map((e) => providerCodeFor(providerId, e.code, e.system, mode)));
}
