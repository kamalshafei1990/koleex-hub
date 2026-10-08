/* ---------------------------------------------------------------------------
   notification-pause (client) — the bell's "Pause notifications".

   Three choices: an hour; until the morning (08:00 on this device's clock —
   the next one at least half an hour away); while a meeting runs (the server
   reads the Calendar, lib/server/notification-pause). The answer is saved
   in the account's preferences, so the phone's push stops too, and the
   account is re-read everywhere (notifyIdentityChanged) — Settings and any
   other bell see the same pause.
   --------------------------------------------------------------------------- */
import { notifyIdentityChanged } from "@/lib/identity";

export type PauseChoice = "hour" | "morning" | "meeting";

const MORNING_HOUR = 8;

/** The next `hour`:00 (08:00 by default) on this device's clock that is at
 *  least 30 minutes away. */
export function nextMorning(now: Date = new Date(), hour: number = MORNING_HOUR): Date {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= now.getTime() + 30 * 60_000) d.setDate(d.getDate() + 1);
  return d;
}

/** Start a pause (or resume, with null). The pause's end, or null when the
 *  request failed. */
export async function requestPause(choice: PauseChoice | null): Promise<{ until: string | null; meeting: boolean } | null> {
  const body = choice === null ? { until: null }
    : choice === "meeting" ? { meeting: true }
    : { until: (choice === "hour" ? new Date(Date.now() + 3_600_000) : nextMorning()).toISOString() };
  try {
    const res = await fetch("/api/inbox/pause", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { until?: string | null; meeting?: boolean };
    notifyIdentityChanged();
    return { until: j.until ?? null, meeting: !!j.meeting };
  } catch {
    return null;
  }
}

/** "15:30", or "08:00" with the day's word when it is not today — on the
 *  reader's 12/24-hour setting. `tomorrow` is the word for the next day;
 *  a later day is written day first (D/M). */
export function clockText(d: Date, twelveHour: boolean, tomorrow: string, now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = d.getHours();
  const time = twelveHour ? `${h % 12 || 12}:${pad(d.getMinutes())} ${h >= 12 ? "PM" : "AM"}` : `${pad(h)}:${pad(d.getMinutes())}`;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86_400_000);
  if (diff <= 0) return time;
  if (diff === 1) return `${tomorrow} ${time}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${time}`;
}

/* ── Later (snooze one notification) ────────────────────────────────────
   The bell row's and the pop-up card's "Later": an hour, three hours, or
   tomorrow at 09:00 on this device's clock. The row is hidden until then
   and comes back on top as new, with its push (lib/server/inbox-snooze). */
export type LaterChoice = "1h" | "3h" | "tomorrow";
export const LATER_CHOICES: LaterChoice[] = ["1h", "3h", "tomorrow"];

export function laterUntil(c: LaterChoice, now: Date = new Date()): string {
  if (c === "tomorrow") return nextMorning(now, 9).toISOString();
  return new Date(now.getTime() + (c === "1h" ? 1 : 3) * 3_600_000).toISOString();
}
