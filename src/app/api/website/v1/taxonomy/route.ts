/* Website bridge — divisions › categories › subcategories in three
   languages, each with its count of products the website shows. The
   website caches it under the "taxonomy" tag. */

import { bridgeJson, requireWebsiteBridge } from "@/lib/server/website-bridge";
import { websiteTaxonomy } from "@/lib/server/website-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireWebsiteBridge(req);
  if (denied) return denied;
  try {
    return bridgeJson({ divisions: await websiteTaxonomy() });
  } catch (e) {
    console.error(`[website-bridge] taxonomy ${(e as Error).message}`);
    return bridgeJson({ error: "Could not load the taxonomy." }, 500);
  }
}
