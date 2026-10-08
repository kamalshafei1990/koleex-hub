"use client";

/* Social Marketing — Insights: each connected Page's and Instagram
   account's numbers for 7, 28 or 90 days, against the days before. */

import AuthGate from "@/components/admin/AuthGate";
import SocialInsights from "@/components/marketing/SocialInsights";

export default function SocialMarketingInsightsPage() {
  return (
    <AuthGate>
      <SocialInsights space="company" />
    </AuthGate>
  );
}
