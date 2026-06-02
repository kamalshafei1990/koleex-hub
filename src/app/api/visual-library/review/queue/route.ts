import "server-only";

/* Review queue — filtered + sorted list of asset reviews joined to assets. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

function publicUrl(bucket: string | null, path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/${bucket || "media"}/${path}`;
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const tid = auth.tenant_id;
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "").trim();
  const priority = (url.searchParams.get("priority") ?? "").trim();
  const risk = (url.searchParams.get("risk_level") ?? "").trim();
  const prodReady = url.searchParams.get("production_ready");
  const sort = (url.searchParams.get("sort") ?? "risk").trim();
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "50", 10) || 50));
  const from = (page - 1) * pageSize, to = from + pageSize - 1;

  let q = supabaseServer.from("visual_asset_reviews").select("*", { count: "exact" }).eq("tenant_id", tid);
  if (status) q = q.eq("review_status", status);
  if (priority) q = q.eq("review_priority", priority);
  if (risk) q = q.eq("risk_level", risk);
  if (prodReady === "true") q = q.eq("production_ready", true);
  else if (prodReady === "false") q = q.eq("production_ready", false);
  // "risk" + "lowest_quality" both surface the most-at-risk first (lowest approval_score).
  q = sort === "oldest" ? q.order("reviewed_at", { ascending: true, nullsFirst: true })
    : sort === "newest" ? q.order("reviewed_at", { ascending: false, nullsFirst: false })
    : q.order("approval_score", { ascending: true });

  const { data: reviews, count, error } = await q.range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (reviews ?? []).map((r) => r.asset_id as string);
  const byId: Record<string, unknown> = {};
  if (ids.length) {
    const { data: assets } = await supabaseServer.from("visual_assets")
      .select("id, title, visual_asset_code, category, storage_bucket, svg_path").eq("tenant_id", tid).in("id", ids);
    for (const a of assets ?? []) byId[a.id as string] = { ...a, public_url: publicUrl(a.storage_bucket as string, a.svg_path as string) };
  }
  const items = (reviews ?? []).map((r) => ({ ...r, asset: byId[r.asset_id as string] ?? null }));
  return NextResponse.json({ items, total: count ?? items.length, page, pageSize });
}
