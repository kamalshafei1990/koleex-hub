"use client";

/* Social Marketing — the Feed (phase 1, 27/09/2026): a column for each
   connected Facebook Page and Instagram account, with its posts and their
   numbers. The accounts themselves are managed on the Accounts tab. */

import AuthGate from "@/components/admin/AuthGate";
import SocialFeed from "@/components/marketing/SocialFeed";

export default function SocialMarketingPage() {
  return (
    <AuthGate>
      <SocialFeed space="company" />
    </AuthGate>
  );
}
