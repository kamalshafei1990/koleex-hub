import "server-only";

/* ---------------------------------------------------------------------------
   /api/quotations/catalog-search

   Search the product catalog for the quotation builder's "add from
   catalog" picker. Returns a flat list of model rows — one per model
   — joined with the parent product's display name and the first
   product image, so the picker can show:

     [ thumbnail | MODEL CODE | product name | price ]

   Query:
     q=<text>        free-text search against model_name + product_name
     limit=<n>       cap (default 40, max 100)

   Auth: any authenticated user. Customers get the same projection;
   no cost / supplier fields are exposed.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

interface ProductRow {
  id: string;
  product_name: string;
  status?: string;
  visible?: boolean;
}
interface ModelRow {
  id: string;
  product_id: string;
  model_name: string | null;
  sku: string | null;
  global_price: number | null;
  head_only_price: number | null;
  complete_set_price: number | null;
  visible?: boolean;
  status?: string;
}
interface MediaRow {
  product_id: string;
  url: string | null;
  order: number | null;
}

interface PickerRow {
  product_id: string;
  model_id: string;
  model_name: string;
  sku: string;
  product_name: string;
  price: number;
  image_url: string | null;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  /* Internal-only — the picker surfaces every catalog row including
     drafts and not-yet-visible products. External customers must
     never see those, so gate the route behind Quotations module
     access (sales staff + admins). */
  const deny = await requireModuleAccess(auth, "Quotations");
  if (deny) return deny;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  /* Hard cap on what we ever return in one response. Tenants with
     more SKUs than this would need a scrolled / paginated picker —
     none today exceed ~2k models, well under the cap. */
  const limit = Math.min(
    Math.max(1, Number(url.searchParams.get("limit") ?? 2000)),
    2000,
  );

  /* Three queries in parallel. We deliberately do NOT cap the
     product_models query — capping it at `limit * 3` meant the
     server only ever scanned the first ~180 models, so a search
     for an SKU that lived past that slot returned nothing. The
     full catalog is small enough (one tenant's products) to load
     into memory in one pass, and we cap the OUTPUT after the
     filter so the response payload stays bounded. */
  const productsQuery = supabaseServer
    .from("products")
    .select("id, product_name, status, visible");
  const modelsQuery = supabaseServer
    .from("product_models")
    .select(
      "id, product_id, model_name, sku, global_price, head_only_price, complete_set_price, visible, status",
    )
    .order("order", { ascending: true });
  const mediaQuery = supabaseServer
    .from("product_media")
    .select("product_id, url, order")
    .order("order", { ascending: true });

  const [productsRes, modelsRes, mediaRes] = await Promise.all([
    productsQuery,
    modelsQuery,
    mediaQuery,
  ]);

  if (productsRes.error || modelsRes.error || mediaRes.error) {
    const msg =
      productsRes.error?.message ||
      modelsRes.error?.message ||
      mediaRes.error?.message ||
      "catalog fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const products = (productsRes.data ?? []) as ProductRow[];
  const productById = new Map(products.map((p) => [p.id, p]));

  /* First image per product. media query is pre-sorted by `order` so
     `set(...).get(...)` keeps the first one (we only insert if absent). */
  const firstImage = new Map<string, string>();
  for (const m of (mediaRes.data ?? []) as MediaRow[]) {
    if (m.url && !firstImage.has(m.product_id)) {
      firstImage.set(m.product_id, m.url);
    }
  }

  const needle = q.toLowerCase();
  const out: PickerRow[] = [];
  for (const m of (modelsRes.data ?? []) as ModelRow[]) {
    const product = productById.get(m.product_id);
    if (!product) continue;
    /* Internal picker — drafts and not-yet-visible products MUST be
       reachable so sales can quote new SKUs before they go public.
       The route's auth + module-access gates are the security
       perimeter here, not the visibility flag. */

    const modelName = m.model_name ?? m.sku ?? "";
    const productName = product.product_name ?? "";

    if (needle) {
      /* Match against model code + SKU + product name so a bounded server
         search (used by the picker's debounced query) finds a SKU even when
         model_name is present. Broadens matches only — never narrows. */
      const hay = `${modelName} ${m.sku ?? ""} ${productName}`.toLowerCase();
      if (!hay.includes(needle)) continue;
    }

    /* Pick the most useful price for the picker. Prefer global_price
       (the headline catalog price) and fall back to complete-set, then
       head-only, then 0. The salesperson will edit it anyway, but a
       sensible default beats 0. */
    const price =
      typeof m.global_price === "number"
        ? m.global_price
        : typeof m.complete_set_price === "number"
          ? m.complete_set_price
          : typeof m.head_only_price === "number"
            ? m.head_only_price
            : 0;

    out.push({
      product_id: m.product_id,
      model_id: m.id,
      model_name: modelName,
      sku: m.sku ?? "",
      product_name: productName,
      price,
      image_url: firstImage.get(m.product_id) ?? null,
    });

    if (out.length >= limit) break;
  }

  return NextResponse.json(
    { rows: out },
    {
      /* Catalog is read-heavy and changes infrequently. 60 s cache +
         stale-while-revalidate keeps the picker snappy when the user
         types and re-opens. */
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=300",
      },
    },
  );
}
