import "server-only";

/* POST /api/brand-center/items — a new item in a section (and group).
   { sectionId, groupId?, name, use?, importance? } · Brand Center "create" */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { brandCenterGate } from "@/lib/server/brand-center/access";
import { IMPORTANCE, keyFrom, oneOf, text } from "@/lib/server/brand-center/library";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "create");
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = text(body?.name, 200);
  const sectionId = text(body?.sectionId, 60);
  if (!name || !sectionId) return NextResponse.json({ error: "name_and_section_required" }, { status: 400 });

  const { data: section } = await supabaseServer.from("brand_sections").select("id").eq("tenant_id", auth.tenant_id).eq("id", sectionId).maybeSingle();
  if (!section) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const groupId = text(body?.groupId, 60);
  if (groupId) {
    const { data: g } = await supabaseServer.from("brand_groups").select("id").eq("section_id", sectionId).eq("id", groupId).maybeSingle();
    if (!g) return NextResponse.json({ error: "bad_group" }, { status: 400 });
  }
  const { data: last } = await supabaseServer.from("brand_items").select("sort").eq("section_id", sectionId).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabaseServer.from("brand_items").insert({
    tenant_id: auth.tenant_id, section_id: sectionId, group_id: groupId ?? null,
    key: `${keyFrom(name)}-${Date.now().toString(36)}`, name, use_text: text(body?.use, 600) ?? null,
    importance: oneOf(body?.importance, IMPORTANCE) ?? "core", decision: "yes", status: "draft",
    sort: ((last as { sort?: number } | null)?.sort ?? 0) + 1, created_by: auth.account_id,
  }).select("id").single();
  if (error) {
    console.error("[api/brand-center/items POST]", error.message);
    return NextResponse.json({ error: "Could not add the item." }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
