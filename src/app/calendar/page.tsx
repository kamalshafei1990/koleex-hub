"use client";

import AuthGate from "@/components/admin/AuthGate";
import CalendarApp from "@/components/admin/calendar/CalendarApp";

export default function CalendarPage() {
  return (
    <AuthGate
      title="Calendar"
      subtitle="Self-contained scheduling for Koleex accounts"
    >
      <CalendarApp />
    </AuthGate>
  );
}
