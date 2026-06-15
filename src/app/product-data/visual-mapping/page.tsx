"use client";

/* ---------------------------------------------------------------------------
   Product Data › Visual Library
   The single home for every product visual — grouped: Commercial · Classification
   · Identity & Common · Specs (special per type) · Media. See ProductVisualLibrary.
   --------------------------------------------------------------------------- */

import PermissionGate from "@/components/layout/PermissionGate";
import ProductVisualLibrary from "@/components/admin/ProductVisualLibrary";

export default function VisualLibraryPage() {
  return (
    <PermissionGate module="Product Data">
      <ProductVisualLibrary />
    </PermissionGate>
  );
}
