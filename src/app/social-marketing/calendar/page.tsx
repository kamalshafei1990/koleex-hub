"use client";

/* Social Marketing — Calendar: the month in Shanghai time, what goes out and
   what went out; an empty day starts a new post on that day. */

import AuthGate from "@/components/admin/AuthGate";
import SocialCalendar from "@/components/marketing/SocialCalendar";

export default function SocialMarketingCalendarPage() {
  return (
    <AuthGate>
      <SocialCalendar space="company" />
    </AuthGate>
  );
}
