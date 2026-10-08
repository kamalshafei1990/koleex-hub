/* Website bridge — a message from the site's contact form or «Request a
   quotation» (lib/server/website/leads). The site's own server posts it,
   with a keyed hash of the sender's address; the Hub keeps it, finds or
   creates the customer, and tells the people who follow up once the site
   has its answer. The answer says only "kept" — never whether the email
   already belonged to a customer. */

import { after } from "next/server";
import { bridgeJson, requireWebsiteBridge } from "@/lib/server/website-bridge";
import { notifyLead, receiveLead } from "@/lib/server/website/leads";
import { isError } from "@/lib/server/website/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY_MAX = 32 * 1024;

export async function POST(req: Request) {
  const denied = requireWebsiteBridge(req);
  if (denied) return denied;
  const raw = await req.text();
  if (raw.length > BODY_MAX) return bridgeJson({ error: "The message is too long.", code: "too_long" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return bridgeJson({ error: "Bad request.", code: "bad_request" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return bridgeJson({ error: "Bad request.", code: "bad_request" }, 400);
  try {
    const lead = await receiveLead(body as Record<string, unknown>);
    if (isError(lead)) return bridgeJson({ error: lead.error, code: lead.code }, lead.status);
    after(() => notifyLead(lead));
    return bridgeJson({ ok: true });
  } catch (e) {
    console.error(`[website-bridge] leads ${(e as Error).message}`);
    return bridgeJson({ error: "The message could not be sent.", code: "failed" }, 500);
  }
}
