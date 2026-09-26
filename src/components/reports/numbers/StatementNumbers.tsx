"use client";

/* ---------------------------------------------------------------------------
   /reports/statements — profit & loss, balance sheet, cash flow, what
   customers owe and what we owe suppliers (Reports 6C, owner's pick
   26/09/2026: «تقارير الأرقام بشكل جديد»).

   FOUND: the page this replaces read `j.pl ?? j.profit_loss ?? j` while the
   APIs answer `{ statement }` / `{ balance_sheet }` — every tab threw on its
   first render. And the Library's line ("statements, receivables and
   payables ageing") and Finance's "tap for aging" cards promised two agings
   the page never had (`?tab=ar|ap` was not read). Both are here now, on the
   same APIs and the same Finance door.

   The statements come from the ledger in the company's currency; the two
   agings keep each currency on its own row and total (lib/accounting/aging).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { reportNumbersT } from "@/lib/translations/report-ui/numbers";
import { entityHref } from "@/lib/reports/link-targets";
import {
  AGING_BUCKETS, CASH_FLOW_LINE_WORDS, RANGED_TABS, STATEMENT_TABS, fmtAmount, fmtCount, isStatementTab, isYmd, moneyLine, pct, quickRange, ymdOf,
  type Money, type StatementTab,
} from "@/lib/reports/numbers";
import {
  MoneyKpi, MoneyStack, NumbersFrame, NumbersTable, PeriodBar, PlainKpi, PrintButton, RowName, StateCard, TabPills, printPaper, readSearch, writeSearch,
  CARD, type NumCol, type T,
} from "./NumbersKit";
import { agingTotals, fetchStatement, type Aging, type AgingRow, type BalanceSummary, type CashFlow, type Fetched, type ProfitLoss, type StatementData } from "./data";

const seen = new Map<string, Fetched<StatementData>>();

export default function StatementNumbers() {
  const { t, lang } = useTranslation(reportNumbersT);
  const today = useMemo(() => ymdOf(new Date()), []);
  const yearly = useMemo(() => quickRange("year", today), [today]);
  const [tab, setTab] = useState<StatementTab>("pl");
  const [from, setFrom] = useState(yearly.from);
  const [to, setTo] = useState(yearly.to);
  const [asOf, setAsOf] = useState(today);
  const [cmp, setCmp] = useState(false);
  const [result, setResult] = useState<Fetched<StatementData> | null>(null);
  const [loading, setLoading] = useState(false);
  const req = useRef(0);

  /* ?tab=ar|ap is how Finance's "tap for aging" cards arrive. */
  useEffect(() => {
    void Promise.resolve().then(() => {
      const q = readSearch();
      const tb = q.get("tab"), f = q.get("from"), tt = q.get("to"), a = q.get("as_of");
      if (isStatementTab(tb)) setTab(tb);
      if (isYmd(f) && isYmd(tt) && f <= tt) { setFrom(f); setTo(tt); }
      if (isYmd(a)) setAsOf(a);
      if (q.get("cmp") === "1") setCmp(true);
    });
  }, []);

  const ranged = RANGED_TABS.has(tab);
  const keyOf = useCallback((tb: StatementTab) => (RANGED_TABS.has(tb) ? `${tb}|${from}|${to}|${tb === "pl" && cmp ? 1 : 0}` : `${tb}|${asOf}`), [from, to, asOf, cmp]);

  const load = useCallback(async (tb: StatementTab, force = false) => {
    const key = keyOf(tb);
    const hit = seen.get(key);
    if (hit && !force) { setResult(hit); return; }
    const id = ++req.current;
    setLoading(true);
    const out = await fetchStatement(tb, { from, to, asOf, cmp });
    if (id !== req.current) return;
    if (out.state !== "error") seen.set(key, out);
    setResult(out);
    setLoading(false);
  }, [keyOf, from, to, asOf, cmp]);

  useEffect(() => { void Promise.resolve().then(() => load(tab)); }, [tab, load]);

  const pickTab = (tb: StatementTab) => { setTab(tb); writeSearch({ tab: tb === "pl" ? null : tb }); };
  const pickRange = (f: string, tt: string) => {
    setFrom(f); setTo(tt);
    const dflt = f === yearly.from && tt === yearly.to;
    writeSearch({ from: dflt ? null : f, to: dflt ? null : tt });
  };
  const pickAsOf = (d: string) => { setAsOf(d); writeSearch({ as_of: d === today ? null : d }); };
  const toggleCmp = () => { setCmp((v) => { writeSearch({ cmp: v ? null : "1" }); return !v; }); };

  const data = result?.state === "ok" && result.data.tab === tab ? result.data : null;
  const printSrc = `/reports/statements/print?tab=${tab}${ranged ? `&from=${from}&to=${to}${tab === "pl" && cmp ? "&cmp=1" : ""}` : `&as_of=${asOf}`}&lang=${lang}`;

  return (
    <NumbersFrame t={t} lang={lang} title={t("num.st.title")} subtitle={t("num.st.subtitle")} icon="balance-scale-left"
      action={<PrintButton t={t} disabled={!data} onClick={() => printPaper(printSrc)} />}>
      <section className={`${CARD} space-y-3 p-3 sm:p-4`}>
        <TabPills label={t("num.st.title")} value={tab} onChange={pickTab} tabs={STATEMENT_TABS.map((k) => ({ key: k, label: t(`num.st.tab.${k}`) }))} />
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="text-[12.5px] text-[var(--text-dim)]">{t(`num.st.hint.${tab}`)}</p>
          {tab === "pl" && (
            <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-[var(--text-secondary)]">
              <input type="checkbox" checked={cmp} onChange={toggleCmp} className="h-4 w-4 accent-[var(--text-primary)]" />
              {t("num.pl.compare")}
            </label>
          )}
        </div>
        <PeriodBar t={t} lang={lang} today={today} mode={ranged ? "range" : "asOf"} from={from} to={to} asOf={asOf} onRange={pickRange} onAsOf={pickAsOf} />
      </section>

      {result?.state === "locked" ? (
        <StateCard t={t} kind="locked" text={t(result.code === "needs_bank_profit" ? "num.locked.bankProfit" : "num.locked.finance")} />
      ) : result?.state === "error" ? (
        <StateCard t={t} kind="error" onRetry={() => void load(tab, true)} />
      ) : !data ? (
        <StateCard t={t} kind="loading" />
      ) : (
        <div key={tab} className={`kx-tab-in space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          {data.tab === "pl" && <ProfitLossView t={t} pl={data.pl} />}
          {data.tab === "bs" && <BalanceView t={t} bs={data.bs} currency={data.currency} />}
          {data.tab === "cf" && <CashFlowView t={t} cf={data.cf} />}
          {(data.tab === "ar" || data.tab === "ap") && <AgingView t={t} side={data.tab} aging={data.aging} />}
        </div>
      )}
    </NumbersFrame>
  );
}

/* ── Profit & loss ─────────────────────────────────────────────────────── */

type PLRow = { key: string; tone?: "head" | "sub"; label: string; code?: string; amount?: number; prev?: number };

function plRows(t: T, pl: ProfitLoss): PLRow[] {
  const prev = pl.comparison;
  const prevOf = (section: "revenue" | "cost_of_sales" | "operating_expenses", id: string) =>
    prev ? (prev[section].accounts.find((a) => a.account_id === id)?.amount ?? 0) : undefined;
  const rows: PLRow[] = [];
  const section = (key: "revenue" | "cost_of_sales" | "operating_expenses", word: string) => {
    rows.push({ key: `${key}-h`, tone: "head", label: t(word) });
    const accounts = pl[key].accounts;
    /* An account the previous period had and this one does not still shows. */
    const extra = prev ? prev[key].accounts.filter((p) => !accounts.some((a) => a.account_id === p.account_id)) : [];
    for (const a of accounts) rows.push({ key: `${key}-${a.account_id}`, label: a.name, code: a.code, amount: a.amount, prev: prevOf(key, a.account_id) });
    for (const p of extra) rows.push({ key: `${key}-${p.account_id}`, label: p.name, code: p.code, amount: 0, prev: p.amount });
    if (!accounts.length && !extra.length) rows.push({ key: `${key}-none`, label: t("num.pl.noLines") });
    rows.push({ key: `${key}-t`, tone: "sub", label: t("num.total"), amount: pl[key].amount, prev: prev?.[key].amount });
  };
  section("revenue", "num.pl.revenue");
  section("cost_of_sales", "num.pl.cos");
  rows.push({ key: "gross", tone: "sub", label: `${t("num.pl.gross")} · ${t("num.pl.margin").replace("{p}", pct(pl.gross_margin_pct))}`, amount: pl.gross_profit, prev: prev?.gross_profit });
  section("operating_expenses", "num.pl.opex");
  rows.push({ key: "operating", tone: "sub", label: `${t("num.pl.operating")} · ${t("num.pl.margin").replace("{p}", pct(pl.operating_margin_pct))}`, amount: pl.operating_profit, prev: prev?.operating_profit });
  return rows;
}

function ProfitLossView({ t, pl }: { t: T; pl: ProfitLoss }) {
  const c = pl.currency;
  const one = (n: number): Money => ({ [c]: n });
  const rows = plRows(t, pl);
  const amount = (n: number | undefined) => (n === undefined ? "" : <span dir="ltr" className="whitespace-nowrap font-mono tabular-nums [unicode-bidi:isolate]">{moneyLine(c, n)}</span>);
  const cols: Array<NumCol<PLRow>> = [
    { key: "account", primary: true, label: t("num.col.account"), render: (r) => (
      <span dir="auto" className={r.tone ? "" : "ps-3"}>{r.code ? <span className="me-2 font-mono text-[11.5px] text-[var(--text-dim)]">{r.code}</span> : null}{r.label}</span>
    ) },
    { key: "amount", align: "end", label: pl.comparison ? t("num.col.current") : t("num.col.amount"), render: (r) => amount(r.amount), foot: <MoneyStack m={one(pl.net_profit)} base={c} strong tone={pl.net_profit < 0 ? "text-rose-400" : ""} /> },
    ...(pl.comparison ? [{ key: "prev", align: "end" as const, label: t("num.col.previous"), render: (r: PLRow) => amount(r.prev), foot: <MoneyStack m={one(pl.comparison.net_profit)} base={c} /> }] : []),
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <MoneyKpi t={t} label={t("num.pl.revenue")} m={one(pl.revenue.amount)} base={c} icon="money" />
        <MoneyKpi t={t} label={t("num.pl.gross")} m={one(pl.gross_profit)} base={c} icon="coins" />
        <MoneyKpi t={t} label={t("num.pl.operating")} m={one(pl.operating_profit)} base={c} icon="calculator" />
        <MoneyKpi t={t} label={t("num.pl.net")} m={one(pl.net_profit)} base={c} icon="piggy-bank" tone={pl.net_profit > 0 ? "positive" : pl.net_profit < 0 ? "rose" : undefined} />
      </div>
      <NumbersTable<PLRow> cols={cols} rows={rows} rowKey={(r) => r.key} rowTone={(r) => r.tone}
        footLabel={`${t("num.pl.net")} · ${t("num.pl.margin").replace("{p}", pct(pl.net_margin_pct))}`} empty={t("num.empty")} />
    </>
  );
}

/* ── Balance sheet ─────────────────────────────────────────────────────── */

function BalanceView({ t, bs, currency }: { t: T; bs: BalanceSummary; currency: string }) {
  const one = (n: number): Money => ({ [currency]: n });
  const balanced = Math.abs(bs.balanced_difference) < 0.01;
  type BRow = { key: string; label: string; amount: number; tone?: "sub" };
  const rows: BRow[] = [
    { key: "assets", label: t("num.bs.assets"), amount: bs.total_assets, tone: "sub" },
    { key: "liabilities", label: t("num.bs.liabilities"), amount: bs.total_liabilities },
    { key: "equity", label: t("num.bs.equity"), amount: bs.total_equity },
    { key: "earnings", label: t("num.bs.earnings"), amount: bs.current_year_earnings },
    { key: "liabEq", label: t("num.bs.liabEq"), amount: bs.total_liabilities + bs.total_equity + bs.current_year_earnings, tone: "sub" },
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <MoneyKpi t={t} label={t("num.bs.assets")} m={one(bs.total_assets)} base={currency} icon="building" />
        <MoneyKpi t={t} label={t("num.bs.liabilities")} m={one(bs.total_liabilities)} base={currency} icon="credit-card" />
        <MoneyKpi t={t} label={t("num.bs.equity")} m={one(bs.total_equity)} base={currency} icon="scale" />
        <PlainKpi label={balanced ? t("num.bs.balanced") : t("num.bs.off").replace("{n}", moneyLine(currency, bs.balanced_difference))} value={balanced ? "✓" : "!"} icon="badge-check" />
      </div>
      <NumbersTable<BRow>
        cols={[
          { key: "label", primary: true, label: t("num.col.account"), render: (r) => r.label },
          { key: "amount", align: "end", label: t("num.col.amount"), render: (r) => <MoneyStack m={one(r.amount)} base={currency} strong={r.tone === "sub"} /> },
        ]}
        rows={rows} rowKey={(r) => r.key} rowTone={(r) => r.tone} empty={t("num.emptyNow")}
        caption={t("num.bs.note")}
      />
    </>
  );
}

/* ── Cash flow ─────────────────────────────────────────────────────────── */

function CashFlowView({ t, cf }: { t: T; cf: CashFlow }) {
  const c = cf.currency;
  const one = (n: number): Money => ({ [c]: n });
  type CRow = { key: string; label: string; amount?: number; tone?: "head" | "sub" };
  const lineWord = (label: string) => (CASH_FLOW_LINE_WORDS[label] ? t(CASH_FLOW_LINE_WORDS[label]) : label);
  const rows: CRow[] = [{ key: "open", label: t("num.cf.opening"), amount: cf.opening_cash, tone: "sub" }];
  for (const [key, word] of [["operating", "num.cf.operating"], ["investing", "num.cf.investing"], ["financing", "num.cf.financing"]] as const) {
    const s = cf[key];
    rows.push({ key: `${key}-h`, label: t(word), tone: "head" });
    s.lines.forEach((l, i) => rows.push({ key: `${key}-${i}`, label: lineWord(l.label), amount: l.amount }));
    rows.push({ key: `${key}-t`, label: t("num.total"), amount: s.amount, tone: "sub" });
  }
  rows.push({ key: "net", label: t("num.cf.net"), amount: cf.net_change, tone: "sub" });
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <MoneyKpi t={t} label={t("num.cf.opening")} m={one(cf.opening_cash)} base={c} icon="wallet" />
        <MoneyKpi t={t} label={t("num.cf.net")} m={one(cf.net_change)} base={c} icon="arrow-up-right" tone={cf.net_change < 0 ? "rose" : cf.net_change > 0 ? "positive" : undefined} />
        <MoneyKpi t={t} label={t("num.cf.closing")} m={one(cf.closing_cash)} base={c} icon="bank" />
        <PlainKpi label={cf.reconciled ? t("num.cf.reconciled") : t("num.cf.off")} value={cf.reconciled ? "✓" : "!"} icon="badge-check" />
      </div>
      <NumbersTable<CRow>
        cols={[
          { key: "label", primary: true, label: t("num.col.account"), render: (r) => <span dir="auto" className={r.tone ? "" : "ps-3"}>{r.label}</span> },
          { key: "amount", align: "end", label: t("num.col.amount"), render: (r) => (r.amount === undefined ? "" : <MoneyStack m={one(r.amount)} base={c} strong={r.tone === "sub"} />), foot: <MoneyStack m={one(cf.closing_cash)} base={c} strong /> },
        ]}
        rows={rows} rowKey={(r) => r.key} rowTone={(r) => r.tone} footLabel={t("num.cf.closing")} empty={t("num.empty")}
      />
    </>
  );
}

/* ── What customers owe / what we owe ──────────────────────────────────── */

function AgingView({ t, side, aging }: { t: T; side: "ar" | "ap"; aging: Aging }) {
  const totals = agingTotals(aging);
  const codes = Object.keys(totals).sort();
  const base = codes[0] ?? "CNY";
  const pick = (f: (x: { by_bucket: Record<string, number>; total_open: number; total_overdue: number }) => number): Money =>
    Object.fromEntries(codes.map((c) => [c, f(totals[c])]));
  /* Invoices that name no customer are a row, not a customer. */
  const parties = new Set(aging.parties.filter((p) => p.party_id).map((p) => p.party_id)).size;
  const plain = (n: number) => <span dir="ltr" className="whitespace-nowrap font-mono tabular-nums [unicode-bidi:isolate]">{Math.abs(n) < 0.005 ? "—" : fmtAmount(n)}</span>;
  const cols: Array<NumCol<AgingRow>> = [
    { key: "party", primary: true, label: t(side === "ar" ? "num.col.customer" : "num.col.supplier"), render: (p) => (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <RowName href={p.party_id ? entityHref(side === "ar" ? "customer" : "supplier", p.party_id) : null}>{p.party_name ?? t(side === "ar" ? "num.none.sales" : "num.none.purchases")}</RowName>
        <span className="rounded-md border border-[var(--border-subtle)] px-1.5 font-mono text-[10.5px] text-[var(--text-dim)]">{p.currency}</span>
      </span>
    ) },
    ...AGING_BUCKETS.map((b): NumCol<AgingRow> => ({ key: b, align: "end", label: t(`num.bucket.${b}`), render: (p) => plain(p.buckets[b] ?? 0), foot: <MoneyStack m={pick((x) => x.by_bucket[b] ?? 0)} base={base} /> })),
    { key: "open", align: "end", label: t("num.col.open"), render: (p) => <span className="font-semibold">{plain(p.total_open)}</span>, foot: <MoneyStack m={pick((x) => x.total_open)} base={base} strong /> },
    { key: "overdue", align: "end", label: t("num.col.overdue"), render: (p) => <span className={p.total_overdue > 0.005 ? "text-amber-400" : ""}>{plain(p.total_overdue)}</span>, foot: <MoneyStack m={pick((x) => x.total_overdue)} base={base} strong /> },
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <MoneyKpi t={t} label={t(`num.aging.${side}.open`)} m={pick((x) => x.total_open)} base={base} icon="money" />
        <MoneyKpi t={t} label={t("num.aging.overdue")} m={pick((x) => x.total_overdue)} base={base} icon="clock" tone={codes.some((c) => totals[c].total_overdue > 0.005) ? "warning" : undefined} />
        <PlainKpi label={t(`num.aging.${side}.rows`)} value={fmtCount(parties)} icon={side === "ar" ? "users" : "handshake"} />
        <MoneyKpi t={t} label={t("num.aging.old")} m={pick((x) => x.by_bucket["90+"] ?? 0)} base={base} icon="flag-alt" />
      </div>
      <NumbersTable<AgingRow> cols={cols} rows={aging.parties} rowKey={(p) => `${p.party_id ?? p.party_name ?? "—"}|${p.currency}`}
        footLabel={t("num.total")} empty={t("num.aging.empty")} />
    </>
  );
}
