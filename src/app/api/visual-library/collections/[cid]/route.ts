import "server-only";

/* ---------------------------------------------------------------------------
   /api/visual-library/collections/[cid]  (cid = uuid or slug)
   GET    → collection + computed intelligence (style/category distribution,
            top meanings, total usage, duplicate concepts) — no AI, just data.
   PATCH  → edit, or action: approve | archive | deprecate | restore.
   DELETE → delete the collection (bridge rows cascade).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { buildCollectionPatch, validateCollectionPatch } from "@/lib/visual-library/collection-fields";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolve(cid: string, tid: string) {
  const q = supabaseServer.from("visual_collections").select("*").eq("tenant_id", tid);
  const { data } = await (UUID.test(cid) ? q.eq("id", cid) : q.eq("slug", cid)).maybeSingle();
  return data as Record<string, unknown> | null;
}

function topN(items: string[], n: number) {
  const m: Record<string, number> = {};
  for (const it of items) if (it) m[it] = (m[it] ?? 0) + 1;
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ value: k, count: v }));
}

export async function GET(req: Request, ctx: { params: Promise<{ cid: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;

  const { cid } = await ctx.params;
  const col = await resolve(cid, auth.tenant_id);
  if (!col) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Member asset ids → fetch lightweight fields for intelligence.
  const { data: links } = await supabaseServer.from("visual_collection_assets")
    .select("asset_id").eq("collection_id", col.id);
  const ids = (links ?? []).map((l) => l.asset_id as string);

  let intelligence = {
    total: 0, styles: [] as { value: string; count: number }[],
    categories: [] as { value: string; count: number }[],
    meanings: [] as { value: string; count: number }[],
    total_usage: 0, duplicate_concepts: [] as { value: string; count: number }[],
  };
  if (ids.length) {
    const rows: { style: string | null; category: string | null; semantic_meaning: string | null; usage_count: number | null; title: string | null }[] = [];
    for (let i = 0; i < ids.length; i += 1000) {
      const { data } = await supabaseServer.from("visual_assets")
        .select("style, category, semantic_meaning, usage_count, title")
        .eq("tenant_id", auth.tenant_id).in("id", ids.slice(i, i + 1000));
      rows.push(...(data ?? []) as typeof rows);
    }
    const dupes = topN(rows.map((r) => (r.title ?? "").toLowerCase()).filter(Boolean), 50).filter((d) => d.count > 1).slice(0, 8);
    intelligence = {
      total: rows.length,
      styles: topN(rows.map((r) => r.style ?? "").filter(Boolean), 5),
      categories: topN(rows.map((r) => r.category ?? "").filter(Boolean), 6),
      meanings: topN(rows.flatMap((r) => (r.semantic_meaning ?? "").toLowerCase().split(/[^a-z0-9]+/)).filter((w) => w.length > 3), 8),
      total_usage: rows.reduce((s, r) => s + (r.usage_count ?? 0), 0),
      duplicate_concepts: dupes,
    };
  }

  return NextResponse.json({ collection: col, intelligence });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ cid: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "edit");
  if (deny) return deny;

  const { cid } = await ctx.params;
  const col = await resolve(cid, auth.tenant_id);
  if (!col) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const action = typeof body.action === "string" ? body.action : "";
  let patch: Record<string, unknown> = {};
  if (action === "approve") patch = { approval_status: "approved" };
  else if (action === "archive") patch = { approval_status: "archived" };
  else if (action === "deprecate") patch = { approval_status: "deprecated" };
  else if (action === "restore") patch = { approval_status: "draft" };
  else if (!action) {
    patch = buildCollectionPatch(body);
    const verr = validateCollectionPatch(patch);
    if (verr) return NextResponse.json({ error: verr }, { status: 400 });
  } else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { error } = await supabaseServer.from("visual_collections").update(patch).eq("id", col.id).eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ cid: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "delete");
  if (deny) return deny;

  const { cid } = await ctx.params;
  const col = await resolve(cid, auth.tenant_id);
  if (!col) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await supabaseServer.from("visual_collections").delete().eq("id", col.id).eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
