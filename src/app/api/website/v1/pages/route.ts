/* Website bridge — the site's pages (slug, name, title, description), for
   its navigation and sitemap. */

import { bridgeJson, requireWebsiteBridge } from "@/lib/server/website-bridge";
import { listWebsitePages } from "@/lib/server/website-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireWebsiteBridge(req);
  if (denied) return denied;
  try {
    return bridgeJson({ pages: await listWebsitePages() });
  } catch (e) {
    console.error(`[website-bridge] pages ${(e as Error).message}`);
    return bridgeJson({ error: "Could not load the pages." }, 500);
  }
}
