/* Website bridge — the front door: the website checks it can reach the Hub
   (key right, bridge configured) and learns what it can read. */

import { bridgeJson, requireWebsiteBridge, websiteTenantId } from "@/lib/server/website-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireWebsiteBridge(req);
  if (denied) return denied;
  const tenant = await websiteTenantId();
  return bridgeJson({
    ok: !!tenant,
    version: 1,
    endpoints: [
      "/api/website/v1/products",
      "/api/website/v1/products/{slug}",
      "/api/website/v1/taxonomy",
      "/api/website/v1/pages",
      "/api/website/v1/pages/{slug}",
      "/api/website/v1/jobs",
      "/api/website/v1/company",
      "/api/website/v1/catalogs",
    ],
    tags: ["products", "taxonomy", "jobs", "company", "catalogs", "page:{slug}"],
  });
}
