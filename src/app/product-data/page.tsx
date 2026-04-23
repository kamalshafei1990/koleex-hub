"use client";

/* ---------------------------------------------------------------------------
   /product-data — internal admin catalog (full fields).

   Same underlying UI as /products, but:
     · Guarded by the "Product Data" module permission
     · Shows cost_price, supplier, internal notes, etc.
     · This is the working tool admins use to ADD / EDIT / REMOVE products.

   The PUBLIC /products page is a cleaned-up read view of the same rows,
   visible to customers without secrets.
   --------------------------------------------------------------------------- */

import PermissionGate from "@/components/layout/PermissionGate";
import ProductList from "@/components/admin/ProductList";

export default function ProductDataPage() {
  return (
    <PermissionGate module="Product Data">
      <ProductList />
    </PermissionGate>
  );
}
