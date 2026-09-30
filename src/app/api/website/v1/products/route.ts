/* Website bridge — the product list: active, visible products of the host
   company, no price. ?division= ?category= ?subcategory= ?featured=1 ?q=
   ?slugs=a,b,c (hand-picked, in that order, ≤24) ?page= ?pageSize= (≤100).
   The website caches it under the "products" tag. */

import { bridgeJson, requireWebsiteBridge } from "@/lib/server/website-bridge";
import { listWebsiteProducts } from "@/lib/server/website-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireWebsiteBridge(req);
  if (denied) return denied;
  const sp = new URL(req.url).searchParams;
  const int = (k: string) => { const n = Number(sp.get(k)); return Number.isFinite(n) && n > 0 ? n : undefined; };
  try {
    const result = await listWebsiteProducts({
      division: sp.get("division"),
      category: sp.get("category"),
      subcategory: sp.get("subcategory"),
      featured: sp.get("featured") === "1",
      q: sp.get("q"),
      slugs: sp.get("slugs")?.split(",").map((x) => x.trim()).filter(Boolean) ?? null,
      page: int("page"),
      pageSize: int("pageSize"),
    });
    return bridgeJson(result);
  } catch (e) {
    console.error(`[website-bridge] products ${(e as Error).message}`);
    return bridgeJson({ error: "Could not load products." }, 500);
  }
}
