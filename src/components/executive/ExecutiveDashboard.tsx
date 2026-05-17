"use client";

/* ---------------------------------------------------------------------------
   /executive — premium board-ready dashboard.

   Reuses ErpUi primitives. Every KPI card is a Link. Charts are
   minimal SVG — no chart library, no D3. Monochrome, calm, printable.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ErpEyebrow, ErpHairline, ErpPage, ErpPanel, ErpTable,
  type ErpColumn,
} from "@/components/ui/erp/ErpUi";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

/* ─── Types matching /api/executive/snapshot ─── */

type Tone = "neutral" | "positive" | "warning" | "info";
interface ExecKpi { label: string; value: number; hint?: string; tone: Tone; href: string }
interface MonthPoint { month: string; revenue: number; cogs: number; gross_profit: number; operating_expense: number; net_profit: number }
interface TopRow { id: string | null; label: string; amount: number; href?: string }
interface FxExposure {
  base_currency: string;
  exposed: Array<{ currency: string; receivable: number; payable: number; net_base: number }>;
  total_net_base_abs: number;
}
interface Snapshot {
  base_currency: string;
  period: { from: string; to: string };
  kpis: {
    revenue: ExecKpi; gross_profit: ExecKpi; net_profit: ExecKpi;
    cash_position: ExecKpi; inventory: ExecKpi; receivables: ExecKpi;
    payables: ExecKpi; fx_exposure: ExecKpi;
  };
  monthly: MonthPoint[];
  top_markets: TopRow[]; top_customers: TopRow[]; top_products: TopRow[];
  inventory_intel: {
    highest_value: TopRow[]; slow_moving: TopRow[]; low_stock: TopRow[]; dead_stock: TopRow[];
  };
  fx: FxExposure;
}

function fmtAmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}
function fmtFull(n: number, ccy: string): string {
  return `${ccy} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/* ─── KPI card ─── */

function KpiCard({ kpi, ccy }: { kpi: ExecKpi; ccy: string }) {
  const accent =
    kpi.tone === "positive" ? "bg-emerald-300/55" :
    kpi.tone === "warning"  ? "bg-amber-300/55"   :
    kpi.tone === "info"     ? "bg-blue-300/55"    :
                              "bg-white/30";
  return (
    <Link href={kpi.href} className="group block">
      <div className="relative h-full rounded-xl border border-white/[0.05] bg-white/[0.012] px-4 py-3.5 transition-colors group-hover:bg-white/[0.02]">
        <div aria-hidden className={`absolute left-4 top-0 h-px w-8 ${accent}`} />
        <ErpEyebrow>{kpi.label}</ErpEyebrow>
        <div className="mt-2 font-mono text-[22px] leading-none tabular-nums tracking-[-0.01em]">
          {ccy} {fmtAmt(kpi.value)}
        </div>
        {kpi.hint && <div className="mt-1.5 text-[10.5px] text-gray-600">{kpi.hint}</div>}
      </div>
    </Link>
  );
}

/* ─── Minimal monochrome line chart ───
   Renders two series (revenue + net profit) on a single SVG. No
   library, no animations — calm visual, board-ready. */

function MonthlyChart({ data, ccy, profitVisible }: { data: MonthPoint[]; ccy: string; profitVisible: boolean }) {
  const w = 720; const h = 180; const padL = 36; const padR = 12; const padT = 12; const padB = 22;
  const innerW = w - padL - padR; const innerH = h - padT - padB;
  const maxY = Math.max(1, ...data.map((d) => Math.max(d.revenue, profitVisible ? d.net_profit : 0)));
  const minY = Math.min(0, ...data.map((d) => Math.min(d.revenue, profitVisible ? d.net_profit : 0)));
  function xFor(i: number) { return padL + (i * innerW) / Math.max(1, data.length - 1); }
  function yFor(v: number) { return padT + innerH - ((v - minY) / (maxY - minY)) * innerH; }
  const revPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(d.revenue).toFixed(1)}`).join(" ");
  const profPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(d.net_profit).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Revenue and net profit by month">
      {/* baseline */}
      <line x1={padL} x2={w - padR} y1={yFor(0)} y2={yFor(0)} stroke="rgba(255,255,255,0.07)" />
      {/* revenue */}
      <path d={revPath} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
      {/* net profit */}
      {profitVisible && (
        <path d={profPath} fill="none" stroke="rgba(110,231,183,0.85)" strokeWidth={1.25} strokeDasharray="3 3" />
      )}
      {/* x labels: first / middle / last */}
      {[0, Math.floor(data.length / 2), data.length - 1].map((i) =>
        data[i] ? (
          <text key={i} x={xFor(i)} y={h - 6} fill="rgba(255,255,255,0.4)"
                fontSize={9} textAnchor="middle">{data[i].month}</text>
        ) : null
      )}
      {/* y labels */}
      <text x={padL - 4} y={yFor(maxY) + 3} fill="rgba(255,255,255,0.4)" fontSize={9} textAnchor="end">{fmtAmt(maxY)}</text>
      <text x={padL - 4} y={yFor(0) + 3}    fill="rgba(255,255,255,0.4)" fontSize={9} textAnchor="end">0</text>
      <title>{`Revenue (solid) and net profit (dashed) — ${ccy}`}</title>
    </svg>
  );
}

/* ─── Margin trend bars ─── */

function MarginBars({ data, profitVisible }: { data: MonthPoint[]; profitVisible: boolean }) {
  const w = 720; const h = 80; const padL = 36; const padR = 12; const padT = 4; const padB = 18;
  const innerW = w - padL - padR; const innerH = h - padT - padB;
  const gap = 2;
  const barW = (innerW / Math.max(1, data.length)) - gap;
  const margins = data.map((d) => profitVisible && d.revenue > 0 ? (d.gross_profit / d.revenue) * 100 : 0);
  const maxM = Math.max(20, ...margins);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Monthly gross margin %">
      <line x1={padL} x2={w - padR} y1={padT + innerH} y2={padT + innerH} stroke="rgba(255,255,255,0.07)" />
      {data.map((d, i) => {
        const x = padL + i * (barW + gap);
        const m = margins[i];
        const bh = Math.max(0, (m / maxM) * innerH);
        const y = padT + innerH - bh;
        return <rect key={d.month} x={x} y={y} width={barW} height={bh} fill="rgba(255,255,255,0.55)" rx={1.5} />;
      })}
      <text x={padL - 4} y={padT + 8}    fill="rgba(255,255,255,0.4)" fontSize={9} textAnchor="end">{maxM.toFixed(0)}%</text>
      <text x={padL - 4} y={padT + innerH + 3} fill="rgba(255,255,255,0.4)" fontSize={9} textAnchor="end">0%</text>
    </svg>
  );
}

/* ─── Top list panel ─── */

function TopList({
  title, icon, rows, ccy, hint,
}: { title: string; icon: RrIconName; rows: TopRow[]; ccy: string; hint?: string }) {
  const max = rows[0]?.amount ?? 1;
  return (
    <ErpPanel className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-300">
            <RrIcon name={icon} size={12} />
          </span>
          <div>
            <div className="text-[12.5px] font-medium">{title}</div>
            {hint && <div className="text-[10px] text-gray-500">{hint}</div>}
          </div>
        </div>
      </div>
      <ErpHairline />
      <ul className="mt-2 space-y-1.5">
        {rows.length === 0 && <li className="px-1 py-1 text-[11px] text-gray-600">No data.</li>}
        {rows.map((r) => {
          const pct = max > 0 ? (Math.abs(r.amount) / max) * 100 : 0;
          const body = (
            <div className="flex items-center gap-3 rounded-md px-1 py-1 hover:bg-white/[0.02]">
              <div className="flex-1 min-w-0">
                <div className="truncate text-[12px]">{r.label}</div>
                <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.04]">
                  <div className="h-full bg-white/45" style={{ width: `${pct.toFixed(0)}%` }} />
                </div>
              </div>
              <div className="shrink-0 font-mono text-[11.5px] tabular-nums text-gray-300">
                {ccy} {fmtAmt(r.amount)}
              </div>
            </div>
          );
          return (
            <li key={(r.id ?? r.label) + r.amount}>
              {r.href ? <Link href={r.href}>{body}</Link> : body}
            </li>
          );
        })}
      </ul>
    </ErpPanel>
  );
}

/* ─── Page ─── */

export default function ExecutiveDashboard() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [vis,  setVis]  = useState<{ can_see_profit: boolean; can_see_cost_data: boolean; can_see_bank_balances: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/executive/snapshot");
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        setSnap(j.snapshot);
        setVis(j.visibility);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally { setLoading(false); }
    })();
  }, []);

  const fxRows = useMemo(() => snap?.fx.exposed ?? [], [snap]);

  const fxCols: Array<ErpColumn<FxExposure["exposed"][number]>> = useMemo(() => [
    { key: "cur",  header: "Currency",   render: (r) => r.currency },
    { key: "rec",  header: "Receivable", align: "right", render: (r) => fmtAmt(r.receivable) },
    { key: "pay",  header: "Payable",    align: "right", render: (r) => fmtAmt(r.payable) },
    { key: "net",  header: "Net (base)", align: "right",
      render: (r) => <span className={r.net_base >= 0 ? "text-emerald-300/85" : "text-rose-300/85"}>{fmtAmt(r.net_base)}</span> },
  ], []);

  return (
    <ErpPage
      title="Executive"
      subtitle="Board-ready KPIs and trends"
      icon="bullseye-arrow"
      backHref="/"
      action={
        <Link href="/finance/statements"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.06]">
          <RrIcon name="balance-scale-left" size={12} />
          Open Statements
        </Link>
      }
    >
      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-rose-300">{error}</div>}
      {snap && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-4">
            <KpiCard kpi={snap.kpis.revenue}       ccy={snap.base_currency} />
            <KpiCard kpi={snap.kpis.gross_profit}  ccy={snap.base_currency} />
            <KpiCard kpi={snap.kpis.net_profit}    ccy={snap.base_currency} />
            <KpiCard kpi={snap.kpis.cash_position} ccy={snap.base_currency} />
            <KpiCard kpi={snap.kpis.inventory}     ccy={snap.base_currency} />
            <KpiCard kpi={snap.kpis.receivables}   ccy={snap.base_currency} />
            <KpiCard kpi={snap.kpis.payables}      ccy={snap.base_currency} />
            <KpiCard kpi={snap.kpis.fx_exposure}   ccy={snap.base_currency} />
          </div>

          {/* Charts */}
          <ErpPanel className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12.5px] font-medium">Revenue & Profit · last 12 months</div>
                <div className="text-[10px] text-gray-500">
                  Solid = revenue · dashed = net profit · {snap.base_currency}
                </div>
              </div>
              <Link href="/finance/statements?tab=pl" className="text-[11px] text-gray-400 hover:text-gray-200">
                Income statement →
              </Link>
            </div>
            <ErpHairline className="my-3" />
            <MonthlyChart data={snap.monthly} ccy={snap.base_currency} profitVisible={!!vis?.can_see_profit} />
            {vis?.can_see_profit && (
              <>
                <div className="mt-3 text-[10px] uppercase tracking-[0.10em] text-gray-500">Gross margin %</div>
                <MarginBars data={snap.monthly} profitVisible={!!vis.can_see_profit} />
              </>
            )}
          </ErpPanel>

          {/* Top markets / customers / products */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <TopList title="Top Markets" icon="flag-alt" rows={snap.top_markets}
                     ccy={snap.base_currency} hint="Sales by customer country · 12 mo" />
            <TopList title="Top Customers" icon="users" rows={snap.top_customers}
                     ccy={snap.base_currency} hint="By posted invoice value · 12 mo" />
            <TopList title="Top Products" icon="box-open" rows={snap.top_products}
                     ccy={snap.base_currency} hint="By invoice line value · 12 mo" />
          </div>

          {/* Inventory intelligence */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <TopList title="Highest-Value Inventory" icon="coins" rows={snap.inventory_intel.highest_value}
                     ccy={snap.base_currency} hint="By stock value" />
            <TopList title="Low Stock Alerts" icon="flag-checkered" rows={snap.inventory_intel.low_stock}
                     ccy={snap.base_currency} hint="Below reorder point" />
            <TopList title="Slow-Moving (90d)" icon="clock" rows={snap.inventory_intel.slow_moving}
                     ccy={snap.base_currency} hint="No movement in 90 days" />
            <TopList title="Dead Stock (180d)" icon="trash" rows={snap.inventory_intel.dead_stock}
                     ccy={snap.base_currency} hint="No movement in 180 days" />
          </div>

          {/* FX */}
          <ErpPanel>
            <div className="flex items-center justify-between p-4">
              <div>
                <div className="text-[12.5px] font-medium">Currency Exposure</div>
                <div className="text-[10px] text-gray-500">Open AR − AP per currency · base {snap.fx.base_currency}</div>
              </div>
              <Link href="/finance/setup?card=fx-rates" className="text-[11px] text-gray-400 hover:text-gray-200">
                Manage FX rates →
              </Link>
            </div>
            <ErpHairline />
            <ErpTable<FxExposure["exposed"][number]>
              rows={fxRows}
              columns={fxCols}
              rowKey={(r) => r.currency}
              empty="No non-base-currency exposure."
            />
          </ErpPanel>
        </>
      )}
    </ErpPage>
  );
}
