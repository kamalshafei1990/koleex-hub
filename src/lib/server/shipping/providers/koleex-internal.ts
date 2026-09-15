import "server-only";

/* ---------------------------------------------------------------------------
   Provider — Koleex's own freight history.

   The one source that needs no contract, no credential and no third party:
   money Koleex actually paid, already sitting in the Hub.

   Today it reads `landed_cost_simulations.shipping`, which carries a real
   freight figure, the two ports, the mode, a transit time and — unusually for
   any source — ITEMISED SURCHARGES that an operator typed in from a real
   invoice (BAF, CAF, GRI, PSS, AMS/ENS/ISF, B/L, telex release).

   ── ⚠️ IT IS HISTORY, AND IT IS LABELLED AS HISTORY ───────────────────────
   kind = "koleex" and the confidence model caps it at 70. The UI says
   "Koleex Historical Rate" with the date it was recorded, always. A rate from
   April shown as today's market is the single most expensive mistake this
   module could make, because it looks authoritative — it IS our own number.

   ── Tenant scope ──────────────────────────────────────────────────────────
   `landed_cost_simulations` has no tenant_id column. That is pre-existing and
   deliberate (see the note in src/app/api/landed-cost/route.ts): the table is
   shared. Nothing here changes that, and nothing here weakens it — the rates
   this provider emits are stamped with the CALLING tenant when the engine
   persists them into shipping_rate_quotes, which is tenant-scoped.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ContainerEquipment, FreightRate, ProviderResult, RateQuery, ShippingMode, Surcharge } from "@/lib/shipping/types";
import { normaliseAlias } from "../port-resolver";
import type { FreightRateProvider } from "./types";

/** The shape the landed-cost engine stores. Mirrors ShippingCosts. */
interface ShippingCostsRow {
  shippingMode?: string;
  portOfLoading?: string;
  portOfDestination?: string;
  freightCost?: number;
  insuranceCost?: number;
  baf?: number; caf?: number; gri?: number;
  peakSeasonSurcharge?: number; amsEnsIsf?: number;
  blAwbFee?: number; telexReleaseFee?: number;
  transitTime?: string;
  freightCurrency?: string;
  freightExchangeRate?: number;
  notes?: string;
}

/** ProductInfo.loadingType → our mode + equipment. */
function readLoadingType(v: unknown): { mode: ShippingMode | null; equipment?: ContainerEquipment } {
  const s = String(v ?? "").toUpperCase();
  if (s.includes("40HQ")) return { mode: "ocean_fcl", equipment: "40HQ" };
  if (s.includes("40GP") || s.includes("40'")) return { mode: "ocean_fcl", equipment: "40GP" };
  if (s.includes("20GP") || s.includes("20'")) return { mode: "ocean_fcl", equipment: "20GP" };
  if (s.includes("LCL")) return { mode: "ocean_lcl" };
  if (s.includes("AIR") || s.includes("COURIER")) return { mode: "air" };
  return { mode: null };
}

function modeFromShippingMode(v: unknown): ShippingMode | null {
  const s = String(v ?? "").toLowerCase();
  if (s.startsWith("sea")) return "ocean_fcl";
  if (s.startsWith("air") || s.startsWith("courier")) return "air";
  return null;
}

/** "28 days", "25-30 days", "28" → a day range. */
export function parseTransit(v: unknown): { min?: number; max?: number } {
  const s = String(v ?? "");
  const nums = [...s.matchAll(/\d+/g)].map((m) => Number(m[0])).filter((n) => n > 0 && n < 400);
  if (!nums.length) return {};
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

const SURCHARGE_FIELDS: { key: keyof ShippingCostsRow; code: string; label: string }[] = [
  { key: "baf", code: "BAF", label: "Bunker adjustment" },
  { key: "caf", code: "CAF", label: "Currency adjustment" },
  { key: "gri", code: "GRI", label: "General rate increase" },
  { key: "peakSeasonSurcharge", code: "PSS", label: "Peak season surcharge" },
  { key: "amsEnsIsf", code: "AMS", label: "AMS / ENS / ISF filing" },
  { key: "blAwbFee", code: "DOC", label: "B/L or AWB fee" },
  { key: "telexReleaseFee", code: "TLX", label: "Telex release" },
];

export const koleexInternalProvider: FreightRateProvider = {
  id: "koleex_landed_cost",
  label: "Koleex historical rate",
  kind: "koleex",
  capabilities: {
    modes: ["ocean_fcl", "ocean_lcl", "air"],
    cadence: "historical",
    itemisesSurcharges: true,
    statesValidity: false,
    requires: "Nothing. Reads freight already recorded in Koleex's landed-cost simulations.",
  },

  /* Always on: it costs no API credit and needs no key. */
  isEnabled: () => true,

  async getRates(query: RateQuery): Promise<ProviderResult> {
    const started = Date.now();

    /* Both codes and every spelling they answer to, so a stored
       "Shanghai" / "Shanghai, China" / "CNSGH" all find the same lane. */
    const [originAliases, destAliases] = await Promise.all([
      aliasesFor(query.originCode),
      aliasesFor(query.destinationCode),
    ]);
    if (!originAliases.size || !destAliases.size) {
      return { providerId: this.id, rates: [], elapsedMs: Date.now() - started };
    }

    const { data, error } = await supabaseServer
      .from("landed_cost_simulations")
      .select("id, name, shipping, product_info, created_at, updated_at, currency")
      .not("shipping", "is", null)
      .order("created_at", { ascending: false })
      .limit(400);
    if (error) {
      return { providerId: this.id, rates: [], error: { kind: "upstream", detail: error.message }, elapsedMs: Date.now() - started };
    }

    const rates: FreightRate[] = [];
    for (const row of (data ?? []) as {
      id: string; name: string | null; shipping: ShippingCostsRow | null;
      product_info: Record<string, unknown> | null; created_at: string; updated_at: string | null;
    }[]) {
      const s = row.shipping;
      if (!s) continue;
      const freight = Number(s.freightCost) || 0;
      if (freight <= 0) continue;                       // nothing recorded is not a rate of zero

      if (!originAliases.has(normaliseAlias(s.portOfLoading ?? ""))) continue;
      if (!destAliases.has(normaliseAlias(s.portOfDestination ?? ""))) continue;

      const fromLoad = readLoadingType(row.product_info?.loadingType);
      const mode = fromLoad.mode ?? modeFromShippingMode(s.shippingMode);
      if (!mode || mode !== query.mode) continue;
      if (query.mode === "ocean_fcl" && query.equipment?.length && fromLoad.equipment
          && !query.equipment.includes(fromLoad.equipment)) continue;

      const currency = (s.freightCurrency || "USD").toUpperCase();
      const surcharges: Surcharge[] = [];
      for (const f of SURCHARGE_FIELDS) {
        const amount = Number(s[f.key]) || 0;
        if (amount > 0) surcharges.push({ code: f.code, label: f.label, amount, currency, per: "shipment" });
      }
      const insurance = Number(s.insuranceCost) || 0;
      if (insurance > 0) surcharges.push({ code: "INS", label: "Insurance", amount: insurance, currency, per: "shipment" });

      const transit = parseTransit(s.transitTime);
      const recordedAt = row.updated_at ?? row.created_at;

      rates.push({
        kind: "koleex",
        sourceId: this.id,
        sourceLabel: this.label,
        sourceCadence: "historical",
        mode,
        originCode: query.originCode,
        destinationCode: query.destinationCode,
        originCodeSystem: query.originCodeSystem,
        destinationCodeSystem: query.destinationCodeSystem,
        originLabel: s.portOfLoading ?? undefined,
        destinationLabel: s.portOfDestination ?? undefined,
        /* A landed-cost simulation records port-to-port freight; the
           destination-side charges live in its OWN import section, which is
           why they are not folded in here. */
        scope: mode === "air" ? "airport_to_airport" : "port_to_port",
        includesOriginCharges: false,
        includesDestinationCharges: false,
        includesCustoms: false,
        equipment: fromLoad.equipment,
        unit: mode === "ocean_fcl" ? "container" : mode === "ocean_lcl" ? "cbm" : "kg",
        amount: freight,
        currency,
        surcharges,
        totalEstimate: freight + surcharges.reduce((t, x) => t + x.amount, 0),
        /* retrievedAt is when KOLEEX recorded it, not when we read the row —
           the confidence model must see the real age, and this one is old. */
        retrievedAt: recordedAt,
        transitDaysMin: transit.min,
        transitDaysMax: transit.max,
        isEstimate: true,
        notes: row.name ? `From landed-cost simulation "${row.name}"` : "From a landed-cost simulation",
      });
    }

    return { providerId: this.id, rates, elapsedMs: Date.now() - started };
  },
};

/** Every normalised spelling a port answers to, so stored plain names match. */
async function aliasesFor(locode: string): Promise<Set<string>> {
  const out = new Set<string>();
  if (!locode) return out;
  const { data } = await supabaseServer
    .from("shipping_ports")
    .select("name, name_official, locode, shipping_port_aliases(alias)")
    .eq("locode", locode.toUpperCase()).is("tenant_id", null).maybeSingle();
  if (!data) return out;
  const row = data as { name: string; name_official: string | null; locode: string | null; shipping_port_aliases: { alias: string }[] | null };
  for (const v of [row.name, row.name_official, row.locode]) if (v) out.add(normaliseAlias(v));
  for (const a of row.shipping_port_aliases ?? []) out.add(a.alias);
  return out;
}
