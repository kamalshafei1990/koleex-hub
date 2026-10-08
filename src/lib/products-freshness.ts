/* Product freshness — the three catalogue badges, as one small number.
 *
 *   NEW            the product became active within the window
 *   Updated        customer-visible content changed within the window
 *   Price updated  this product's own price inputs changed within the window
 *
 * The database records the MOMENTS (products.published_at,
 * content_updated_at, price_updated_at — see the 20260919_products_freshness
 * migration for exactly what moves each one). This module turns them into
 * what the card shows, and it is the ONLY place the 14-day rule lives.
 *
 * WHY A BITMASK, AND WHY THE SERVER COMPUTES IT
 * The catalogue response is measured in bytes × products: three ISO
 * timestamps are ~150 bytes a row, 60 KB over 400 products — 40% more than
 * the whole response weighs today, for a fact that is false on almost every
 * row on almost every day. So the timestamps stop at the API: it reads
 * them, folds them into `fresh`, and DROPS them. `fresh` is omitted when it
 * is 0, so a product with nothing to say costs nothing. A row that is
 * fresh carries `"fresh":3` — seven bytes.
 *
 * The browser never sees a timestamp and never runs a clock: it reads bits.
 * That also means a warm-start snapshot shows the badges as they were when
 * it was written, until the live response replaces it — a badge can outlive
 * its window by the age of the snapshot, never appear early.
 */

export const FRESH_WINDOW_DAYS = 14;
const WINDOW_MS = FRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export const FRESH_NEW = 1;
export const FRESH_UPDATED = 2;
export const FRESH_PRICE = 4;

/** The columns the API must SELECT to compute `fresh`. Never in the
 *  response — see stripFreshness. */
export const FRESHNESS_COLUMNS = ["published_at", "content_updated_at", "price_updated_at"] as const;
export type FreshnessColumn = (typeof FRESHNESS_COLUMNS)[number];

type Moments = Partial<Record<FreshnessColumn, string | null | undefined>>;

function within(iso: string | null | undefined, now: number): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  const age = now - t;
  return age >= 0 && age < WINDOW_MS;
}

/** Fold the three moments into a bitmask. `now` is injectable for tests. */
export function freshnessBits(row: Moments, now: number = Date.now()): number {
  let bits = 0;
  if (within(row.published_at, now)) bits |= FRESH_NEW;
  if (within(row.content_updated_at, now)) bits |= FRESH_UPDATED;
  if (within(row.price_updated_at, now)) bits |= FRESH_PRICE;
  return bits;
}

/** Replace the timestamps on a row with `fresh` (omitted when 0). Mutates
 *  and returns the same object — the list route hands rows straight to the
 *  response, so a copy per row would be the only allocation on the path. */
export function foldFreshness<T extends Record<string, unknown>>(row: T, now: number = Date.now()): T {
  const bits = freshnessBits(row as Moments, now);
  for (const c of FRESHNESS_COLUMNS) delete (row as Record<string, unknown>)[c];
  if (bits) (row as Record<string, unknown>).fresh = bits;
  return row;
}

/** The badges a card shows, in display order: NEW first (the product is the
 *  news), then what changed about it. */
export function freshnessBadges(fresh: number | undefined | null): Array<"new" | "updated" | "price"> {
  if (!fresh) return [];
  const out: Array<"new" | "updated" | "price"> = [];
  if (fresh & FRESH_NEW) out.push("new");
  if (fresh & FRESH_UPDATED) out.push("updated");
  if (fresh & FRESH_PRICE) out.push("price");
  return out;
}
