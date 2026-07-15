"use client";

import PermissionGate from "@/components/layout/PermissionGate";
import ProductForm from "@/components/admin/ProductFormLazy";

export default function NewProductDataPage() {
  return (
    <PermissionGate module="Product Data">
      <ProductForm />
    </PermissionGate>
  );
}
