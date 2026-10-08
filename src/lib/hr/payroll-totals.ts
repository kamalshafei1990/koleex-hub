/* ---------------------------------------------------------------------------
   Payroll totals — per currency, never mixed (owner's pick, 26 Sep 2026).

   A run can cover employees paid in different currencies (a run for every
   country: EGP, CNY, USD…). Its totals used to add every slip together and
   carry the FIRST slip's currency, and the ledger entry drafted on approval
   posted that sum in that one currency — 10,000 EGP and 2,000 USD became
   12,000 USD in the books. Now:

     · a run's totals are one line per currency (totalsByCurrency);
     · the run row keeps its total columns only when it pays ONE currency —
       for several, currency and totals are null and every screen reads the
       lines (runColumns);
     · the ledger entry gets one balanced group of lines per currency, each
       valued at its own rate (lib/accounting/posting buildPayroll).

   Pure: the payroll engine, the run screen, the ledger and the validator
   share it.
   --------------------------------------------------------------------------- */

export interface CurrencyTotal { currency: string; employees: number; gross: number; net: number; employer: number }

export interface SlipMoney { currency?: string | null; gross: number | string | null; net: number | string | null; employer?: number | string | null }

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Each currency's slips added up, the currency with the most pay first. A
 *  slip with no currency counts under "USD" — the engine's own default. */
export function totalsByCurrency(slips: SlipMoney[]): CurrencyTotal[] {
  const by = new Map<string, CurrencyTotal>();
  for (const s of slips) {
    const currency = (s.currency || "USD").trim().toUpperCase();
    const cur = by.get(currency) ?? { currency, employees: 0, gross: 0, net: 0, employer: 0 };
    cur.employees++;
    cur.gross = r2(cur.gross + num(s.gross));
    cur.net = r2(cur.net + num(s.net));
    cur.employer = r2(cur.employer + num(s.employer));
    by.set(currency, cur);
  }
  return Array.from(by.values()).sort((a, b) => b.gross - a.gross || a.currency.localeCompare(b.currency));
}

/** A slip's employer contributions, added up (the stored JSON of name → amount). */
export function employerTotal(contributions: Record<string, unknown> | null | undefined): number {
  return r2(Object.values(contributions ?? {}).reduce<number>((a, v) => a + num(v), 0));
}

/** What the run row keeps: one currency's totals — or, for several, no
 *  currency and no totals (the lines are read from the slips instead). */
export function runColumns(lines: CurrencyTotal[]): { currency: string | null; employees: number; total_gross: number | null; total_net: number | null; total_employer: number | null } {
  const employees = lines.reduce((a, l) => a + l.employees, 0);
  if (lines.length === 1) {
    const [l] = lines;
    return { currency: l.currency, employees, total_gross: l.gross, total_net: l.net, total_employer: l.employer };
  }
  return { currency: null, employees, total_gross: lines.length ? null : 0, total_net: lines.length ? null : 0, total_employer: lines.length ? null : 0 };
}

/** A ledger line as the payroll entry drafts it (the posting engine stamps its rate). */
export interface PayrollLine { account_id: string; debit: number; credit: number; currency: string; description: string; reference: string }

/** A payroll's lines, one balanced group per currency — debits: the
 *  salaries and the employer's share; credits: the net pay owed and what is
 *  withheld or owed on top (gross − net + employer). Each group balances by
 *  itself, so the entry balances at any rate. */
export function payrollLines(groups: CurrencyTotal[], acct: { salaries: string; employer: string; netOwed: string; deductionsOwed: string }, period: string): PayrollLine[] {
  const lines: PayrollLine[] = [];
  for (const g of groups) {
    if (g.gross <= 0) continue;
    const tag = groups.length > 1 ? ` · ${g.currency}` : "";
    const deductions = r2(g.gross - g.net + g.employer);
    lines.push({ account_id: acct.salaries, debit: r2(g.gross), credit: 0, currency: g.currency, description: `Salaries ${period}${tag}`, reference: period });
    if (g.employer > 0) lines.push({ account_id: acct.employer, debit: r2(g.employer), credit: 0, currency: g.currency, description: `Employer contributions${tag}`, reference: period });
    lines.push({ account_id: acct.netOwed, debit: 0, credit: r2(g.net), currency: g.currency, description: `Net pay owed${tag}`, reference: period });
    if (deductions > 0) lines.push({ account_id: acct.deductionsOwed, debit: 0, credit: deductions, currency: g.currency, description: `Deductions, tax and contributions owed${tag}`, reference: period });
  }
  return lines;
}
