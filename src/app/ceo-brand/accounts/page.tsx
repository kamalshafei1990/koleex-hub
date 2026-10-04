"use client";

/* CEO Brand — the accounts (owner, 29/09/2026): the Social engine on the CEO's
   own accounts (space "ceo"). */

import AuthGate from "@/components/admin/AuthGate";
import ConnectedAccounts from "@/components/marketing/ConnectedAccounts";

export default function CeoBrandAccountsPage() {
  return (
    <AuthGate>
      <ConnectedAccounts space="ceo" />
    </AuthGate>
  );
}
