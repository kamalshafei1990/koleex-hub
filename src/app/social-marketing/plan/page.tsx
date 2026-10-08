"use client";

/* Social Marketing — Plan: the week's plan Koleex AI drafted from the
   accounts' numbers, approved by an approver, with its progress. */

import AuthGate from "@/components/admin/AuthGate";
import SocialPlan from "@/components/marketing/SocialPlan";

export default function SocialMarketingPlanPage() {
  return (
    <AuthGate>
      <SocialPlan space="company" />
    </AuthGate>
  );
}
