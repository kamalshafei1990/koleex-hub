import "server-only";

/* ---------------------------------------------------------------------------
   /api/shipping/quotes — forwarder quotes typed in by an operator.

   The one rate source that needs no contract, no credential and no third
   party: a price a named forwarder actually gave us, with the validity they
   gave it for. Everything else in this module either estimates (market),
   remembers (Koleex history) or has to be bought (a provider API). This is the
   only path that produces a REAL, CURRENT, BOOKABLE number today.

   ── WHY THE LANE IS RESOLVED HERE, THE SAME WAY /rates RESOLVES IT ─────────
   A stored quote is found by `readStored()` on an exact match of
   (mode, origin_code, destination_code, origin_code_system,
   destination_code_system). If this route wrote whatever string the browser
   sent, a quote entered as "Ningbo" would be filed under "Ningbo" and a search
   for CNNBO would never see it — the operator would type a real price in and
   the screen would still say "no rate". So the lane goes through the SAME
   resolveEndpoint + endpointCode pair the search uses, and a lane that cannot
   be resolved is refused rather than stored somewhere it can never be read.

   ── WHAT THIS ROUTE REFUSES ───────────────────────────────────────────────
   · a quote with no validity date — an undated price is not a quote, it is a
     number someone remembers. `valid_until` is required.
   · an amount that is not a positive finite number.
   · an inclusion the operator did not state. Undefined stays undefined:
     comparability.ts keeps "the source did not say" in its own bucket and it
     must never be silently rewritten to false.
   · rate_kind anything but 'forwarder'. This route cannot manufacture a
     provider rate, a market band or a Koleex historical figure.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { stageTimer } from "@/lib/server/perf";
import { endpointCode, resolveEndpoint, type CanonicalPort } from "@/lib/server/shipping/port-resolver";
import { CONTAINER_EQUIPMENT, type ContainerEquipment, type RateUnit, type ServiceScope, type ShippingMode, type Surcharge } from "@/lib/shipping/types";

const MODULE = "Shipping";
const MODES: ShippingMode[] = ["ocean_fcl", "ocean_lcl", "air"];
const SCOPES: ServiceScope[] = ["port_to_port", "door_to_port", "port_to_door", "door_to_door", "airport_to_airport"];
const UNITS: RateUnit[] = ["container", "cbm", "kg", "shipment"];
const PER_UNITS: RateUnit[] = UNITS;
const LIST_LIMIT = 50;
const MAX_SURCHARGES = 20;

/* A surcharge code is a trade identifier (BAF, THC, ISPS…), not free prose:
   it keys the translation and it is what a carrier's invoice prints. Anything
   outside this shape is stored under FEE with the operator's own label. */
const CODE_RE = /^[A-Z0-9]{2,6}$/;

const positive = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};
const wholeDays = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isInteger(n) && n > 0 && n <= 400 ? n : null;
};
const isoDate = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : null;
};
/** ⚠️ Tri-state. undefined ("not stated") is a real answer and is preserved. */
const triState = (v: unknown): boolean | null =>
  v === true || v === "yes" ? true : v === false || v === "no" ? false : null;

/** Stable per forwarder NAME, so re-quoting the same lane replaces rather than
    piles up: the engine keeps the newest row per (kind, source, equipment,
    weight break, scope). Prefixed so it can never collide with a provider id. */
function sourceIdFor(name: string): string {
  /* \p{L}\p{N} and not [a-z0-9]: a forwarder is as likely to be 宁波中外运 or
     الشحن السريع as it is to be "Sinotrans", and an ASCII-only slug would empty
     every one of those to the same id — three different forwarders silently
     collapsing into one row. Combining marks are dropped after NFKD so
     "Kühne" and "Kuhne" do not become two sources. */
  const slug = name.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `fwd:${slug || "unnamed"}`;
}

function readSurcharges(v: unknown, fallbackCurrency: string): Surcharge[] {
  if (!Array.isArray(v)) return [];
  const out: Surcharge[] = [];
  for (const raw of v.slice(0, MAX_SURCHARGES)) {
    const o = raw as Record<string, unknown>;
    const amount = positive(o.amount);
    if (amount == null) continue;                       // a blank row is not a charge
    const code = String(o.code ?? "").trim().toUpperCase();
    const label = String(o.label ?? "").trim();
    const per = PER_UNITS.includes(o.per as RateUnit) ? (o.per as RateUnit) : "shipment";
    out.push({
      code: CODE_RE.test(code) ? code : "FEE",
      label: label || code || "Local charge",
      amount,
      currency: String(o.currency ?? fallbackCurrency).trim().toUpperCase().slice(0, 3) || fallbackCurrency,
      per,
    });
  }
  return out;
}

/* ── GET: the tenant's forwarder quotes, newest first ──────────────────────
   Optionally narrowed to one lane, which is how the app shows "3 quotes on
   this lane" beside the results. */
export async function GET(req: Request) {
  const _t = stageTimer("shipping.quotes");
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) { _t.done({ status: 401 }); return auth; }
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) { _t.done({ status: 403 }); return deny; }

  const url = new URL(req.url);
  let q = supabaseServer.from("shipping_rate_quotes")
    .select("id, source_id, source_label, mode, origin_code, destination_code, origin_code_system, destination_code_system, service_scope, includes_origin_charges, includes_destination_charges, includes_customs, equipment, unit, weight_break, amount, currency, surcharges, total_estimate, valid_from, valid_until, transit_days_min, transit_days_max, carrier, is_estimate, notes, retrieved_at, created_at")
    .eq("tenant_id", auth.tenant_id)
    .eq("rate_kind", "forwarder")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  const mode = url.searchParams.get("mode");
  const origin = url.searchParams.get("originCode");
  const destination = url.searchParams.get("destinationCode");
  if (mode && origin && destination) {
    q = q.eq("mode", mode).eq("origin_code", origin.toUpperCase()).eq("destination_code", destination.toUpperCase());
  }

  const { data, error } = await q;
  if (error) {
    _t.done({ status: 500, error: 1 });
    console.warn("[shipping.quotes] list failed:", error.message);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
  const { header } = _t.done({ status: 200, rows: data?.length ?? 0 });
  return NextResponse.json({ quotes: data ?? [] },
    { headers: { "Cache-Control": "private, no-store", "Server-Timing": header } });
}

/* ── POST: record one forwarder quote ─────────────────────────────────────── */
export async function POST(req: Request) {
  const _t = stageTimer("shipping.quotes.create");
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) { _t.done({ status: 401 }); return auth; }
  const deny = await requireModuleAction(auth, MODULE, "create");
  if (deny) { _t.done({ status: 403 }); return deny; }

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { _t.done({ status: 400 }); return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const mode = String(body.mode ?? "") as ShippingMode;
  if (!MODES.includes(mode)) {
    _t.done({ status: 400 });
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }

  const forwarder = String(body.forwarder ?? "").trim().slice(0, 120);
  if (!forwarder) {
    _t.done({ status: 400 });
    return NextResponse.json({ error: "missing_forwarder" }, { status: 400 });
  }

  const amount = positive(body.amount);
  if (amount == null) {
    _t.done({ status: 400 });
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  /* ⚠️ A quote with no expiry is not a quote. The whole reason a forwarder
     price can be shown as CURRENT — unlike Koleex history — is that it carries
     the date it stops being true. */
  const validUntil = isoDate(body.validUntil);
  if (!validUntil) {
    _t.done({ status: 400 });
    return NextResponse.json({ error: "missing_validity" }, { status: 400 });
  }
  const validFrom = isoDate(body.validFrom);
  if (validFrom && validFrom > validUntil) {
    _t.done({ status: 400 });
    return NextResponse.json({ error: "validity_backwards" }, { status: 400 });
  }

  const equipment = mode === "ocean_fcl"
    ? (CONTAINER_EQUIPMENT as readonly string[]).includes(String(body.equipment)) ? (body.equipment as ContainerEquipment) : null
    : null;
  if (mode === "ocean_fcl" && !equipment) {
    _t.done({ status: 400 });
    return NextResponse.json({ error: "missing_equipment" }, { status: 400 });
  }

  /* The unit follows the method — a per-container price for FCL, per CBM for
     groupage, per kg for air — unless the operator says the whole shipment is
     one lump sum, which forwarders do quote. */
  const lumpSum = body.lumpSum === true;
  const unit: RateUnit = lumpSum ? "shipment"
    : mode === "ocean_fcl" ? "container"
    : mode === "ocean_lcl" ? "cbm"
    : "kg";

  const defaultScope: ServiceScope = mode === "air" ? "airport_to_airport" : "port_to_port";
  const scope = SCOPES.includes(body.scope as ServiceScope) ? (body.scope as ServiceScope) : defaultScope;

  const currency = String(body.currency ?? "USD").trim().toUpperCase().slice(0, 3) || "USD";
  const surcharges = readSurcharges(body.surcharges, currency);

  /* The all-in total is stored only when every component is in ONE currency —
     a total that quietly crossed an exchange rate is a wrong number wearing a
     confident face. Mirrors allInTotal() in comparability.ts. */
  const mixedCurrency = surcharges.some((s) => s.currency !== currency);
  const totalEstimate = mixedCurrency ? null
    : Math.round((amount + surcharges.reduce((n, s) => n + s.amount, 0)) * 100) / 100;

  /* ── the lane, resolved exactly as a search resolves it ─────────────────── */
  const originRaw = String(body.origin ?? "").trim();
  const destRaw = String(body.destination ?? "").trim();
  if (!originRaw || !destRaw) {
    _t.done({ status: 400 });
    return NextResponse.json({ error: "missing_route" }, { status: 400 });
  }

  const [origin, destination] = await Promise.all([
    resolveEndpoint(originRaw, mode, typeof body.originCountry === "string" ? body.originCountry : undefined),
    resolveEndpoint(destRaw, mode, typeof body.destinationCountry === "string" ? body.destinationCountry : undefined),
  ]);
  _t.mark("resolve");

  for (const [side, r, raw] of [["origin", origin, originRaw], ["destination", destination, destRaw]] as const) {
    if (r.status === "unknown") {
      _t.done({ status: 422, reason: `${side}_unknown` });
      return NextResponse.json({ error: "port_unknown", side, input: raw }, { status: 422 });
    }
    if (r.status === "ambiguous") {
      _t.done({ status: 409, reason: `${side}_ambiguous` });
      return NextResponse.json({ error: "port_ambiguous", side, input: raw, candidates: r.candidates }, { status: 409 });
    }
  }
  const originPort = (origin as { status: "ok"; port: CanonicalPort }).port;
  const destPort = (destination as { status: "ok"; port: CanonicalPort }).port;

  const originId = endpointCode(originPort);
  const destId = endpointCode(destPort);
  if (!originId || !destId) {
    _t.done({ status: 422, reason: "no_code" });
    return NextResponse.json({
      error: "port_has_no_code",
      side: originId ? "destination" : "origin",
      port: originId ? destPort.name : originPort.name,
    }, { status: 422 });
  }

  const row = {
    tenant_id: auth.tenant_id,
    rate_kind: "forwarder" as const,
    source_id: sourceIdFor(forwarder),
    source_label: forwarder,
    /* "manual" is the honest cadence: a human typed it. It is what stops the
       UI ever badging this row as live. */
    source_cadence: "manual" as const,

    mode,
    origin_code: originId.code,
    destination_code: destId.code,
    origin_code_system: originId.system,
    destination_code_system: destId.system,
    origin_port_id: originId.system === "unlocode" ? originPort.id : null,
    destination_port_id: destId.system === "unlocode" ? destPort.id : null,
    origin_airport_id: originId.system === "iata" ? originPort.id : null,
    destination_airport_id: destId.system === "iata" ? destPort.id : null,

    service_scope: scope,
    includes_origin_charges: triState(body.includesOriginCharges),
    includes_destination_charges: triState(body.includesDestinationCharges),
    includes_customs: triState(body.includesCustoms),
    incoterm: String(body.incoterm ?? "").trim().toUpperCase().slice(0, 12) || null,

    equipment,
    unit,
    weight_break: mode === "air" ? (String(body.weightBreak ?? "").trim().slice(0, 12) || null) : null,
    min_charge: positive(body.minCharge),

    amount,
    currency,
    surcharges,
    total_estimate: totalEstimate,

    /* ⚠️ expires_at is the CACHE clock and must not be confused with the
       carrier's validity. A forwarder quote has no cache to expire — it was
       not fetched — so it stays null and only valid_until governs whether the
       UI may still call it current. */
    expires_at: null,
    valid_from: validFrom,
    valid_until: validUntil,

    transit_days_min: wholeDays(body.transitDaysMin),
    transit_days_max: wholeDays(body.transitDaysMax),
    carrier: String(body.carrier ?? "").trim().slice(0, 80) || null,

    /* A forwarder quote with a validity is bookable unless the operator says
       it was indicative. The default is the common case, not the flattering
       one: they are copying a document that says "valid until". */
    is_estimate: body.isEstimate === true,

    raw: { enteredVia: "shipping.quotes", forwarder },
    notes: String(body.notes ?? "").trim().slice(0, 600) || null,
    created_by: auth.account_id,
  };

  const { data, error } = await supabaseServer.from("shipping_rate_quotes")
    .insert(row).select("id").single();
  if (error) {
    _t.done({ status: 500, error: 1 });
    console.warn("[shipping.quotes] insert failed:", error.message);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  const { header } = _t.done({ status: 200, mode });
  return NextResponse.json(
    { ok: true, id: data.id, originCode: originId.code, destinationCode: destId.code },
    { headers: { "Server-Timing": header } },
  );
}

/* ── DELETE: withdraw a quote ──────────────────────────────────────────────
   An entry path with no way back is a trap: a mistyped price would sit on the
   lane for as long as its validity runs, and a wrong number that looks real is
   worse than no number. Scoped to forwarder rows so this can never be used to
   prune provider history or the audit trail. */
export async function DELETE(req: Request) {
  const _t = stageTimer("shipping.quotes.delete");
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) { _t.done({ status: 401 }); return auth; }
  const deny = await requireModuleAction(auth, MODULE, "delete");
  if (deny) { _t.done({ status: 403 }); return deny; }

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    _t.done({ status: 400 });
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const { error, count } = await supabaseServer.from("shipping_rate_quotes")
    .delete({ count: "exact" })
    .eq("tenant_id", auth.tenant_id)
    .eq("rate_kind", "forwarder")
    .eq("id", id);
  if (error) {
    _t.done({ status: 500, error: 1 });
    console.warn("[shipping.quotes] delete failed:", error.message);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  if (!count) {
    _t.done({ status: 404 });
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  _t.done({ status: 200 });
  return NextResponse.json({ ok: true });
}
