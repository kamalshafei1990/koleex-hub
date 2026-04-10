"use client";

import AdminAuth from "@/components/admin/AdminAuth";
import CalendarApp from "@/components/admin/calendar/CalendarApp";

export default function CalendarPage() {
  return (
    <AdminAuth
      title="Calendar"
      subtitle="Self-contained scheduling for Koleex accounts"
    >
      <CalendarApp />
    </AdminAuth>
  );
}
