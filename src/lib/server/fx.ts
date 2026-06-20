import "server-only";

/* ---------------------------------------------------------------------------
   fx — live CNY-per-USD exchange rate fetcher.

   Used by:
     · POST /api/commercial-policy/fx/refresh   (manual "Update FX" button)
     · GET  /api/cron/fx-refresh                (daily Vercel cron)

   Two free, no-key providers with automatic fallback. Base currency is
   USD, so `rates.CNY` is exactly "how many CNY per 1 USD" — i.e. the
   `fx_cny_per_usd` value the Commercial Policy stores. A sanity-range
   guard rejects anything wildly off (bad payload, provider glitch) so a
   garbage rate can never land in the policy.
   --------------------------------------------------------------------------- */

export interface FxResult {
  rate: number;
  source: string;
  fetchedAt: string;
}

/* CNY/USD has lived in ~6–8 for two decades. A 4–12 band leaves head-room
   for real moves while still catching obviously-broken responses. */
const SANE_MIN = 4;
const SANE_MAX = 12;

/** Fetch with a hard timeout so a hanging provider can't stall the cron. */
async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fromOpenErApi(): Promise<number | null> {
  const json = (await fetchJson("https://open.er-api.com/v6/latest/USD")) as { rates?: { CNY?: number } } | null;
  const r = Number(json?.rates?.CNY);
  return Number.isFinite(r) ? r : null;
}

async function fromFrankfurter(): Promise<number | null> {
  const json = (await fetchJson("https://api.frankfurter.app/latest?from=USD&to=CNY")) as { rates?: { CNY?: number } } | null;
  const r = Number(json?.rates?.CNY);
  return Number.isFinite(r) ? r : null;
}

/** Fetch the current CNY-per-USD rate. Throws if no provider responds or
 *  the value is outside the sane range — callers should surface that and
 *  leave the stored rate untouched. */
export async function fetchCnyPerUsd(): Promise<FxResult> {
  let rate = await fromOpenErApi();
  let source = "open.er-api.com";
  if (rate === null) {
    rate = await fromFrankfurter();
    source = "frankfurter.app (ECB)";
  }
  if (rate === null) {
    throw new Error("Could not reach any FX provider");
  }
  if (rate < SANE_MIN || rate > SANE_MAX) {
    throw new Error(`FX rate ${rate} is outside the sane range ${SANE_MIN}–${SANE_MAX}`);
  }
  return {
    rate: Math.round(rate * 10000) / 10000, // store 4 dp, matching the UI
    source,
    fetchedAt: new Date().toISOString(),
  };
}
