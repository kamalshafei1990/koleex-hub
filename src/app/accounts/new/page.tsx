"use client";

import AdminAuth from "@/components/admin/AdminAuth";
import AccountForm from "@/components/admin/accounts/AccountForm";

export default function NewAccountPage() {
  return (
    <AdminAuth
      title="Accounts Manager"
      subtitle="Super Admin access only"
    >
      <AccountForm mode="create" />
    </AdminAuth>
  );
}
