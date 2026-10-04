import "server-only";

/* ===========================================================================
   Aging from the ledger — receivables (1100) and payables (2000) by party,
   built from journal lines rather than from the invoice and bill tables.

   Why a second aging: the operational aging says what the sales and
   purchase apps believe is open; this one says what the books carry. When
   the two disagree, something was posted without its document or a
   document changed after it was booked — the control account is the
   referee. Every row here sums back to the account's balance.

   Method: per party, charges (debits on 1100 / credits on 2000) are
   settled first-in-first-out by the party's settlements; what remains open
   is aged by the charge's entry date (0–30 · 31–60 · 61–90 · 90+). A party
   with more settlements than charges shows the excess as unapplied, so the
   party total is still its ledger balance. Amounts are base currency.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import { resolveBaseCurrency } from "@/lib/finance/currency";

export type LedgerAgingSide = "ar" | "ap";
export type LedgerBucket = "0-30" | "31-60" | "61-90" | "90+";
export const LEDGER_BUCKETS: LedgerBucket[] = ["0-30", "31-60", "61-90", "90+"];

export interface LedgerAgingParty {
  party_id: string | null;
  party_name: string;
  balance: number;          // ledger balance for the party (base)
  open: number;             // open charges after FIFO settlement
  unapplied: number;        // settlements not matched to a charge (≥ 0)
  buckets: Record<LedgerBucket, number>;
  oldest_open: string | null;
}

export interface LedgerAging {
  side: LedgerAgingSide;
  account_code: string;
  as_of: string;
  currency: string;
  control_balance: number;   // the account balance in the trial balance
  parties: LedgerAgingParty[];
  totals: { balance: number; open: number; unapplied: number; buckets: Record<LedgerBucket, number> };
}

interface Line { party_id: string | null; entry_date: string; amount: number }  // amount = base, +charge / −settlement

const r2 = (n: number) => Math.round(n * 100) / 100;
const emptyBuckets = (): Record<LedgerBucket, number> => ({ "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 });
function bucketOf(days: number): LedgerBucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

async function fetchLines(tenantId: string, accountId: string, asOf: string, sign: 1 | -1): Promise<Line[]> {
  const out: Line[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseServer
      .from("accounting_journal_lines")
      .select("party_id, debit, credit, exchange_rate, entry:entry_id!inner(entry_date, status)")
      .eq("tenant_id", tenantId)
      .eq("account_id", accountId)
      .in("entry.status", ["posted", "voided"])
      .lte("entry.entry_date", asOf)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Array<{ party_id: string | null; debit: number | string; credit: number | string; exchange_rate: number | string | null; entry: { entry_date: string } | { entry_date: string }[] }>;
    for (const r of rows) {
      const e = Array.isArray(r.entry) ? r.entry[0] : r.entry;
      const rate = Number(r.exchange_rate ?? 1) || 1;
      out.push({ party_id: r.party_id, entry_date: e?.entry_date ?? asOf, amount: sign * (Number(r.debit) - Number(r.credit)) * rate });
    }
    if (rows.length < PAGE) break;
  }
  return out;
}

async function partyNames(side: LedgerAgingSide, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  if (side === "ar") {
    const { data } = await supabaseServer.from("customers").select("id, name").in("id", ids);
    for (const c of (data ?? []) as Array<{ id: string; name: string }>) map.set(c.id, c.name);
  }
  const missing = ids.filter((id) => !map.has(id));
  if (missing.length) {
    const { data } = await supabaseServer.from("suppliers").select("id, name, company_name").in("id", missing);
    for (const s of (data ?? []) as Array<{ id: string; name: string | null; company_name: string | null }>) map.set(s.id, s.company_name || s.name || s.id.slice(0, 8));
  }
  const still = ids.filter((id) => !map.has(id));
  if (still.length) {
    const { data } = await supabaseServer.from("contacts").select("id, display_name, company_name").in("id", still);
    for (const c of (data ?? []) as Array<{ id: string; display_name: string | null; company_name: string | null }>) map.set(c.id, c.company_name || c.display_name || c.id.slice(0, 8));
  }
  return map;
}

export async function buildLedgerAging(tenantId: string, side: LedgerAgingSide, asOfIso?: string): Promise<LedgerAging> {
  const asOf = asOfIso && /^\d{4}-\d{2}-\d{2}$/.test(asOfIso) ? asOfIso : new Date().toISOString().slice(0, 10);
  const code = side === "ar" ? "1100" : "2000";
  const { data: acct } = await supabaseServer.from("accounting_accounts").select("id").eq("tenant_id", tenantId).eq("code", code).maybeSingle();
  const currency = await resolveBaseCurrency(tenantId);
  if (!acct) return { side, account_code: code, as_of: asOf, currency, control_balance: 0, parties: [], totals: { balance: 0, open: 0, unapplied: 0, buckets: emptyBuckets() } };

  /* A charge is a debit on the receivable, a credit on the payable. */
  const lines = await fetchLines(tenantId, (acct as { id: string }).id, asOf, side === "ar" ? 1 : -1);
  const asOfMs = Date.parse(asOf);

  const byParty = new Map<string, Line[]>();
  for (const l of lines) {
    const k = l.party_id ?? "";
    const arr = byParty.get(k) ?? [];
    arr.push(l);
    byParty.set(k, arr);
  }
  const names = await partyNames(side, Array.from(byParty.keys()).filter(Boolean));

  const parties: LedgerAgingParty[] = [];
  for (const [key, arr] of byParty) {
    arr.sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    const charges: Array<{ date: string; left: number }> = [];
    let settlements = 0;
    for (const l of arr) {
      if (l.amount > 0) charges.push({ date: l.entry_date, left: l.amount });
      else settlements += -l.amount;
    }
    /* FIFO: oldest charges are cleared first. */
    let pool = settlements;
    for (const c of charges) {
      if (pool <= 0) break;
      const take = Math.min(c.left, pool);
      c.left -= take;
      pool -= take;
    }
    const buckets = emptyBuckets();
    let open = 0;
    let oldest: string | null = null;
    for (const c of charges) {
      if (c.left < 0.005) continue;
      const days = Math.floor((asOfMs - Date.parse(c.date)) / 86_400_000);
      buckets[bucketOf(days)] = r2(buckets[bucketOf(days)] + c.left);
      open = r2(open + c.left);
      if (!oldest || c.date < oldest) oldest = c.date;
    }
    const unapplied = r2(Math.max(0, pool));
    const balance = r2(arr.reduce((s, l) => s + l.amount, 0));
    if (Math.abs(balance) < 0.005 && open < 0.005 && unapplied < 0.005) continue;
    parties.push({
      party_id: key || null,
      party_name: key ? (names.get(key) ?? key.slice(0, 8)) : (side === "ar" ? "No customer on line" : "No supplier on line"),
      balance, open, unapplied, buckets, oldest_open: oldest,
    });
  }
  parties.sort((a, b) => b.open - a.open || b.balance - a.balance);

  const totals = parties.reduce(
    (acc, p) => {
      acc.balance = r2(acc.balance + p.balance);
      acc.open = r2(acc.open + p.open);
      acc.unapplied = r2(acc.unapplied + p.unapplied);
      for (const b of LEDGER_BUCKETS) acc.buckets[b] = r2(acc.buckets[b] + p.buckets[b]);
      return acc;
    },
    { balance: 0, open: 0, unapplied: 0, buckets: emptyBuckets() },
  );
  const control_balance = r2(lines.reduce((s, l) => s + l.amount, 0));
  return { side, account_code: code, as_of: asOf, currency, control_balance, parties, totals };
}
