/* Website bridge — Koleex's own catalogs the website shows (title and
   description in English, Arabic and Chinese, the PDF's public link, cover,
   year, size). Suppliers' catalogs never live in this table. The website
   caches it under "catalogs". */

import { bridgeJson, requireWebsiteBridge } from "@/lib/server/website-bridge";
import { listCatalogs } from "@/lib/server/website/catalogs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireWebsiteBridge(req);
  if (denied) return denied;
  try {
    const catalogs = (await listCatalogs(true)).map(({ id, title, description, fileUrl, fileSize, coverUrl, year }) => ({ id, title, description, fileUrl, fileSize, coverUrl, year }));
    return bridgeJson({ catalogs });
  } catch (e) {
    console.error(`[website-bridge] catalogs ${(e as Error).message}`);
    return bridgeJson({ error: "Could not load the catalogs." }, 500);
  }
}
