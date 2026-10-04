/* ---------------------------------------------------------------------------
   marketing/format — how the marketing screens write dates and counts.

   TIME: the marketing section runs on SHANGHAI time (owner, 27/09/2026 —
   Koleex is in Taizhou, Zhejiang): a post scheduled for 09:00 goes out at
   09:00 in China wherever the person scheduling it is, and every date the
   marketing screens show is Shanghai time. China Standard Time is UTC+8 all
   year (no daylight saving since 1991), so the conversion is a fixed offset.
   Dates are D/M/Y (the Hub's rule). Counts are compact — 12.4K, 1.2M — in
   Western digits in every language, the way the platforms show them.
   --------------------------------------------------------------------------- */

export const MARKETING_TZ = "Asia/Shanghai";
const OFFSET_MS = 8 * 3600_000;
const p2 = (n: number) => String(n).padStart(2, "0");

/** The wall-clock of an instant in Shanghai (dow: Monday = 0). */
export function shanghai(at: string | Date): { y: number; m: number; d: number; hh: number; mm: number; dow: number } | null {
  const t = typeof at === "string" ? Date.parse(at) : at.getTime();
  if (Number.isNaN(t)) return null;
  const s = new Date(t + OFFSET_MS);
  return { y: s.getUTCFullYear(), m: s.getUTCMonth() + 1, d: s.getUTCDate(), hh: s.getUTCHours(), mm: s.getUTCMinutes(), dow: (s.getUTCDay() + 6) % 7 };
}

/** "27/09/2026 09:30" in Shanghai time. */
export function dmyHm(iso: string | null | undefined): string {
  const s = iso ? shanghai(iso) : null;
  return s ? `${p2(s.d)}/${p2(s.m)}/${s.y} ${p2(s.hh)}:${p2(s.mm)}` : "—";
}

/** "09:30" in Shanghai time. */
export function hm(iso: string | null | undefined): string {
  const s = iso ? shanghai(iso) : null;
  return s ? `${p2(s.hh)}:${p2(s.mm)}` : "—";
}

/** The Shanghai day of an instant, "YYYY-MM-DD". */
export function dayKey(at: string | Date): string {
  const s = shanghai(at);
  return s ? `${s.y}-${p2(s.m)}-${p2(s.d)}` : "";
}

/** A Shanghai date ("YYYY-MM-DD") and time ("HH:mm") as an instant (ISO,
 *  UTC); null when either is not one. */
export function fromShanghai(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const t = Date.parse(`${date}T${time}:00+08:00`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

const UNITS = ["", "K", "M", "B"] as const;

export function compact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  let v = Math.abs(n);
  let u = 0;
  while (v >= 1000 && u < UNITS.length - 1) { v /= 1000; u++; }
  let r = u === 0 ? Math.round(v) : Math.round(v * 10) / 10;
  /* 999,950 rounds to "1000K": carry it to the next unit. */
  if (r >= 1000 && u < UNITS.length - 1) { r = Math.round(r / 100) / 10; u++; }
  return `${n < 0 ? "-" : ""}${r}${UNITS[u]}`;
}
