import "server-only";

/* GET /api/brand-center/products — the products a post template can be made
   for (plan step C14), with only what a post may show.
     ?q=<words>  up to 20 ACTIVE products whose name or KOLEEX model matches
                 (owner rule: only active products are ever offered);
     ?id=<uuid>  one of them in full: its name in English / Chinese / Arabic,
                 the KOLEEX model, the category, the main photo, the selling
                 points and the feature highlights.
   Never a price and never a supplier: the model is the commercial KOLEEX
   code (`primary_model`) only — never the supplier's reference or name.
   Anyone who can open Brand Center; the tenant's own products only.
   Pictures are first-party addresses (our own image optimizer, reachable
   from China — never supabase.co in the browser): a post's photo at up to
   2048 px, a search row's thumbnail at 96. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { brandCenterGate } from "@/lib/server/brand-center/access";
import { mainPhotoByProduct } from "@/lib/server/product-photos";
import { cdnImage } from "@/lib/cdn";

const big = (url: string | null | undefined) => (url ? cdnImage(url, { width: 2048, quality: 78, resize: "contain" }) : null);

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = { id: string; product_name: string; category_slug: string | null; subcategory_slug: string | null; highlights: string[] | null };

/** The KOLEEX model of each product: its first model's commercial code. */
async function modelsOf(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { data } = await supabaseServer.from("product_models").select("product_id, primary_model, created_at")
    .in("product_id", ids).not("primary_model", "is", null).order("created_at", { ascending: true });
  const out: Record<string, string> = {};
  for (const m of (data ?? []) as Array<{ product_id: string; primary_model: string | null }>) {
    if (m.primary_model && !out[m.product_id]) out[m.product_id] = m.primary_model;
  }
  return out;
}

/** The sub-category's name (the more precise), else the category's. */
async function categoryNames(rows: Row[]) {
  const subs = [...new Set(rows.map((r) => r.subcategory_slug).filter(Boolean))] as string[];
  const cats = [...new Set(rows.map((r) => r.category_slug).filter(Boolean))] as string[];
  const [s, c] = await Promise.all([
    subs.length ? supabaseServer.from("subcategories").select("slug, name, name_zh, name_ar").in("slug", subs) : Promise.resolve({ data: [] }),
    cats.length ? supabaseServer.from("categories").select("slug, name, name_zh, name_ar").in("slug", cats) : Promise.resolve({ data: [] }),
  ]);
  type N = { slug: string; name: string; name_zh: string | null; name_ar: string | null };
  const sub = new Map(((s.data ?? []) as N[]).map((x) => [x.slug, x]));
  const cat = new Map(((c.data ?? []) as N[]).map((x) => [x.slug, x]));
  return (r: Row) => (r.subcategory_slug && sub.get(r.subcategory_slug)) || (r.category_slug && cat.get(r.category_slug)) || null;
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = await brandCenterGate(auth, "view");
  if (denied) return denied;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const cols = "id, product_name, category_slug, subcategory_slug, highlights";

  if (id) {
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { data: p, error } = await supabaseServer.from("products").select(cols)
      .eq("id", id).eq("tenant_id", auth.tenant_id).eq("status", "active").maybeSingle();
    if (error) {
      console.error("[api/brand-center/products id]", error.message);
      return NextResponse.json({ error: "Could not load the product." }, { status: 500 });
    }
    if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const row = p as Row;
    const [photos, models, names, tr, feats] = await Promise.all([
      mainPhotoByProduct([row.id]),
      modelsOf([row.id]),
      categoryNames([row]),
      supabaseServer.from("product_translations").select("locale, product_name").eq("product_id", row.id),
      supabaseServer.from("product_feature_highlights").select("title, title_zh, title_ar, description, description_zh, description_ar, image_url, sort")
        .eq("product_id", row.id).is("model_id", null).order("sort", { ascending: true }).limit(8),
    ]);
    const nameIn = (pre: string) => ((tr.data ?? []) as Array<{ locale: string; product_name: string }>).find((t) => t.locale?.toLowerCase().startsWith(pre))?.product_name?.trim() || null;
    const cat = names(row);
    return NextResponse.json({
      product: {
        id: row.id,
        name: row.product_name,
        nameZh: nameIn("zh"),
        nameAr: nameIn("ar"),
        model: models[row.id] ?? null,
        category: cat?.name ?? null,
        categoryZh: cat?.name_zh ?? null,
        categoryAr: cat?.name_ar ?? null,
        photo: big(photos[row.id]),
        highlights: (row.highlights ?? []).map((h) => h.trim()).filter(Boolean).slice(0, 6),
        features: ((feats.data ?? []) as Array<Record<string, string | null>>).map((f) => ({
          title: f.title ?? "", titleZh: f.title_zh, titleAr: f.title_ar,
          text: f.description, textZh: f.description_zh, textAr: f.description_ar, image: big(f.image_url),
        })).filter((f) => f.title),
      },
    });
  }

  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!q) return NextResponse.json({ products: [] });
  const safe = q.replace(/[%_\\]/g, (c) => `\\${c}`);
  const [byName, byModel] = await Promise.all([
    supabaseServer.from("products").select(cols).eq("tenant_id", auth.tenant_id).eq("status", "active")
      .ilike("product_name", `%${safe}%`).order("product_name", { ascending: true }).limit(20),
    supabaseServer.from("product_models").select("product_id").ilike("primary_model", `%${safe}%`).limit(20),
  ]);
  if (byName.error) {
    console.error("[api/brand-center/products q]", byName.error.message);
    return NextResponse.json({ error: "Could not load products." }, { status: 500 });
  }
  let rows = (byName.data ?? []) as Row[];
  const extra = [...new Set(((byModel.data ?? []) as Array<{ product_id: string }>).map((m) => m.product_id))].filter((pid) => !rows.some((r) => r.id === pid));
  if (extra.length && rows.length < 20) {
    const { data } = await supabaseServer.from("products").select(cols).eq("tenant_id", auth.tenant_id).eq("status", "active").in("id", extra).limit(20 - rows.length);
    rows = [...rows, ...((data ?? []) as Row[])];
  }
  const ids = rows.map((r) => r.id);
  const [photos, models, names] = await Promise.all([mainPhotoByProduct(ids), modelsOf(ids), categoryNames(rows)]);
  return NextResponse.json({
    products: rows.map((r) => ({ id: r.id, name: r.product_name, model: models[r.id] ?? null, category: names(r)?.name ?? null, photo: photos[r.id] ? cdnImage(photos[r.id], { width: 96, resize: "contain" }) : null })),
  });
}
