"use client";

import { use } from "react";
import PermissionGate from "@/components/layout/PermissionGate";
import SupplierDetail from "@/components/suppliers/SupplierDetail";

export default function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <PermissionGate module="Suppliers">
      <SupplierDetail id={id} />
    </PermissionGate>
  );
}
