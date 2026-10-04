/* ---------------------------------------------------------------------------
   What each number report prints (Reports 6C): the same columns, rows and
   totals the page shows, as tables and bars for NumbersPrintDoc. Pure — the
   words come in as `t`, the data as the API sent it.

   Every amount prints as "CODE 1,234.50", one line per currency; a row of
   the two agings is one party in one currency, so its figures print bare and
   its code sits beside the name.
   --------------------------------------------------------------------------- */

import { AGING_BUCKETS, CASH_FLOW_LINE_WORDS, DATED_KINDS, currencyOrder, dmy as dmyDate, dmyHm, fmtAmount, fmtCount, moneyLine, moneyLines, pct, type Money, type OpsKind } from "@/lib/reports/numbers";
import type { PrintBlock, PrintColumn, PrintRow } from "@/lib/reports/numbers-print";
import type { Paper } from "./NumbersPrintDoc";
import { agingTotals, type OpsReport, type StatementData } from "./data";

type T = (key: string) => string;

const NAME = "minmax(0,2.6fr)";
const NUM = "minmax(0,1.25fr)";
const SMALL = "minmax(0,0.7fr)";
const col = (label: string, width: string, align: "start" | "end" = "end"): PrintColumn => ({ label, width, align });
const period = (from: string, to: string) => `${dmyDate(from)} – ${dmyDate(to)}`;
const fileDate = (s: string) => s.replace(/\//g, "-");
/** A row with no money prints "—"; a total prints its zero. */
const rowMoney = (m: Money | undefined, base: string) => (currencyOrder(base, m).length ? moneyLines(m, base) : ["—"]);

export function opsPaper(t: T, kind: OpsKind, r: OpsReport, q: { from: string; to: string }): Paper {
  const base = r.base;
  const dated = DATED_KINDS.has(kind);
  const nameCol = t(kind === "sales" || kind === "customers" ? "num.col.customer" : kind === "purchases" || kind === "suppliers" ? "num.col.supplier" : kind === "expenses" ? "num.col.category" : "num.col.warehouse");
  const name = (label: string | null, key?: string) => [label ?? (key === "—" ? t(kind === "customers" ? "num.none.sales" : kind === "suppliers" ? "num.none.purchases" : `num.none.${kind}`) : t(`num.none.${kind}`))];
  const country = (m?: Record<string, string | number | null>) => [String(m?.country ?? "") || "—"];
  const tot = r.totals;
  let cols: PrintColumn[];
  let rows: PrintRow[];
  let foot: PrintRow;
  const total = t("num.totalOf").replace("{n}", fmtCount(r.rows.length));
  switch (kind) {
    case "sales":
      cols = [col(nameCol, NAME, "start"), col(t("num.col.country"), SMALL, "start"), col(t("num.col.invoices"), SMALL), col(t("num.col.amount"), NUM)];
      rows = r.rows.map((x) => ({ cells: [name(x.label, x.key), country(x.meta), [fmtCount(x.count)], rowMoney(x.amounts, base)] }));
      foot = { cells: [[total], [], [fmtCount(tot.count)], moneyLines(tot.amounts, base)] };
      break;
    case "purchases":
    case "expenses":
      cols = [col(nameCol, NAME, "start"), col(t(kind === "purchases" ? "num.col.bills" : "num.col.entries"), SMALL), col(t("num.col.amount"), NUM)];
      rows = r.rows.map((x) => ({ cells: [name(x.label, x.key), [fmtCount(x.count)], rowMoney(x.amounts, base)] }));
      foot = { cells: [[total], [fmtCount(tot.count)], moneyLines(tot.amounts, base)] };
      break;
    case "inventory":
      cols = [col(nameCol, NAME, "start"), col(t("num.col.items"), SMALL), col(t("num.col.qty"), SMALL), col(t("num.col.value"), NUM)];
      rows = r.rows.map((x) => ({ cells: [name(x.label, x.key), [fmtCount(x.count)], [fmtCount(x.qty ?? 0)], rowMoney(x.amounts, base)] }));
      foot = { cells: [[total], [fmtCount(tot.count)], [fmtCount(tot.qty ?? 0)], moneyLines(tot.amounts, base)] };
      break;
    case "customers":
      cols = [col(nameCol, NAME, "start"), col(t("num.col.country"), SMALL, "start"), col(t("num.col.invoices"), SMALL), col(t("num.col.sales"), NUM), col(t("num.col.toCollect"), NUM)];
      rows = r.rows.map((x) => ({ cells: [name(x.label, x.key), country(x.meta), [fmtCount(x.count)], rowMoney(x.amounts, base), rowMoney(x.open, base)] }));
      foot = { cells: [[total], [], [fmtCount(tot.count)], moneyLines(tot.amounts, base), moneyLines(tot.open, base)] };
      break;
    case "suppliers":
      cols = [col(nameCol, NAME, "start"), col(t("num.col.bills"), SMALL), col(t("num.col.purchases"), NUM), col(t("num.col.toPay"), NUM)];
      rows = r.rows.map((x) => ({ cells: [name(x.label, x.key), [fmtCount(x.count)], rowMoney(x.amounts, base), rowMoney(x.open, base)] }));
      foot = { cells: [[total], [fmtCount(tot.count)], moneyLines(tot.amounts, base), moneyLines(tot.open, base)] };
      break;
  }
  const codes = currencyOrder(base, tot.amounts, tot.open);
  const when = dated ? period(q.from, q.to) : `${dmyDate(new Date().toISOString())} · ${t("num.print.today")}`;
  const printed = dmyHm(new Date());
  const kindName = t(`num.kind.${kind}`);
  return {
    title: kindName,
    caption: t("num.ops.title"),
    meta: [
      { label: dated ? t("num.print.period") : t("num.print.asOf"), value: when },
      { label: t("num.print.currency"), value: codes.length ? codes.join(" · ") : base },
      { label: t(`num.kpi.${kind}.rows`), value: fmtCount(r.rows.filter((x) => x.key !== "—" && (kind !== "customers" && kind !== "suppliers" ? true : x.count > 0)).length) },
      { label: t("num.print.printed"), value: printed },
    ],
    strip: `${kindName} · ${when}`,
    blocks: [{ kind: "table", head: t(`num.hint.${kind}`), cols, rows, foot: r.rows.length ? [foot] : [], empty: dated ? t("num.empty") : t("num.emptyNow") }],
    fileName: `${kindName} — ${fileDate(dated ? period(q.from, q.to) : dmyDate(new Date().toISOString()))}`,
  };
}

export function statementPaper(t: T, d: StatementData, q: { from: string; to: string; asOf: string }): Paper {
  const printed = dmyHm(new Date());
  const title = t(`num.st.tab.${d.tab}`);
  const caption = t("num.st.title");
  const blocks: PrintBlock[] = [];
  const meta = (when: string, currency: string, third: { label: string; value: string }) => [
    { label: d.tab === "pl" || d.tab === "cf" ? t("num.print.period") : t("num.print.asOf"), value: when },
    { label: t("num.print.currency"), value: currency },
    third,
    { label: t("num.print.printed"), value: printed },
  ];
  if (d.tab === "pl") {
    const pl = d.pl, c = pl.currency, prev = pl.comparison;
    const cols = [col(t("num.col.account"), NAME, "start"), col(prev ? t("num.col.current") : t("num.col.amount"), NUM), ...(prev ? [col(t("num.col.previous"), NUM)] : [])];
    const amounts = (n: number, p?: number) => [[moneyLine(c, n)], ...(prev ? [[p === undefined ? "" : moneyLine(c, p)]] : [])];
    for (const [key, word] of [["revenue", "num.pl.revenue"], ["cost_of_sales", "num.pl.cos"], ["operating_expenses", "num.pl.opex"]] as const) {
      const s = pl[key];
      const extra = prev ? prev[key].accounts.filter((p) => !s.accounts.some((a) => a.account_id === p.account_id)) : [];
      const rows: PrintRow[] = [
        ...s.accounts.map((a) => ({ cells: [[`${a.code}  ${a.name}`], ...amounts(a.amount, prev ? prev[key].accounts.find((p) => p.account_id === a.account_id)?.amount ?? 0 : undefined)] })),
        ...extra.map((p) => ({ cells: [[`${p.code}  ${p.name}`], ...amounts(0, p.amount)] })),
      ];
      blocks.push({ kind: "table", head: t(word), cols, rows, foot: [{ cells: [[t("num.total")], ...amounts(s.amount, prev?.[key].amount)] }], empty: t("num.pl.noLines") });
      if (key === "cost_of_sales") blocks.push({ kind: "bar", label: `${t("num.pl.gross")} · ${t("num.pl.margin").replace("{p}", pct(pl.gross_margin_pct))}`, lines: [moneyLine(c, pl.gross_profit), ...(prev ? [`${t("num.col.previous")}: ${moneyLine(c, prev.gross_profit)}`] : [])] });
    }
    blocks.push({ kind: "bar", label: `${t("num.pl.operating")} · ${t("num.pl.margin").replace("{p}", pct(pl.operating_margin_pct))}`, lines: [moneyLine(c, pl.operating_profit), ...(prev ? [`${t("num.col.previous")}: ${moneyLine(c, prev.operating_profit)}`] : [])] });
    blocks.push({ kind: "bar", strong: true, label: `${t("num.pl.net")} · ${t("num.pl.margin").replace("{p}", pct(pl.net_margin_pct))}`, lines: [moneyLine(c, pl.net_profit), ...(prev ? [`${t("num.col.previous")}: ${moneyLine(c, prev.net_profit)}`] : [])] });
    const when = period(pl.period.from, pl.period.to);
    return {
      title, caption, blocks, strip: `${title} · ${when}`,
      meta: meta(when, c, prev ? { label: t("num.col.previous"), value: period(prev.period.from, prev.period.to) } : { label: t("num.pl.net"), value: moneyLine(c, pl.net_profit) }),
      fileName: `${title} — ${fileDate(when)}`,
    };
  }
  if (d.tab === "bs") {
    const bs = d.bs, c = d.currency;
    const balanced = Math.abs(bs.balanced_difference) < 0.01;
    blocks.push({
      kind: "table", head: t("num.st.tab.bs"), cols: [col(t("num.col.account"), NAME, "start"), col(t("num.col.amount"), NUM)],
      rows: [
        { cells: [[t("num.bs.assets")], [moneyLine(c, bs.total_assets)]], tone: "sub" },
        { cells: [[t("num.bs.liabilities")], [moneyLine(c, bs.total_liabilities)]] },
        { cells: [[t("num.bs.equity")], [moneyLine(c, bs.total_equity)]] },
        { cells: [[t("num.bs.earnings")], [moneyLine(c, bs.current_year_earnings)]] },
      ],
      foot: [{ cells: [[t("num.bs.liabEq")], [moneyLine(c, bs.total_liabilities + bs.total_equity + bs.current_year_earnings)]] }],
    });
    blocks.push({ kind: "bar", label: balanced ? t("num.bs.balanced") : t("num.bs.off").replace("{n}", moneyLine(c, bs.balanced_difference)), lines: [balanced ? "✓" : moneyLine(c, bs.balanced_difference)] });
    const when = dmyDate(bs.as_of || q.asOf);
    return { title, caption, blocks, strip: `${title} · ${when}`, meta: meta(when, c, { label: t("num.bs.assets"), value: moneyLine(c, bs.total_assets) }), fileName: `${title} — ${fileDate(when)}` };
  }
  if (d.tab === "cf") {
    const cf = d.cf, c = cf.currency;
    const word = (label: string) => (CASH_FLOW_LINE_WORDS[label] ? t(CASH_FLOW_LINE_WORDS[label]) : label);
    blocks.push({ kind: "bar", label: t("num.cf.opening"), lines: [moneyLine(c, cf.opening_cash)] });
    for (const [key, w] of [["operating", "num.cf.operating"], ["investing", "num.cf.investing"], ["financing", "num.cf.financing"]] as const) {
      const s = cf[key];
      blocks.push({
        kind: "table", head: t(w), cols: [col(t("num.col.account"), NAME, "start"), col(t("num.col.amount"), NUM)],
        rows: s.lines.map((l) => ({ cells: [[word(l.label)], [moneyLine(c, l.amount)]] })),
        foot: [{ cells: [[t("num.total")], [moneyLine(c, s.amount)]] }], empty: t("num.empty"),
      });
    }
    blocks.push({ kind: "bar", label: t("num.cf.net"), lines: [moneyLine(c, cf.net_change)] });
    blocks.push({ kind: "bar", strong: true, label: `${t("num.cf.closing")} · ${cf.reconciled ? t("num.cf.reconciled") : t("num.cf.off")}`, lines: [moneyLine(c, cf.closing_cash)] });
    const when = period(cf.period.from, cf.period.to);
    return { title, caption, blocks, strip: `${title} · ${when}`, meta: meta(when, c, { label: t("num.cf.net"), value: moneyLine(c, cf.net_change) }), fileName: `${title} — ${fileDate(when)}` };
  }
  /* The two agings: a row is one party in one currency. */
  const a = d.aging;
  const side = d.tab;
  const totals = agingTotals(a);
  const codes = Object.keys(totals).sort();
  /* The total bar: one line per currency, the code once beside "Total" —
     eight columns leave no room for it in every cell. */
  const money = (f: (x: { by_bucket: Record<string, number>; total_open: number; total_overdue: number }) => number) =>
    codes.map((c) => fmtAmount(f(totals[c])));
  const bare = (n: number) => [Math.abs(n) < 0.005 ? "—" : fmtAmount(n)];
  const narrow = "minmax(0,1fr)";
  const cols: PrintColumn[] = [
    col(t(side === "ar" ? "num.col.customer" : "num.col.supplier"), "minmax(0,2.2fr)", "start"),
    ...AGING_BUCKETS.map((b) => col(t(`num.bucket.${b}`), narrow)),
    col(t("num.col.open"), "minmax(0,1.15fr)"),
    col(t("num.col.overdue"), "minmax(0,1.15fr)"),
  ];
  blocks.push({
    kind: "table", head: t(`num.st.hint.${side}`), cols,
    rows: a.parties.map((p) => ({ cells: [[`${p.party_name ?? t(side === "ar" ? "num.none.sales" : "num.none.purchases")} · ${p.currency}`], ...AGING_BUCKETS.map((b) => bare(p.buckets[b] ?? 0)), bare(p.total_open), bare(p.total_overdue)] })),
    foot: a.parties.length ? [{ cells: [codes.map((c) => `${t("num.total")} · ${c}`), ...AGING_BUCKETS.map((b) => money((x) => x.by_bucket[b] ?? 0)), money((x) => x.total_open), money((x) => x.total_overdue)] }] : [],
    empty: t("num.aging.empty"),
  });
  const when = dmyDate(a.as_of || q.asOf);
  const open: Money = Object.fromEntries(codes.map((c) => [c, totals[c].total_open]));
  return {
    title, caption, blocks, strip: `${title} · ${when}`,
    meta: meta(when, codes.join(" · ") || "—", { label: t(`num.aging.${side}.open`), value: codes.map((c) => moneyLine(c, open[c])).join(" · ") || "—" }),
    fileName: `${title} — ${fileDate(when)}`,
  };
}
