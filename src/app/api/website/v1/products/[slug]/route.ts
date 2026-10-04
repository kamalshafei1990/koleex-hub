/* Website bridge — one product page, the same content the Hub's own public
   page shows (loadPublicSchemaProduct, audience "public": customer content,
   website fields only, no price), then scrubbed once more. 404 for anything
   that is not this company's, active and visible; 500 when any read fails
   (strict), never a product with parts missing — the website would keep it. */

import { bridgeJson, requireWebsiteBridge } from "@/lib/server/website-bridge";
import { scrubForWebsite, websiteProductId } from "@/lib/server/website-catalog";
import { loadPublicSchemaProduct } from "@/lib/server/product-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const denied = requireWebsiteBridge(req);
  if (denied) return denied;
  const { slug } = await params;
  try {
    const id = await websiteProductId(slug);
    const product = id ? await loadPublicSchemaProduct(id, { audience: "public", strict: true }) : null;
    if (!product) return bridgeJson({ error: "Not found" }, 404);
    return bridgeJson({ product: scrubForWebsite(product) });
  } catch (e) {
    console.error(`[website-bridge] product ${(e as Error).message}`);
    return bridgeJson({ error: "Could not load the product." }, 500);
  }
}
