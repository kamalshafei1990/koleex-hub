import "server-only";

/* ---------------------------------------------------------------------------
   generated-storage — one home for files the AI makes (images, documents).

   Both generation tools (image-gen, doc-gen) used to carry their own copy
   of "upload to the media bucket under ai-generated/<tenant>/<account>".
   This is that code, once.

   THE URL THE USER SEES is on OUR OWN DOMAIN, not Supabase's. The bucket
   is public-by-design (the link is the token — a random UUID path), and
   the Hub proxies the exact same bytes at /ai/files/<tenant>/<account>/<id>
   via a next.config rewrite. Same bytes, same access semantics, but a link
   in the chat reads hub.koleexgroup.com — not a storage host the user has
   never heard of (owner, 2026-10-08: "when I press the link it sends me to
   supabase").
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../supabase-server";
import { isUuid } from "../ai-agent/uuid";

const BUCKET = "media";
const PREFIX = "ai-generated";

/** The origin a user can open. NEXT_PUBLIC_APP_URL wins when set; on Vercel
 *  the production-domain variable is the one that names hub.koleexgroup.com
 *  (VERCEL_URL is the per-deployment host — right bytes, ugly link); local
 *  dev falls back to the dev server, whose rewrite proxies the same bucket
 *  the local env points at. */
export function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prodHost) return `https://${prodHost}`;
  const deployHost = process.env.VERCEL_URL?.trim();
  if (deployHost) return `https://${deployHost}`;
  return "http://localhost:3001";
}

/** Bytes in, a Hub-domain URL out — or null, and the caller says so
 *  plainly. The tenant/account pair names the path so no link can ever be
 *  guessed into somebody else's. */
export async function storeGeneratedFile(
  tenantId: string,
  accountId: string,
  bytes: Uint8Array,
  contentType: string,
  ext: string,
): Promise<string | null> {
  if (!isUuid(tenantId) || !isUuid(accountId)) return null;
  const path = `${PREFIX}/${tenantId}/${accountId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseServer.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: false, cacheControl: "31536000" });
  if (error) {
    console.error("[ai.files] store failed", error.message);
    return null;
  }
  return `${appOrigin()}/ai/files/${tenantId}/${accountId}/${path.split("/").pop()}`;
}
