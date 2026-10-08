"use client";

/* Social Marketing — Posts: every post written in the Hub (drafts, waiting
   for approval, published, problems), and "New post". */

import AuthGate from "@/components/admin/AuthGate";
import SocialPosts from "@/components/marketing/SocialPosts";

export default function SocialMarketingPostsPage() {
  return (
    <AuthGate>
      <SocialPosts space="company" />
    </AuthGate>
  );
}
