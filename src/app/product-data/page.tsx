"use client";

/* ---------------------------------------------------------------------------
   /product-data — the landing screen (was: the catalogue itself).

   The catalogue now lives at /product-data/catalog and this route opens on
   ProductDataHome, matching how Inventory and Purchase open. See
   ProductDataHome.tsx for the measurement behind the change.

   PermissionGate stays exactly where it was: the "Product Data" module grant
   still governs everything in this segment, landing screen included — the
   numbers on it (cost gaps, supplier gaps) are internal signals customers
   must never see.
   --------------------------------------------------------------------------- */

import PermissionGate from "@/components/layout/PermissionGate";
import ProductDataHome from "@/components/admin/ProductDataHome";

export default function ProductDataPage() {
  return (
    <PermissionGate module="Product Data">
      <ProductDataHome />
    </PermissionGate>
  );
}
