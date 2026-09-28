import "server-only";

/* GET /api/brand-center/sections/<key> — one section of the library: its
   groups, and each item with its types and options (the owner's picks in
   `chosen`) and its designs. Anyone who may read Brand Center; retired
   items and designs are left out unless ?all=1 and the reader may edit. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { allRows } from "@/lib/server/all-rows";
import { brandCenterGate } from "@/lib/server/brand-center/access";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "view");
  if (deny) return deny;

  const { key } = await params;
  const wantAll = new URL(req.url).searchParams.get("all") === "1";
  const all = wantAll && (await brandCenterGate(auth, "edit")) === null;
  const t = auth.tenant_id;

  const { data: section, error: sErr } = await supabaseServer
    .from("brand_sections").select("id, key, no, name, name_i18n, icon")
    .eq("tenant_id", t).eq("key", key).maybeSingle();
  if (sErr) return NextResponse.json({ error: "Could not load the section." }, { status: 500 });
  if (!section) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let itemsQ = supabaseServer.from("brand_items")
    .select("id, group_id, key, name, name_i18n, use_text, use_i18n, importance, decision, status, note, owner_note, rules, roles, sort")
    .eq("section_id", section.id);
  if (!all) itemsQ = itemsQ.neq("status", "retired");
  let designsQ = supabaseServer.from("brand_designs")
    .select("id, item_id, option_ids, name, name_i18n, kind, status, is_default, notes, updated_at")
    .eq("tenant_id", t);
  if (!all) designsQ = designsQ.neq("status", "retired");

  /* Paged reads (allRows, 1000 rows a page) keep the screen's order and end
     on the key, so a tie never moves a row between pages. */
  const [groups, items] = await Promise.all([
    supabaseServer.from("brand_groups").select("id, name, name_i18n, sort").eq("section_id", section.id).order("sort"),
    allRows<{ id: string }>(itemsQ.order("sort").order("id"), "brand items"),
  ]);
  if (groups.error || items.error) {
    console.error("[api/brand-center/section]", (groups.error ?? items.error)?.message);
    return NextResponse.json({ error: "Could not load the section." }, { status: 500 });
  }
  /* Only this section's items: a section holds tens of items, the library
     thousands of options — never read the whole library for one screen. */
  const ids = (items.data ?? []).map((i) => i.id);
  const itemIds = new Set(ids);
  const none = { data: [], error: null };
  const [types, options, designs] = ids.length ? await Promise.all([
    allRows<{ id: string; item_id: string }>(supabaseServer.from("brand_item_types").select("id, item_id, key, label, label_i18n, sort").in("item_id", ids).order("sort").order("id"), "brand types"),
    allRows<{ type_id: string }>(supabaseServer.from("brand_item_options").select("id, item_id, type_id, key, label, label_i18n, recommended, chosen, sort").in("item_id", ids).order("sort").order("id"), "brand options"),
    /* Designs in the order they were added. */
    allRows<{ item_id: string }>(designsQ.in("item_id", ids).order("created_at").order("id"), "brand designs"),
  ]) : [none, none, none];
  if (types.error || options.error || designs.error) {
    console.error("[api/brand-center/section]", (types.error ?? options.error ?? designs.error)?.message);
    return NextResponse.json({ error: "Could not load the section." }, { status: 500 });
  }

  const optionsOf = new Map<string, unknown[]>();
  for (const o of options.data ?? []) {
    const list = optionsOf.get(o.type_id) ?? [];
    list.push(o);
    optionsOf.set(o.type_id, list);
  }
  const typesOf = new Map<string, unknown[]>();
  for (const ty of types.data ?? []) {
    if (!itemIds.has(ty.item_id)) continue;
    const list = typesOf.get(ty.item_id) ?? [];
    list.push({ ...ty, options: optionsOf.get(ty.id) ?? [] });
    typesOf.set(ty.item_id, list);
  }
  const designsOf = new Map<string, unknown[]>();
  for (const d of designs.data ?? []) {
    const list = designsOf.get(d.item_id) ?? [];
    list.push(d);
    designsOf.set(d.item_id, list);
  }
  return NextResponse.json({
    section,
    groups: groups.data ?? [],
    items: (items.data ?? []).map((i) => ({ ...i, types: typesOf.get(i.id) ?? [], designs: designsOf.get(i.id) ?? [] })),
    canEdit: (await brandCenterGate(auth, "edit")) === null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
