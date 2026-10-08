import "server-only";

/* GET /api/brand-center/library — the library's sections with how many
   groups, items and types each holds. Anyone who may read Brand Center. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { allRows } from "@/lib/server/all-rows";
import { brandCenterGate } from "@/lib/server/brand-center/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "view");
  if (deny) return deny;

  const t = auth.tenant_id;
  /* The paged reads are counted, not shown: their key alone keeps allRows'
     1000-row pages stable (no row counted twice or missed). */
  const [sections, groups, items, types] = await Promise.all([
    supabaseServer.from("brand_sections").select("id, key, no, name, name_i18n, icon").eq("tenant_id", t).order("no"),
    allRows<{ section_id: string }>(supabaseServer.from("brand_groups").select("section_id").eq("tenant_id", t).order("id"), "brand groups"),
    allRows<{ id: string; section_id: string }>(supabaseServer.from("brand_items").select("id, section_id").eq("tenant_id", t).neq("status", "retired").order("id"), "brand items"),
    allRows<{ item_id: string }>(supabaseServer.from("brand_item_types").select("item_id").eq("tenant_id", t).order("id"), "brand types"),
  ]);
  const err = sections.error ?? groups.error ?? items.error ?? types.error;
  if (err) {
    console.error("[api/brand-center/library]", err.message);
    return NextResponse.json({ error: "Could not load the library." }, { status: 500 });
  }
  const sectionOfItem = new Map((items.data ?? []).map((i) => [i.id, i.section_id]));
  const tally = (rows: Array<{ section_id?: string }>) => rows.reduce<Record<string, number>>((m, r) => {
    if (r.section_id) m[r.section_id] = (m[r.section_id] ?? 0) + 1;
    return m;
  }, {});
  const g = tally(groups.data ?? []);
  const it = tally(items.data ?? []);
  const ty = tally((types.data ?? []).map((r) => ({ section_id: sectionOfItem.get(r.item_id) })));
  return NextResponse.json({
    sections: (sections.data ?? []).map((s) => ({ ...s, groups: g[s.id] ?? 0, items: it[s.id] ?? 0, types: ty[s.id] ?? 0 })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
