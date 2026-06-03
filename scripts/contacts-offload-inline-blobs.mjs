/* One-off: move oversized inline base64 data: URLs out of contacts JSONB
   arrays (catalogues / documents / attachments) into Supabase Storage and
   rewrite the array entry's `url` to the public storage URL.

   Why: a single supplier had a 40 MB PDF stored as a data: URL inside
   contacts.catalogues, making that row 40 MB. GET /api/contacts/[id]
   (select *) then exceeded Vercel's ~4.5 MB function limit and returned
   413 — breaking the edit form's hydrate and every save (the misleading
   "missing RLS policies" banner). Small inline images (photo/logo/QR,
   ~50 kB) are fine and left untouched. Idempotent: only data: URLs are
   migrated; already-migrated https URLs are skipped. */

import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const ROOT = "/Users/kamalshafei/Desktop/Koleex HUB";
const envText = await fs.readFile(`${ROOT}/.env.local`, "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const supabase = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "media";
const ARRAY_FIELDS = ["catalogues", "documents", "attachments"];
// Only offload data: URLs above this size; tiny inline thumbs stay put.
const MIN_BYTES = 200 * 1024; // 200 kB

const EXT_BY_MIME = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

function sanitize(name) {
  return (name || "file")
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

function parseDataUrl(url) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url);
  if (!m) return null;
  const mime = m[1] || "application/octet-stream";
  const isB64 = !!m[2];
  const buf = isB64
    ? Buffer.from(m[3], "base64")
    : Buffer.from(decodeURIComponent(m[3]), "utf8");
  return { mime, buf };
}

const { data: rows, error } = await supabase
  .from("contacts")
  .select(`id, display_name, ${ARRAY_FIELDS.join(", ")}`);
if (error) { console.error("fetch failed:", error.message); process.exit(1); }

let migrated = 0, skipped = 0, rowsTouched = 0;

for (const row of rows) {
  let changed = false;
  const patch = {};

  for (const field of ARRAY_FIELDS) {
    const arr = row[field];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const next = [];
    let fieldChanged = false;

    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      const url = item && typeof item === "object" ? item.url : null;
      if (typeof url !== "string" || !url.startsWith("data:")) {
        next.push(item);
        continue;
      }
      const approxBytes = Math.floor((url.length - url.indexOf(",") - 1) * 0.75);
      if (approxBytes < MIN_BYTES) { next.push(item); skipped++; continue; }

      const parsed = parseDataUrl(url);
      if (!parsed) { next.push(item); skipped++; continue; }

      const ext = EXT_BY_MIME[parsed.mime] || "bin";
      const base = sanitize(item.name?.replace(/\.[^.]+$/, "") || `${field}_${i}`);
      const path = `supplier-catalogues/${row.id}/${Date.now()}_${i}_${base}.${ext}`;

      const up = await supabase.storage
        .from(BUCKET)
        .upload(path, parsed.buf, { contentType: parsed.mime, upsert: true });
      if (up.error) {
        console.error(`  upload failed (${row.id} ${field}[${i}]):`, up.error.message);
        next.push(item);
        continue;
      }
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
      next.push({ ...item, url: publicUrl, storage_path: path });
      fieldChanged = true;
      migrated++;
      console.log(`  ↑ ${row.display_name || row.id} · ${field}[${i}] "${item.name}" → ${(parsed.buf.length / 1048576).toFixed(1)} MB → ${path}`);
    }

    if (fieldChanged) { patch[field] = next; changed = true; }
  }

  if (changed) {
    const { error: upErr } = await supabase.from("contacts").update(patch).eq("id", row.id);
    if (upErr) console.error(`  row update failed (${row.id}):`, upErr.message);
    else rowsTouched++;
  }
}

console.log(`\nDone. migrated=${migrated} files, rowsTouched=${rowsTouched}, skipped(small/other)=${skipped}`);
