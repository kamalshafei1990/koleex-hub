import "server-only";

/* Match preorder model codes to products and return a primary image URL per code.
   Codes are matched (case-insensitive) against product_models.sku and .model_name,
   scoped to the caller's tenant. Returns { matches: { CODE: url } } — codes with
   no product or no image are simply omitted. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publicUrl = (fp: string | null | undefined) =>
  fp ? `${SUPA}/storage/v1/object/public/media/${fp.replace(/^\/+/, "")}` : null;

const mediaUrl = (m: { url?: string | null; file_path?: string | null }) =>
  m.url && /^https?:\/\//i.test(m.url) ? m.url : publicUrl(m.file_path);

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as { models?: unknown } | null;
  const codes = Array.isArray(body?.models)
    ? Array.from(new Set(body!.models.filter((m): m is string => typeof m === "string" && m.trim() !== "").map((m) => m.trim().toUpperCase())))
    : [];
  if (codes.length === 0) return NextResponse.json({ matches: {} });

  // Tenant's product ids.
  const { data: prods, error: prodErr } = await supabaseServer
    .from("products")
    .select("id")
    .eq("tenant_id", auth.tenant_id);
  if (prodErr) {
    console.error("[preorders/match-products products]", prodErr.message);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
  const productIds = (prods ?? []).map((p) => p.id);
  if (productIds.length === 0) return NextResponse.json({ matches: {} });

  // All models for those products; match in JS (codes may contain quotes/commas).
  const { data: models, error: mErr } = await supabaseServer
    .from("product_models")
    .select("id, product_id, sku, model_name")
    .in("product_id", productIds);
  if (mErr) {
    console.error("[preorders/match-products models]", mErr.message);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }

  // code -> { product_id, model_id }
  const codeToModel = new Map<string, { product_id: string; model_id: string }>();
  for (const m of models ?? []) {
    for (const raw of [m.sku, m.model_name]) {
      const key = typeof raw === "string" ? raw.trim().toUpperCase() : "";
      if (key && codes.includes(key) && !codeToModel.has(key)) {
        codeToModel.set(key, { product_id: m.product_id, model_id: m.id });
      }
    }
  }
  if (codeToModel.size === 0) return NextResponse.json({ matches: {} });

  const matchedProductIds = Array.from(new Set(Array.from(codeToModel.values()).map((v) => v.product_id)));
  const { data: media, error: medErr } = await supabaseServer
    .from("product_media")
    .select("product_id, model_id, url, file_path, role, order, type")
    .in("product_id", matchedProductIds);
  if (medErr) {
    console.error("[preorders/match-products media]", medErr.message);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }

  const isImage = (t: string | null | undefined) => !t || /image|photo|img|png|jpg|jpeg|webp/i.test(t);
  const roleRank = (r: string | null | undefined) =>
    r === "primary" || r === "cover" || r === "main" ? 0 : 1;

  // Best image per (model_id) and per (product_id).
  const pick = (rows: typeof media) =>
    (rows ?? [])
      .filter((m) => isImage(m.type) && mediaUrl(m))
      .sort((a, b) => roleRank(a.role) - roleRank(b.role) || (a.order ?? 999) - (b.order ?? 999))[0];

  const matches: Record<string, string> = {};
  for (const [code, ref] of codeToModel) {
    const byModel = pick((media ?? []).filter((m) => m.model_id === ref.model_id));
    const byProduct = byModel ?? pick((media ?? []).filter((m) => m.product_id === ref.product_id));
    const url = byProduct ? mediaUrl(byProduct) : null;
    if (url) matches[code] = url;
  }

  return NextResponse.json({ matches });
}
