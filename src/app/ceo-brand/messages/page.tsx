"use client";

/* CEO Brand — the private messages (owner, 29/09/2026): the Social engine on the CEO's
   own accounts (space "ceo"). */

import AuthGate from "@/components/admin/AuthGate";
import SocialMessages from "@/components/marketing/SocialMessages";

export default function CeoBrandMessagesPage() {
  return (
    <AuthGate>
      <SocialMessages space="ceo" />
    </AuthGate>
  );
}
