"use client";

/* Internal product record. NOT the customer-facing product page.

   This route used to render LegacyProductView — the same component the
   Products app shows to customers, with internal blocks bolted on. That is
   the wrong shape for Product Data: a showroom hides what is empty, and an
   operator opens a product precisely to find what is missing. The two apps
   answer different questions, so they no longer share a page.

   The customer-facing page still lives at /products/[slug], and the header
   here links to it. */

import PermissionGate from "@/components/layout/PermissionGate";
import ProductProfile from "@/components/admin/ProductProfile";

export default function ProductDataDetailPage() {
  return (
    <PermissionGate module="Product Data">
      <ProductProfile />
    </PermissionGate>
  );
}
