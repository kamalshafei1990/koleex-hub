"use client";

import AuthGate from "@/components/admin/AuthGate";
import CalendarApp from "@/components/admin/calendar/CalendarApp";

export default function CalendarPage() {
  return (
    <AuthGate>
      <CalendarApp />
    </AuthGate>
  );
}
