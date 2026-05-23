/* ---------------------------------------------------------------------------
   FEFO (First-Expiry-First-Out) suggestion helper.

   Pure, server-safe, no React. The UI suggests this batch first but
   never enforces it — operators always have the final call.
   --------------------------------------------------------------------------- */

export interface FefoBatchOption {
  id: string;
  batch_no: string;
  expiry_date: string | null;
  quantity_remaining?: number;
}

/** Return the batch with the earliest expiry that still has stock, or
 *  null if no batch has an expiry date set. */
export function suggestFefoBatch<T extends FefoBatchOption>(batches: T[]): T | null {
  const candidates = batches.filter(
    (b) => b.expiry_date != null && (b.quantity_remaining ?? 1) > 0,
  );
  if (candidates.length === 0) return null;
  return candidates.slice().sort((a, b) => {
    const ax = a.expiry_date ?? "9999-12-31";
    const bx = b.expiry_date ?? "9999-12-31";
    return ax < bx ? -1 : ax > bx ? 1 : 0;
  })[0];
}
