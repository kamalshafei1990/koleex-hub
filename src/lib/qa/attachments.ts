import "server-only";

/* ---------------------------------------------------------------------------
   QA comment attachments (Phase 4.2) — server-side validation + signing.

   Images are uploaded via the existing /api/qa/upload endpoint (which already
   validates type + size and writes to the private `qa-screenshots` bucket
   under a tenant-scoped path `${tenant_id}/...`). A comment then stores only
   metadata { path, name, type, size, uploaded_at } in qa_issue_comments.
   attachments; the URL is never stored — it's signed per request on read so
   nothing leaks across tenants and links expire.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

const BUCKET = "qa-screenshots";
export const ATTACH_MAX_BYTES = 5 * 1024 * 1024;
export const ATTACH_MAX_COUNT = 4;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

export interface StoredAttachment {
  path: string;
  name: string;
  type: string;
  size: number;
  uploaded_at: string;
}

/**
 * Validate + normalise client-supplied attachment metadata before storing.
 *  • path must live under the caller's tenant prefix (no cross-tenant refs)
 *  • type must be an allowed image MIME
 *  • size must be within the 5 MB cap (the upload endpoint also enforces this)
 *  • count is capped
 * Returns a clean array or a user-facing error.
 */
export function sanitizeAttachments(
  tenantId: string,
  raw: unknown,
): { ok: true; value: StoredAttachment[] } | { ok: false; error: string } {
  if (raw == null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Attachments must be a list." };
  if (raw.length > ATTACH_MAX_COUNT) return { ok: false, error: `Up to ${ATTACH_MAX_COUNT} images per comment.` };

  const now = new Date().toISOString();
  const out: StoredAttachment[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") return { ok: false, error: "Invalid attachment." };
    const o = a as Record<string, unknown>;
    const path = typeof o.path === "string" ? o.path : "";
    const type = typeof o.type === "string" ? o.type : "";
    const size = typeof o.size === "number" ? o.size : 0;
    const name = (typeof o.name === "string" ? o.name : "image").slice(0, 200);
    if (!path.startsWith(`${tenantId}/`)) return { ok: false, error: "Attachment is outside this tenant." };
    if (!ALLOWED_MIME.has(type)) return { ok: false, error: "Only PNG, JPG or WEBP images are allowed." };
    if (size > ATTACH_MAX_BYTES) return { ok: false, error: "An attachment is too large (max 5 MB)." };
    out.push({ path, name, type, size, uploaded_at: now });
  }
  return { ok: true, value: out };
}

/** Resolve stored attachment paths to short-lived signed URLs (tenant-scoped). */
export async function signAttachments(
  tenantId: string,
  list: unknown,
): Promise<Array<StoredAttachment & { url: string | null }>> {
  if (!Array.isArray(list)) return [];
  const out: Array<StoredAttachment & { url: string | null }> = [];
  for (const a of list) {
    const o = (a ?? {}) as Record<string, unknown>;
    const path = typeof o.path === "string" ? o.path : "";
    let url: string | null = null;
    if (path.startsWith(`${tenantId}/`)) {
      const { data } = await supabaseServer.storage.from(BUCKET).createSignedUrl(path, 3600);
      url = data?.signedUrl ?? null;
    }
    out.push({
      path,
      name: typeof o.name === "string" ? o.name : "image",
      type: typeof o.type === "string" ? o.type : "",
      size: typeof o.size === "number" ? o.size : 0,
      uploaded_at: typeof o.uploaded_at === "string" ? o.uploaded_at : "",
      url,
    });
  }
  return out;
}
