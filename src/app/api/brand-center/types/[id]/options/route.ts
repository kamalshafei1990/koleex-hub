import "server-only";

/* POST /api/brand-center/types/<id>/options — a new choice on an axis.
   { label } · Brand Center "edit". New choices start as chosen. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { brandCenterGate } from "@/lib/server/brand-center/access";
import { keyFrom, text } from "@/lib/server/brand-center/library";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "edit");
  if (deny) return deny;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const label = text(body?.label, 160);
  if (!label) return NextResponse.json({ error: "label_required" }, { status: 400 });
  const { data: type } = await supabaseServer.from("brand_item_types").select("id, item_id").eq("tenant_id", auth.tenant_id).eq("id", id).maybeSingle();
  if (!type) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: last } = await supabaseServer.from("brand_item_options").select("sort").eq("type_id", id).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabaseServer.from("brand_item_options").insert({
    tenant_id: auth.tenant_id, item_id: type.item_id, type_id: id, key: `${keyFrom(label)}-${Date.now().toString(36)}`, label,
    chosen: true, sort: ((last as { sort?: number } | null)?.sort ?? -1) + 1,
  }).select("id").single();
  if (error) return NextResponse.json({ error: "Could not add the choice." }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
