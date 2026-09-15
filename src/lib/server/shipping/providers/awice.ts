import "server-only";

/* ---------------------------------------------------------------------------
   Provider — Awice / 5688.cn open platform.  ⛔ DISABLED. CREDENTIALS NEEDED.

   The only self-serve, documented, HMAC-signed freight-rate API found in the
   Chinese market (5688.com.cn and awice.com are the same company; the separate
   awice.com host is dead). It covers all three modes out of China with
   per-carrier prices, itemised local charges and a stated validity — which is
   everything this module needs and nothing else free supplies.

   ── WHAT IS NEEDED BEFORE THIS CAN BE TURNED ON ───────────────────────────
   1. An account at https://www.5688.cn/open — registration needs a mobile
      number. Trial is 100 credits, ¥0, 30 days, no identity verification.
      UNVERIFIED whether a non-Chinese mobile is accepted.
   2. SHIPPING_AWICE_APP_KEY and SHIPPING_AWICE_APP_SECRET in the environment,
      plus the server's egress IP added to their allow-list.
   3. A READ OF THEIR API TERMS. Their privacy/legal links are client-rendered
      and could not be checked, so whether normalised rates may be stored and
      shown to customers is currently unknown. Do not enable before someone
      has read them.

   ── AND ONE THING THE UI MUST NOT GET WRONG ───────────────────────────────
   Their marketing says "real-time quotes from 53 carriers". Every page of
   their documentation says **Data freshness: Daily**. So cadence is "daily"
   and the badge reads "Provider Rate — Updated Daily", never "Live".

   ⚠️ THE REQUEST AND RESPONSE SHAPES BELOW WERE TRANSCRIBED FROM THEIR PUBLIC
   DOCUMENTATION, NOT FROM A LIVE CALL. No credential existed while this was
   written. Treat the field names as a first draft: the first authenticated
   response must be captured and this parser checked against it before any
   number it produces is shown to an operator. Everything is read defensively
   and a field it cannot find becomes undefined, never a default number.
   --------------------------------------------------------------------------- */

import { createHash, createHmac, randomUUID } from "node:crypto";
import type { ContainerEquipment, FreightRate, ProviderResult, RateQuery, Surcharge } from "@/lib/shipping/types";
import { type FreightRateProvider, type ProviderContext, providerDeadline, providerError } from "./types";
import { providerCodes } from "./trade-codes";

const BASE = "https://www.5688.cn";
const PATHS = {
  ocean_fcl: "/api/openapi/v1/freight/fcl/search",
  ocean_lcl: "/api/openapi/v1/freight/lcl/search",
  air: "/api/openapi/v1/freight/air/search",
} as const;

const key = () => (process.env.SHIPPING_AWICE_APP_KEY ?? "").trim();
const secret = () => (process.env.SHIPPING_AWICE_APP_SECRET ?? "").trim();
/** Second switch: credentials alone are not consent. Terms must be read first. */
const termsAccepted = () => (process.env.SHIPPING_AWICE_TERMS_REVIEWED ?? "").toLowerCase() === "yes";

export const awiceProvider: FreightRateProvider = {
  id: "awice",
  label: "Provider rate",
  kind: "provider",
  capabilities: {
    modes: ["ocean_fcl", "ocean_lcl", "air"],
    cadence: "daily",
    itemisesSurcharges: true,
    statesValidity: true,
    requires:
      "Account at 5688.cn/open (mobile number, 100 free credits), SHIPPING_AWICE_APP_KEY + _APP_SECRET, server IP allow-listed, and SHIPPING_AWICE_TERMS_REVIEWED=yes once the API terms have been read.",
  },

  isEnabled: () => Boolean(key() && secret() && termsAccepted()),

  disabledReason() {
    if (!key() || !secret()) return "No API credentials. Register at 5688.cn/open and set SHIPPING_AWICE_APP_KEY and SHIPPING_AWICE_APP_SECRET.";
    if (!termsAccepted()) return "Credentials present, but the provider's API terms have not been reviewed. Set SHIPPING_AWICE_TERMS_REVIEWED=yes to confirm.";
    return undefined;
  },

  async getRates(query: RateQuery, ctx: ProviderContext): Promise<ProviderResult> {
    const started = Date.now();
    if (!this.isEnabled()) return providerError(this.id, "unconfigured", this.disabledReason?.(), 0);

    const path = PATHS[query.mode];
    /* They accept the trade spelling (CNSHA), Chinese, or English names.
       Resolved HERE, for this request only — the canonical UN/LOCODE stays
       canonical for the cache, the history and every other provider. */
    const [origin, destination] = await providerCodes(
      this.id,
      [
        { code: query.originCode, system: query.originCodeSystem },
        { code: query.destinationCode, system: query.destinationCodeSystem },
      ],
      query.mode,
    );

    const body: Record<string, unknown> = { pol: origin, pod: destination };
    if (query.departOn) body.etd = query.departOn;
    if (query.mode === "ocean_fcl") body.containers = query.equipment ?? ["20GP", "40GP", "40HQ"];
    if (query.mode === "ocean_lcl") { body.volume = query.cbm; body.weight = query.grossKg; }
    if (query.mode === "air") body.weight = query.grossKg;

    const payload = JSON.stringify(body);
    const ts = String(Date.now());
    const nonce = randomUUID();
    const digest = createHash("md5").update(payload).digest("hex");
    const signature = createHmac("sha256", secret())
      .update(`POST\n${path}\n${ts}\n${nonce}\n${digest}`)
      .digest("hex");

    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Awice-AppKey": key(),
          "X-Awice-Timestamp": ts,
          "X-Awice-Nonce": nonce,
          "X-Awice-Signature": signature,
        },
        body: payload,
        signal: providerDeadline(ctx.signal),
        cache: "no-store",
      });
    } catch (e) {
      return providerError(this.id, "timeout", e instanceof Error ? e.message : String(e), Date.now() - started);
    }

    if (res.status === 401 || res.status === 403) return providerError(this.id, "unauthorised", `HTTP ${res.status}`, Date.now() - started);
    if (res.status === 429) return providerError(this.id, "quota", "rate limited", Date.now() - started);
    if (!res.ok) return providerError(this.id, "upstream", `HTTP ${res.status}`, Date.now() - started);

    let json: { code?: number; msg?: string; data?: unknown };
    try { json = await res.json() as typeof json; }
    catch { return providerError(this.id, "upstream", "response was not JSON", Date.now() - started); }

    /* Their envelope reports failures with a non-zero `code` and HTTP 200. */
    if (typeof json.code === "number" && json.code !== 0) {
      const quota = json.code === 3003 || /credit|quota|plan/i.test(json.msg ?? "");
      return providerError(this.id, quota ? "quota" : "upstream", `${json.code}: ${json.msg ?? ""}`, Date.now() - started);
    }

    const rows = asArray(json.data);
    const rates: FreightRate[] = [];
    const now = new Date().toISOString();

    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const currency = str(r.currency)?.toUpperCase() ?? "USD";
      const carrier = str(r.carrier) ?? str(r.carrier_name) ?? undefined;
      const validFrom = str(r.valid_from) ?? undefined;
      const validUntil = str(r.valid_to) ?? str(r.valid_until) ?? undefined;
      const transit = num(r.transit) ?? num(r.transit_days);
      /* `is_real` distinguishes a real carrier schedule from their estimate. */
      const bookable = r.is_real === true;
      const surcharges = readLocalFees(r.local_fee ?? r.local_fees, currency);

      const base = {
        kind: "provider" as const,
        sourceId: awiceProvider.id,
        sourceLabel: awiceProvider.label,
        sourceCadence: "daily" as const,
        mode: query.mode,
        /* Filed under the CANONICAL code, never the spelling we sent. */
        originCode: query.originCode,
        destinationCode: query.destinationCode,
        originCodeSystem: query.originCodeSystem,
        destinationCodeSystem: query.destinationCodeSystem,
        scope: (query.mode === "air" ? "airport_to_airport" : "port_to_port") as FreightRate["scope"],
        includesOriginCharges: surcharges.length > 0 ? true : undefined,
        includesDestinationCharges: undefined,
        currency,
        surcharges,
        retrievedAt: now,
        validFrom, validUntil,
        transitDaysMin: transit ?? undefined,
        transitDaysMax: transit ?? undefined,
        carrier,
        vessel: str(r.vessel) ?? undefined,
        voyage: str(r.voyage) ?? undefined,
        etd: str(r.etd) ?? undefined,
        eta: str(r.eta) ?? undefined,
        isEstimate: !bookable,
      };

      if (query.mode === "ocean_fcl") {
        const perBox: [ContainerEquipment, string[]][] = [
          ["20GP", ["container_20gp", "price_20gp", "gp20"]],
          ["40GP", ["container_40gp", "price_40gp", "gp40"]],
          ["40HQ", ["container_40hq", "price_40hq", "hq40"]],
        ];
        for (const [equipment, keys] of perBox) {
          if (query.equipment?.length && !query.equipment.includes(equipment)) continue;
          const amount = firstNum(r, keys);
          if (amount == null) continue;
          rates.push({ ...base, equipment, unit: "container", amount,
            totalEstimate: amount + surcharges.reduce((t, s) => t + s.amount, 0) });
        }
      } else if (query.mode === "ocean_lcl") {
        const price = r.price as Record<string, unknown> | undefined;
        const amount = num(price?.value) ?? firstNum(r, ["price_per_cbm", "cbm_price"]);
        if (amount == null) continue;
        rates.push({
          ...base, unit: "cbm", amount,
          minCharge: firstNum(r, ["min_charge", "minimum", "min_price"]) ?? undefined,
          /* "CNY/W/M" means weight-or-measure: the greater of tonnes and m³.
             Recorded in notes so the screen can say so — an operator who
             multiplies by CBM alone under-quotes a heavy consignment. */
          notes: str(price?.unit) ? `Priced ${str(price?.unit)}${str(r.weight_ratio) ? ` · ratio ${str(r.weight_ratio)}` : ""}` : undefined,
        });
      } else {
        const grades = asArray(r.price_grades ?? r.grades);
        for (const g of grades) {
          const gr = g as Record<string, unknown>;
          const perKg = firstNum(gr, ["price_per_kg", "price", "rate"]);
          if (perKg == null) continue;
          const floor = firstNum(gr, ["min_weight", "weight_from", "from"]);
          rates.push({ ...base, unit: "kg", amount: perKg,
            weightBreak: floor == null || floor <= 0 ? "MIN" : `+${floor}`,
            minCharge: firstNum(r, ["min_charge", "minimum"]) ?? undefined });
        }
      }
    }

    if (!rates.length) return providerError(this.id, "no_route", "no rate for this lane", Date.now() - started);
    return { providerId: this.id, rates, elapsedMs: Date.now() - started };
  },
};

/* ── defensive readers ──────────────────────────────────────────────────── */
const asArray = (v: unknown): unknown[] =>
  Array.isArray(v) ? v
  : v && typeof v === "object"
    ? (Array.isArray((v as Record<string, unknown>).list) ? (v as { list: unknown[] }).list
      : Array.isArray((v as Record<string, unknown>).items) ? (v as { items: unknown[] }).items
      : [v])
    : [];

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v
  : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v)
  : null;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function firstNum(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) { const n = num(o[k]); if (n != null) return n; }
  return null;
}

function readLocalFees(v: unknown, fallbackCurrency: string): Surcharge[] {
  const out: Surcharge[] = [];
  for (const raw of asArray(v)) {
    const f = raw as Record<string, unknown>;
    const amount = firstNum(f, ["price", "amount", "value"]);
    if (amount == null || amount <= 0) continue;
    const code = str(f.type) ?? str(f.code) ?? "FEE";
    out.push({
      code: code.toUpperCase().slice(0, 12),
      label: str(f.remark) ?? str(f.name) ?? code,
      amount,
      currency: str(f.currency)?.toUpperCase() ?? fallbackCurrency,
      per: str(f.unit)?.toLowerCase().includes("cbm") ? "cbm"
         : str(f.unit)?.toLowerCase().includes("kg") ? "kg"
         : str(f.unit)?.toLowerCase().includes("container") ? "container" : "shipment",
    });
  }
  return out;
}
