/* Client-safe time helpers for attendance screens. The day's times belong to
   the employee's attendance-policy zone (a China policy = China time), so the
   edit and correction forms show and take "HH:MM" in THAT zone, whatever the
   browser's own zone is. */

/** "HH:MM" of an instant in a zone ("" for no instant). */
export function hhmmInZone(iso: string | null | undefined, tz: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false })
      .format(new Date(iso)).replace("24:", "00:");
  } catch {
    return new Date(iso).toISOString().slice(11, 16);
  }
}

/** "1h 05m" from minutes. */
export function fmtMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
