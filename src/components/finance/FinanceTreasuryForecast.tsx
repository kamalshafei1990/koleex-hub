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
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";
import { EmptyState, SectionCard } from "@/components/finance/FinanceUi";
import { MetricCard } from "@/components/finance/FinanceUiX";
import RrIcon from "@/components/ui/RrIcon";
import { useBaseCurrency } from "@/lib/hooks/useBaseCurrency";
import type {
  ForecastDayPoint,
  ForecastDiff,
  ForecastInputs,
  ForecastResult,
  LiquidityRisk,
  ScenarioAssumptions,
} from "@/lib/intelligence/treasury-forecast";
/* Phase S.4 — the forecast engine is pure (no DB, no React, no
   server-only marker) so it imports cleanly into a client component.
   First server call returns the raw inputs bundle; subsequent preset
   toggles re-run the engine locally — no spinner, no round-trip. */
import {
  buildTreasuryForecast,
  compareForecasts,
  rankLiquidityRisks,
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
  const { t } = useTranslation(financeT);
  const baseCurrency = useBaseCurrency();
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
  /* Phase S.4 — cached inputs from the first server call. While
     non-null, preset toggles re-run the engine locally and skip the
     server round-trip. Reset to null on explicit "refresh from
     server" so the operator can always pull fresh data. */
  const [cachedInputs, setCachedInputs] = useState<ForecastInputs | null>(null);

  /* Fetch fresh inputs from the server and run the base case. The
     server bundles `inputs` into the response when we ask for them,
     so subsequent preset toggles can recompute locally. */
  const refreshFromServer = useCallback(async (a: ScenarioAssumptions | null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/treasury-forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assumptions: a, includeInputs: true }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        base?: ForecastResult; stress?: ForecastResult | null; diff?: ForecastDiff | null; risks?: LiquidityRisk[]; inputs?: ForecastInputs; error?: string;
      };
      if (!res.ok || !j.base) throw new Error(j.error ?? `HTTP ${res.status}`);
      setBase(j.base);
      setStress(j.stress ?? null);
      setDiff(j.diff ?? null);
      setRisks(j.risks ?? []);
      setAssumptions(a);
      if (j.inputs) setCachedInputs(j.inputs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  /* Initial run on mount — base case + fetch input bundle. */
  useEffect(() => {
    void refreshFromServer(null);
  }, [refreshFromServer]);

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
    /* Phase S.4 — hot path: preset toggles run the deterministic
       engine locally against cached inputs. The server is the source
       of truth for inputs, but the engine is pure so client output
       is byte-identical to a server re-run. */
    if (cachedInputs) {
      const baseResult = buildTreasuryForecast(cachedInputs);
      const stressResult = a ? buildTreasuryForecast(cachedInputs, a) : null;
      const diffResult = stressResult ? compareForecasts(baseResult, stressResult) : null;
      const risksResult = rankLiquidityRisks(stressResult ?? baseResult);
      setBase(baseResult);
      setStress(stressResult);
      setDiff(diffResult);
      setRisks(risksResult);
      setAssumptions(a);
      return;
    }
    /* Fallback: no cached inputs yet — full server round-trip. */
    void refreshFromServer(a);
  }, [assumptions, cachedInputs, refreshFromServer]);

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
    { key: "base",     label: t("forecast.preset.base", "Base case"),         group: "Baseline" },
    { key: "delay7",   label: t("forecast.preset.delay7", "Customer delay 7d"),   group: "Customer delay" },
    { key: "delay15",  label: t("forecast.preset.delay15", "Customer delay 15d"),  group: "Customer delay" },
    { key: "delay30",  label: t("forecast.preset.delay30", "Customer delay 30d"),  group: "Customer delay" },
    { key: "accel7",   label: t("forecast.preset.accel7", "Supplier accel 7d"),   group: "Supplier acceleration" },
    { key: "accel15",  label: t("forecast.preset.accel15", "Supplier accel 15d"),  group: "Supplier acceleration" },
    { key: "fx5",      label: t("forecast.preset.fx5", "FX shock −5%"),        group: "FX shock" },
    { key: "fx10",     label: t("forecast.preset.fx10", "FX shock −10%"),       group: "FX shock" },
    { key: "cost10",   label: t("forecast.preset.cost10", "Cost shock +10%"),     group: "Cost shock" },
    { key: "combined", label: t("forecast.preset.combined", "Combined stress"),     group: "Combined" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <FinanceHeader
          title={t("forecast.title", "Treasury Forecast")}
          subtitle={t("forecast.subtitle", "Deterministic 90-day cash projection. Apply scenarios to stress-test customer delays, FX shocks, supplier acceleration, and cost shocks.")}
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const def = stress?.assumptions?.[0]?.label ?? t("forecast.save.baseCase", "Base case");
                  setSaveDraft({ name: `${def} · ${new Date().toLocaleDateString()}`, description: "" });
                }}
                disabled={!base || loading}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-inverted)] px-3 py-2 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50"
              >
                <RrIcon name="check" size={12} />
                {t("forecast.saveAsPlan", "Save as plan")}
              </button>
              <Link
                href="/finance/treasury-plans"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-medium text-[var(--text-highlight)] hover:border-[var(--border-strong)]"
              >
                <RrIcon name="file-invoice" size={12} />
                {t("forecast.plans", "Plans")}
              </Link>
              <button
                onClick={() => onPreset("base")}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] disabled:opacity-60"
              >
                {loading ? <RrIcon name="loading" size={12} className="animate-spin" /> : <RrIcon name="recycle" size={12} />}
                {t("forecast.resetToBase", "Reset to base")}
              </button>
            </div>
          }
        />

        {/* Save-as-plan drawer */}
        {saveDraft && base && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center sm:px-4 sm:py-8" onClick={() => setSaveDraft(null)}>
            <div className="relative w-full max-w-md rounded-t-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5">
                <div>
                  <h2 className="text-[14px] font-semibold">{t("forecast.save.title", "Save scenario as plan")}</h2>
                  <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">{t("forecast.save.subtitle", "Locks the current assumptions + forecast snapshot for executive review.")}</p>
                </div>
                <button onClick={() => setSaveDraft(null)} className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]">
                  <RrIcon name="cross" size={12} />
                </button>
              </div>
              <div className="space-y-3 px-5 py-4">
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">{t("forecast.save.planName", "Plan name")}</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-[var(--text-ghost)] focus:border-[var(--border-strong)] focus:outline-none"
                    value={saveDraft.name}
                    onChange={(e) => setSaveDraft({ ...saveDraft, name: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">{t("forecast.save.description", "Description")}</span>
                  <textarea
                    rows={3}
                    className="mt-1 w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-sm placeholder-[var(--text-ghost)] focus:border-[var(--border-strong)] focus:outline-none"
                    value={saveDraft.description}
                    placeholder={t("forecast.save.descPlaceholder", "Why are we saving this scenario? Operator can revisit this later.")}
                    onChange={(e) => setSaveDraft({ ...saveDraft, description: e.target.value })}
                  />
                </label>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]/40 px-3 py-2 text-[11px] text-[var(--text-secondary)]">
                  <div className="font-semibold text-[var(--text-primary)]">{t("forecast.save.snapshot", "Snapshot captured")}</div>
                  <div className="mt-1">{t("forecast.save.snapshotLine", "Starting cash · {start} USD · d90 {d90} USD · Runway {runway}d")
                    .replace("{start}", (stress ?? base).startingCash.toFixed(0))
                    .replace("{d90}", (stress ?? base).d90.toFixed(0))
                    .replace("{runway}", String((stress ?? base).runwayDays ?? "—"))}</div>
                  <div className="mt-1">{t("forecast.save.assumptions", "Assumptions: {value}").replace("{value}", (stress ?? base).assumptions.length === 0 ? t("forecast.save.baseCase", "Base case") : (stress ?? base).assumptions.map((a) => a.label).join("; "))}</div>
                </div>
              </div>
              <div className="border-t border-[var(--border-subtle)] px-5 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setSaveDraft(null)} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-[var(--text-highlight)] hover:border-[var(--border-strong)]">{t("forecast.save.cancel", "Cancel")}</button>
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
                    {t("forecast.save.confirm", "Save plan")}
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
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-[11px] text-[var(--text-secondary)]">
          <RrIcon name="info" size={11} />
          <span>{t("forecast.disclaimer", "This is a deterministic forecast based on current records and selected assumptions. It is not a guarantee.")}</span>
        </div>

        {!base && loading ? (
          <SectionCard>
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--text-dim)]">
              <RrIcon name="loading" size={14} className="animate-spin" />
              {t("forecast.building", "Building forecast…")}
            </div>
          </SectionCard>
        ) : !base ? (
          <EmptyState title={t("forecast.unavailable", "Forecast unavailable")} hint={t("forecast.unavailable.hint", "Connect a bank account and add some orders or payments to seed the forecast engine.")} />
        ) : (
          <>
            {/* KPI strip */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <MetricCard label={t("forecast.kpi.today", "Cash today")}  value={base.startingCash} unit={baseCurrency} hint={t("forecast.kpi.todayHint", "Available across active accounts")} loading={false} />
              <MetricCard label="7d"  value={(stress ?? base).d7}  unit={baseCurrency} tone={(stress ?? base).d7  < 0 ? "negative" : "neutral"} hint={t("forecast.kpi.projected", "Projected")} loading={false} />
              <MetricCard label="30d" value={(stress ?? base).d30} unit={baseCurrency} tone={(stress ?? base).d30 < 0 ? "negative" : "neutral"} hint={t("forecast.kpi.projected", "Projected")} loading={false} />
              <MetricCard label="60d" value={(stress ?? base).d60} unit={baseCurrency} tone={(stress ?? base).d60 < 0 ? "negative" : "neutral"} hint={t("forecast.kpi.projected", "Projected")} loading={false} />
              <MetricCard label="90d" value={(stress ?? base).d90} unit={baseCurrency} tone={(stress ?? base).d90 < 0 ? "negative" : "neutral"} hint={t("forecast.kpi.projected", "Projected")} loading={false} />
              <MetricCard
                label={t("forecast.kpi.runway", "Runway")}
                value={(stress ?? base).runwayDays != null ? `${(stress ?? base).runwayDays}` : "—"}
                unit={(stress ?? base).runwayDays != null ? t("forecast.kpi.days", "days") : ""}
                tone={
                  (stress ?? base).runwayDays == null ? "positive" :
                  (stress ?? base).runwayDays! <= 14 ? "negative" :
                  (stress ?? base).runwayDays! <= 30 ? "warning" : "neutral"
                }
                hint={(stress ?? base).firstNegativeDate ?? t("forecast.kpi.beyondHorizon", "Beyond horizon")}
                loading={false}
              />
            </div>

            {/* Comparison chart */}
            <div className="mt-5">
              <SectionCard
                title={t("forecast.chart.title", "90-day cash trajectory")}
                subtitle={t("forecast.chart.subtitle", "Base case (white) vs scenario (amber). Zero line marked.")}
                action={
                  diff ? (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      diff.direction === "deteriorates" ? "bg-rose-500/15 text-rose-300" :
                      diff.direction === "improves"     ? "bg-emerald-500/15 text-emerald-300" :
                      "bg-gray-500/15 text-[var(--text-highlight)]"
                    }`}>
                      {t("forecast.chart.impact", "Impact at 90d: {value} USD").replace("{value}", fmtCompactUsd(diff.d90Delta))}
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
                        if (p) items.push({ label: t("forecast.chart.cashNegative", "Cash negative"), date: p.date, daysFromNow: p.daysFromNow, value: p.cumulative, tone: "rose" });
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
                title={t("forecast.controls.title", "Scenario controls")}
                subtitle={t("forecast.controls.subtitle", "Pick a preset to stress-test the forecast. The base trajectory stays visible underneath.")}
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
                            : "border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-highlight)] hover:border-[var(--border-strong)]"
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
                title={t("forecast.risks.title", "Liquidity risk ranking")}
                subtitle={stress ? t("forecast.risks.stress", "Stress scenario.") : t("forecast.risks.base", "Base case.")}
              >
                {risks.length === 0 ? (
                  <EmptyState title={t("forecast.risks.empty", "No material risks")} hint={t("forecast.risks.emptyHint", "Forecast looks resilient under the selected scenario.")} />
                ) : (
                  <ul className="space-y-1.5">
                    {risks.slice(0, 6).map((r) => (
                      <li key={r.key} className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]/40 px-3 py-2 text-[11px]">
                        <span className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                          r.severity === "risk" ? "bg-rose-400" : r.severity === "watch" ? "bg-amber-300" : "bg-gray-400"
                        }`} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-semibold text-[var(--text-primary)]">{r.label}</div>
                          <div className="mt-0.5 text-[10.5px] text-[var(--text-secondary)]">{r.detail}</div>
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--text-highlight)]">{fmtCompactUsd(r.amountReporting)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard
                title={t("forecast.drivers.title", "Top forecast drivers")}
                subtitle={t("forecast.drivers.subtitle", "Largest contribution to cash position in the 90-day window.")}
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <DriverList title={t("forecast.drivers.outflows", "Top outflows")} items={(stress ?? base).drivers.topOutflows} tone="negative" />
                  <DriverList title={t("forecast.drivers.inflows", "Top inflows")}  items={(stress ?? base).drivers.topInflows}  tone="positive" />
                </div>
              </SectionCard>
            </div>

            {/* Assumptions + limitations */}
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SectionCard title={t("forecast.assumptions.title", "Applied assumptions")} subtitle={t("forecast.assumptions.subtitle", "Knobs the scenario adjusted; cash impact in USD.")}>
                {(stress ?? base).assumptions.length === 0 ? (
                  <div className="py-2 text-[11px] text-[var(--text-dim)]">{t("forecast.assumptions.empty", "No assumptions applied. Showing base case as it stands.")}</div>
                ) : (
                  <ul className="space-y-1.5">
                    {(stress ?? base).assumptions.map((a) => (
                      <li key={a.key} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]/40 px-3 py-2 text-[11px]">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-semibold text-[var(--text-primary)]">{a.label}</span>
                          <span className="block text-[10px] text-[var(--text-dim)]">{t("forecast.assumptions.affected", "Affected events: {n}").replace("{n}", String(a.affectedEventCount))}</span>
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--text-highlight)]">{fmtCompactUsd(a.cashImpact)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard title={t("forecast.limitations.title", "Forecast limitations")} subtitle={t("forecast.limitations.subtitle", "What this engine can and cannot tell you.")}>
                <ul className="space-y-1.5 text-[11px] text-[var(--text-secondary)]">
                  {(stress ?? base).limitations.map((l, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <RrIcon name="info" size={9} className="mt-0.5 shrink-0 opacity-70" />
                      <span>{l}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-2">
                    <RrIcon name="info" size={9} className="mt-0.5 shrink-0 opacity-70" />
                    <span>{t("forecast.limitations.confidence", "Composite confidence: {pct}%").replace("{pct}", ((stress ?? base).confidence * 100).toFixed(0))}</span>
                  </li>
                </ul>
              </SectionCard>
            </div>

            {/* Event timeline */}
            <div className="mt-4">
              <SectionCard title={t("forecast.events.title", "Cash event timeline")} subtitle={t("forecast.events.subtitle", "Forecast inflows and outflows in the next 90 days.")}>
                {((stress ?? base).events.length === 0) ? (
                  <EmptyState title={t("forecast.events.empty", "No events")} hint={t("forecast.events.emptyHint", "No expected cash events in the forecast window.")} />
                ) : (
                  <ul className="divide-y divide-white/[0.04]">
                    {(stress ?? base).events.slice(0, 30).map((e) => (
                      <li key={e.key} className="flex items-center gap-3 py-2 text-[11px]">
                        <span className="text-[var(--text-dim)] tabular-nums w-14">d+{e.daysFromNow}</span>
                        <span className="text-[var(--text-dim)] tabular-nums">{e.date}</span>
                        <span className={`rounded px-1.5 py-0.5 font-semibold uppercase tracking-wider ${e.direction === "inflow" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
                          {e.direction === "inflow" ? t("forecast.events.in", "In") : t("forecast.events.out", "Out")}
                        </span>
                        <span className="text-[var(--text-secondary)]">{e.source.replace(/_/g, " ")}</span>
                        <span className="min-w-0 flex-1 truncate text-[var(--text-highlight)]">{e.party}</span>
                        <span className="tabular-nums font-semibold text-[var(--text-highlight)]">{fmtCompactUsd(e.amount * (e.confidence || 1))} {e.currency}</span>
                        <span className="text-[var(--text-dim)]">·</span>
                        <span className="text-[10px] text-[var(--text-dim)]">{Math.round(e.confidence * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>

            {/* Deep link to reconciliation queue when there's overdue activity. */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
              <Link href="/finance/reconciliation" className="inline-flex items-center gap-1 hover:text-[var(--text-highlight)]">
                <RrIcon name="arrow-up-right-from-square" size={9} />
                {t("forecast.links.reconciliation", "Reconciliation queue")}
              </Link>
              <span className="text-[var(--text-whisper)]">·</span>
              <Link href="/finance/bank-accounts" className="inline-flex items-center gap-1 hover:text-[var(--text-highlight)]">
                <RrIcon name="arrow-up-right-from-square" size={9} />
                {t("forecast.links.bankAccounts", "Bank accounts")}
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
  const { t } = useTranslation(financeT);
  const accent = tone === "positive" ? "text-emerald-300" : "text-rose-300";
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-dim)]">{title}</div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-3 text-[11px] text-[var(--text-dim)]">{t("forecast.drivers.noItems", "No material items.")}</div>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.key} className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]/40 px-2.5 py-1.5 text-[11px]">
              <span className="text-[var(--text-dim)] tabular-nums w-10">d+{it.daysFromNow}</span>
              <span className="min-w-0 flex-1 truncate text-[var(--text-highlight)]">{it.party}</span>
              <span className={`tabular-nums font-semibold ${accent}`}>{fmtCompactUsd(it.amountReporting)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
