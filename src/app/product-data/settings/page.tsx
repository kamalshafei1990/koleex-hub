"use client";

import PermissionGate from "@/components/layout/PermissionGate";
import ProductSettingsPage from "@/app/products/settings/page";

export default function ProductDataSettingsPage() {
  return (
    <PermissionGate module="Product Data">
      <ProductSettingsPage />
    </PermissionGate>
  );
}
