"use client";

/* ---------------------------------------------------------------------------
   /product-data/catalog — the internal admin catalogue (full fields).

   This is what /product-data used to be. It moved one level down when the
   segment gained a landing screen; /product-data is now the home tab.

   The grid is rendered exactly as before — its own header, its own sticky
   search with the suggestion list, its own category nav. The only thing that
   changed is where its back arrow points (see ProductList: under
   /product-data it now returns to the landing screen, not to Home).

   The PUBLIC /products page renders the same component and is untouched.
   --------------------------------------------------------------------------- */

import PermissionGate from "@/components/layout/PermissionGate";
import ProductList from "@/components/admin/ProductList";

export default function ProductDataCatalogPage() {
  return (
    <PermissionGate module="Product Data">
      <ProductList />
    </PermissionGate>
  );
}
