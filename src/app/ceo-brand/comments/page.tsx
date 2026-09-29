"use client";

/* CEO Brand — the comments (owner, 29/09/2026): the Social engine on the CEO's
   own accounts (space "ceo"). */

import AuthGate from "@/components/admin/AuthGate";
import SocialComments from "@/components/marketing/SocialComments";

export default function CeoBrandCommentsPage() {
  return (
    <AuthGate>
      <SocialComments space="ceo" />
    </AuthGate>
  );
}
