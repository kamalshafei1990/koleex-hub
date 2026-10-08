import "server-only";

/* POST /api/brand-center/items/<id>/designs — a new design for an item, or
   for some of its choices (owner: "maybe later I need to add my own
   designs"). { name, kind?, optionIds?, notes? } · Brand Center "create".
   Files are added to the design afterwards. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { brandCenterGate } from "@/lib/server/brand-center/access";
import { DESIGN_KIND, oneOf, text } from "@/lib/server/brand-center/library";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "create");
  if (deny) return deny;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = text(body?.name, 200);
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  const { data: item } = await supabaseServer.from("brand_items").select("id").eq("tenant_id", auth.tenant_id).eq("id", id).maybeSingle();
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  /* The choices a design is for must be this item's own. */
  const wanted = Array.isArray(body?.optionIds) ? (body!.optionIds as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 50) : [];
  let optionIds: string[] = [];
  if (wanted.length) {
    const { data: opts } = await supabaseServer.from("brand_item_options").select("id").eq("item_id", id).in("id", wanted);
    optionIds = (opts ?? []).map((o) => o.id);
  }
  const { count } = await supabaseServer.from("brand_designs").select("id", { count: "exact", head: true }).eq("item_id", id).neq("status", "retired");
  const { data, error } = await supabaseServer.from("brand_designs").insert({
    tenant_id: auth.tenant_id, item_id: id, option_ids: optionIds, name,
    kind: oneOf(body?.kind, DESIGN_KIND) ?? "other", status: "draft",
    is_default: (count ?? 0) === 0, notes: text(body?.notes, 2000) ?? null, created_by: auth.account_id,
  }).select("id").single();
  if (error) {
    console.error("[api/brand-center/designs POST]", error.message);
    return NextResponse.json({ error: "Could not add the design." }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
