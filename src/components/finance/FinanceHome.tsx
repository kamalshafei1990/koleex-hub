"use client";

/* ---------------------------------------------------------------------------
   /finance — Operator front door (Coffee Inc 2-inspired rebuild).

   The previous Home had 4 abstract paths + a 5-column Finance Map = 25
   visible links. The operator's feedback was "I can't see what I need."

   This rebuild swaps that for a clear, opinionated front door:

     1. Setup-health banner (when items missing)
     2. Hero: Total Revenue + Net Income, with deltas vs prior period
     3. Mini trend bars (Revenue vs Net Income, 5 buckets)
     4. 5 BIG operator tiles — the things the operator uses daily:
          • Overview · Orders · Customers · Suppliers · Expenses
     5. ONE Accounting & Deep Analytics panel that collects every
        professional accounting page (Trial Balance, GL, Reconciliation,
        FX, Treasury, Statements, Reports, Approvals, Intelligence) so
        nothing is removed — just no longer in the operator's face.

   Nothing professional was deleted. The deep pages still live at their
   existing URLs and remain reachable from the Accounting top-tab.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { formatCompact } from "@/components/finance/FinanceUiX";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { useBaseCurrencyOptional } from "@/lib/hooks/useBaseCurrency";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";
import type { DashboardKpi } from "@/lib/finance/types";

interface OperatorTile {
  href: string;
  icon: RrIconName;
  tone: "emerald" | "blue" | "amber" | "rose" | "neutral";
  titleKey: string;  titleFallback: string;
  bodyKey:  string;  bodyFallback:  string;
}

const TILES: OperatorTile[] = [
  { href: "/finance/overview",  icon: "balance-scale-left", tone: "emerald",
    titleKey: "home.tile.overview.title",  titleFallback: "Overview",
    bodyKey:  "home.tile.overview.body",   bodyFallback:  "Income · Balance Sheet · Cash Flow — at a glance." },
  { href: "/finance/orders",    icon: "file-invoice",       tone: "blue",
    titleKey: "home.tile.orders.title",    titleFallback: "Orders & Profit",
    bodyKey:  "home.tile.orders.body",     bodyFallback:  "Per-order revenue, cost, and gross profit." },
  { href: "/finance/customers", icon: "arrow-down-left",    tone: "amber",
    titleKey: "home.tile.customers.title", titleFallback: "Customers",
    bodyKey:  "home.tile.customers.body",  bodyFallback:  "What each customer owes you and their payment history." },
  { href: "/finance/suppliers", icon: "arrow-up-right",     tone: "rose",
    titleKey: "home.tile.suppliers.title", titleFallback: "Suppliers",
    bodyKey:  "home.tile.suppliers.body",  bodyFallback:  "What you owe each supplier and what's already paid." },
  { href: "/finance/expenses",  icon: "receipt",            tone: "neutral",
    titleKey: "home.tile.expenses.title",  titleFallback: "Expenses",
    bodyKey:  "home.tile.expenses.body",   bodyFallback:  "Rent · salaries · marketing · everything else." },
];

interface SetupHealth {
  ready: boolean;
  completion: number;
  missingCount: number;
  missingTitles: string[];
}

export default function FinanceHome() {
  const { t } = useTranslation(financeT);
  const [kpi, setKpi] = useState<DashboardKpi | null>(null);
  const baseCurrency = useBaseCurrencyOptional() ?? "";
  const [loading, setLoading] = useState(true);
  const [setupHealth, setSetupHealth] = useState<SetupHealth | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [k, s] = await Promise.all([
          fetch("/api/finance/dashboard?period=year", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
          fetch("/api/finance/setup/status", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
        ]);
        if (k?.kpi) setKpi(k.kpi as DashboardKpi);
        if (s?.snapshot) {
          const snap = s.snapshot as { ready: boolean; completion: number; cards: Array<{ status: string; title: string }> };
          const missing = snap.cards.filter((c) => c.status === "empty");
          setSetupHealth({
            ready: snap.ready,
            completion: snap.completion,
            missingCount: missing.length,
            missingTitles: missing.slice(0, 3).map((c) => c.title),
          });
        }
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
        <FinanceHeader
          title={t("app.title", "Finance")}
          subtitle={t("app.subtitle", "Your operator front door — see what you earned, who owes you, what you owe, and where money is going.")}
        />

        {setupHealth && !setupHealth.ready && setupHealth.missingCount > 0 && (
          <SetupHealthBanner health={setupHealth} />
        )}

        {/* ── HERO: Total Revenue + Net Income, Coffee Inc 2 style ── */}
        <section className="mt-5">
          <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-gray-500">
            {t("home.eyebrowKpis", "This period")}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <BigKpi
              label={t("home.kpi.revenue", "Total Revenue")}
              ccy={baseCurrency}
              value={kpi?.total_revenue ?? 0}
              delta={kpi?.delta_value?.revenue ?? null}
              pct={kpi?.delta?.revenue_pct ?? null}
              tone="info"
              loading={loading}
              href="/finance/overview"
            />
            <BigKpi
              label={t("home.kpi.netIncome", "Net Income")}
              ccy={baseCurrency}
              value={kpi?.net_profit ?? 0}
              delta={kpi?.delta_value?.net_profit ?? null}
              pct={kpi?.delta?.net_profit_pct ?? null}
              tone={(kpi?.net_profit ?? 0) >= 0 ? "positive" : "warning"}
              loading={loading}
              href="/finance/overview"
            />
          </div>
          {kpi?.trend && kpi.trend.length > 0 && (
            <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.012] px-4 py-3 sm:px-5">
              <TrendBars trend={kpi.trend} />
            </div>
          )}
        </section>

        {/* ── 5 operator tiles — the daily front door ── */}
        <section className="mt-7">
          <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-gray-500">
            {t("home.eyebrowOperator", "What do you need?")}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {TILES.map((tile) => <BigTile key={tile.href} tile={tile} />)}
          </div>
        </section>

        {/* ── ONE accounting panel — all 20 deep pages collected here ── */}
        <section className="mt-7">
          <Link
            href="/finance/accounting/queue"
            className="group flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.012] px-4 py-3.5 transition-colors hover:bg-white/[0.04] sm:px-5 sm:py-4"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
                {t("home.eyebrowAccounting", "Accounting & deep analytics")}
              </div>
              <div className="mt-1 text-[13.5px] font-semibold text-[var(--text-primary)]">
                {t("home.accounting.body", "Trial Balance · General Ledger · Reconciliation · FX · Treasury · Approvals · Intelligence.")}
              </div>
            </div>
            <span className="shrink-0 self-center rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[11.5px] text-gray-200">
              {t("home.accounting.cta", "Open Accounting →")}
            </span>
          </Link>
        </section>
      </div>
    </div>
  );
}

/* ─── Hero KPI card (large) ─── */

function BigKpi({
  label, ccy, value, delta, pct, tone, loading, href,
}: {
  label: string; ccy: string; value: number;
  delta: number | null; pct: number | null;
  tone: "info" | "positive" | "warning";
  loading: boolean; href: string;
}) {
  const valueText =
    tone === "positive" ? "text-emerald-100" :
    tone === "warning"  ? "text-amber-100"   :
                          "text-[var(--text-primary)]";
  const accent =
    tone === "positive" ? "bg-emerald-300/60" :
    tone === "warning"  ? "bg-amber-300/60"   :
                          "bg-blue-300/60";
  const deltaUp = (delta ?? 0) >= 0;
  const deltaTone = deltaUp ? "text-emerald-300" : "text-rose-300";

  return (
    <Link
      href={href}
      className="group relative block rounded-xl border border-white/[0.06] bg-white/[0.012] px-5 py-4 transition-colors hover:bg-white/[0.025]"
      aria-label={`Open ${label}`}
    >
      <span aria-hidden className={`absolute left-5 top-0 h-px w-10 ${accent}`} />
      <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{label}</div>
      <div className={`mt-2 font-mono text-[32px] leading-none tabular-nums tracking-[-0.01em] sm:text-[36px] ${valueText}`}>
        {loading ? (
          <span className="text-gray-700">—</span>
        ) : (
          <>
            <span className="text-[14px] text-gray-500">{ccy || ""}</span>{" "}
            {formatCompact(value)}
          </>
        )}
      </div>
      {!loading && delta !== null && pct !== null && (
        <div className={`mt-2 text-[11.5px] ${deltaTone}`}>
          {deltaUp ? "▲" : "▼"} {formatCompact(Math.abs(delta))} ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)
        </div>
      )}
    </Link>
  );
}

/* ─── Trend bar chart (twin bars: revenue vs expenses, 5 buckets) ─── */

function TrendBars({ trend }: { trend: Array<{ label: string; revenue: number; expenses: number }> }) {
  const buckets = trend.slice(-5);
  const w = 720; const h = 90; const padL = 8; const padR = 8; const padT = 8; const padB = 18;
  const innerW = w - padL - padR; const innerH = h - padT - padB;
  const maxY = Math.max(1, ...buckets.flatMap((b) => [Math.abs(b.revenue), Math.abs(b.expenses)]));
  const slot = innerW / Math.max(1, buckets.length);
  const gap = 4;
  const barW = Math.max(3, (slot - gap * 3) / 2);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Revenue vs expenses trend">
      <line x1={padL} x2={w - padR} y1={padT + innerH} y2={padT + innerH} stroke="rgba(255,255,255,0.08)" />
      {buckets.map((b, i) => {
        const xSlot = padL + i * slot;
        const xRev = xSlot + slot / 2 - barW - 1;
        const xExp = xSlot + slot / 2 + 1;
        const hRev = Math.max(2, (Math.abs(b.revenue)  / maxY) * innerH);
        const hExp = Math.max(2, (Math.abs(b.expenses) / maxY) * innerH);
        return (
          <g key={`${b.label}-${i}`}>
            <rect x={xRev} y={padT + innerH - hRev} width={barW} height={hRev} fill="rgba(255,255,255,0.85)" rx={2} />
            <rect x={xExp} y={padT + innerH - hExp} width={barW} height={hExp} fill="rgba(180, 92, 60, 0.85)" rx={2} />
            <text x={xSlot + slot / 2} y={h - 4} fill="rgba(255,255,255,0.45)"
                  fontSize={9} textAnchor="middle">{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Big operator tile ─── */

function BigTile({ tile }: { tile: OperatorTile }) {
  const { t } = useTranslation(financeT);
  const tones: Record<OperatorTile["tone"], { border: string; bg: string; iconBg: string; iconText: string }> = {
    emerald: {
      border: "border-emerald-300/30",
      bg: "bg-emerald-300/[0.04] hover:bg-emerald-300/[0.09]",
      iconBg: "border-emerald-300/40 bg-emerald-300/[0.10]",
      iconText: "text-emerald-100",
    },
    blue: {
      border: "border-blue-300/30",
      bg: "bg-blue-300/[0.04] hover:bg-blue-300/[0.09]",
      iconBg: "border-blue-300/40 bg-blue-300/[0.10]",
      iconText: "text-blue-100",
    },
    amber: {
      border: "border-amber-300/30",
      bg: "bg-amber-300/[0.04] hover:bg-amber-300/[0.09]",
      iconBg: "border-amber-300/40 bg-amber-300/[0.10]",
      iconText: "text-amber-100",
    },
    rose: {
      border: "border-rose-300/25",
      bg: "bg-rose-300/[0.04] hover:bg-rose-300/[0.09]",
      iconBg: "border-rose-300/40 bg-rose-300/[0.10]",
      iconText: "text-rose-100",
    },
    neutral: {
      border: "border-white/[0.10]",
      bg: "bg-white/[0.02] hover:bg-white/[0.05]",
      iconBg: "border-white/[0.10] bg-white/[0.04]",
      iconText: "text-gray-200",
    },
  };
  const toneCls = tones[tile.tone];
  return (
    <Link
      href={tile.href}
      className={`group flex h-full flex-col gap-3 rounded-xl border ${toneCls.border} ${toneCls.bg} px-4 py-4 transition-colors`}
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-lg border ${toneCls.iconBg} ${toneCls.iconText}`}>
        <RrIcon name={tile.icon} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-[var(--text-primary)]">{t(tile.titleKey, tile.titleFallback)}</div>
        <div className="mt-1 text-[11.5px] leading-snug text-gray-400">{t(tile.bodyKey, tile.bodyFallback)}</div>
      </div>
      <div className="flex items-center justify-end">
        <RrIcon name="arrow-up-right" size={11} className="text-gray-500 transition-colors group-hover:text-gray-200" />
      </div>
    </Link>
  );
}

/* ─── Setup-health banner ─── */

function SetupHealthBanner({ health }: { health: SetupHealth }) {
  const { t } = useTranslation(financeT);
  const pct = Math.round(health.completion * 100);
  const items = health.missingTitles.join(" · ");
  const more = health.missingCount > health.missingTitles.length
    ? t("home.banner.more", " · +{n} more").replace("{n}", String(health.missingCount - health.missingTitles.length))
    : "";
  return (
    <section className="mt-5">
      <Link
        href="/finance/setup"
        className="group relative flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] px-4 py-3 transition-colors hover:bg-amber-300/[0.07]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-300/15 text-amber-200">
          <RrIcon name="shield-check" size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-amber-300/80">
            {t("home.banner.kicker", "Finance setup · {pct}% complete").replace("{pct}", String(pct))}
          </div>
          <div className="mt-0.5 text-[13px] font-semibold text-[var(--text-primary)]">
            {health.missingCount === 1
              ? t("home.banner.oneMissing", "1 setup item is empty — your KPIs may understate cash and AR/AP until it's filled.")
              : t("home.banner.manyMissing", "{n} setup items are empty — your KPIs may understate cash and AR/AP until they're filled.").replace("{n}", String(health.missingCount))}
          </div>
          <div className="mt-1 truncate text-[11px] text-gray-400">{items}{more}</div>
        </div>
        <RrIcon name="arrow-up-right" size={11} className="mt-1 text-amber-300/70 transition-colors group-hover:text-amber-200" />
      </Link>
    </section>
  );
}
