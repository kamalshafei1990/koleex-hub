import "server-only";

/* ---------------------------------------------------------------------------
   Server-side memo for the ?kind=all taxonomy payload.

   WHY IT EXISTS — measured on production, 2026-08-08, with the browser in
   Tokyo, the Vercel function in hnd1 and the database in ap-northeast-1, so
   all three co-located and no cross-region hop in play:

     Postgres builds the entire payload    1.9 ms   (EXPLAIN ANALYZE, 367 rows)
     brotli on the wire                     32 KB
     the actual request                   3513 ms

   Neither the query nor the transfer explains that. The time goes into pulling
   451 rows out through PostgREST and into the function, and no code in this
   repo makes that hop faster. What code CAN do is stop making it: this payload
   is byte-identical for every authenticated user, and the catalogue structure
   changes a handful of times a month.

   WHAT THIS IS NOT: a permission bypass. Callers check auth BEFORE reading the
   memo — see both GET handlers. The only thing shared across users here is the
   public catalogue structure (division / category / subcategory names, slugs
   and order), which every authenticated user is already allowed to read.

   TTL is deliberately the same 60s the routes ALREADY advertise in their
   Cache-Control, so nothing becomes staler than it was: a browser that cached
   the previous response would have shown those same rows for that same minute.
   Writes call invalidate() so the person making the edit never reads their own
   stale copy; the TTL is only the backstop for a write served by a DIFFERENT
   function instance.

   The state hangs off globalThis because the server bundle can contain more
   than one copy of this module — per-copy caches would each miss (SYS-4, the
   same trap that made /api/shell fire twice on the client).
   --------------------------------------------------------------------------- */

export interface TaxonomyAll {
  divisions: unknown[];
  categories: unknown[];
  subcategories: unknown[];
}

interface Memo { at: number; payload: TaxonomyAll }

const g = globalThis as typeof globalThis & { __kxTaxonomyAll?: Memo | null };
const TTL_MS = 60_000;

/** Fresh payload, or null when the memo is absent or past its TTL. */
export function readTaxonomyAll(): TaxonomyAll | null {
  const memo = g.__kxTaxonomyAll;
  if (!memo) return null;
  return Date.now() - memo.at < TTL_MS ? memo.payload : null;
}

/** The last payload regardless of age — used to keep the catalogue screens
 *  alive through a transient PostgREST error instead of 500-ing all of them. */
export function readTaxonomyAllStale(): TaxonomyAll | null {
  return g.__kxTaxonomyAll?.payload ?? null;
}

export function writeTaxonomyAll(payload: TaxonomyAll): void {
  g.__kxTaxonomyAll = { at: Date.now(), payload };
}

/** Call after any taxonomy write (create, edit, delete). */
export function invalidateTaxonomyAll(): void {
  g.__kxTaxonomyAll = null;
}
