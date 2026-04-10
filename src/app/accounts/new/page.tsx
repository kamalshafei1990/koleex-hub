"use client";

import AuthGate from "@/components/admin/AuthGate";
import AccountForm from "@/components/admin/accounts/AccountForm";

export default function NewAccountPage() {
  return (
    <AuthGate
      title="Accounts Manager"
      subtitle="Super Admin access only"
    >
      <AccountForm mode="create" />
    </AuthGate>
  );
}
