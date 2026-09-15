import "server-only";

/* ---------------------------------------------------------------------------
   /api/shipping/rates — the freight rate search.

   POST because it is a query with a body, and because the answer must never be
   cached by a shared cache: a rate is tenant data.

   ── Every credential stays here ───────────────────────────────────────────
   No provider key is ever sent to, or named to, the browser. The client posts
   a lane and a mode; the engine decides which sources can answer. When a
   provider is switched off the client learns only that it is off and what it
   would need — never a token, never a URL.

   ── Requests cost money, so they are budgeted ─────────────────────────────
   One search can spend an Awice credit and a Freightos call, and the Freightos
   calculator IP-blocks after a handful. So a per-tenant budget sits in front,
   and the engine's cache absorbs repeat searches for the same lane. The
   limiter fails OPEN, matching the house rule: a counter outage must not take
   the feature down.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { stageTimer } from "@/lib/server/perf";
import { searchRates } from "@/lib/server/shipping/engine";
import { resolvePort } from "@/lib/server/shipping/port-resolver";
import { consumeBudget } from "@/lib/server/ai/security/rate-limit";
import { chargeableWeight } from "@/lib/shipping/chargeable-weight";
import type { ContainerEquipment, RateQuery, ShippingMode, VolumetricRule } from "@/lib/shipping/types";
import { CONTAINER_EQUIPMENT } from "@/lib/shipping/types";

const MODULE = "Shipping";
const MODES: ShippingMode[] = ["ocean_fcl", "ocean_lcl", "air"];

const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export async function POST(req: Request) {
  const _t = stageTimer("shipping.rates");
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) { _t.done({ status: 401 }); return auth; }
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) { _t.done({ status: 403 }); return deny; }
  _t.mark("auth");

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { _t.done({ status: 400 }); return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const mode = String(body.mode ?? "") as ShippingMode;
  if (!MODES.includes(mode)) {
    _t.done({ status: 400 });
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }

  const originRaw = String(body.origin ?? "").trim();
  const destRaw = String(body.destination ?? "").trim();
  if (!originRaw || !destRaw) {
    _t.done({ status: 400 });
    return NextResponse.json({ error: "missing_route" }, { status: 400 });
  }

  /* Resolve BOTH ends before spending anything. An ambiguous name is returned
     to the caller to disambiguate — it is never resolved by guessing. */
  const [origin, destination] = await Promise.all([
    resolvePort(originRaw, typeof body.originCountry === "string" ? body.originCountry : undefined),
    resolvePort(destRaw, typeof body.destinationCountry === "string" ? body.destinationCountry : undefined),
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
  const originPort = (origin as { status: "ok"; port: { locode: string | null; name: string } }).port;
  const destPort = (destination as { status: "ok"; port: { locode: string | null; name: string } }).port;

  /* A port with no confirmed UN/LOCODE cannot be sent to a provider. That is a
     data gap, stated as one, not an excuse to send its name and hope. */
  if (!originPort.locode || !destPort.locode) {
    _t.done({ status: 422, reason: "no_locode" });
    return NextResponse.json({
      error: "port_has_no_code",
      side: originPort.locode ? "destination" : "origin",
      port: originPort.locode ? destPort.name : originPort.name,
    }, { status: 422 });
  }

  const equipment = Array.isArray(body.equipment)
    ? (body.equipment.filter((e): e is ContainerEquipment =>
        typeof e === "string" && (CONTAINER_EQUIPMENT as readonly string[]).includes(e)))
    : undefined;

  const dims = Array.isArray(body.dimensionsCm)
    ? body.dimensionsCm.flatMap((d) => {
        const o = d as Record<string, unknown>;
        const l = num(o.l), w = num(o.w), h = num(o.h);
        return l && w && h ? [{ l, w, h, qty: num(o.qty) ?? 1 }] : [];
      })
    : undefined;

  const query: RateQuery = {
    mode,
    originCode: originPort.locode,
    destinationCode: destPort.locode,
    equipment: equipment?.length ? equipment : undefined,
    cbm: num(body.cbm),
    grossKg: num(body.grossKg),
    dimensionsCm: dims?.length ? dims : undefined,
    volumetricRule: body.volumetricRule === "express_courier" ? ("express_courier" as VolumetricRule) : "iata_air",
    departOn: typeof body.departOn === "string" ? body.departOn : undefined,
  };

  /* Only a fetch costs anything; a cached answer is free, so the budget is
     spent inside the engine's decision, not before it. The cheap guard here
     protects the fetch path. */
  const force = body.force === true;
  const budget = await consumeBudget(`tenant:${auth.tenant_id}`, {
    bucket: "shipping_rates",
    windowSec: 60,
    max: Number(process.env.SHIPPING_LIMIT_SEARCHES_PER_MIN) || 30,
  }).catch(() => null);
  if (budget && budget.allowed === false && force) {
    _t.done({ status: 429 });
    return NextResponse.json({ error: "rate_limited", retryAfterSec: budget.retryAfterSec ?? 60 }, { status: 429 });
  }
  _t.mark("budget");

  try {
    const result = await searchRates(query, {
      tenantId: auth.tenant_id,
      accountId: auth.account_id,
      force,
      signal: req.signal,
    });
    _t.mark("engine");

    /* Air: the chargeable weight is computed here so the screen and the rate
       agree, and so the volumetric RULE travels with the answer. */
    const weight = mode === "air"
      ? chargeableWeight({ grossKg: query.grossKg, cbm: query.cbm, dimensionsCm: query.dimensionsCm, rule: query.volumetricRule })
      : undefined;

    const { header } = _t.done({
      status: 200, mode,
      rates: Object.values(result.byKind).reduce((n, l) => n + l.length, 0),
      cached: result.servedFromCache ? 1 : 0,
    });
    return NextResponse.json({
      ...result,
      origin: originPort,
      destination: destPort,
      weight,
    }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": header } });
  } catch (e) {
    _t.done({ status: 500, error: 1 });
    console.warn("[shipping.rates]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "search_failed" }, { status: 500 });
  }
}
