/* GET /api/website/catalog — what a page's products section can show, the
   way the site shows it (lib/server/website-catalog: active and visible,
   no price): ?q=words → matching products (≤12) for "pick products";
   ?slugs=a,b → those cards; no query → the categories that have products.
   Website view. */

import { NextResponse } from "next/server";
import { builderJson, guardWebsite } from "@/lib/server/website/guard";
import { listWebsiteProducts, websiteTaxonomy } from "@/lib/server/website-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await guardWebsite("view");
  if (auth instanceof NextResponse) return auth;
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 80);
  const slugs = (sp.get("slugs") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 24);
  try {
    if (q || slugs.length) {
      const list = await listWebsiteProducts(slugs.length ? { slugs } : { q, pageSize: 12 });
      return builderJson({ products: list.items.map((p) => ({ slug: p.slug, name: p.name, image: p.image })) });
    }
    const categories = (await websiteTaxonomy()).flatMap((d) =>
      d.categories.filter((c) => c.productCount > 0).map((c) => ({ slug: c.slug, name: c.name, division: d.name, count: c.productCount })));
    return builderJson({ categories });
  } catch (e) {
    console.error(`[website/catalog] ${(e as Error).message}`);
    return builderJson({ error: "The catalog could not be loaded." }, 500);
  }
}
