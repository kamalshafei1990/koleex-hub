import "server-only";

/* Match preorder model codes to products and return a primary image URL per code.
   Codes are matched (case-insensitive) against product_models.sku and .model_name,
   then tenant-verified. Returns { matches: { CODE: url } } — codes with no product
   or no image are simply omitted. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

const SUPA = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
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
  const wanted = new Set(codes);

  // Fetch all models (small table) and match in JS — avoids huge IN() lists.
  const { data: models, error: mErr } = await supabaseServer
    .from("product_models")
    .select("id, product_id, sku, model_name");
  if (mErr) {
    console.error("[match-products models]", mErr.message);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }

  const codeToModel = new Map<string, { product_id: string; model_id: string }>();
  for (const m of models ?? []) {
    if (!m.product_id) continue;
    for (const raw of [m.sku, m.model_name]) {
      const key = typeof raw === "string" ? raw.trim().toUpperCase() : "";
      if (key && wanted.has(key) && !codeToModel.has(key)) {
        codeToModel.set(key, { product_id: m.product_id, model_id: m.id });
      }
    }
  }
  if (codeToModel.size === 0) return NextResponse.json({ matches: {} });

  const matchedProductIds = Array.from(new Set(Array.from(codeToModel.values()).map((v) => v.product_id)));

  // Tenant-verify just the matched products (small list).
  const { data: prods, error: pErr } = await supabaseServer
    .from("products")
    .select("id, tenant_id")
    .in("id", matchedProductIds);
  if (pErr) {
    console.error("[match-products products]", pErr.message);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
  const okProducts = new Set((prods ?? []).filter((p) => p.tenant_id === auth.tenant_id).map((p) => p.id));
  if (okProducts.size === 0) return NextResponse.json({ matches: {} });

  // Media for just the matched products (small list). Alias reserved "order".
  const { data: media, error: medErr } = await supabaseServer
    .from("product_media")
    .select("product_id, model_id, url, file_path, role, type, ord:order")
    .in("product_id", Array.from(okProducts));
  if (medErr) {
    console.error("[match-products media]", medErr.message);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }

  const isImage = (t: string | null | undefined) => !t || /image|photo|img|main|hero|png|jpe?g|webp/i.test(t);
  const roleRank = (r: string | null | undefined) =>
    r === "primary" || r === "cover" || r === "main" || r === "hero" ? 0 : 1;
  const pick = (rows: NonNullable<typeof media>) =>
    rows
      .filter((m) => isImage(m.type) && mediaUrl(m))
      .sort((a, b) => roleRank(a.role) - roleRank(b.role) || ((a.ord ?? 999) - (b.ord ?? 999)))[0];

  const all = media ?? [];
  const matches: Record<string, string> = {};
  for (const [code, ref] of codeToModel) {
    if (!okProducts.has(ref.product_id)) continue;
    const byModel = pick(all.filter((m) => m.model_id === ref.model_id));
    const best = byModel ?? pick(all.filter((m) => m.product_id === ref.product_id));
    const url = best ? mediaUrl(best) : null;
    if (url) matches[code] = url;
  }

  return NextResponse.json({ matches });
}
