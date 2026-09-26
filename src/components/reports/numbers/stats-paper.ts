/* ---------------------------------------------------------------------------
   Compliance by month on the house paper (owner's pick 26/09/2026,
   «إحصائيات الالتزام بالشهور») — the number reports' sheets (NumbersPrintDoc,
   paginateNumbers): each person's rate per month with the team's as the
   total bar, then the last month in detail (due, on time, late, missing).
   A cell is one line — "92% · 11/12" — so a row's height stays arithmetic.
   --------------------------------------------------------------------------- */

import { dmyHm } from "@/lib/reports/numbers";
import type { PrintColumn, PrintRow } from "@/lib/reports/numbers-print";
import { rateOf, type MonthTally } from "@/lib/reports/compliance-stats";
import type { ComplianceStats } from "@/lib/work-reports";
import type { Paper } from "./NumbersPrintDoc";

type T = (key: string) => string;
const NAME = "minmax(0,2.2fr)";
const CELL = "minmax(0,1fr)";
const col = (label: string, width: string, align: "start" | "end" = "end"): PrintColumn => ({ label, width, align });
const month = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;
const zero: MonthTally = { onTime: 0, late: 0, missing: 0, pending: 0 };

/** "92% · 11/12", or "—" while nothing in the month is decided. */
export function statCell(x: MonthTally | undefined): string {
  const tally = x ?? zero;
  const r = rateOf(tally);
  return r === null ? "—" : `${r}% · ${tally.onTime}/${tally.onTime + tally.late + tally.missing}`;
}

export function statsPaper(t: T, d: ComplianceStats): Paper {
  const last = d.months[d.months.length - 1];
  const range = d.months.length > 1 ? `${month(d.months[0])} – ${month(last)}` : month(last);
  const title = t("stats.print.title");
  const byMonth: PrintRow[] = d.rows.map((r) => ({ cells: [[r.person.name], ...d.months.map((m) => [statCell(r.months[m])])] }));
  const detailRow = (name: string, x: MonthTally | undefined, tone?: "sub"): PrintRow => {
    const tally = x ?? zero;
    const r = rateOf(tally);
    return { cells: [[name], [String(tally.onTime + tally.late + tally.missing + tally.pending)], [String(tally.onTime)], [String(tally.late)], [String(tally.missing)], [r === null ? "—" : `${r}%`]], ...(tone ? { tone } : {}) };
  };
  const teamRate = rateOf(d.team[last] ?? zero);
  return {
    title,
    caption: t("stats.print.caption"),
    meta: [
      { label: t("stats.print.months"), value: range },
      { label: t("stats.print.people"), value: String(d.rows.length) },
      { label: t("stats.print.teamRate"), value: teamRate === null ? "—" : `${teamRate}%` },
      { label: t("stats.print.printed"), value: dmyHm(new Date()) },
    ],
    strip: `${title} · ${range}`,
    blocks: [
      {
        kind: "table", head: t("stats.print.byMonth"),
        cols: [col(t("stats.col.person"), NAME, "start"), ...d.months.map((m) => col(month(m), CELL))],
        rows: byMonth, foot: d.rows.length ? [{ cells: [[t("stats.team")], ...d.months.map((m) => [statCell(d.team[m])])] }] : [], empty: t("compliance.empty"),
      },
      {
        kind: "table", head: t("stats.print.detail").replace("{month}", month(last)),
        cols: [col(t("stats.col.person"), NAME, "start"), col(t("stats.col.due"), CELL), col(t("stats.col.onTime"), CELL), col(t("stats.col.late"), CELL), col(t("stats.col.missing"), CELL), col(t("stats.col.rate"), CELL)],
        rows: d.rows.map((r) => detailRow(r.person.name, r.months[last])), foot: d.rows.length ? [detailRow(t("stats.team"), d.team[last])] : [], empty: t("compliance.empty"),
      },
    ],
    fileName: `${title} — ${range.replace(/\//g, "-")}`,
  };
}
