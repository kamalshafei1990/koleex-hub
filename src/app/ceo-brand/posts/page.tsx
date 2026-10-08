"use client";

/* CEO Brand — the posts (owner, 29/09/2026): the Social engine on the CEO's
   own accounts (space "ceo"). */

import AuthGate from "@/components/admin/AuthGate";
import SocialPosts from "@/components/marketing/SocialPosts";

export default function CeoBrandPostsPage() {
  return (
    <AuthGate>
      <SocialPosts space="ceo" />
    </AuthGate>
  );
}
