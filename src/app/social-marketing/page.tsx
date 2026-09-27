"use client";

/* Social Marketing — phase 1, first screen (27/09/2026): connecting Koleex's
   Facebook Page and Instagram account. The Feed, composer, calendar and
   approvals build on these connected accounts next. */

import AuthGate from "@/components/admin/AuthGate";
import ConnectedAccounts from "@/components/marketing/ConnectedAccounts";

export default function SocialMarketingPage() {
  return (
    <AuthGate>
      <ConnectedAccounts space="company" />
    </AuthGate>
  );
}
