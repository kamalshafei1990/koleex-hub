/* ---------------------------------------------------------------------------
   ai/attachment-chunks — a big document reaches Koleex AI through OUR server,
   one piece at a time.

   Test round, 2026-09-04: a 62.5 MB catalogue PDF failed with "Network error
   preparing upload (62.5MB, direct)". The "direct" road hands the browser a
   signed URL and has it PUT the bytes straight to the storage host — a hop
   that never touches our server, and, from mainland China, one that does
   not reliably arrive. Everything else the Hub does from there goes through
   our own functions, which the network reaches; only this one hop did not.

   So a big attachment now takes the road the app already relies on: the
   file is cut into pieces small enough for a serverless request body, each
   piece is POSTed to /api/ai/attachments/chunk, and the attachments endpoint
   is then told "this upload id, this many parts" and puts them back together
   on the server. Nothing new is stored: the parts are transport, removed
   the moment the file has been read (or swept when abandoned).

   The plan is pure so the suite can drive it; the uploading is the browser's.
   --------------------------------------------------------------------------- */

/** Comfortably under the platform's ~4.5 MB request-body cap, with room for
 *  the multipart envelope and the small fields beside the bytes. */
export const CHUNK_BYTES = 3.5 * 1024 * 1024;
/** 60 × 3.5 MB = 210 MB, just above the document ceiling the endpoint reads. */
export const MAX_PARTS = 60;
/** Batches whose total is at or under this ride the request body whole. */
export const INLINE_MAX_BYTES = 3.5 * 1024 * 1024;

export type ChunkPlan = Array<{ index: number; start: number; end: number }>;

/** Byte ranges for one file, in order. An empty file is one empty part, so
 *  every upload has at least one request to name it. Pure. */
export function planChunks(size: number, chunkBytes: number = CHUNK_BYTES): ChunkPlan {
  const total = Math.max(0, Math.floor(size));
  const step = Math.max(1, Math.floor(chunkBytes));
  const count = Math.max(1, Math.ceil(total / step));
  const plan: ChunkPlan = [];
  for (let i = 0; i < count; i++) {
    plan.push({ index: i, start: i * step, end: Math.min(total, (i + 1) * step) });
  }
  return plan;
}

/** Whether a batch fits the request body whole, or must go piecewise. Pure. */
export function needsChunking(files: ReadonlyArray<{ size: number }>, inlineMax: number = INLINE_MAX_BYTES): boolean {
  return files.reduce((n, f) => n + f.size, 0) > inlineMax;
}

export interface ChunkedRef {
  name: string;
  type: string;
  size: number;
  upload: string;
  parts: number;
}

/**
 * Upload one file in pieces through /api/ai/attachments/chunk and return the
 * ref the attachments endpoint reassembles from. A dropped connection on a
 * piece is retried once; a server refusal is thrown as-is. Progress is a
 * fraction 0..1 of bytes sent.
 */
export async function uploadInChunks(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<ChunkedRef> {
  const plan = planChunks(file.size);
  if (plan.length > MAX_PARTS) throw new Error(`${file.name}: over the size limit`);
  const upload = crypto.randomUUID();
  for (const part of plan) {
    const send = () => {
      const fd = new FormData();
      fd.append("upload", upload);
      fd.append("index", String(part.index));
      fd.append("total", String(plan.length));
      fd.append("chunk", file.slice(part.start, part.end), `${part.index}`);
      return fetch("/api/ai/attachments/chunk", { method: "POST", credentials: "include", body: fd });
    };
    let res: Response;
    try {
      res = await send();
    } catch (first) {
      if (!(first instanceof TypeError)) throw first;
      await new Promise((r) => setTimeout(r, 1200));
      res = await send();
    }
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(`${file.name}: ${j?.error || `upload refused (${res.status})`}`);
    }
    onProgress?.(part.end / Math.max(1, file.size));
  }
  return { name: file.name, type: file.type || "", size: file.size, upload, parts: plan.length };
}
