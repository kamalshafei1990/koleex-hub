import "server-only";

/* ---------------------------------------------------------------------------
   ai/attachment-parts — where the pieces of a big attachment live while they
   are in transit, and how they are put back together and cleared away.

   Shared by /api/ai/attachments/chunk (writes one piece) and
   /api/ai/attachments (reads them all, then removes them). The folder is
   composed from the SIGNED-IN account id, never from anything the client
   names, so a ref can only ever reach the caller's own pieces.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

export const PARTS_ROOT = "ai-attachments/parts";
/** A piece is at most this many bytes — the client cuts at 3.5 MB; this is
 *  the ceiling the server accepts, with margin. */
export const PART_BYTES_MAX = 4 * 1024 * 1024;
export const MAX_PARTS_SERVER = 60;
export const UPLOAD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A folder older than this with no assembly is an abandoned upload. */
const STALE_MS = 2 * 60 * 60 * 1000;

/** The caller's transport folder for one upload. Pure. */
export function partsFolder(accountId: string, upload: string): string {
  return `${PARTS_ROOT}/${accountId}/${upload.toLowerCase()}`;
}

/** Download the pieces in order and join them. Every piece must be present;
 *  a missing or unreadable one fails the whole file (null). One retry per
 *  piece for a cut socket. The joined size is checked against the declared
 *  ceiling BEFORE the last pieces are fetched, so a ref cannot make the
 *  server hold more than the document limit. */
export async function assembleParts(
  folder: string,
  parts: number,
  maxBytes: number,
): Promise<Uint8Array | null> {
  const bufs: Uint8Array[] = [];
  let total = 0;
  for (let i = 0; i < parts; i++) {
    let piece: Uint8Array | null = null;
    for (let attempt = 0; attempt < 2 && !piece; attempt++) {
      try {
        const { data, error } = await supabaseServer.storage.from("media").download(`${folder}/${i}`);
        if (error || !data) {
          console.error(`[ai.attachments] part download failed index=${i}/${parts}`, error?.message);
        } else {
          piece = new Uint8Array(await data.arrayBuffer());
        }
      } catch (e) {
        console.error(`[ai.attachments] part download threw index=${i}/${parts}`, e);
      }
    }
    if (!piece) return null;
    total += piece.byteLength;
    if (total > maxBytes) {
      console.error(`[ai.attachments] parts over the limit at index=${i} bytes=${total}`);
      return null;
    }
    bufs.push(piece);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const b of bufs) {
    out.set(b, at);
    at += b.byteLength;
  }
  return out;
}

/** Remove every piece of one upload. Best-effort; never throws. */
export async function removeParts(folder: string, parts: number): Promise<void> {
  const paths: string[] = [];
  for (let i = 0; i < parts; i++) paths.push(`${folder}/${i}`);
  try {
    await supabaseServer.storage.from("media").remove(paths);
  } catch {
    /* transport only — a leftover is swept later */
  }
}

/** Sweep the caller's abandoned uploads: folders whose NEWEST piece is
 *  older than STALE_MS, other than the uploads being assembled right now.
 *  A folder's age is read from its files (a folder entry itself carries no
 *  timestamp); when no age can be read the folder is LEFT ALONE — an
 *  upload in progress from another tab must never be swept from under it.
 *  Best-effort; never throws; counts only in the log. Keeps the "read,
 *  described, and forgotten" contract true for a file whose upload was cut
 *  off half-way. */
export async function sweepStaleParts(accountId: string, keepUploads: ReadonlySet<string>): Promise<void> {
  try {
    const root = `${PARTS_ROOT}/${accountId}`;
    const { data: folders } = await supabaseServer.storage.from("media").list(root, { limit: 50 });
    const now = Date.now();
    let swept = 0;
    for (const f of folders ?? []) {
      if (!f.name || keepUploads.has(f.name.toLowerCase())) continue;
      const { data: files } = await supabaseServer.storage.from("media").list(`${root}/${f.name}`, { limit: 100 });
      if (!files || files.length === 0) continue;
      let newest = Number.NEGATIVE_INFINITY;
      for (const x of files) {
        const stamp = Date.parse(x.created_at ?? x.updated_at ?? "");
        if (Number.isFinite(stamp)) newest = Math.max(newest, stamp);
      }
      if (!Number.isFinite(newest) || now - newest < STALE_MS) continue;
      await supabaseServer.storage.from("media").remove(files.map((x) => `${root}/${f.name}/${x.name}`));
      swept += files.length;
    }
    if (swept > 0) console.log(`[ai.attachments] swept stale parts=${swept}`);
  } catch {
    /* best-effort */
  }
}
