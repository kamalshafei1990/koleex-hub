"use client";

/* ClockButton — the one control that punches the clock. Overview and the
   Attendance tab both render it; the server decides the time. */

import { useState } from "react";
import type { MyAttendanceRecord, MyHrBundle } from "@/lib/me-hr-types";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PlayIcon from "@/components/icons/ui/PlayIcon";
import StopIcon from "@/components/icons/ui/StopIcon";
import { ERROR_KEYS, browserTz, meFetch } from "./shared";

export default function ClockButton({ today, setBundle, t, size = "md" }: {
  today: MyAttendanceRecord | null;
  setBundle: (fn: (prev: MyHrBundle) => MyHrBundle) => void;
  t: (key: string, fallback?: string) => string;
  size?: "md" | "lg";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = !!today?.clock_out;
  const action: "in" | "out" = today?.clock_in && !done ? "out" : "in";

  const punch = async () => {
    setBusy(true);
    setError(null);
    const res = await meFetch<{ record: MyAttendanceRecord }>("/api/me/hr/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, tz: browserTz() }),
    });
    setBusy(false);
    if (!res.ok) { setError(t(ERROR_KEYS[res.error] ?? "hr.me.error")); return; }
    const rec = res.data.record;
    setBundle((prev) => {
      const rest = prev.attendance.month.filter((r) => r.id !== rec.id);
      const month = [rec, ...rest].sort((a, b) => (a.date < b.date ? 1 : -1));
      const monthHours = Math.round(month.reduce((s, r) => s + Number(r.total_hours ?? 0), 0) * 100) / 100;
      return { ...prev, attendance: { today: rec, month, monthHours } };
    });
  };

  const h = size === "lg" ? "h-12 px-6 text-[14px]" : "h-10 px-4 text-[13px]";
  const cls = done
    ? `${h} rounded-xl font-semibold bg-[var(--bg-surface)] text-[var(--text-dim)] border border-[var(--border-subtle)] cursor-default`
    : action === "in"
      ? `${h} rounded-xl font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-40 transition-all shadow-lg`
      : `${h} rounded-xl font-semibold bg-transparent text-[var(--text-primary)] border border-[var(--border-strong,var(--border-subtle))] hover:bg-[var(--bg-surface)] disabled:opacity-40 transition-all`;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button type="button" onClick={punch} disabled={busy || done} className={`${cls} inline-flex items-center gap-2`}>
        {busy ? <SpinnerIcon size={14} /> : action === "in" ? <PlayIcon size={14} /> : <StopIcon size={14} />}
        {done ? t("hr.me.dayDone") : action === "in" ? t("hr.me.clockInBtn") : t("hr.clockOutBtn")}
      </button>
      {error && <span className="text-[12px] text-[#FF3333]">{error}</span>}
    </div>
  );
}
