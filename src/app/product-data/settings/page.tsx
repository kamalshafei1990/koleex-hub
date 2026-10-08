"use client";

/* The same Control Panel, reached from inside Product Data. Both routes mount
   the shared component behind the same gate — see the note in
   /products/settings. */

import PermissionGate from "@/components/layout/PermissionGate";
import ProductControlPanel from "@/components/admin/ProductControlPanel";

export default function ProductDataSettingsPage() {
  return (
    <PermissionGate module="Product Data">
      <ProductControlPanel />
    </PermissionGate>
  );
}
