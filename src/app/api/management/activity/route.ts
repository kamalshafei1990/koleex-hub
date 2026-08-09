import "server-only";

/* Position history — the org chart's paper trail.

   GET  ?position_id=…   history for one position
   GET  ?limit=50        the most recent changes across the tenant
   POST { ...row }       add an entry

   koleex_position_history is service-role-only, so the browser reads this
   replaces returned nothing: the Management dashboard's activity feed and
   every position's history tab were permanently empty. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const positionId = url.searchParams.get("position_id");
  const limitRaw = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 200) : 50;

  let q = supabaseServer
    .from("koleex_position_history")
    .select("*")
    .order("created_at", { ascending: false });
  if (positionId) q = q.eq("position_id", positionId);
  else q = q.limit(limit);

  const { data, error } = await q;
  if (error) {
    console.error("[api/management/activity GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ history: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Super admin required." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Body required." }, { status: 400 });

  /* Who made the change is decided here, from the session — an audit row whose
     author the client can choose is not an audit row. */
  const { error } = await supabaseServer
    .from("koleex_position_history")
    .insert({ ...body, changed_by_account_id: auth.account_id });
  if (error) {
    console.error("[api/management/activity POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
