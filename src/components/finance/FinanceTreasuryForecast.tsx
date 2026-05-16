"use client";

/* ===========================================================================
   FinanceTreasuryForecast — Phase 2.8

   Deterministic cash forecast surface with scenario controls.

   Layout (top to bottom):
     1. KPI strip            — start cash · d7/30/60/90 · runway · low point
     2. Comparison chart     — base vs scenario lines + delta band
     3. Scenario controls    — customer delay · supplier accel · FX shock
                               · cost shock · combined preset
     4. Risk ranking         — top 3-5 liquidity drivers
     5. Event timeline       — major inflows / outflows
     6. Explainability       — applied assumptions, drivers, limitations

   The forecast page calls /api/finance/treasury-forecast for the
   inputs, then runs the pure engine client-side for every scenario
   tweak — there is no round-trip per slider move.
   ========================================================================== */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { EmptyState, SectionCard } from "@/components/finance/FinanceUi";
import { MetricCard } from "@/components/finance/FinanceUiX";
import RrIcon from "@/components/ui/RrIcon";
import type {
  ForecastDayPoint,
  ForecastDiff,
  ForecastResult,
  LiquidityRisk,
  ScenarioAssumptions,
} from "@/lib/intelligence/treasury-forecast";

/* ────────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────────── */

function fmtCompactUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(abs >= 10_000 ? 1 : 2)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

/* Build SVG path from a trajectory. */
function buildPath(points: ForecastDayPoint[], W: number, H: number, vMin: number, vMax: number, padY = 8): string {
  if (points.length === 0) return "";
  const range = Math.max(1, vMax - vMin);
  const stepX = W / Math.max(1, points.length - 1);
  let d = "";
  points.forEach((p, i) => {
    const x = i * stepX;
    const y = padY + (H - 2 * padY) - ((p.cumulative - vMin) / range) * (H - 2 * padY);
    d += (i === 0 ? "M" : " L") + ` ${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  return d;
}

/* Zero-axis y coordinate in viewBox space. */
function zeroY(H: number, vMin: number, vMax: number, padY = 8): number {
  const range = Math.max(1, vMax - vMin);
  return padY + (H - 2 * padY) - ((0 - vMin) / range) * (H - 2 * padY);
}

/* ────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────── */

type ScenarioPreset = "base" | "delay7" | "delay15" | "delay30" | "accel7" | "accel15" | "fx5" | "fx10" | "cost10" | "combined" | "custom";

export default function FinanceTreasuryForecast() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [base, setBase] = useState<ForecastResult | null>(null);
  const [stress, setStress] = useState<ForecastResult | null>(null);
  const [diff, setDiff] = useState<ForecastDiff | null>(null);
  const [risks, setRisks] = useState<LiquidityRisk[]>([]);
  const [assumptions, setAssumptions] = useState<ScenarioAssumptions | null>(null);
  const [preset, setPreset] = useState<ScenarioPreset>("base");
  const [saveDraft, setSaveDraft] = useState<{ name: string; description: string } | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);

  /* Run a forecast on the server. */
  const run = useCallback(async (a: ScenarioAssumptions | null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/treasury-forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assumptions: a }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        base?: ForecastResult; stress?: ForecastResult | null; diff?: ForecastDiff | null; risks?: LiquidityRisk[]; error?: string;
      };
      if (!res.ok || !j.base) throw new Error(j.error ?? `HTTP ${res.status}`);
      setBase(j.base);
      setStress(j.stress ?? null);
      setDiff(j.diff ?? null);
      setRisks(j.risks ?? []);
      setAssumptions(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  /* Initial run on mount — base case. */
  useEffect(() => {
    void run(null);
  }, [run]);

  const onPreset = useCallback((p: ScenarioPreset) => {
    setPreset(p);
    let a: ScenarioAssumptions | null = null;
    switch (p) {
      case "base":      a = null; break;
      case "delay7":    a = { customerDelay: { days: 7 } }; break;
      case "delay15":   a = { customerDelay: { days: 15 } }; break;
      case "delay30":   a = { customerDelay: { days: 30 } }; break;
      case "accel7":    a = { supplierAcceleration: { days: 7 } }; break;
      case "accel15":   a = { supplierAcceleration: { days: 15 } }; break;
      case "fx5":       a = { fxShock: { pct: 5 } }; break;
      case "fx10":      a = { fxShock: { pct: 10 } }; break;
      case "cost10":    a = { costShock: { pct: 10 } }; break;
      case "combined":  a = { customerDelay: { days: 15 }, fxShock: { pct: 5 }, supplierAcceleration: { days: 7 } }; break;
      case "custom":    a = assumptions; break;
    }
    void run(a);
  }, [assumptions, run]);

  /* Y-axis range for the chart. */
  const chart = useMemo(() => {
    if (!base) return null;
    const series = stress?.trajectory ?? base.trajectory;
    const otherSeries = stress ? base.trajectory : [];
    const vals = [...series.map((p) => p.cumulative), ...otherSeries.map((p) => p.cumulative), 0];
    const vMin = Math.min(...vals);
    const vMax = Math.max(...vals);
    const pad = Math.max(1, (vMax - vMin) * 0.08);
    return {
      points: series,
      basePath: buildPath(base.trajectory, 600, 220, vMin - pad, vMax + pad),
      stressPath: stress ? buildPath(stress.trajectory, 600, 220, vMin - pad, vMax + pad) : null,
      zero: zeroY(220, vMin - pad, vMax + pad),
      vMin: vMin - pad,
      vMax: vMax + pad,
    };
  }, [base, stress]);

  const presetOptions: Array<{ key: ScenarioPreset; label: string; group: string }> = [
    { key: "base",     label: "Base case",         group: "Baseline" },
    { key: "delay7",   label: "Customer delay 7d",   group: "Customer delay" },
    { key: "delay15",  label: "Customer delay 15d",  group: "Customer delay" },
    { key: "delay30",  label: "Customer delay 30d",  group: "Customer delay" },
    { key: "accel7",   label: "Supplier accel 7d",   group: "Supplier acceleration" },
    { key: "accel15",  label: "Supplier accel 15d",  group: "Supplier acceleration" },
    { key: "fx5",      label: "FX shock −5%",        group: "FX shock" },
    { key: "fx10",     label: "FX shock −10%",       group: "FX shock" },
    { key: "cost10",   label: "Cost shock +10%",     group: "Cost shock" },
    { key: "combined", label: "Combined stress",     group: "Combined" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <FinanceHeader
          title="Treasury Forecast"
          subtitle="Deterministic 90-day cash projection. Apply scenarios to stress-test customer delays, FX shocks, supplier acceleration, and cost shocks."
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const def = stress?.assumptions?.[0]?.label ?? "Base case";
                  setSaveDraft({ name: `${def} · ${new Date().toLocaleDateString()}`, description: "" });
                }}
                disabled={!base || loading}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-inverted)] px-3 py-2 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50"
              >
                <RrIcon name="check" size={12} />
                Save as plan
              </button>
              <Link
                href="/finance/treasury-plans"
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[var(--bg-surface)] px-3 py-2 text-sm font-medium text-gray-300 hover:border-white/[0.18]"
              >
                <RrIcon name="file-invoice" size={12} />
                Plans
              </Link>
              <button
                onClick={() => onPreset("base")}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[var(--bg-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:border-white/[0.18] disabled:opacity-60"
              >
                {loading ? <RrIcon name="loading" size={12} className="animate-spin" /> : <RrIcon name="recycle" size={12} />}
                Reset to base
              </button>
            </div>
          }
        />

        {/* Save-as-plan drawer */}
        {saveDraft && base && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center sm:px-4 sm:py-8" onClick={() => setSaveDraft(null)}>
            <div className="relative w-full max-w-md rounded-t-2xl border border-white/[0.08] bg-[var(--bg-secondary)] shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
                <div>
                  <h2 className="text-[14px] font-semibold">Save scenario as plan</h2>
                  <p className="mt-0.5 text-[11px] text-gray-500">Locks the current assumptions + forecast snapshot for executive review.</p>
                </div>
                <button onClick={() => setSaveDraft(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/[0.06] hover:text-gray-100">
                  <RrIcon name="cross" size={12} />
                </button>
              </div>
              <div className="space-y-3 px-5 py-4">
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Plan name</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-gray-600 focus:border-white/[0.22] focus:outline-none"
                    value={saveDraft.name}
                    onChange={(e) => setSaveDraft({ ...saveDraft, name: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Description</span>
                  <textarea
                    rows={3}
                    className="mt-1 w-full resize-none rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-gray-600 focus:border-white/[0.22] focus:outline-none"
                    value={saveDraft.description}
                    placeholder="Why are we saving this scenario? Operator can revisit this later."
                    onChange={(e) => setSaveDraft({ ...saveDraft, description: e.target.value })}
                  />
                </label>
                <div className="rounded-lg border border-white/[0.05] bg-[var(--bg-primary)]/40 px-3 py-2 text-[11px] text-gray-400">
                  <div className="font-semibold text-[var(--text-primary)]">Snapshot captured</div>
                  <div className="mt-1">Starting cash · {(stress ?? base).startingCash.toFixed(0)} USD · d90 {(stress ?? base).d90.toFixed(0)} USD · Runway {(stress ?? base).runwayDays ?? "—"}d</div>
                  <div className="mt-1">Assumptions: {(stress ?? base).assumptions.length === 0 ? "Base case" : (stress ?? base).assumptions.map((a) => a.label).join("; ")}</div>
                </div>
              </div>
              <div className="border-t border-white/[0.06] px-5 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setSaveDraft(null)} className="rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-gray-300 hover:border-white/[0.18]">Cancel</button>
                  <button
                    disabled={saveBusy || !saveDraft.name.trim()}
                    onClick={async () => {
                      if (!base) return;
                      setSaveBusy(true);
                      try {
                        const res = await fetch("/api/finance/treasury-plans", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: saveDraft.name.trim(),
                            description: saveDraft.description || undefined,
                            forecast: stress ?? base,
                            assumptions: assumptions ?? null,
                          }),
                        });
                        if (!res.ok) {
                          const j = await res.json().catch(() => ({}));
                          throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
                        }
                        setSaveDraft(null);
                        window.location.href = "/finance/treasury-plans";
                      } catch (e) {
                        setError(e instanceof Error ? e.message : String(e));
                      } finally {
                        setSaveBusy(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-xs font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50"
                  >
                    {saveBusy ? <RrIcon name="loading" size={11} className="animate-spin" /> : <RrIcon name="check" size={11} />}
                    Save plan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">{error}</div>
        )}

        {/* Safety disclaimer */}
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.018] px-3 py-2 text-[11px] text-gray-400">
          <RrIcon name="info" size={11} />
          <span>This is a deterministic forecast based on current records and selected assumptions. It is not a guarantee.</span>
        </div>

        {!base && loading ? (
          <SectionCard>
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--text-dim)]">
              <RrIcon name="loading" size={14} className="animate-spin" />
              Building forecast…
            </div>
          </SectionCard>
        ) : !base ? (
          <EmptyState title="Forecast unavailable" hint="Connect a bank account and add some orders or payments to seed the forecast engine." />
        ) : (
          <>
            {/* KPI strip */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <MetricCard label="Cash today"  value={base.startingCash} unit="USD" hint="Available across active accounts" loading={false} />
              <MetricCard label="7d"  value={(stress ?? base).d7}  unit="USD" tone={(stress ?? base).d7  < 0 ? "negative" : "neutral"} hint="Projected" loading={false} />
              <MetricCard label="30d" value={(stress ?? base).d30} unit="USD" tone={(stress ?? base).d30 < 0 ? "negative" : "neutral"} hint="Projected" loading={false} />
              <MetricCard label="60d" value={(stress ?? base).d60} unit="USD" tone={(stress ?? base).d60 < 0 ? "negative" : "neutral"} hint="Projected" loading={false} />
              <MetricCard label="90d" value={(stress ?? base).d90} unit="USD" tone={(stress ?? base).d90 < 0 ? "negative" : "neutral"} hint="Projected" loading={false} />
              <MetricCard
                label="Runway"
                value={(stress ?? base).runwayDays != null ? `${(stress ?? base).runwayDays}` : "—"}
                unit={(stress ?? base).runwayDays != null ? "days" : ""}
                tone={
                  (stress ?? base).runwayDays == null ? "positive" :
                  (stress ?? base).runwayDays! <= 14 ? "negative" :
                  (stress ?? base).runwayDays! <= 30 ? "warning" : "neutral"
                }
                hint={(stress ?? base).firstNegativeDate ?? "Beyond horizon"}
                loading={false}
              />
            </div>

            {/* Comparison chart */}
            <div className="mt-5">
              <SectionCard
                title="90-day cash trajectory"
                subtitle="Base case (white) vs scenario (amber). Zero line marked."
                action={
                  diff ? (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      diff.direction === "deteriorates" ? "bg-rose-500/15 text-rose-300" :
                      diff.direction === "improves"     ? "bg-emerald-500/15 text-emerald-300" :
                      "bg-gray-500/15 text-gray-300"
                    }`}>
                      Impact at 90d: {fmtCompactUsd(diff.d90Delta)} USD
                    </span>
                  ) : null
                }
              >
                {chart && (
                  <div className="relative h-[260px] w-full">
                    <svg viewBox="0 0 600 220" className="h-full w-full" preserveAspectRatio="none">
                      {/* Zero axis */}
                      <line x1={0} y1={chart.zero} x2={600} y2={chart.zero} stroke="rgba(255,255,255,0.08)" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
                      {/* Base */}
                      <path
                        d={chart.basePath}
                        fill="none"
                        stroke="rgba(255,255,255,0.55)"
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      {/* Stress */}
                      {chart.stressPath && (
                        <path
                          d={chart.stressPath}
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                    </svg>
                    {/* Annotations: lowest projected + first negative on the active series */}
                    {(() => {
                      const active = stress ?? base;
                      const items: Array<{ label: string; date: string; daysFromNow: number; value: number; tone: "rose" | "amber" }> = [];
                      if (active.firstNegativeDate) {
                        const idx = active.trajectory.findIndex((p) => p.date === active.firstNegativeDate);
                        const p = active.trajectory[idx];
                        if (p) items.push({ label: "Cash negative", date: p.date, daysFromNow: p.daysFromNow, value: p.cumulative, tone: "rose" });
                      }
                      return items.map((it) => {
                        const xPct = (it.daysFromNow / Math.max(1, active.horizonDays)) * 100;
                        return (
                          <div
                            key={it.label}
                            className="absolute top-2 inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-200"
                            style={{ left: `${xPct}%`, transform: "translateX(-50%)" }}
                          >
                            <RrIcon name="info" size={9} />
                            {it.label} · {it.date}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Scenario controls */}
            <div className="mt-4">
              <SectionCard
                title="Scenario controls"
                subtitle="Pick a preset to stress-test the forecast. The base trajectory stays visible underneath."
              >
                <div className="flex flex-wrap gap-1.5">
                  {presetOptions.map((opt) => {
                    const active = preset === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => onPreset(opt.key)}
                        disabled={loading}
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-50 ${
                          active
                            ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                            : "border-white/[0.06] bg-[var(--bg-primary)] text-gray-300 hover:border-white/[0.18]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </SectionCard>
            </div>

            {/* Risk ranking + Drivers + Assumptions */}
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SectionCard
                title="Liquidity risk ranking"
                subtitle={stress ? "Stress scenario." : "Base case."}
              >
                {risks.length === 0 ? (
                  <EmptyState title="No material risks" hint="Forecast looks resilient under the selected scenario." />
                ) : (
                  <ul className="space-y-1.5">
                    {risks.slice(0, 6).map((r) => (
                      <li key={r.key} className="flex items-start gap-2 rounded-lg border border-white/[0.05] bg-[var(--bg-primary)]/40 px-3 py-2 text-[11px]">
                        <span className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                          r.severity === "risk" ? "bg-rose-400" : r.severity === "watch" ? "bg-amber-300" : "bg-gray-400"
                        }`} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-semibold text-[var(--text-primary)]">{r.label}</div>
                          <div className="mt-0.5 text-[10.5px] text-gray-400">{r.detail}</div>
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-gray-300">{fmtCompactUsd(r.amountReporting)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard
                title="Top forecast drivers"
                subtitle="Largest contribution to cash position in the 90-day window."
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <DriverList title="Top outflows" items={(stress ?? base).drivers.topOutflows} tone="negative" />
                  <DriverList title="Top inflows"  items={(stress ?? base).drivers.topInflows}  tone="positive" />
                </div>
              </SectionCard>
            </div>

            {/* Assumptions + limitations */}
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SectionCard title="Applied assumptions" subtitle="Knobs the scenario adjusted; cash impact in USD.">
                {(stress ?? base).assumptions.length === 0 ? (
                  <div className="py-2 text-[11px] text-gray-500">No assumptions applied. Showing base case as it stands.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {(stress ?? base).assumptions.map((a) => (
                      <li key={a.key} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-[var(--bg-primary)]/40 px-3 py-2 text-[11px]">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-semibold text-[var(--text-primary)]">{a.label}</span>
                          <span className="block text-[10px] text-gray-500">Affected events: {a.affectedEventCount}</span>
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-gray-300">{fmtCompactUsd(a.cashImpact)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard title="Forecast limitations" subtitle="What this engine can and cannot tell you.">
                <ul className="space-y-1.5 text-[11px] text-gray-400">
                  {(stress ?? base).limitations.map((l, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <RrIcon name="info" size={9} className="mt-0.5 shrink-0 opacity-70" />
                      <span>{l}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-2">
                    <RrIcon name="info" size={9} className="mt-0.5 shrink-0 opacity-70" />
                    <span>Composite confidence: {((stress ?? base).confidence * 100).toFixed(0)}%</span>
                  </li>
                </ul>
              </SectionCard>
            </div>

            {/* Event timeline */}
            <div className="mt-4">
              <SectionCard title="Cash event timeline" subtitle="Forecast inflows and outflows in the next 90 days.">
                {((stress ?? base).events.length === 0) ? (
                  <EmptyState title="No events" hint="No expected cash events in the forecast window." />
                ) : (
                  <ul className="divide-y divide-white/[0.04]">
                    {(stress ?? base).events.slice(0, 30).map((e) => (
                      <li key={e.key} className="flex items-center gap-3 py-2 text-[11px]">
                        <span className="text-gray-500 tabular-nums w-14">d+{e.daysFromNow}</span>
                        <span className="text-gray-500 tabular-nums">{e.date}</span>
                        <span className={`rounded px-1.5 py-0.5 font-semibold uppercase tracking-wider ${e.direction === "inflow" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
                          {e.direction === "inflow" ? "In" : "Out"}
                        </span>
                        <span className="text-gray-400">{e.source.replace(/_/g, " ")}</span>
                        <span className="min-w-0 flex-1 truncate text-gray-300">{e.party}</span>
                        <span className="tabular-nums font-semibold text-gray-200">{fmtCompactUsd(e.amount * (e.confidence || 1))} {e.currency}</span>
                        <span className="text-gray-500">·</span>
                        <span className="text-[10px] text-gray-500">{Math.round(e.confidence * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>

            {/* Deep link to reconciliation queue when there's overdue activity. */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
              <Link href="/finance/reconciliation" className="inline-flex items-center gap-1 hover:text-gray-200">
                <RrIcon name="arrow-up-right-from-square" size={9} />
                Reconciliation queue
              </Link>
              <span className="text-gray-700">·</span>
              <Link href="/finance/bank-accounts" className="inline-flex items-center gap-1 hover:text-gray-200">
                <RrIcon name="arrow-up-right-from-square" size={9} />
                Bank accounts
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DriverList({
  title, items, tone,
}: {
  title: string;
  items: Array<{ key: string; party: string; amountReporting: number; daysFromNow: number; source: string }>;
  tone: "positive" | "negative";
}) {
  const accent = tone === "positive" ? "text-emerald-300" : "text-rose-300";
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">{title}</div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/[0.05] px-3 py-3 text-[11px] text-gray-500">No material items.</div>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.key} className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-[var(--bg-primary)]/40 px-2.5 py-1.5 text-[11px]">
              <span className="text-gray-500 tabular-nums w-10">d+{it.daysFromNow}</span>
              <span className="min-w-0 flex-1 truncate text-gray-300">{it.party}</span>
              <span className={`tabular-nums font-semibold ${accent}`}>{fmtCompactUsd(it.amountReporting)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
