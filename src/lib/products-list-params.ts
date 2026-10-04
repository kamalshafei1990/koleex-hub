/* ---------------------------------------------------------------------------
   The catalogue's request, in ONE place.

   ⚠️ WHY THIS FILE EXISTS. Two things have to agree byte for byte or work is
   silently thrown away:

     · ProductList's `serverParams`, which the grid actually fetches, and the
       `defaultParams` it compares against to decide `isDefaultView` — the flag
       that governs whether the warm snapshot may be written at all. A drift
       between those two disables the warm start with no error.
     · Home's APP_DATA_PREFETCH, which warms the browser HTTP cache on hover.
       A different query string is a different cache key, so the prefetch
       downloads a response nobody ever reads.

   The prefetch has now been wrong THREE times. First it pointed at the bare
   /api/products (the full 80-column projection). Then it kept `?view=list`
   after the grid moved to server paging. And when this file was written it
   still said `pageSize=150` while the grid had been asking for 200 since
   2026-09-15 — a whole response downloaded and discarded on every hover,
   which at 3,000 products is ~1.8 MB competing with the real page load.

   A comment saying "keep these in sync" did not survive contact with reality
   three times, so the string is now built from one function and both callers
   import it. `validate:products-i18n` fails the build if Home hardcodes the
   URL again.
   --------------------------------------------------------------------------- */

/** The server's own ceiling — `products-config.ts` maxPageSize. Asking for
 *  more is clamped; asking for less only buys extra round trips, and on this
 *  platform a round trip costs about a second whatever it carries. 400 holds
 *  today's 394-product catalogue in ONE response. */
export const LIST_PAGE_SIZE = "400";

/** Koleex's flagship division — the public catalogue's default view. */
export const FLAGSHIP_DIVISION_SLUG = "garment-machinery";

/**
 * The query string the catalogue requests on a clean open.
 *
 * `internal` is /product-data (every status, no division default); the public
 * /products catalogue defaults to the flagship division and can only ever show
 * active products.
 *
 * Parameter ORDER is part of the contract: `isDefaultView` compares the built
 * string against `serverParams`, and URLSearchParams preserves insertion order.
 */
export function defaultListParams(opts: { internal: boolean; division?: string | null }): string {
  const p = new URLSearchParams({ view: "list", paged: "1", pageSize: LIST_PAGE_SIZE });
  if (opts.division) p.set("division", opts.division);
  if (!opts.internal) p.set("status", "active");
  return p.toString();
}

/** The exact URL Home should prefetch for each of the two catalogue apps. */
export const PRODUCTS_PREFETCH_URL =
  `/api/products?${defaultListParams({ internal: false, division: FLAGSHIP_DIVISION_SLUG })}`;
export const PRODUCT_DATA_PREFETCH_URL =
  `/api/products?${defaultListParams({ internal: true })}`;
