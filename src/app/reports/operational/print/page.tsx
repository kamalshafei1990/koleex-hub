"use client";

/* /reports/operational/print?kind=&from=&to=&lang= — one number report on
   the house sheet (Reports 6C). The page prints it through a hidden iframe;
   see NumbersPrintPage for the print contract. */

import NumbersPrintPage, { type PaperResult } from "@/components/reports/numbers/NumbersPrintPage";
import { fetchOps } from "@/components/reports/numbers/data";
import { opsPaper } from "@/components/reports/numbers/paper";
import { COST_KINDS, isOpsKind, isYmd, quickRange, ymdOf } from "@/lib/reports/numbers";

async function build(q: URLSearchParams, t: (key: string) => string): Promise<PaperResult> {
  const k = q.get("kind");
  const kind = isOpsKind(k) ? k : "sales";
  const year = quickRange("year", ymdOf(new Date()));
  const f = q.get("from"), to = q.get("to");
  const range = isYmd(f) && isYmd(to) && f <= to ? { from: f, to } : year;
  const res = await fetchOps(kind, range.from, range.to);
  if (res.state === "locked") return { failed: COST_KINDS.has(kind) ? "num.locked.cost" : "num.locked.finance" };
  if (res.state === "error") return { failed: "num.error" };
  return { paper: opsPaper(t, kind, res.data, range) };
}

export default function OperationalPrintPage() {
  return <NumbersPrintPage build={build} />;
}
