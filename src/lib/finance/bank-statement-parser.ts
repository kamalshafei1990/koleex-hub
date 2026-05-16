/* ===========================================================================
   Phase 2.6 — Bank Statement Parser
   ----------------------------------------------------------------------------
   Flexible CSV/XLSX → bank-statement-row parser. The parser is
   deterministic and pure: given a file Buffer + a file type, it
   produces a normalised array of statement rows ready to persist.

   Design pillars:

     · Header detection — no two banks use identical column names, so
       we resolve each canonical field via a permissive alias table.
     · Direction detection — supports debit/credit columns, sign on
       amount, or an explicit type/direction column.
     · Date detection — tries a small ordered list of formats.
     · Currency normalisation — falls back to the bank account's
       currency when absent.
     · Mapping override — the caller may pass a saved mapping; the
       parser uses it directly and skips auto-detect.

   The parser does NOT touch the DB. It does NOT decide duplicates.
   That's the import API endpoint's job.
   ========================================================================== */

import Papa from "papaparse";
import * as XLSX from "xlsx";
import type {
  BankStatementColumnMapping,
  BankStatementFileType,
  CashMovementDirection,
  CashMovementType,
} from "@/lib/finance/types";

/* ────────────────────────────────────────────────────────────────────────
   Alias tables — case + whitespace insensitive substring match.
   The first key that hits wins. Aliases are intentionally generous;
   bank statements in the wild use surprisingly long phrases.
   ──────────────────────────────────────────────────────────────────────── */

const ALIASES: Record<keyof BankStatementColumnMapping, string[]> = {
  date: [
    "transaction date", "trans date", "txn date", "posting date",
    "post date", "booking date", "date", "operation date",
  ],
  value_date: ["value date", "settlement date", "effective date"],
  description: [
    "description", "details", "narration", "narrative", "particulars",
    "memo", "remarks", "transaction details", "txn details", "purpose",
  ],
  reference: [
    "bank reference", "reference", "ref", "reference no", "ref no",
    "transaction reference", "transaction ref", "txn ref", "utr",
    "voucher", "voucher no", "doc no",
  ],
  debit: ["debit", "debit amount", "dr", "withdrawal", "outflow", "paid out", "paid-out"],
  credit: ["credit", "credit amount", "cr", "deposit", "inflow", "paid in", "paid-in"],
  amount: ["amount", "value", "transaction amount", "txn amount"],
  direction: ["direction", "type", "transaction type", "dr/cr", "dr cr"],
  balance: ["balance", "running balance", "balance after", "closing balance"],
  counterparty: ["counterparty", "beneficiary", "payer", "payee", "from/to", "from / to", "originator"],
  currency: ["currency", "ccy"],
};

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9 /-]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Find a column key in the row whose normalised name matches any
 *  alias of the canonical field. Returns the *original* column header
 *  the caller will use to index into the row object. */
function pickColumn(headers: string[], field: keyof BankStatementColumnMapping): string | undefined {
  const aliases = ALIASES[field];
  const map = headers.map((h) => ({ raw: h, norm: normaliseHeader(h) }));
  /* Exact match first. */
  for (const a of aliases) for (const h of map) if (h.norm === a) return h.raw;
  /* Then contains. */
  for (const a of aliases) for (const h of map) if (h.norm.includes(a) || a.includes(h.norm)) return h.raw;
  return undefined;
}

function detectMapping(headers: string[]): BankStatementColumnMapping {
  const m: BankStatementColumnMapping = {};
  for (const field of Object.keys(ALIASES) as Array<keyof BankStatementColumnMapping>) {
    const hit = pickColumn(headers, field);
    if (hit) m[field] = hit;
  }
  return m;
}

/* ────────────────────────────────────────────────────────────────────────
   Date parser — tries ISO, then dd/mm/yyyy / mm/dd/yyyy variants, then
   yyyy-mm-dd, then Excel serials. Returns yyyy-mm-dd string or null.
   ──────────────────────────────────────────────────────────────────────── */

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

function parseDate(raw: unknown): string | null {
  if (raw == null) return null;
  /* Excel serial number (XLSX). */
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw > 1000 && raw < 100_000) {
      const ms = EXCEL_EPOCH_MS + raw * 86_400_000;
      return new Date(ms).toISOString().slice(0, 10);
    }
  }
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw !== "string") raw = String(raw);
  const s = (raw as string).trim();
  if (!s) return null;

  /* ISO-ish (yyyy-mm-dd[T...]) */
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  /* dd/mm/yyyy or dd-mm-yyyy. Ambiguous with mm/dd; we prefer
     dd/mm because most non-US bank exports use that. */
  const eu = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (eu) {
    const [, d, m] = eu;
    let y = eu[3];
    if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
    const dd = d.padStart(2, "0");
    const mm = m.padStart(2, "0");
    /* Sanity check — if dd > 12 we know it isn't mm/dd. If both ≤ 12
       we keep the dd/mm assumption. */
    if (Number(dd) > 31 || Number(mm) > 31) return null;
    return `${y}-${mm}-${dd}`;
  }

  /* Native Date fallback. */
  const n = Date.parse(s);
  if (!Number.isNaN(n)) return new Date(n).toISOString().slice(0, 10);
  return null;
}

/* ────────────────────────────────────────────────────────────────────────
   Amount parser — strips currency symbols, thousands separators, and
   parentheses (used for negatives). Returns { amount, signHint }.
   ──────────────────────────────────────────────────────────────────────── */

function parseAmount(raw: unknown): { amount: number | null; signHint: "in" | "out" | null } {
  if (raw == null || raw === "") return { amount: null, signHint: null };
  if (typeof raw === "number") {
    return {
      amount: Math.abs(raw),
      signHint: raw < 0 ? "out" : raw > 0 ? "in" : null,
    };
  }
  let s = String(raw).trim();
  if (!s) return { amount: null, signHint: null };

  let signHint: "in" | "out" | null = null;
  /* Accounting parens: (123.45) means -123.45 → outflow */
  const parens = s.match(/^\(([^)]+)\)$/);
  if (parens) {
    s = parens[1];
    signHint = "out";
  }
  if (s.startsWith("-")) {
    s = s.slice(1);
    signHint = "out";
  } else if (s.startsWith("+")) {
    s = s.slice(1);
    signHint = "in";
  }

  /* Strip currency code/symbol + thousands separators. */
  s = s.replace(/[^0-9.,\-]/g, "");
  /* Decide decimal separator: if both "," and "." present, the last
     one is decimal; otherwise prefer ".", fall back to ",". */
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",") && !s.includes(".")) {
    /* If exactly 2 digits after the comma, treat as decimal. */
    if (/,\d{1,2}$/.test(s)) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return { amount: null, signHint };
  return { amount: Math.abs(n), signHint };
}

/* ────────────────────────────────────────────────────────────────────────
   Direction resolution — uses debit/credit columns first, falls back
   to amount sign hint, then to direction/type column text.
   ──────────────────────────────────────────────────────────────────────── */

function resolveDirection(args: {
  mapping: BankStatementColumnMapping;
  row: Record<string, unknown>;
  signHint: "in" | "out" | null;
}): { direction: CashMovementDirection | null; amount: number | null; raw_amount: number | null } {
  const r = args.row;
  /* Debit/credit columns. */
  if (args.mapping.debit || args.mapping.credit) {
    const dRaw = args.mapping.debit ? r[args.mapping.debit] : null;
    const cRaw = args.mapping.credit ? r[args.mapping.credit] : null;
    const d = parseAmount(dRaw).amount ?? 0;
    const c = parseAmount(cRaw).amount ?? 0;
    if (c > 0 && c >= d) return { direction: "inflow", amount: c, raw_amount: c };
    if (d > 0)            return { direction: "outflow", amount: d, raw_amount: -d };
  }
  /* Amount column with sign / explicit direction. */
  if (args.mapping.amount) {
    const { amount, signHint } = parseAmount(r[args.mapping.amount]);
    let dir: CashMovementDirection | null = null;
    if (signHint === "in") dir = "inflow";
    if (signHint === "out") dir = "outflow";
    /* Direction text column overrides if present. */
    if (!dir && args.mapping.direction && r[args.mapping.direction]) {
      const txt = String(r[args.mapping.direction]).toLowerCase().trim();
      if (/in|cr|credit|deposit|inward|incoming/.test(txt)) dir = "inflow";
      else if (/out|dr|debit|withdraw|outward|outgoing/.test(txt)) dir = "outflow";
    }
    return { direction: dir, amount, raw_amount: amount != null ? (dir === "outflow" ? -amount : amount) : null };
  }
  /* Pure direction-text fallback. */
  if (args.mapping.direction && args.row[args.mapping.direction]) {
    const txt = String(args.row[args.mapping.direction]).toLowerCase();
    const dir: CashMovementDirection | null = /in|cr|credit/.test(txt) ? "inflow"
      : /out|dr|debit/.test(txt) ? "outflow" : null;
    return { direction: dir, amount: null, raw_amount: null };
  }
  return { direction: null, amount: null, raw_amount: null };
}

/* ────────────────────────────────────────────────────────────────────────
   Movement type inference — best-effort heuristic on description +
   direction. Operator can edit before confirm. Never blocks import.
   ──────────────────────────────────────────────────────────────────────── */

function inferMovementType(
  direction: CashMovementDirection | null,
  description: string | null,
): CashMovementType | null {
  if (!direction) return null;
  const d = (description ?? "").toLowerCase();
  if (/fee|charge|commission/.test(d))   return "fee";
  if (/refund|reversal|chargeback/.test(d)) return "refund";
  if (/fx|forex|exchange/.test(d))       return "fx";
  if (/adjustment|adjust|correction/.test(d)) return "adjustment";
  if (/transfer|internal/.test(d))       return "transfer";
  return direction === "inflow" ? "incoming" : "outgoing";
}

/* ────────────────────────────────────────────────────────────────────────
   Public types + entry point
   ──────────────────────────────────────────────────────────────────────── */

export interface ParsedStatementRow {
  row_index: number;
  raw_data: Record<string, unknown>;
  movement_date: string | null;
  value_date: string | null;
  description: string | null;
  reference: string | null;
  counterparty_name: string | null;
  direction: CashMovementDirection | null;
  amount: number | null;
  currency: string | null;
  balance_after: number | null;
  movement_type: CashMovementType | null;
}

export interface ParseResult {
  detectedMapping: BankStatementColumnMapping;
  headers: string[];
  rows: ParsedStatementRow[];
  /** Per-row parse error (row never gets a movement, but it persists for audit). */
  errorRows: Array<{ row_index: number; raw_data: Record<string, unknown>; error_message: string }>;
}

export interface ParseInput {
  fileType: BankStatementFileType;
  buffer: ArrayBuffer | Buffer;
  /** Default currency to apply when a row has no currency column. */
  defaultCurrency?: string;
  /** Operator-provided column mapping overrides auto-detect. */
  mappingOverride?: BankStatementColumnMapping;
}

function bufferToString(buffer: ArrayBuffer | Buffer): string {
  if (Buffer.isBuffer(buffer)) return buffer.toString("utf-8");
  return new TextDecoder("utf-8").decode(buffer);
}

function bufferToUint8(buffer: ArrayBuffer | Buffer): Uint8Array {
  if (Buffer.isBuffer(buffer)) return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  return new Uint8Array(buffer);
}

export function parseStatement(input: ParseInput): ParseResult {
  const { fileType, buffer, defaultCurrency, mappingOverride } = input;
  const errorRows: ParseResult["errorRows"] = [];
  const out: ParsedStatementRow[] = [];

  let headers: string[] = [];
  let records: Record<string, unknown>[] = [];

  if (fileType === "csv") {
    const text = bufferToString(buffer);
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    });
    headers = (parsed.meta.fields ?? []).map((h) => String(h));
    records = (parsed.data ?? []).filter((r) => r && Object.values(r).some((v) => v != null && v !== ""));
  } else {
    /* XLSX path — read the first sheet, header row drives the column
       names. We feed XLSX a typed array; Buffer in Node works too. */
    const wb = XLSX.read(bufferToUint8(buffer), { type: "array", cellDates: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return { detectedMapping: {}, headers: [], rows: [], errorRows: [] };
    }
    const sheet = wb.Sheets[sheetName];
    records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
    headers = records.length ? Object.keys(records[0]) : [];
  }

  const mapping: BankStatementColumnMapping = mappingOverride ?? detectMapping(headers);

  records.forEach((r, idx) => {
    try {
      const movement_date =
        mapping.date ? parseDate(r[mapping.date]) : null;
      const value_date =
        mapping.value_date ? parseDate(r[mapping.value_date]) : null;
      const description =
        mapping.description ? (r[mapping.description] != null ? String(r[mapping.description]).trim() : null) : null;
      const reference =
        mapping.reference ? (r[mapping.reference] != null ? String(r[mapping.reference]).trim() : null) : null;
      const counterparty =
        mapping.counterparty ? (r[mapping.counterparty] != null ? String(r[mapping.counterparty]).trim() : null) : null;

      const { amount, signHint } = mapping.amount
        ? parseAmount(r[mapping.amount])
        : { amount: null, signHint: null };
      const resolved = resolveDirection({ mapping, row: r, signHint });

      const currency = mapping.currency && r[mapping.currency]
        ? String(r[mapping.currency]).trim().toUpperCase().slice(0, 4)
        : (defaultCurrency ?? null);

      const balance_after = mapping.balance ? parseAmount(r[mapping.balance]).amount : null;

      const movement_type = inferMovementType(resolved.direction, description);

      /* Row must have at least date + amount + direction to be useful. */
      if (!movement_date || resolved.amount == null || !resolved.direction) {
        errorRows.push({
          row_index: idx,
          raw_data: r,
          error_message: "Missing date, amount, or direction",
        });
        return;
      }

      out.push({
        row_index: idx,
        raw_data: r,
        movement_date,
        value_date,
        description: description || null,
        reference: reference || null,
        counterparty_name: counterparty || null,
        direction: resolved.direction,
        amount: resolved.amount ?? amount,
        currency,
        balance_after,
        movement_type,
      });
    } catch (e) {
      errorRows.push({
        row_index: idx,
        raw_data: r,
        error_message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  return { detectedMapping: mapping, headers, rows: out, errorRows };
}
