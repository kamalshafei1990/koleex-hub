/* Website bridge — open job postings for the careers page, newest first,
   without the salary. The website caches it under the "jobs" tag. */

import { bridgeJson, requireWebsiteBridge } from "@/lib/server/website-bridge";
import { listWebsiteJobs } from "@/lib/server/website-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireWebsiteBridge(req);
  if (denied) return denied;
  try {
    return bridgeJson({ jobs: await listWebsiteJobs(new Date().toISOString().slice(0, 10)) });
  } catch (e) {
    console.error(`[website-bridge] jobs ${(e as Error).message}`);
    return bridgeJson({ error: "Could not load the jobs." }, 500);
  }
}
