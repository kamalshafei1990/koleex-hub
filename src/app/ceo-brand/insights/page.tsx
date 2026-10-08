"use client";

/* CEO Brand — the numbers (owner, 29/09/2026): the Social engine on the CEO's
   own accounts (space "ceo"). */

import AuthGate from "@/components/admin/AuthGate";
import SocialInsights from "@/components/marketing/SocialInsights";

export default function CeoBrandInsightsPage() {
  return (
    <AuthGate>
      <SocialInsights space="ceo" />
    </AuthGate>
  );
}
