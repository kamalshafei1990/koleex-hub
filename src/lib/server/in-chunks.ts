import "server-only";

/* ---------------------------------------------------------------------------
   inChunks — run a PostgREST `.in(column, ids)` read over MANY ids safely.

   WHY. supabase-js turns `.in("id", ids)` into a query-string filter, so
   every id travels in the request URL. At ~37 bytes an id, 394 ids is a
   15 KB URL; the request never reaches PostgREST — it dies in the HTTP
   client as `TypeError: fetch failed`, with no status and no body
   (measured 22 Sep 2026 on /api/products/signals, five such reads in
   parallel). Two hundred ids happened to fit; the catalogue is heading for
   three thousand, and any route that batches "the rest" in one call must
   not depend on where that ceiling is.

   150 ids per chunk keeps each URL under ~6 KB. Chunks run in parallel and
   the rows are concatenated; the first error wins, exactly as one read
   would have reported it.
   --------------------------------------------------------------------------- */

export const IN_CHUNK = 150;

interface ReadResult<T> { data: T[] | null; error: { message: string } | null }

export async function inChunks<T>(
  ids: readonly string[],
  run: (chunk: string[]) => PromiseLike<ReadResult<T>>,
  size: number = IN_CHUNK,
): Promise<ReadResult<T>> {
  if (ids.length === 0) return { data: [], error: null };
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  const results = await Promise.all(chunks.map((c) => run(c)));
  const data: T[] = [];
  for (const r of results) {
    if (r.error) return { data: null, error: r.error };
    if (r.data) data.push(...r.data);
  }
  return { data, error: null };
}
