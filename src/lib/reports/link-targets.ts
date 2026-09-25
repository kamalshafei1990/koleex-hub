/* ---------------------------------------------------------------------------
   Where a report's link opens (Phase 4A): each record's own page. Pure and
   tiny — the reader and the record pages' "Reports about this" card share it.
   --------------------------------------------------------------------------- */

import type { ReportLinkType } from "./templates";

export function entityHref(type: ReportLinkType, id: string): string | null {
  const safe = encodeURIComponent(id);
  switch (type) {
    case "customer": return `/customers/${safe}`;
    case "supplier": return `/suppliers/${safe}`;
    case "product": return `/products/${safe}`;
    case "order": return `/orders/${safe}`;
    default: return null;
  }
}
