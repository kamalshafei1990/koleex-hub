import "server-only";

/* ---------------------------------------------------------------------------
   persist-contact-images — root-cause guard against base64 re-entering the
   `contacts` table.

   The supplier/contact forms produce cropped avatars as inline `data:` URLs.
   If those are written straight into logo_url/photo_url, each row carries
   ~80–150 KB of base64, which bloats the directory list payload (toward
   Vercel's 4.5 MB response cap) and the table itself. This helper runs on the
   server BEFORE every insert/update and moves any inline image into the public
   `media` Storage bucket, replacing the column with a short URL — so no form,
   old or new, can reintroduce inline base64.

   Guarantees:
   • Idempotent — http/storage URLs and empty values pass straight through.
   • Data-safe — if an upload fails, the ORIGINAL value is kept (an image is
     never dropped); the row simply stays base64 until the next successful save.
   • Same bucket + path convention as the one-off backfill migration, and the
     stored images render identically (they're just relocated bytes).
   --------------------------------------------------------------------------- */

import { createHash } from "node:crypto";
import { supabaseServer } from "./supabase-server";

const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg",
  "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg",
};

/* Single-avatar image columns that must live in Storage, not inline. These are
   the fields rendered in the directory LIST; heavy detail-only blobs (QR codes,
   business cards, contact_persons) are stripped from the list separately. */
const IMAGE_FIELDS = ["logo_url", "photo_url"] as const;

function parseDataUrl(s: string): { mime: string; buf: Buffer } | null {
  const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(s);
  if (!m) return null;
  const mime = (m[1] || "image/png").toLowerCase();
  const buf = m[2]
    ? Buffer.from(m[3], "base64")
    : Buffer.from(decodeURIComponent(m[3]), "utf8");
  return { mime, buf };
}

async function uploadOne(
  tenantId: string | null,
  field: string,
  dataUrl: string,
): Promise<string> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return dataUrl; // unparseable — leave untouched
  const key = createHash("sha1").update(dataUrl).digest("hex");
  const ext = EXT[parsed.mime] || "png";
  const path = `${tenantId || "shared"}/contact-images/${field}/${key}.${ext}`;
  const up = await supabaseServer.storage.from("media").upload(path, parsed.buf, {
    contentType: parsed.mime, upsert: true, cacheControl: "31536000",
  });
  if (up.error) throw new Error(up.error.message);
  return supabaseServer.storage.from("media").getPublicUrl(path).data.publicUrl;
}

/**
 * Convert any inline base64 `data:` URL in the known avatar fields of a contact
 * write payload into a Storage URL, IN PLACE. Safe to call on every create /
 * update; non-image values and existing URLs are left as-is.
 */
export async function persistContactImages(
  tenantId: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  for (const field of IMAGE_FIELDS) {
    const v = payload[field];
    if (typeof v === "string" && v.startsWith("data:")) {
      try {
        payload[field] = await uploadOne(tenantId, field, v);
      } catch {
        /* Keep the original base64 rather than lose the image; the row will be
           migrated on the next successful save. */
      }
    }
  }
}
