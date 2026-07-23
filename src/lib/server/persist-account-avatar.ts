import "server-only";

/* ---------------------------------------------------------------------------
   persist-account-avatar — root-cause guard against base64 re-entering
   `accounts.avatar_url`.

   The avatar pickers (Settings ProfileTab, admin AccountDetail) produce a
   cropped 256×256 image as an inline `data:` URL. Storing that string in the
   column means every API that joins the sender/account avatar re-ships the
   blob per row (/api/inbox/feed full mode was the worst hit). This helper
   runs on the server BEFORE any accounts write and moves the inline image
   into the public `media` Storage bucket, replacing the value with a short
   URL — so no form, old or new, can reintroduce inline base64.

   Sibling of persist-contact-images (same bucket, same mechanics). Path is
   per-account + content-hash (`avatars/accounts-{id}-{hash}.{ext}`) so a
   changed avatar gets a NEW URL — public objects are cached for a year, and
   reusing one path per account would pin browsers to the stale image.
   --------------------------------------------------------------------------- */

import { createHash } from "node:crypto";
import { supabaseServer } from "./supabase-server";

const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg",
  "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg",
};

/**
 * Upload an inline `data:` URL avatar to Storage and return its public URL.
 * Throws if the upload fails — callers reject the write instead of silently
 * persisting base64 (the previous avatar simply stays in place).
 */
export async function persistAccountAvatar(
  accountId: string,
  dataUrl: string,
): Promise<string> {
  const m = /^data:([^;,]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) throw new Error("Unsupported avatar payload (expected base64 data URL)");
  const mime = m[1].toLowerCase();
  const buf = Buffer.from(m[2], "base64");
  if (buf.length === 0) throw new Error("Empty avatar image");
  const hash = createHash("sha1").update(buf).digest("hex").slice(0, 12);
  const path = `avatars/accounts-${accountId}-${hash}.${EXT[mime] || "png"}`;
  const up = await supabaseServer.storage.from("media").upload(path, buf, {
    contentType: mime, upsert: true, cacheControl: "31536000",
  });
  if (up.error) throw new Error(up.error.message);
  return supabaseServer.storage.from("media").getPublicUrl(path).data.publicUrl;
}

/**
 * Guard an accounts write payload IN PLACE: any inline `data:` avatar_url is
 * converted to a Storage URL. Non-string values and http(s) URLs pass through.
 */
export async function guardAccountAvatarField(
  accountId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const v = payload.avatar_url;
  if (typeof v === "string" && v.startsWith("data:")) {
    payload.avatar_url = await persistAccountAvatar(accountId, v);
  }
}
