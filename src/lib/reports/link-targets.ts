/* ---------------------------------------------------------------------------
   Where a report's link opens (Phase 4A): each record's own page. Pure and
   tiny — the reader and the record pages' "Reports about this" card share it.
   A quotation or an invoice (4B) opens in its own editor (?doc=), where the
   apps open them — they have no page of their own.
   --------------------------------------------------------------------------- */

import type { ReportLinkType } from "./templates";

export function entityHref(type: ReportLinkType, id: string): string | null {
  const safe = encodeURIComponent(id);
  switch (type) {
    case "customer": return `/customers/${safe}`;
    case "supplier": return `/suppliers/${safe}`;
    case "product": return `/products/${safe}`;
    case "order": return `/orders/${safe}`;
    case "quotation": return `/quotations?doc=${safe}`;
    case "invoice": return `/invoices?doc=${safe}`;
    /* 5C: what a report's numbers are about. */
    case "project": return `/projects?project=${safe}`;
    case "employee": return `/employees/${safe}`;
    case "warehouse": return "/inventory/warehouses";
    default: return null;
  }
}
