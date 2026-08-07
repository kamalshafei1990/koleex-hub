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
import SpecIconHub from "@/components/database/SpecIconHub";

export default function DatabaseSpecsAttributesPage() {
  return (
    <PermissionGate module="Database">
      <div className="px-4 md:px-6 pt-6 max-w-[1400px] mx-auto">
        <SpecIconHub />
      </div>
      <ProductVisualLibrary embedded />
    </PermissionGate>
  );
}
