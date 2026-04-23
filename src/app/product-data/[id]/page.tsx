"use client";

/* Internal detail view. Re-exports the existing public-style product
   detail page but flags it so the component can show cost / supplier
   / internal-notes sections. Both paths render the exact same component
   file; the internal flag comes from the route via a data attribute on
   body (read by the component with usePathname). */

import PermissionGate from "@/components/layout/PermissionGate";
import ProductDetailPage from "@/app/products/[id]/page";

/* The underlying ProductDetailPage reads `id` from useParams() so no
   props are passed through — the /product-data/[id] segment makes the
   id available on its own via the Next.js route. */
export default function ProductDataDetailPage() {
  return (
    <PermissionGate module="Product Data">
      <ProductDetailPage />
    </PermissionGate>
  );
}
