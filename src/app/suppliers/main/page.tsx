"use client";
import PermissionGate from "@/components/layout/PermissionGate";
import KoleexMainSuppliers from "@/components/suppliers/KoleexMainSuppliers";

export default function KoleexMainSuppliersPage() {
  return (
    <PermissionGate module="Suppliers">
      <KoleexMainSuppliers />
    </PermissionGate>
  );
}
