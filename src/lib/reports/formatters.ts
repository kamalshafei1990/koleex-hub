/* ===========================================================================
   Phase R — Enterprise Reporting Formatters.

   Accounting-grade formatting helpers. Used by every renderer
   (layout, table, document) so a number on page 3 looks identical to
   the same number on page 1 — same decimals, same alignment, same
   negative convention.

   Anchor conventions (bank statement + enterprise accounting):
     · numbers right-aligned in tables, ALWAYS with two decimals
       (configurable for non-money columns)
     · negatives in parentheses, not with a minus sign: (1,234.56)
     · zero rendered as an em-dash "—" by default (cleaner than 0.00)
     · currency code as a separate column, not appended to the
       number — keeps decimal alignment perfect
     · dates as DD Mmm YYYY (international, unambiguous)
     · datetimes as DD Mmm YYYY · HH:mm
     · all formatting goes through Intl with the document locale, so
       English / Arabic / Chinese all render correctly (Arabic numerals
       used everywhere — accounting convention)
   ========================================================================== */

import type { ValueFormat } from "./types";

/** Money — fixed two decimals, thousands-separated, NEGATIVES IN
 *  PARENTHESES (accounting convention). Pass zeroAsDash=false to
 *  render 0.00 verbatim (useful for grand-total rows). */
export interface MoneyOptions {
  decimals?: number;       // default 2
  zeroAsDash?: boolean;    // default true for table cells
  locale?: string;         // default "en-US"
}
export function formatMoney(n: number | null | undefined, opts: MoneyOptions = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n as number)) return "—";
  const decimals = opts.decimals ?? 2;
  const zeroDash = opts.zeroAsDash ?? true;
  const locale = opts.locale ?? "en-US";
  const value = Number(n);
  if (zeroDash && Math.abs(value) < 10 ** -(decimals + 2)) return "—";
  const abs = Math.abs(value).toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return value < 0 ? `(${abs})` : abs;
}

/** Integer / count — thousands-separated, no decimals. */
export function formatCount(n: number | null | undefined, locale = "en-US"): string {
  if (n === null || n === undefined || !Number.isFinite(n as number)) return "—";
  return Number(n).toLocaleString(locale);
}

/** Percentage — one decimal, trailing %. */
export function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n as number)) return "—";
  return `${Number(n).toFixed(1)}%`;
}

/** Date — DD Mmm YYYY (e.g. "17 May 2026"). International unambiguous
 *  format; never US slash dates. */
export function formatDate(iso: string | null | undefined, locale = "en-GB"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

/** Datetime — DD Mmm YYYY · HH:mm. */
export function formatDateTime(iso: string | null | undefined, locale = "en-GB"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
  const timePart = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${datePart} · ${timePart}`;
}

/** Generic value formatter — drives table cell rendering through a
 *  single switch so a column declaring `format: "money"` is handled
 *  identically across every report. */
export function formatValue(
  v: string | number | null | undefined,
  fmt: ValueFormat | undefined,
  opts: { locale?: string; moneyDecimals?: number; zeroAsDash?: boolean } = {},
): string {
  if (v === null || v === undefined || v === "") return "—";
  switch (fmt) {
    case "money":
      return formatMoney(typeof v === "number" ? v : Number(v), {
        decimals: opts.moneyDecimals,
        zeroAsDash: opts.zeroAsDash,
        locale: opts.locale,
      });
    case "count":
      return formatCount(typeof v === "number" ? v : Number(v), opts.locale);
    case "percent":
      return formatPercent(typeof v === "number" ? v : Number(v));
    case "date":
      return formatDate(typeof v === "string" ? v : String(v));
    case "text":
    default:
      return String(v);
  }
}

/** HTML-escape — the renderer NEVER interpolates raw strings into
 *  HTML. Every string the builder layer passes through (recipient
 *  name, description, note, etc.) gets sanitised here. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Attribute-escape — currently same rules as content; separate name
 *  documents intent and lets us tighten quoting in one place if
 *  we ever switch to single-quoted attributes. */
export function escapeAttr(s: string): string {
  return escapeHtml(s);
}

/** Short reference — used in footers and audit lines. Always
 *  rendered in mono. */
export function shortRef(s: string, n = 8): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n);
}
