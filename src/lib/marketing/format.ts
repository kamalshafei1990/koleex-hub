/* ---------------------------------------------------------------------------
   marketing/format — how the marketing screens write dates and counts.
   Dates are D/M/Y (the Hub's rule). Counts are compact — 12.4K, 1.2M — in
   Western digits in every language, the way the platforms show them.
   --------------------------------------------------------------------------- */

export function dmyHm(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
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
