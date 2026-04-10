"use client";

import AdminAuth from "@/components/admin/AdminAuth";
import AccountsList from "@/components/admin/accounts/AccountsList";

export default function AccountsPage() {
  return (
    <AdminAuth
      title="Accounts Manager"
      subtitle="Super Admin access only"
    >
      <AccountsList />
    </AdminAuth>
  );
}
