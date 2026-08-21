import "server-only";

/* ---------------------------------------------------------------------------
   /api/product-feature-highlights

   The supplier-catalog "feature card": small photo + trilingual title/short
   explanation of one feature or function (owner ask 2026-08-21 — the
   Sertol/Lingrai pages: "Sensor", "Adjustment motor", "Wire breakage
   responder"). Not media, not specs — its own rows on
   product_feature_highlights, optionally pinned to one model (member).

   GET  ?product_id=<uuid>  → { highlights: [...] }
   PUT  { product_id, highlights: [...] } → replace-the-set (PD edit only).
   Same shape and guards as /api/product-certifications.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { requireProductDataAction } from "@/lib/server/product-access";
import { humanizeError } from "@/lib/ui/humanize-error";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLS =
  "id, product_id, model_id, title, title_zh, title_ar, description, description_zh, description_ar, image_url, sort";

async function tenantOwnsProduct(productId: string, tenantId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("products").select("id").eq("tenant_id", tenantId).eq("id", productId).maybeSingle();
  return !!data;
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const productId = new URL(req.url).searchParams.get("product_id") || "";
  if (!UUID_RE.test(productId) || !(await tenantOwnsProduct(productId, auth.tenant_id))) {
    return NextResponse.json({ highlights: [] });
  }
  const { data, error } = await supabaseServer
    .from("product_feature_highlights").select(COLS)
    .eq("product_id", productId).order("sort", { ascending: true });
  if (error) {
    console.error("[api/product-feature-highlights GET]", error.message);
    return NextResponse.json({ error: "Failed to load feature highlights" }, { status: 500 });
  }
  return NextResponse.json({ highlights: data ?? [] });
}

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireProductDataAction(auth, "edit");
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as {
    product_id?: string; highlights?: Array<Record<string, unknown>>;
  };
  const productId = body.product_id || "";
  if (!UUID_RE.test(productId)) return NextResponse.json({ error: "A valid product_id is required." }, { status: 400 });
  if (!(await tenantOwnsProduct(productId, auth.tenant_id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = (Array.isArray(body.highlights) ? body.highlights : [])
    .filter((r) => str(r.title))
    .map((r, i) => ({
      product_id: productId,
      model_id: typeof r.model_id === "string" && UUID_RE.test(r.model_id) ? r.model_id : null,
      title: str(r.title) as string,
      title_zh: str(r.title_zh),
      title_ar: str(r.title_ar),
      description: str(r.description),
      description_zh: str(r.description_zh),
      description_ar: str(r.description_ar),
      image_url: str(r.image_url),
      sort: i,
    }));

  const del = await supabaseServer.from("product_feature_highlights").delete().eq("product_id", productId);
  if (del.error) return NextResponse.json({ error: humanizeError(del.error) }, { status: 500 });
  if (rows.length) {
    const ins = await supabaseServer.from("product_feature_highlights").insert(rows);
    if (ins.error) return NextResponse.json({ error: humanizeError(ins.error) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: rows.length });
}
