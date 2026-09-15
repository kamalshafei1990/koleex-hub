import "server-only";

/* ---------------------------------------------------------------------------
   /api/shipping/routes — recent searches and favourite lanes.

   One endpoint, both lists. They are always shown together and each is a dozen
   short rows; two calls would pay this platform's per-request floor twice for
   nothing.

   Both are scoped to the ACCOUNT as well as the tenant. A colleague's recent
   searches are not yours, and a shared "recent" list is a privacy leak dressed
   as a convenience.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { stageTimer } from "@/lib/server/perf";
import type { ShippingMode } from "@/lib/shipping/types";

const MODULE = "Shipping";
const MODES: ShippingMode[] = ["ocean_fcl", "ocean_lcl", "air"];
const RECENT_LIMIT = 8;

const COLS = "id, mode, origin_code, destination_code, origin_label, destination_label, params";

export async function GET() {
  const _t = stageTimer("shipping.routes");
  const auth = await requireAuth();
  if (auth instanceof NextResponse) { _t.done({ status: 401 }); return auth; }
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) { _t.done({ status: 403 }); return deny; }
  _t.mark("auth");

  const [recent, favorites] = await Promise.all([
    supabaseServer.from("shipping_searches")
      .select(`${COLS}, run_count, last_run_at`)
      .eq("tenant_id", auth.tenant_id).eq("account_id", auth.account_id)
      .order("last_run_at", { ascending: false }).limit(RECENT_LIMIT),
    supabaseServer.from("shipping_favorite_routes")
      .select(`${COLS}, label, sort_order`)
      .eq("tenant_id", auth.tenant_id).eq("account_id", auth.account_id)
      .order("sort_order", { ascending: true }).order("created_at", { ascending: true }).limit(30),
  ]);
  _t.mark("db");

  const { header } = _t.done({ status: 200, recent: recent.data?.length ?? 0, fav: favorites.data?.length ?? 0 });
  return NextResponse.json(
    { recent: recent.data ?? [], favorites: favorites.data ?? [] },
    { headers: { "Cache-Control": "private, no-store", "Server-Timing": header } },
  );
}

/** Records a search (upsert, so re-running a lane moves it up) or toggles a favourite. */
export async function POST(req: Request) {
  const _t = stageTimer("shipping.routes.write");
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) { _t.done({ status: 401 }); return auth; }
  const deny = await requireModuleAction(auth, MODULE, "create");
  if (deny) { _t.done({ status: 403 }); return deny; }

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { _t.done({ status: 400 }); return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const action = String(body.action ?? "record");
  const mode = String(body.mode ?? "") as ShippingMode;
  const origin = String(body.originCode ?? "").trim().toUpperCase();
  const destination = String(body.destinationCode ?? "").trim().toUpperCase();
  if (!MODES.includes(mode) || !origin || !destination) {
    _t.done({ status: 400 });
    return NextResponse.json({ error: "invalid_route" }, { status: 400 });
  }

  const base = {
    tenant_id: auth.tenant_id,
    account_id: auth.account_id,
    mode,
    origin_code: origin,
    destination_code: destination,
    origin_label: typeof body.originLabel === "string" ? body.originLabel : null,
    destination_label: typeof body.destinationLabel === "string" ? body.destinationLabel : null,
    params: (body.params && typeof body.params === "object") ? body.params : {},
  };

  try {
    if (action === "favorite" || action === "unfavorite") {
      if (action === "unfavorite") {
        const { error } = await supabaseServer.from("shipping_favorite_routes").delete()
          .eq("tenant_id", auth.tenant_id).eq("account_id", auth.account_id)
          .eq("mode", mode).eq("origin_code", origin).eq("destination_code", destination);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseServer.from("shipping_favorite_routes")
          .upsert({ ...base, label: typeof body.label === "string" ? body.label : null, created_by: auth.account_id },
                  { onConflict: "tenant_id,account_id,mode,origin_code,destination_code" });
        if (error) throw new Error(error.message);
      }
      _t.done({ status: 200, action });
      return NextResponse.json({ ok: true });
    }

    /* Recording a search: bump the counter rather than adding a duplicate row. */
    const { data: existing } = await supabaseServer.from("shipping_searches")
      .select("id, run_count")
      .eq("tenant_id", auth.tenant_id).eq("account_id", auth.account_id)
      .eq("mode", mode).eq("origin_code", origin).eq("destination_code", destination)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseServer.from("shipping_searches")
        .update({ ...base, run_count: (existing.run_count ?? 1) + 1, last_run_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseServer.from("shipping_searches").insert(base);
      if (error) throw new Error(error.message);
    }
    _t.done({ status: 200, action: "record" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    _t.done({ status: 500, error: 1 });
    console.warn("[shipping.routes]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
