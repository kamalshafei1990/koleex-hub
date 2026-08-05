import "server-only";

/* ---------------------------------------------------------------------------
   fx-live — a real CNY→USD rate for the places that show a factory cost.

   Costs are entered in CNY because that is what the factory quotes, and the
   pricing engine works from CNY. But most people reading a cost think in
   dollars, and converting in your head at a rate you half-remember is how a
   quotation goes out wrong.

   THREE SOURCES, in order of authority:

     1. The tenant's OWN configured rate in `finance_fx_rates`. If Finance has
        decided on a rate, nothing here may quietly disagree with it — the
        books and the product cards must show the same number.
     2. A live daily reference feed (Frankfurter, ECB data, no key required).
     3. A hardcoded floor, used only when both are unreachable, and always
        labelled as such so the number is never mistaken for today's.

   Cached in module memory for six hours. These are daily reference rates —
   fetching one per page view would add a cross-border round trip to a screen
   whose whole job is to be fast, for a number that changes once a day.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

export interface FxQuote {
  /** How many USD one CNY buys. */
  rate: number;
  source: "tenant" | "live" | "fallback";
  /** ISO date the rate applies to; null when we fell back. */
  asOf: string | null;
}

/* Last resort only. Deliberately NOT presented as current anywhere — the
   `source` field is what callers key their wording off. */
const FALLBACK_CNY_USD = 0.14;

const TTL_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 4_000;

let cache: { at: number; quote: FxQuote } | null = null;
/* Concurrent renders must share one upstream call, not race each other. */
let inFlight: Promise<FxQuote> | null = null;

async function fetchLive(): Promise<FxQuote | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=CNY&to=USD", {
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { date?: string; rates?: { USD?: number } };
    const rate = json.rates?.USD;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null;
    return { rate, source: "live", asOf: typeof json.date === "string" ? json.date : null };
  } catch {
    /* Offline, blocked, or slow — the caller falls through to the floor. */
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The tenant's own rate, if Finance has configured one. Stored as USD→CNY
 *  (how many CNY per dollar), so it is inverted here. */
async function fetchTenantRate(tenantId: string): Promise<FxQuote | null> {
  const { data } = await supabaseServer
    .from("finance_fx_rates")
    .select("rate, effective_date")
    .eq("tenant_id", tenantId)
    .eq("from_currency", "USD")
    .eq("to_currency", "CNY")
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const perUsd = Number(data?.rate);
  /* A configured rate still has to be sane. The table currently contains a
     seeded 99.0 on a demo tenant; a bad row must not silently price the
     catalogue. Anything outside a plausible band is ignored in favour of the
     live feed. */
  if (!Number.isFinite(perUsd) || perUsd < 3 || perUsd > 15) return null;
  return {
    rate: 1 / perUsd,
    source: "tenant",
    asOf: (data?.effective_date as string | undefined) ?? null,
  };
}

export async function getCnyToUsd(tenantId: string | null): Promise<FxQuote> {
  if (tenantId) {
    const tenant = await fetchTenantRate(tenantId);
    /* Not cached: it is one indexed row, and an operator who edits the rate in
       Finance should see it on the next page load, not in six hours. */
    if (tenant) return tenant;
  }

  if (cache && Date.now() - cache.at < TTL_MS) return cache.quote;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const live = await fetchLive();
    const quote: FxQuote =
      live ?? { rate: FALLBACK_CNY_USD, source: "fallback", asOf: null };
    /* Only a real answer earns the cache; a failure must retry on the next
       request rather than pin the fallback in place for six hours. */
    if (live) cache = { at: Date.now(), quote };
    return quote;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
