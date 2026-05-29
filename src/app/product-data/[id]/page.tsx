"use client";

/* Internal detail view. Re-exports the existing public-style product
   detail page but flags it so the component can show cost / supplier
   / internal-notes sections. Both paths render the exact same component
   file; the internal flag comes from the route via a data attribute on
   body (read by the component with usePathname). */

import PermissionGate from "@/components/layout/PermissionGate";
import LegacyProductView from "@/app/products/[id]/LegacyProductView";

/* Internal detail view. Renders the legacy client renderer directly — it
   reads `id` from useParams() and detects the /product-data path via
   usePathname() to surface internal cost/supplier/notes sections.
   (The public /products/[id] route is now a server component that picks
   the schema-driven view when a schema resolves, so it can't be rendered
   as a child here — we mount the underlying renderer instead.) */
export default function ProductDataDetailPage() {
  return (
    <PermissionGate module="Product Data">
      <LegacyProductView />
    </PermissionGate>
  );
}
