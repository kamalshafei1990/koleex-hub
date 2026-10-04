"use client";

/* ---------------------------------------------------------------------------
   /reports/operational — sales, purchases, expenses, stock, customers and
   suppliers (Reports 6C, owner's pick 26/09/2026: «تقارير الأرقام بشكل
   جديد»). The same API and the same doors as before (the finance-numbers
   door, and the «private records» switch for the three cost reports —
   /api/reports/operational decides, this page only says so); the Reports
   app's look, three languages, a phone layout, the house paper.

   Every amount stays in its own currency (lib/reports/operational): a row
   and a total show one line per currency, never one sum of two.

   One request per report and period, kept for the visit, so going back to
   a tab paints at once; the report and period live in the URL.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { reportNumbersT } from "@/lib/translations/report-ui/numbers";
import { entityHref } from "@/lib/reports/link-targets";
import { COST_KINDS, DATED_KINDS, OPS_KINDS, currencyOrder, fmtCount, isOpsKind, isYmd, quickRange, ymdOf, type Money, type OpsKind } from "@/lib/reports/numbers";
import {
  MoneyKpi, MoneyStack, NumbersFrame, NumbersTable, PeriodBar, PlainKpi, PrintButton, RowName, StateCard, TabPills, printPaper, readSearch, writeSearch,
  CARD, type NumCol,
} from "./NumbersKit";
import { fetchOps, type Fetched, type OpsReport, type OpsRow as Row } from "./data";

type Result = Fetched<OpsReport>;

/* Kept for the visit: a tab already read paints at once. */
const seen = new Map<string, Result>();
const keyOf = (kind: OpsKind, from: string, to: string) => (DATED_KINDS.has(kind) ? `${kind}|${from}|${to}` : kind);

const KPI_ICON = {
  sales: ["money", "file-invoice", "users", "award"],
  purchases: ["money", "receipt", "handshake", "award"],
  expenses: ["wallet", "receipt", "clipboard", "award"],
  inventory: ["coins", "box-open", "pallet", "award"],
  customers: ["money", "clock", "users", "award"],
  suppliers: ["money", "clock", "handshake", "award"],
} as const;

export default function OperationalNumbers() {
  const { t, lang } = useTranslation(reportNumbersT);
  const today = useMemo(() => ymdOf(new Date()), []);
  const yearly = useMemo(() => quickRange("year", today), [today]);
  const [kind, setKind] = useState<OpsKind>("sales");
  const [from, setFrom] = useState(yearly.from);
  const [to, setTo] = useState(yearly.to);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState<Set<OpsKind>>(() => new Set());
  const req = useRef(0);

  /* The URL's report and period, once the navigation has committed. */
  useEffect(() => {
    void Promise.resolve().then(() => {
      const q = readSearch();
      const k = q.get("kind"), f = q.get("from"), tt = q.get("to");
      if (isOpsKind(k)) setKind(k);
      if (isYmd(f) && isYmd(tt) && f <= tt) { setFrom(f); setTo(tt); }
    });
  }, []);

  const load = useCallback(async (k: OpsKind, f: string, tt: string, force = false) => {
    const key = keyOf(k, f, tt);
    const hit = seen.get(key);
    if (hit && !force) { setResult(hit); return; }
    const id = ++req.current;
    setLoading(true);
    const out = await fetchOps(k, f, tt);
    if (id !== req.current) return;
    if (out.state !== "error") seen.set(key, out);
    if (out.state === "locked") setLocked((s) => (s.has(k) ? s : new Set(s).add(k)));
    setResult(out);
    setLoading(false);
  }, []);

  useEffect(() => { void Promise.resolve().then(() => load(kind, from, to)); }, [kind, from, to, load]);

  const pickKind = (k: OpsKind) => {
    setKind(k);
    writeSearch({ kind: k === "sales" ? null : k });
  };
  const pickRange = (f: string, tt: string) => {
    setFrom(f); setTo(tt);
    writeSearch({ from: f === yearly.from && tt === yearly.to ? null : f, to: f === yearly.from && tt === yearly.to ? null : tt });
  };

  const report = result?.state === "ok" ? result.data : null;
  const base = report?.base ?? "CNY";
  const dated = DATED_KINDS.has(kind);
  /* A row without a party ("—") is the documents that name none; a party
     without a name is that party's own gap. */
  const nameOf = (r: Row) => r.label ?? (r.key === "—" ? t(kind === "customers" ? "num.none.sales" : kind === "suppliers" ? "num.none.purchases" : `num.none.${kind}`) : t(`num.none.${kind}`));
  const hrefOf = (r: Row): string | null => {
    if (r.key === "—") return kind === "sales" || kind === "customers" ? "/invoices" : null;
    if (kind === "sales" || kind === "customers") return entityHref("customer", r.key);
    if (kind === "purchases" || kind === "suppliers") return entityHref("supplier", r.key);
    if (kind === "inventory") return entityHref("warehouse", r.key);
    return "/finance/expenses";
  };

  const cols = useMemo<Array<NumCol<Row>>>(() => {
    if (!report) return [];
    const tot = report.totals;
    const name: NumCol<Row> = {
      key: "name", primary: true,
      label: t(kind === "sales" || kind === "customers" ? "num.col.customer" : kind === "purchases" || kind === "suppliers" ? "num.col.supplier" : kind === "expenses" ? "num.col.category" : "num.col.warehouse"),
      render: (r) => <RowName href={hrefOf(r)}>{nameOf(r)}</RowName>,
    };
    const country: NumCol<Row> = { key: "country", label: t("num.col.country"), render: (r) => <span dir="auto">{(r.meta?.country as string | null) || "—"}</span> };
    const count = (label: string): NumCol<Row> => ({ key: "count", label, align: "end", render: (r) => <span className="tabular-nums">{fmtCount(r.count)}</span>, foot: <span className="tabular-nums">{fmtCount(tot.count)}</span> });
    const money = (key: string, label: string, pick: (r: Row) => Money | undefined, total: Money | undefined): NumCol<Row> =>
      ({ key, label, align: "end", render: (r) => <MoneyStack m={pick(r)} base={base} dash />, foot: <MoneyStack m={total} base={base} strong /> });
    switch (kind) {
      case "sales": return [name, country, count(t("num.col.invoices")), money("amt", t("num.col.amount"), (r) => r.amounts, tot.amounts)];
      case "purchases": return [name, count(t("num.col.bills")), money("amt", t("num.col.amount"), (r) => r.amounts, tot.amounts)];
      case "expenses": return [name, count(t("num.col.entries")), money("amt", t("num.col.amount"), (r) => r.amounts, tot.amounts)];
      case "inventory": return [name, count(t("num.col.items")),
        { key: "qty", label: t("num.col.qty"), align: "end", render: (r) => <span className="tabular-nums">{fmtCount(r.qty ?? 0)}</span>, foot: <span className="tabular-nums">{fmtCount(tot.qty ?? 0)}</span> },
        money("amt", t("num.col.value"), (r) => r.amounts, tot.amounts)];
      case "customers": return [name, country, count(t("num.col.invoices")), money("amt", t("num.col.sales"), (r) => r.amounts, tot.amounts), money("open", t("num.col.toCollect"), (r) => r.open, tot.open)];
      case "suppliers": return [name, count(t("num.col.bills")), money("amt", t("num.col.purchases"), (r) => r.amounts, tot.amounts), money("open", t("num.col.toPay"), (r) => r.open, tot.open)];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nameOf/hrefOf follow `kind` and `t`, both listed
  }, [report, kind, t, base]);

  const icons = KPI_ICON[kind];
  const top = report?.rows.find((r) => currencyOrder(base, r.amounts).length > 0) ?? null;
  const mixed = report ? currencyOrder(base, report.totals.amounts, report.totals.open).length > 1 : false;
  const waiting = loading && !report;

  return (
    <NumbersFrame t={t} lang={lang} title={t("num.ops.title")} subtitle={t("num.ops.subtitle")} icon="receipt"
      action={<PrintButton t={t} disabled={!report} onClick={() => printPaper(`/reports/operational/print?kind=${kind}${dated ? `&from=${from}&to=${to}` : ""}&lang=${lang}`)} />}>
      <section className={`${CARD} space-y-3 p-3 sm:p-4`}>
        <TabPills label={t("num.ops.title")} value={kind} onChange={pickKind}
          tabs={OPS_KINDS.map((k) => ({ key: k, label: t(`num.kind.${k}`), locked: locked.has(k) }))} />
        <div className="flex flex-wrap items-start justify-between gap-2 px-1">
          <p className="text-[12.5px] text-[var(--text-dim)]">{t(`num.hint.${kind}`)}</p>
        </div>
        {dated && <PeriodBar t={t} lang={lang} today={today} mode="range" from={from} to={to} onRange={pickRange} />}
      </section>

      {result?.state === "locked" ? (
        <StateCard t={t} kind="locked" text={t(COST_KINDS.has(kind) ? "num.locked.cost" : "num.locked.finance")} />
      ) : result?.state === "error" ? (
        <StateCard t={t} kind="error" onRetry={() => void load(kind, from, to, true)} />
      ) : waiting || !report ? (
        <StateCard t={t} kind="loading" />
      ) : (
        <div key={kind} className={`kx-tab-in space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            <MoneyKpi t={t} label={t(`num.kpi.${kind}.total`)} m={report.totals.amounts} base={base} icon={icons[0]} />
            {kind === "customers" || kind === "suppliers"
              ? <MoneyKpi t={t} label={t(`num.kpi.${kind}.open`)} m={report.totals.open} base={base} icon={icons[1]} tone={report.totals.open && currencyOrder(base, report.totals.open).length ? "warning" : undefined} />
              : <PlainKpi label={t(`num.kpi.${kind}.count`)} value={fmtCount(report.totals.count)} icon={icons[1]} />}
            <PlainKpi label={t(`num.kpi.${kind}.rows`)} value={fmtCount(report.rows.filter((r) => kind !== "customers" && kind !== "suppliers" ? r.key !== "—" : r.key !== "—" && r.count > 0).length)} icon={icons[2]} />
            <PlainKpi label={t(`num.kpi.${kind}.top`)} value={top ? nameOf(top) : "—"} icon={icons[3]} />
          </div>
          <NumbersTable<Row>
            cols={cols}
            rows={report.rows}
            rowKey={(r) => r.key}
            footLabel={t("num.totalOf").replace("{n}", fmtCount(report.rows.length))}
            empty={dated ? t("num.empty") : t("num.emptyNow")}
          />
          {mixed && <p className="px-1 text-[12px] leading-relaxed text-[var(--text-dim)]">{t("num.currencies").replace("{c}", base)}</p>}
        </div>
      )}
    </NumbersFrame>
  );
}
