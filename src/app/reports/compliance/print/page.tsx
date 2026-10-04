"use client";

/* /reports/compliance/print?months=&lang= — compliance by month on the house
   sheet (owner's pick 26/09/2026). The Compliance tab prints it through a
   hidden iframe; see NumbersPrintPage for the print contract. It reads the
   same API as the tab with the reader's own session: the board's scope. */

import NumbersPrintPage, { type PaperResult } from "@/components/reports/numbers/NumbersPrintPage";
import { statsPaper } from "@/components/reports/numbers/stats-paper";
import { fetchComplianceStats } from "@/lib/work-reports";
import { reportComplianceT } from "@/lib/translations/report-ui/compliance";

async function build(q: URLSearchParams): Promise<PaperResult> {
  const lang = (["en", "zh", "ar"] as const).find((l) => l === q.get("lang")) ?? "en";
  const t = (key: string) => (reportComplianceT[key]?.[lang] ?? reportComplianceT[key]?.en ?? key) as string;
  const n = Number(q.get("months"));
  const res = await fetchComplianceStats(Number.isInteger(n) && n >= 1 && n <= 12 ? n : 6);
  if (!res.ok || !res.data.months.length) return { failed: "num.error" };
  return { paper: statsPaper(t, res.data) };
}

export default function CompliancePrintPage() {
  return <NumbersPrintPage build={build} />;
}
