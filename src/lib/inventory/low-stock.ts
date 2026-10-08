/* ---------------------------------------------------------------------------
   Low stock — ONE rule for the alert, the dashboard's count and the Items
   list's "low stock" view (owner's pick, 26 Sep 2026).

   An item is low in a warehouse when what it holds there is at or under its
   REORDER POINT — early enough to order in time — or, for an item with no
   reorder point, at or under its MINIMUM. An item with neither is never low;
   an item not tracked for stock is never low. The alert used the minimum
   first and the dashboard the reorder point only, so the same item was low
   on one screen and fine on the other.

   Per warehouse, as a balance is kept: an item short in one warehouse is
   low even when another holds plenty. Pure — the server and the validator
   share it.
   --------------------------------------------------------------------------- */

export interface StockLimits {
  reorder_point?: number | string | null;
  min_stock?: number | string | null;
  track_stock?: boolean | null;
}

export interface LowStockThreshold {
  at: number;
  /** Which limit applied — the alert names it. */
  by: "reorder_point" | "min_stock";
}

const positive = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Where an item counts as low, or null when it never does. */
export function lowStockThreshold(item: StockLimits | null | undefined): LowStockThreshold | null {
  if (!item || item.track_stock === false) return null;
  const reorder = positive(item.reorder_point);
  if (reorder !== null) return { at: reorder, by: "reorder_point" };
  const min = positive(item.min_stock);
  return min !== null ? { at: min, by: "min_stock" } : null;
}

/** Whether a quantity held is at or under the item's threshold. */
export function isLowStock(qty: number | string | null | undefined, item: StockLimits | null | undefined): boolean {
  const t = lowStockThreshold(item);
  return !!t && (Number(qty) || 0) <= t.at;
}
