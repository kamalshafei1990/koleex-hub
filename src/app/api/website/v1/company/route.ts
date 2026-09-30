/* Website bridge — the company as the site shows it (lib/server/website-
   company: the Hub's own record — the papers' address, phones and email,
   and the owner-approved facts). The website caches it under "company";
   it changes only with a deploy of the Hub, so the hourly refresh is
   enough. */

import { bridgeJson, requireWebsiteBridge } from "@/lib/server/website-bridge";
import { websiteCompany } from "@/lib/server/website-company";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireWebsiteBridge(req);
  if (denied) return denied;
  return bridgeJson({ company: websiteCompany() });
}
