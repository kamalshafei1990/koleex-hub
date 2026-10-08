import "server-only";

/* ---------------------------------------------------------------------------
   product-photos — which picture represents a product, decided once.

   The Hub already answers this in /api/products/media-thumbs: a row tagged
   `role: "hero"` wins outright, otherwise the lowest `order` row is taken,
   and the address is `url` when the row carries one or a public storage URL
   derived from `file_path` when it does not.

   That rule now has a second caller — Koleex AI, which shows a product's
   photo when it talks about the product — and a rule with two callers
   belongs in one file. Copying it would mean the assistant could show a
   different picture from the one the catalogue shows for the same product,
   which is the kind of difference nobody reports as a bug and everybody
   quietly distrusts.

   Service-role reads: product_media is not browser-readable, and every
   caller here has already passed its own permission check. Photos are
   neutral catalogue data — the same picture any viewer sees on the product
   page — so there is no cost/supplier surface to gate here.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "./supabase-server";

interface MediaRow {
  product_id: string;
  url: string | null;
  file_path: string | null;
  role: string | null;
}

function resolve(r: MediaRow): string | null {
  if (r.url) return r.url;
  if (r.file_path) {
    const { data } = supabaseServer.storage.from("media").getPublicUrl(r.file_path);
    return data.publicUrl || null;
  }
  return null;
}

/**
 * One representative photo per product id. Missing products are simply
 * absent from the map — a product with no media is normal, not an error.
 */
export async function mainPhotoByProduct(
  productIds: string[],
): Promise<Record<string, string>> {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (ids.length === 0) return {};

  const { data, error } = await supabaseServer
    .from("product_media")
    .select("product_id, url, file_path, role, order")
    .in("product_id", ids)
    .order("order", { ascending: true });
  if (error) {
    console.error("[product-photos]", error.message);
    return {};
  }

  const out: Record<string, string> = {};
  const heroLocked = new Set<string>();
  for (const r of (data ?? []) as MediaRow[]) {
    const src = resolve(r);
    if (!src) continue;
    if (r.role === "hero") {
      out[r.product_id] = src;
      heroLocked.add(r.product_id);
    } else if (!out[r.product_id] && !heroLocked.has(r.product_id)) {
      out[r.product_id] = src;
    }
  }
  return out;
}
