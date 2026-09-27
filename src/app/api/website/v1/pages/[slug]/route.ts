/* Website bridge — one site page with its visible sections and elements, in
   the Website app's order. The website caches it under "page:{slug}". */

import { bridgeJson, requireWebsiteBridge } from "@/lib/server/website-bridge";
import { websitePage } from "@/lib/server/website-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const denied = requireWebsiteBridge(req);
  if (denied) return denied;
  const { slug } = await params;
  try {
    const page = await websitePage(slug);
    if (!page) return bridgeJson({ error: "Not found" }, 404);
    return bridgeJson(page);
  } catch (e) {
    console.error(`[website-bridge] page ${(e as Error).message}`);
    return bridgeJson({ error: "Could not load the page." }, 500);
  }
}
