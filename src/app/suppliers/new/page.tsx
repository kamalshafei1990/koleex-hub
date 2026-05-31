"use client";
import PermissionGate from "@/components/layout/PermissionGate";
import SupplierOnboarding from "@/components/suppliers/SupplierOnboarding";

export default function NewSupplierPage() {
  return (
    <PermissionGate module="Suppliers">
      <SupplierOnboarding />
    </PermissionGate>
  );
}
