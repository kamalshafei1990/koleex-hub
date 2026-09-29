"use client";

/* CEO Brand — the calendar (owner, 29/09/2026): the Social engine on the CEO's
   own accounts (space "ceo"). */

import AuthGate from "@/components/admin/AuthGate";
import SocialCalendar from "@/components/marketing/SocialCalendar";

export default function CeoBrandCalendarPage() {
  return (
    <AuthGate>
      <SocialCalendar space="ceo" />
    </AuthGate>
  );
}
