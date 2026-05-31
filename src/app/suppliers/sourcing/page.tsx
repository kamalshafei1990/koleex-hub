"use client";
import PermissionGate from "@/components/layout/PermissionGate";
import SourcingCommandCenter from "@/components/suppliers/SourcingCommandCenter";

export default function SourcingCommandCenterPage() {
  return (
    <PermissionGate module="Suppliers">
      <SourcingCommandCenter />
    </PermissionGate>
  );
}
