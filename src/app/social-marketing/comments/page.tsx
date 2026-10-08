"use client";

/* Social Marketing — Comments: the threads on Koleex's posts, answered from
   the Hub; «Needs a reply» first. */

import AuthGate from "@/components/admin/AuthGate";
import SocialComments from "@/components/marketing/SocialComments";

export default function SocialMarketingCommentsPage() {
  return (
    <AuthGate>
      <SocialComments space="company" />
    </AuthGate>
  );
}
