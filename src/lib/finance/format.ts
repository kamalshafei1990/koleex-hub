/* ---------------------------------------------------------------------------
   Finance display formatters — the one place a finance screen turns a
   number or a date into text.

   House rules:
     · dates read D/M/Y (owner standing rule) — never the ISO string a row
       carries, never the browser's locale guess
     · accounting amounts: two decimals, thousands separators, negatives in
       parentheses, a true zero as "—" so a dense ledger stays scannable
     · money with a currency code goes through fmtMoney (calc.ts), which
       already handles the "base currency still resolving" placeholder

   Before this file ~6 finance components each carried a private fmtMoney /
   fmt with slightly different rules (one printed "0.00", one "—", one
   "(12.00) CNY", one "-12.00 CNY").
   --------------------------------------------------------------------------- */

export { fmtMoney } from "@/lib/finance/calc";

const NUM2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "1,234.50", "(1,234.50)" for negatives, "—" for zero. */
export function fmtAccounting(n: number | string | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v) || Math.abs(v) < 0.005) return "—";
  const abs = NUM2.format(Math.abs(v));
  return v < 0 ? `(${abs})` : abs;
}

/** fmtAccounting plus the currency code: "(1,234.50) CNY". */
export function fmtAccountingMoney(n: number | string | null | undefined, currency: string): string {
  const s = fmtAccounting(n);
  return s === "—" || !currency ? s : `${s} ${currency}`;
}

/** "20/09/2026" from an ISO date or timestamp; "—" when absent or unparsable.
 *  Date-only strings are split, not parsed, so a ledger date never shifts a
 *  day with the viewer's time zone. */
export function fmtDMY(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  if (typeof iso === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** "20/09/2026 14:05" in the viewer's local time. */
export function fmtDMYTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${fmtDMY(d)} ${hh}:${mi}`;
}

/** Today's date as the ISO string inputs and APIs expect. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
