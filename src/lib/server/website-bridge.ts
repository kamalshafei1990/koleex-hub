import "server-only";

/* ---------------------------------------------------------------------------
   Website bridge — how the public website (koleexgroup.com) reads the Hub and
   how the Hub tells it something changed (owner, 27/09/2026: "start with the
   website bridge first").

   The website has no data of its own. Its server fetches /api/website/v1/*
   with a shared key and caches each answer under a tag; when the Hub changes
   a product, a page or a job, revalidateWebsite() asks the website to drop
   that tag, so the page is fresh seconds later without a rebuild.

   Server to server only: the key never reaches a browser, and the endpoints
   answer nobody else. That keeps the Hub with no anonymous door — the product
   tables stay locked to anon (P0 security), and the website's pages stay
   static, so its visitors never load the Hub.

   Two env vars, both optional — until they are set the bridge is inert:
     WEBSITE_BRIDGE_KEY      the shared key (also set on the website)
     WEBSITE_REVALIDATE_URL  the website's revalidate endpoint
   --------------------------------------------------------------------------- */

import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";

const bridgeKey = (): string => (process.env.WEBSITE_BRIDGE_KEY ?? "").trim();

/** An answer from the bridge. Never cached by a CDN: it is keyed, and the
 *  website keeps its own copy under a tag. */
export function bridgeJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Every /api/website/v1 handler starts here: null when the caller holds the
 *  key, otherwise the response to return (503 while no key is configured). */
export function requireWebsiteBridge(req: Request): NextResponse | null {
  const key = bridgeKey();
  if (!key) return bridgeJson({ error: "The website bridge is not configured." }, 503);
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const given = Buffer.from(token);
  const expected = Buffer.from(key);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return bridgeJson({ error: "Unauthorized" }, 401);
  }
  return null;
}

/* The website shows ONE company: the host tenant (Koleex). Looked up once per
   server instance; a failed lookup is retried on the next call. */
let hostTenant: Promise<string | null> | null = null;
export function websiteTenantId(): Promise<string | null> {
  if (!hostTenant) {
    hostTenant = (async () => {
      const { data } = await supabaseServer
        .from("tenants")
        .select("id")
        .eq("is_host", true)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      const id = (data as { id?: string } | null)?.id ?? null;
      if (!id) hostTenant = null;
      return id;
    })();
  }
  return hostTenant;
}

/** What the website caches Hub data under. `products` covers the product
 *  pages and lists; `taxonomy` the divisions, categories and their counts. */
export type WebsiteTag = "products" | "taxonomy" | "jobs" | "company" | "catalogs" | `page:${string}`;

/** Ask the website to refresh what it cached under these tags. Runs after the
 *  response, so it never slows or fails the change that caused it. Inert until
 *  both env vars are set. Logs the outcome only — tags and timing, never data. */
export function revalidateWebsite(tags: WebsiteTag[]): void {
  const url = (process.env.WEBSITE_REVALIDATE_URL ?? "").trim();
  const key = bridgeKey();
  if (!url || !key || tags.length === 0) return;
  const unique = Array.from(new Set(tags));
  const run = async () => {
    const started = Date.now();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tags: unique }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) console.error(`[website-bridge] revalidate status=${res.status} tags=${unique.join(",")} ms=${Date.now() - started}`);
    } catch (e) {
      console.error(`[website-bridge] revalidate failed tags=${unique.join(",")} error=${(e as Error).name}`);
    }
  };
  /* Outside a request (a script) there is no after(): run it directly. */
  try { after(run); } catch { void run(); }
}
