"use client";

/* ---------------------------------------------------------------------------
   /products/settings — the Product Control Panel.

   The body lives in components/admin/ProductControlPanel. This route used to
   BE the body, and /product-data/settings reached it by importing this page
   module directly — a route importing another route's page. That works until
   one of them needs a different guard or a different layout, and it hid the
   fact that this route had NO PermissionGate at all while its twin did. The
   writes were refused server-side either way, so nothing leaked; the screen
   simply rendered for people who could not use it.

   One component, two thin routes, the same gate on both.
   --------------------------------------------------------------------------- */

import PermissionGate from "@/components/layout/PermissionGate";
import ProductControlPanel from "@/components/admin/ProductControlPanel";

export default function ProductSettingsPage() {
  return (
    <PermissionGate module="Product Data">
      <ProductControlPanel />
    </PermissionGate>
  );
}
