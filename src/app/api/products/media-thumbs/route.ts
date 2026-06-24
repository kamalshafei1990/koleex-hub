import "server-only";

/* GET /api/products/media-thumbs — { thumbs: { [product_id]: url } }

   The product photos live in product_media (service-role-only, so the browser
   anon client can't read them). This resolves one thumbnail per product — the
   `hero` image when present, otherwise the lowest-ordered row — for the To-do
   product picker grid. Gated by To-do module access. */

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

  return NextResponse.json(
    { thumbs },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
  );
}
