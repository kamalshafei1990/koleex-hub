"use client";

import AuthGate from "@/components/admin/AuthGate";
import AccountsList from "@/components/admin/accounts/AccountsList";

export default function AccountsPage() {
  return (
    <AuthGate
      title="Accounts Manager"
      subtitle="Super Admin access only"
    >
      <AccountsList />
    </AuthGate>
  );
}
