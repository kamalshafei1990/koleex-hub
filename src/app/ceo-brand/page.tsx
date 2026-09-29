"use client";

/* CEO Brand — the Feed: a column for each connected account (owner, 29/09/2026): the Social engine on the CEO's
   own accounts (space "ceo"). */

import AuthGate from "@/components/admin/AuthGate";
import SocialFeed from "@/components/marketing/SocialFeed";

export default function CeoBrandPage() {
  return (
    <AuthGate>
      <SocialFeed space="ceo" />
    </AuthGate>
  );
}
