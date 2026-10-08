"use client";

/* Social Marketing — Accounts: connect and remove the accounts the Feed and
   publishing work on. The Facebook sign-in returns here (SPACE_ROUTE). */

import AuthGate from "@/components/admin/AuthGate";
import ConnectedAccounts from "@/components/marketing/ConnectedAccounts";

export default function SocialMarketingAccountsPage() {
  return (
    <AuthGate>
      <ConnectedAccounts space="company" />
    </AuthGate>
  );
}
