"use client";

/* /reports/statements/print?tab=&from=&to=&as_of=&cmp=&lang= — one
   statement on the house sheet (Reports 6C). The page prints it through a
   hidden iframe; see NumbersPrintPage for the print contract. */

import NumbersPrintPage, { type PaperResult } from "@/components/reports/numbers/NumbersPrintPage";
import { fetchStatement } from "@/components/reports/numbers/data";
import { statementPaper } from "@/components/reports/numbers/paper";
import { isStatementTab, isYmd, quickRange, ymdOf } from "@/lib/reports/numbers";

async function build(q: URLSearchParams, t: (key: string) => string): Promise<PaperResult> {
  const tb = q.get("tab");
  const tab = isStatementTab(tb) ? tb : "pl";
  const today = ymdOf(new Date());
  const year = quickRange("year", today);
  const f = q.get("from"), to = q.get("to"), a = q.get("as_of");
  const range = isYmd(f) && isYmd(to) && f <= to ? { from: f, to } : year;
  const asOf = isYmd(a) ? a : today;
  const res = await fetchStatement(tab, { ...range, asOf, cmp: q.get("cmp") === "1" });
  if (res.state === "locked") return { failed: res.code === "needs_bank_profit" ? "num.locked.bankProfit" : "num.locked.finance" };
  if (res.state === "error") return { failed: "num.error" };
  return { paper: statementPaper(t, res.data, { ...range, asOf }) };
}

export default function StatementPrintPage() {
  return <NumbersPrintPage build={build} />;
}
