import "server-only";

/* ---------------------------------------------------------------------------
   Shipping — the rate engine.

   One search in, four kinds of answer out, kept apart the whole way:

     stored quotes ──┐
     providers ──────┼──► normalise ──► score confidence ──► group ──► UI
     Koleex history ─┘                                    (comparability.ts)

   ── Why the cache is not optional ─────────────────────────────────────────
   Freight rates move weekly, not per-keystroke, and the free sources punish
   repetition: the Freightos public calculator IP-blocks after roughly eight
   calls, and Awice bills per credit. So a lane is fetched at most once per TTL
   per tenant, and every fetch is written to shipping_rate_quotes — which makes
   the cache and the price history the same rows. Nothing is fetched twice to
   redraw a screen.

   ── What this engine will never do ────────────────────────────────────────
   · invent a rate, or fill a gap with a neighbouring lane
   · average across rate kinds, or present a market band as a price
   · call a source a rate is not from
   A lane with no data returns an empty group and the UI says so.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { compare, type ComparisonGroup } from "@/lib/shipping/comparability";
import { withConfidence } from "@/lib/shipping/confidence";
import type {
  FreightRate, ProviderResult, RateKind, RateQuery, RateSearchResult, Surcharge,
} from "@/lib/shipping/types";
import { tradeCodeMap } from "./port-resolver";
import { enabledProviders, providerStatuses, type ProviderStatus } from "./registry";

/* How long a freshly fetched rate stays servable without asking again.
   Ocean moves on weekly GRIs; air moves faster. Neither justifies a live call
   per page view. */
export const CACHE_TTL_MS: Record<RateQuery["mode"], number> = {
  ocean_fcl: 12 * 3600_000,
  ocean_lcl: 12 * 3600_000,
  air: 6 * 3600_000,
};

export interface SearchOptions {
  tenantId: string;
  accountId?: string;
  /** Skip the cache and re-ask every provider. The refresh button. */
  force?: boolean;
  signal?: AbortSignal;
}

export interface EngineResult extends RateSearchResult {
  groups: ComparisonGroup[];
  refusals: { a: string; b: string; reasons: string[] }[];
  providers: ProviderStatus[];
  /** True when nothing was fetched because the cache was warm. */
  servedFromCache: boolean;
  /** Set when every source came back empty, so the UI can say which. */
  unavailable?: { reason: "no_sources" | "no_rates"; detail?: string };
}

export async function searchRates(query: RateQuery, opts: SearchOptions): Promise<EngineResult> {
  const searchedAt = new Date().toISOString();

  /* Stored rows first: forwarder quotes a colleague typed in, and any provider
     rate still inside its TTL. These cost nothing and are always included. */
  const stored = await readStored(query, opts.tenantId);
  const fresh = stored.filter((r) => !r.expiresAt || Date.parse(r.expiresAt) > Date.now());
  const cacheHasProviderRate = fresh.some((r) => r.kind === "provider" || r.kind === "market");

  let results: ProviderResult[] = [];
  let servedFromCache = false;

  if (cacheHasProviderRate && !opts.force) {
    servedFromCache = true;
  } else {
    const providers = enabledProviders().filter((p) => p.capabilities.modes.includes(query.mode));
    if (providers.length) {
      const trade = await tradeCodeMap([query.originCode, query.destinationCode]);
      const ctx = {
        tenantId: opts.tenantId,
        tradeCodeFor: (code: string) => trade.get(code.toUpperCase()) ?? null,
        signal: opts.signal,
      };
      /* In parallel: one slow provider must not hold up the others, and a
         rejected promise must not lose the answers that did arrive. */
      const settled = await Promise.allSettled(providers.map((p) => p.getRates(query, ctx)));
      results = settled.map((s, i) =>
        s.status === "fulfilled"
          ? s.value
          : { providerId: providers[i].id, rates: [], error: { kind: "upstream" as const, detail: String(s.reason) } },
      );
    }
  }

  const fetched = results.flatMap((r) => r.rates);
  if (fetched.length) await persist(fetched, query, opts.tenantId, opts.accountId);

  /* Stored provider/market rows are dropped when we just refetched them, so a
     stale copy never sits beside its own replacement. Koleex history and
     forwarder quotes always survive — they are not what the fetch replaced. */
  const keptStored = fetched.length
    ? fresh.filter((r) => r.kind === "koleex" || r.kind === "forwarder")
    : fresh;

  const all = dedupe([...fetched, ...keptStored]);
  for (const r of all) withConfidence(r, query, all);

  const byKind: Record<RateKind, FreightRate[]> = { provider: [], market: [], koleex: [], forwarder: [] };
  for (const r of all) byKind[r.kind].push(r);
  for (const list of Object.values(byKind)) list.sort(cheapestFirst);

  const { groups, refusals } = compare(all);
  const providers = providerStatuses();

  let unavailable: EngineResult["unavailable"];
  if (!all.length) {
    const anyEnabled = providers.some((p) => p.enabled && p.modes.includes(query.mode));
    unavailable = anyEnabled
      ? { reason: "no_rates" }
      : { reason: "no_sources", detail: "No rate source is configured for this shipping method." };
  }

  return { query, results, byKind, groups, refusals, providers, servedFromCache, searchedAt, unavailable };
}

/* ── stored rows ─────────────────────────────────────────────────────────── */

async function readStored(query: RateQuery, tenantId: string): Promise<FreightRate[]> {
  const { data, error } = await supabaseServer
    .from("shipping_rate_quotes")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("mode", query.mode)
    .eq("origin_code", query.originCode)
    .eq("destination_code", query.destinationCode)
    .order("retrieved_at", { ascending: false })
    .limit(120);
  if (error || !data) return [];

  /* Only the newest row per (kind, source, equipment, weight break) — the
     table is append-only history, and a search shows the current picture. */
  const seen = new Set<string>();
  const out: FreightRate[] = [];
  for (const row of data as StoredRow[]) {
    const k = `${row.rate_kind}|${row.source_id}|${row.equipment ?? "-"}|${row.weight_break ?? "-"}|${row.scope}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(fromRow(row));
  }
  return out;
}

interface StoredRow {
  id: string; rate_kind: RateKind; source_id: string; source_label: string | null;
  source_cadence: FreightRate["sourceCadence"] | null; mode: RateQuery["mode"];
  origin_code: string; destination_code: string;
  scope: FreightRate["scope"];
  includes_origin_charges: boolean | null; includes_destination_charges: boolean | null;
  includes_customs: boolean | null; incoterm: string | null;
  equipment: FreightRate["equipment"] | null; unit: FreightRate["unit"];
  weight_break: string | null; min_charge: number | null;
  amount: number | null; amount_low: number | null; amount_high: number | null;
  currency: string; surcharges: Surcharge[] | null; total_estimate: number | null;
  retrieved_at: string; expires_at: string | null; valid_from: string | null; valid_until: string | null;
  transit_days_min: number | null; transit_days_max: number | null;
  carrier: string | null; vessel: string | null; voyage: string | null;
  etd: string | null; eta: string | null;
  confidence: FreightRate["confidence"] | null; confidence_score: number | null;
  is_estimate: boolean; notes: string | null;
}

const n = (v: number | null): number | undefined => (v == null ? undefined : Number(v));

function fromRow(r: StoredRow): FreightRate {
  return {
    id: r.id,
    kind: r.rate_kind,
    sourceId: r.source_id,
    sourceLabel: r.source_label ?? r.source_id,
    sourceCadence: r.source_cadence ?? "manual",
    mode: r.mode,
    originCode: r.origin_code,
    destinationCode: r.destination_code,
    scope: r.scope,
    includesOriginCharges: r.includes_origin_charges ?? undefined,
    includesDestinationCharges: r.includes_destination_charges ?? undefined,
    includesCustoms: r.includes_customs ?? undefined,
    incoterm: r.incoterm ?? undefined,
    equipment: r.equipment ?? undefined,
    unit: r.unit,
    weightBreak: r.weight_break ?? undefined,
    minCharge: n(r.min_charge),
    amount: r.amount == null ? null : Number(r.amount),
    amountLow: n(r.amount_low),
    amountHigh: n(r.amount_high),
    currency: r.currency,
    surcharges: Array.isArray(r.surcharges) ? r.surcharges : [],
    totalEstimate: n(r.total_estimate),
    retrievedAt: r.retrieved_at,
    expiresAt: r.expires_at ?? undefined,
    validFrom: r.valid_from ?? undefined,
    validUntil: r.valid_until ?? undefined,
    transitDaysMin: n(r.transit_days_min),
    transitDaysMax: n(r.transit_days_max),
    carrier: r.carrier ?? undefined,
    vessel: r.vessel ?? undefined,
    voyage: r.voyage ?? undefined,
    etd: r.etd ?? undefined,
    eta: r.eta ?? undefined,
    confidence: r.confidence ?? undefined,
    confidenceScore: n(r.confidence_score),
    isEstimate: r.is_estimate,
    notes: r.notes ?? undefined,
  };
}

/**
 * Writes what the providers returned. Append-only: the history is a by-product
 * of using the app, which is the only way it ever gets populated.
 *
 * Koleex historical rates are NOT written back — they are derived from
 * landed-cost simulations on every read, and copying them here would create a
 * second source of truth that drifts the moment a simulation is corrected.
 */
async function persist(rates: FreightRate[], query: RateQuery, tenantId: string, accountId?: string) {
  const rows = rates
    .filter((r) => r.kind === "provider" || r.kind === "market")
    .map((r) => ({
      tenant_id: tenantId,
      rate_kind: r.kind,
      source_id: r.sourceId,
      source_label: r.sourceLabel,
      source_cadence: r.sourceCadence,
      mode: r.mode,
      origin_code: r.originCode,
      destination_code: r.destinationCode,
      scope: r.scope,
      includes_origin_charges: r.includesOriginCharges ?? null,
      includes_destination_charges: r.includesDestinationCharges ?? null,
      includes_customs: r.includesCustoms ?? null,
      incoterm: r.incoterm ?? null,
      equipment: r.equipment ?? null,
      unit: r.unit,
      weight_break: r.weightBreak ?? null,
      min_charge: r.minCharge ?? null,
      amount: r.amount,
      amount_low: r.amountLow ?? null,
      amount_high: r.amountHigh ?? null,
      currency: r.currency,
      surcharges: r.surcharges,
      total_estimate: r.totalEstimate ?? null,
      retrieved_at: r.retrievedAt,
      expires_at: new Date(Date.now() + CACHE_TTL_MS[query.mode]).toISOString(),
      valid_from: r.validFrom ?? null,
      valid_until: r.validUntil ?? null,
      transit_days_min: r.transitDaysMin ?? null,
      transit_days_max: r.transitDaysMax ?? null,
      carrier: r.carrier ?? null,
      vessel: r.vessel ?? null,
      voyage: r.voyage ?? null,
      etd: r.etd ?? null,
      eta: r.eta ?? null,
      confidence: r.confidence ?? null,
      confidence_score: r.confidenceScore ?? null,
      is_estimate: r.isEstimate,
      notes: r.notes ?? null,
      created_by: accountId ?? null,
    }));
  if (!rows.length) return;
  /* A failed cache write must never fail a search the user is watching. */
  const { error } = await supabaseServer.from("shipping_rate_quotes").insert(rows);
  if (error) console.warn("[shipping.engine] cache write failed:", error.message);
}

/** Same source, same product, same money — keep the newest. */
function dedupe(rates: FreightRate[]): FreightRate[] {
  const seen = new Map<string, FreightRate>();
  for (const r of rates) {
    const k = [r.kind, r.sourceId, r.mode, r.originCode, r.destinationCode,
               r.equipment ?? "-", r.weightBreak ?? "-", r.scope, r.currency].join("|");
    const prev = seen.get(k);
    if (!prev || Date.parse(r.retrievedAt) > Date.parse(prev.retrievedAt)) seen.set(k, r);
  }
  return [...seen.values()];
}

/** Rates with no number sort last — an absence is not a cheap option. */
function cheapestFirst(a: FreightRate, b: FreightRate): number {
  const av = a.amount ?? a.amountLow ?? Number.POSITIVE_INFINITY;
  const bv = b.amount ?? b.amountLow ?? Number.POSITIVE_INFINITY;
  if (av !== bv) return av - bv;
  return Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt);
}

/** Lane history for the trend strip. Returns [] rather than a misleading line. */
export async function rateHistory(opts: {
  tenantId: string; mode: RateQuery["mode"];
  originCode: string; destinationCode: string;
  equipment?: string; days?: number;
}): Promise<{ at: string; amount: number; currency: string; kind: RateKind; sourceId: string }[]> {
  const since = new Date(Date.now() - (opts.days ?? 90) * 86_400_000).toISOString();
  let q = supabaseServer.from("shipping_rate_quotes")
    .select("retrieved_at, amount, currency, rate_kind, source_id")
    .eq("tenant_id", opts.tenantId).eq("mode", opts.mode)
    .eq("origin_code", opts.originCode).eq("destination_code", opts.destinationCode)
    .not("amount", "is", null).gte("retrieved_at", since)
    .order("retrieved_at", { ascending: true }).limit(500);
  if (opts.equipment) q = q.eq("equipment", opts.equipment);
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as { retrieved_at: string; amount: number; currency: string; rate_kind: RateKind; source_id: string }[])
    .map((r) => ({ at: r.retrieved_at, amount: Number(r.amount), currency: r.currency, kind: r.rate_kind, sourceId: r.source_id }));
}
