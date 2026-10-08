import "server-only";

/* POST /api/brand-center/items/<id>/types — a new axis on an item
   (e.g. "Size", "Material"). { label } · Brand Center "edit" */

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
  const label = text(body?.label, 120);
  if (!label) return NextResponse.json({ error: "label_required" }, { status: 400 });
  const { data: item } = await supabaseServer.from("brand_items").select("id").eq("tenant_id", auth.tenant_id).eq("id", id).maybeSingle();
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: last } = await supabaseServer.from("brand_item_types").select("sort").eq("item_id", id).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabaseServer.from("brand_item_types").insert({
    tenant_id: auth.tenant_id, item_id: id, key: `${keyFrom(label)}-${Date.now().toString(36)}`, label,
    sort: ((last as { sort?: number } | null)?.sort ?? -1) + 1,
  }).select("id").single();
  if (error) return NextResponse.json({ error: "Could not add the type." }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
