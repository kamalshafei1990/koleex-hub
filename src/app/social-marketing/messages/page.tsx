"use client";

/* Social Marketing — Messages: the customers' private conversations on the
   connected Facebook Page (Messenger) and Instagram account, answered from
   the Hub inside Meta's 24-hour window. */

import AuthGate from "@/components/admin/AuthGate";
import SocialMessages from "@/components/marketing/SocialMessages";

export default function SocialMarketingMessagesPage() {
  return (
    <AuthGate>
      <SocialMessages space="company" />
    </AuthGate>
  );
}
