"use client";
import Contacts from "@/components/contacts/Contacts";
import PermissionGate from "@/components/layout/PermissionGate";
export default function CustomersPage() {
  return (
    <PermissionGate module="Customers">
      <Contacts filterType="customer" />
    </PermissionGate>
  );
}
