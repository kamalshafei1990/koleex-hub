"use client";
import Contacts from "@/components/contacts/Contacts";
import PermissionGate from "@/components/layout/PermissionGate";
export default function SuppliersPage() {
  return (
    <PermissionGate module="Suppliers">
      <Contacts filterType="supplier" />
    </PermissionGate>
  );
}
