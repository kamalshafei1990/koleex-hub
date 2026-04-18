import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET  /api/planning/switch-requests — list my requests + requests
        targeted at me (pending + resolved). ?scope=outgoing|incoming|all
   POST /api/planning/switch-requests — open a new swap.
        body: { item_id, target_id, message } */

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "all";

  let q = supabaseServer
    .from("planning_switch_requests")
    .select(
      `id, tenant_id, item_id, requester_id, target_id, status, message, created_at, updated_at,
       item:item_id ( id, title, start_at, end_at, resource_id, role_id )`,
    )
    .eq("tenant_id", auth.tenant_id);

  if (scope === "outgoing") q = q.eq("requester_id", auth.account_id);
  else if (scope === "incoming") q = q.eq("target_id", auth.account_id);
  else
    q = q.or(
      `requester_id.eq.${auth.account_id},target_id.eq.${auth.account_id}`,
    );

  q = q.order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const body = (await req.json()) as {
    item_id: string;
    target_id?: string | null;
    message?: string | null;
  };
  if (!body.item_id) {
    return NextResponse.json({ error: "item_id required" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("planning_switch_requests")
    .insert({
      tenant_id: auth.tenant_id,
      item_id: body.item_id,
      requester_id: auth.account_id,
      target_id: body.target_id ?? null,
      message: body.message ?? null,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ request: data });
}
