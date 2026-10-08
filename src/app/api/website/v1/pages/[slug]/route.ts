/* Website bridge — one site page: its published Page Builder document, or
   the old editor's visible sections and elements. ?draft=1 answers the
   DRAFT instead — for the site's own signed preview (the key already proves
   the caller is the site's server). The website caches it under
   "page:{slug}" (never the draft). */

import { bridgeJson, requireWebsiteBridge } from "@/lib/server/website-bridge";
import { websitePage } from "@/lib/server/website-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const denied = requireWebsiteBridge(req);
  if (denied) return denied;
  const { slug } = await params;
  try {
    const page = await websitePage(slug, { draft: new URL(req.url).searchParams.get("draft") === "1" });
    if (!page) return bridgeJson({ error: "Not found" }, 404);
    return bridgeJson(page);
  } catch (e) {
    console.error(`[website-bridge] page ${(e as Error).message}`);
    return bridgeJson({ error: "Could not load the page." }, 500);
  }
}
