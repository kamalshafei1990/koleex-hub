import "server-only";

/* ---------------------------------------------------------------------------
   Provider — Freightos public shipping calculator.

   ⚠️ WHAT THIS IS, AND WHAT IT IS NOT
   This endpoint returns a MARKET BAND — a low and a high figure and a transit
   window for a lane. It is not a quotation, it cannot be booked, it names no
   carrier and it states no validity. So every rate it produces is emitted with
   kind = "market", `amount` left NULL and the band in amountLow/amountHigh.
   The confidence model caps market rates at 55, and the UI labels them
   "Market Estimate". None of that is decoration: an operator who pastes the
   low end of a band into a customer quotation has quoted a price nobody
   offered.

   ⚠️ IT RATE-LIMITS HARD — DO NOT CALL IT PER KEYSTROKE
   Documented at 100 calls/IP/hour, but measured on 15 Sep 2026: roughly eight
   calls within a few minutes returned Cloudflare 1015 / HTTP 429 and the block
   was still in place 25 minutes later. It is therefore behind the engine's
   cache and a per-tenant budget, and a 429 disables it for a cool-off window
   rather than retrying.

   ⚠️ THE PARSER HAS NOT SEEN A LIVE RESPONSE IN THIS SESSION
   The IP was already in cool-off when this adapter was written, so the shape
   below is read TOLERANTLY: it walks the payload for the first object that
   carries a recognisable price band, rather than assuming a path. If it finds
   nothing it returns an `upstream` error — it never guesses a number. First
   live call must be verified before this provider is trusted; until then it
   stays off unless SHIPPING_FREIGHTOS_PUBLIC=on.

   Attribution: the Freightos MSA requires that data taken from Freightos is
   acknowledged with a visible link back. FREIGHTOS_ATTRIBUTION below is
   rendered by the UI beside any rate this adapter produced. Do not remove it.
   --------------------------------------------------------------------------- */

import type { FreightRate, ProviderResult, RateQuery } from "@/lib/shipping/types";
import { type FreightRateProvider, type ProviderContext, providerDeadline, providerError, verifiedReason, verifiedSwitch } from "./types";
import { providerCodes } from "./trade-codes";

const ENDPOINT = "https://ship.freightos.com/api/shippingCalculator";

export const FREIGHTOS_ATTRIBUTION = {
  label: "Freightos",
  href: "https://www.freightos.com",
  note: "Market range supplied by Freightos",
} as const;

/** Their loadtype vocabulary. Ocean LCL and air are priced by volume/weight. */
const LOAD_TYPE: Record<string, string> = {
  "20GP": "container20",
  "40GP": "container40",
  "40HQ": "container40HC",
};

/* A 429 here costs us the whole hour, so one is remembered process-wide and
   the adapter stands down instead of walking into the same wall repeatedly. */
let coolOffUntil = 0;
const COOL_OFF_MS = 30 * 60_000;

export const freightosPublicProvider: FreightRateProvider = {
  id: "freightos_public",
  label: "Freightos market range",
  kind: "market",
  capabilities: {
    modes: ["ocean_fcl", "ocean_lcl", "air"],
    cadence: "realtime",
    itemisesSurcharges: false,
    statesValidity: false,
    requires: "No credentials. Public calculator, hard IP rate limit, returns a range not a quotation. Needs SHIPPING_FREIGHTOS_PUBLIC=on and SHIPPING_FREIGHTOS_PUBLIC_VERIFIED=yes once `npm run shipping:verify-provider -- freightos_public` has parsed a real response.",
  },

  isEnabled() {
    /* Off by default until a live response has been verified — see header. */
    return (process.env.SHIPPING_FREIGHTOS_PUBLIC ?? "").toLowerCase() === "on"
      && verifiedSwitch("freightos_public")
      && Date.now() >= coolOffUntil;
  },
  disabledReason() {
    if ((process.env.SHIPPING_FREIGHTOS_PUBLIC ?? "").toLowerCase() !== "on") {
      return "Disabled. Set SHIPPING_FREIGHTOS_PUBLIC=on after verifying one live response.";
    }
    if (!verifiedSwitch("freightos_public")) return verifiedReason("freightos_public");
    if (Date.now() < coolOffUntil) {
      return `Rate limited by Freightos. Retrying after ${new Date(coolOffUntil).toISOString()}.`;
    }
    return undefined;
  },

  async getRates(query: RateQuery, ctx: ProviderContext): Promise<ProviderResult> {
    const started = Date.now();
    if (Date.now() < coolOffUntil) return providerError(this.id, "quota", "in cool-off", 0);

    /* Freightos speaks the trade spelling (CNSHA), not the register's CNSGH.
       Asked for HERE, by this adapter, for this request — the canonical code
       is untouched everywhere else. See providers/trade-codes.ts. */
    const [origin, destination] = await providerCodes(
      this.id,
      [
        { code: query.originCode, system: query.originCodeSystem },
        { code: query.destinationCode, system: query.destinationCodeSystem },
      ],
      query.mode,
    );

    const wanted = query.mode === "ocean_fcl"
      ? (query.equipment?.length ? query.equipment : (["20GP", "40GP", "40HQ"] as const))
      : ([null] as const);

    const rates: FreightRate[] = [];
    for (const eq of wanted) {
      const params = new URLSearchParams({ origin, destination, quantity: "1" });
      if (eq) params.set("loadtype", LOAD_TYPE[eq]);
      else if (query.mode === "ocean_lcl") { params.set("loadtype", "looseCargo"); params.set("volume", String(query.cbm ?? 1)); }
      else { params.set("loadtype", "looseCargo"); params.set("isAir", "true"); }
      if (query.grossKg) params.set("weight", String(query.grossKg));

      let res: Response;
      try {
        res = await fetch(`${ENDPOINT}?${params}`, {
          headers: { Accept: "application/json", "User-Agent": "KoleexHub/1.0 (+https://koleex.com)" },
          signal: providerDeadline(ctx.signal),
          cache: "no-store",
        });
      } catch (e) {
        return providerError(this.id, "timeout", e instanceof Error ? e.message : String(e), Date.now() - started);
      }

      if (res.status === 429 || res.status === 403) {
        coolOffUntil = Date.now() + COOL_OFF_MS;
        return providerError(this.id, "quota", `HTTP ${res.status}`, Date.now() - started);
      }
      if (!res.ok) return providerError(this.id, "upstream", `HTTP ${res.status}`, Date.now() - started);

      let json: unknown;
      try { json = await res.json(); }
      catch { return providerError(this.id, "upstream", "response was not JSON", Date.now() - started); }

      const band = findBand(json);
      if (!band) continue;                     // no band for this equipment — say nothing

      rates.push({
        kind: "market",
        sourceId: this.id,
        sourceLabel: this.label,
        sourceCadence: "realtime",
        mode: query.mode,
        /* The rate is filed under the CANONICAL code, never the spelling we
           happened to send. A provider alias is request-scoped. */
        originCode: query.originCode,
        destinationCode: query.destinationCode,
        originCodeSystem: query.originCodeSystem,
        destinationCodeSystem: query.destinationCodeSystem,
        scope: query.mode === "air" ? "airport_to_airport" : "port_to_port",
        equipment: eq ?? undefined,
        unit: query.mode === "ocean_fcl" ? "container" : query.mode === "ocean_lcl" ? "cbm" : "kg",
        /* amount stays null ON PURPOSE — a band is not a price. */
        amount: null,
        amountLow: band.low,
        amountHigh: band.high,
        currency: band.currency,
        surcharges: [],
        retrievedAt: new Date().toISOString(),
        transitDaysMin: band.transitMin,
        transitDaysMax: band.transitMax,
        isEstimate: true,
        notes: FREIGHTOS_ATTRIBUTION.note,
      });
    }

    if (!rates.length) {
      return providerError(this.id, "no_route", "no band returned for this lane", Date.now() - started);
    }
    return { providerId: this.id, rates, elapsedMs: Date.now() - started };
  },
};

/* ── tolerant parsing ───────────────────────────────────────────────────────
   Walks the payload for the first object carrying a low/high pair plus a
   currency. Deliberately shape-agnostic: the live response was unavailable
   when this was written, and a wrong hard-coded path would fail silently
   rather than loudly. Returns null when nothing recognisable is present —
   which the caller turns into "no rate", never into a number. */
export interface Band { low: number; high: number; currency: string; transitMin?: number; transitMax?: number }

const LOW_KEYS = ["min", "low", "minPrice", "priceMin", "lowerBound", "from"];
const HIGH_KEYS = ["max", "high", "maxPrice", "priceMax", "upperBound", "to"];
const CUR_KEYS = ["currency", "currencyCode", "curr"];
const TMIN_KEYS = ["minTransitTime", "transitMin", "minDays", "minTime"];
const TMAX_KEYS = ["maxTransitTime", "transitMax", "maxDays", "maxTime"];

export function findBand(payload: unknown): Band | null {
  const seen = new Set<unknown>();
  const stack: unknown[] = [payload];
  while (stack.length) {
    const node = stack.shift();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) { stack.push(...node); continue; }

    const o = node as Record<string, unknown>;
    const low = firstNumber(o, LOW_KEYS);
    const high = firstNumber(o, HIGH_KEYS);
    const currency = firstString(o, CUR_KEYS);
    if (low != null && high != null && high >= low && high > 0) {
      return {
        low, high,
        currency: (currency ?? "USD").toUpperCase(),
        transitMin: firstNumber(o, TMIN_KEYS) ?? undefined,
        transitMax: firstNumber(o, TMAX_KEYS) ?? undefined,
      };
    }
    stack.push(...Object.values(o));
  }
  return null;
}

function firstNumber(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
    if (v && typeof v === "object") {
      const inner = (v as Record<string, unknown>).amount ?? (v as Record<string, unknown>).value;
      if (typeof inner === "number" && Number.isFinite(inner)) return inner;
    }
  }
  return null;
}

function firstString(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object") {
      const inner = (v as Record<string, unknown>).currency;
      if (typeof inner === "string" && inner.trim()) return inner.trim();
    }
  }
  return null;
}
