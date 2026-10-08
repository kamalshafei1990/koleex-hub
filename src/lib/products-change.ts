/* products-change — "anything changed in Product Data shows on the next open."
 *
 * Owner rule (19/09/2026). The product PAGE already keeps it: it is rendered
 * on the server per request from the row itself. The CATALOGUE did not: it
 * paints a warm snapshot from localStorage and then fetches /api/products,
 * and that fetch could be answered by the browser's HTTP cache — for up to
 * 30 s by max-age (fine), and until this change for five MINUTES by
 * stale-while-revalidate (not fine: the app got the stale copy and never
 * re-read). The routes dropped stale-while-revalidate; this module closes
 * the last 30 s inside the same browser.
 *
 * HOW
 *   announceProductChange() runs after any successful save in Product Data
 *   (the profile's mergeSaved, the editor's save). It stamps the moment,
 *   drops every catalogue snapshot and model cache, and tells open screens.
 *   catalogueFetchInit() is what the catalogue passes to fetch(): when the
 *   stamp is newer than the catalogue's last successful load it asks the
 *   browser to bypass its HTTP cache (`cache: "reload"`) — one request, the
 *   same URL, fresh data; every other time the normal cache applies.
 *
 * Another browser or another person's session is bounded by max-age: 30 s.
 * That is the rule's honest limit and it is stated in the API route.
 */

const CHANGED_AT = "kx_products_changed_at";
const FETCHED_AT = "kx_products_fetched_at";
export const PRODUCT_CHANGED_EVENT = "koleex:product-changed";

const read = (k: string): number => {
  try { return Number(window.localStorage.getItem(k) ?? 0) || 0; } catch { return 0; }
};
const write = (k: string, v: number) => {
  try { window.localStorage.setItem(k, String(v)); } catch { /* quota / private mode: the 30 s bound still holds */ }
};

/** Call after a product save succeeded. Safe to call more than once. */
export function announceProductChange(productId?: string | null): void {
  if (typeof window === "undefined") return;
  write(CHANGED_AT, Date.now());
  try {
    const drop: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith("kx_products_list_v1:") || k.startsWith("kx_products_models_"))) drop.push(k);
    }
    for (const k of drop) window.localStorage.removeItem(k);
  } catch { /* nothing to drop */ }
  window.dispatchEvent(new CustomEvent(PRODUCT_CHANGED_EVENT, { detail: { productId: productId ?? null } }));
}

/** The fetch options the catalogue uses for its list request. */
export function catalogueFetchInit(extra: RequestInit = {}): RequestInit {
  if (typeof window === "undefined") return extra;
  const stale = read(CHANGED_AT) > read(FETCHED_AT);
  return stale ? { ...extra, cache: "reload" } : extra;
}

/** Call after the catalogue's list request succeeded. */
export function markCatalogueFetched(): void {
  if (typeof window === "undefined") return;
  write(FETCHED_AT, Date.now());
}
