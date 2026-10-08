"use client";

/* CEO Brand — the weekly plan (owner, 29/09/2026): the Social engine on the CEO's
   own accounts (space "ceo"). */

import AuthGate from "@/components/admin/AuthGate";
import SocialPlan from "@/components/marketing/SocialPlan";

export default function CeoBrandPlanPage() {
  return (
    <AuthGate>
      <SocialPlan space="ceo" />
    </AuthGate>
  );
}
