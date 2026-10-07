import "server-only";

/* GET  /api/hr/ratings/cycles — list cycles (HR view, newest first)
   POST /api/hr/ratings/cycles — open a cycle { month: "2026-10-01" }:
         creates it in `scoring` and composes every employee's items
         (general pool + position requirements, snapshotted — compose.ts). */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";
import { composeCycleItems } from "@/lib/server/ratings/compose";

const MODULE = "HR";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("rating_cycles")
    .select("id, month, kind, title, occasion_date, status, config, opened_at, finalized_at, published_at")
    .eq("tenant_id", auth.tenant_id)
    .order("month", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cycles: data ?? [] });
}

interface PostBody { month?: string }

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as PostBody | null;
  const month = body?.month?.trim();
  if (!month || !/^\d{4}-\d{2}-01$/.test(month)) {
    return NextResponse.json({ error: "month must be YYYY-MM-01" }, { status: 400 });
  }

  const { data: cycle, error } = await supabaseServer
    .from("rating_cycles")
    .insert({ tenant_id: auth.tenant_id, month, status: "scoring", opened_by: auth.account_id })
    .select("id, month, status")
    .single();
  if (error) {
    /* the partial unique index makes a second monthly cycle for the same
       month a clean conflict, not a 500 */
    if (error.code === "23505") {
      return NextResponse.json({ error: "A cycle for this month already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const composed = await composeCycleItems(cycle.id, auth.tenant_id);
  void logAudit({
    auth, module: MODULE, action_type: "rating_cycle_opened",
    entity_type: "rating_cycle", entity_id: cycle.id, entity_label: month,
    new_values: { ...composed },
  });

  return NextResponse.json({ cycle, composed });
}
