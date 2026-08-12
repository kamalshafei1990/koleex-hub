"use client";

import AuthGate from "@/components/admin/AuthGate";
import AccountsList from "@/components/admin/accounts/AccountsList";

export default function AccountsPage() {
  return (
    <AuthGate>
      <AccountsList />
    </AuthGate>
  );
}
