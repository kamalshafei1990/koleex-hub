"use client";

/* ---------------------------------------------------------------------------
   Database › Visual Library › Specs & Attributes

   The product-specific visual layers, merged into the Database app's Visual
   Library (the single home for everything visual). Asset repository, Brands
   and Classification live in their own Database tabs — here we own the
   commercial value lists, common data, and the special per-type specs.
   --------------------------------------------------------------------------- */

import PermissionGate from "@/components/layout/PermissionGate";
import ProductVisualLibrary from "@/components/admin/ProductVisualLibrary";

export default function DatabaseSpecsAttributesPage() {
  return (
    <PermissionGate module="Database">
      <ProductVisualLibrary embedded />
    </PermissionGate>
  );
}
