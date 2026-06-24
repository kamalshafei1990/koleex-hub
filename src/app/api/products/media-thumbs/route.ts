import "server-only";

/* GET /api/products/media-thumbs — { thumbs: {...}, models: {...} }

   The product photos live in product_media (service-role-only, so the browser
   anon client can't read them). This resolves one thumbnail per product — the
   `hero` image when present, otherwise the lowest-ordered row — for the To-do
   product picker grid. It also returns one model code per product (the KOLEEX
   primary_model when set, otherwise model_name) so cards can show model + name.
   Gated by To-do module access. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "To-do");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("product_media")
    .select("product_id, url, file_path, role, order")
    .order("product_id", { ascending: true })
    .order("order", { ascending: true });
  if (error) {
    console.error("[api/products/media-thumbs]", error.message);
    return NextResponse.json({ thumbs: {} });
  }

  const rows = (data ?? []) as Array<{
    product_id: string;
    url: string | null;
    file_path: string | null;
    role: string | null;
  }>;

  const resolve = (r: { url: string | null; file_path: string | null }): string | null => {
    if (r.url) return r.url;
    if (r.file_path) {
      const { data: pub } = supabaseServer.storage.from("media").getPublicUrl(r.file_path);
      return pub.publicUrl;
    }
    return null;
  };

  /* hero wins; otherwise keep the first (lowest-order) row seen per product. */
  const thumbs: Record<string, string> = {};
  const heroLocked = new Set<string>();
  for (const r of rows) {
    const src = resolve(r);
    if (!src) continue;
    if (r.role === "hero") {
      thumbs[r.product_id] = src;
      heroLocked.add(r.product_id);
    } else if (!thumbs[r.product_id] && !heroLocked.has(r.product_id)) {
      thumbs[r.product_id] = src;
    }
  }

  /* One model code per product: primary_model (official KOLEEX code) wins,
     otherwise model_name. Both live in product_models (service-role-only). */
  const models: Record<string, string> = {};
  const { data: mData } = await supabaseServer
    .from("product_models")
    .select("product_id, model_name, primary_model");
  for (const m of (mData ?? []) as Array<{
    product_id: string;
    model_name: string | null;
    primary_model: string | null;
  }>) {
    const code = (m.primary_model || m.model_name || "").trim();
    if (code && !models[m.product_id]) models[m.product_id] = code;
  }

  return NextResponse.json(
    { thumbs, models },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
  );
}
