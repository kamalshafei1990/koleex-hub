"use client";

/* ---------------------------------------------------------------------------
   Behavior & Conduct — the employee-form tab (Add + Edit).

   CREATE: enter optional baseline behavior scores. On save the form writes
   them as a *baseline* assessment (labelled, honest — never a fake finalized
   record). If nothing is entered, the employee is created with no assessment.

   EDIT: behavior is a record-based workflow that lives in the HR app, so here
   we show the current standing (latest finalized summary), the assessment
   history, and a link into HR › Behavior to run a new one — the form never
   overwrites a finalized historical assessment.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CogIcon from "@/components/icons/ui/CogIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import {
  BehaviorSlider, BehaviorSliderStyles, BehaviorPicker, PositionBehaviorConfig,
  type BehaviorCategory, type BehaviorIndicator,
} from "@/components/behavior/BehaviorShared";
import { summarize, gapStatus, isCriticalGap, type BehaviorItem } from "@/lib/behavior/scoring";
import { useTranslation } from "@/lib/i18n";
import { hrT } from "@/lib/translations/hr";

interface Requirement { behavior_indicator_id: string; required_score: number; weight: number; is_mandatory: boolean; is_critical: boolean; sort_order: number }
interface BaselineRow { behavior_indicator_id: string; source: "position" | "additional"; employee_score: number | null; comment: string | null }

/* assessment_type / status → translation key, for labels rendered from data. */
const BHV_TYPE_KEY: Record<string, string> = { manager: "hr.bhv.typeManager", hr_review: "hr.bhv.typeHrReview", probation: "hr.bhv.typeProbation", periodic: "hr.bhv.typePeriodic", annual: "hr.bhv.typeAnnual", quarterly: "hr.bhv.typeQuarterly", incident: "hr.bhv.typeIncident", baseline: "hr.bhv.typeManager", self: "hr.bhv.typeManager", peer: "hr.bhv.typeManager" };
const BHV_STATUS_KEY: Record<string, string> = { draft: "hr.bhv.draft", reviewed: "hr.bhv.reviewed", finalized: "hr.bhv.finalized" };

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className="rounded-xl bg-[var(--bg-surface-subtle)] px-3 py-2.5 text-center">
      <div className={`text-[16px] font-semibold tabular-nums ${
        tone === "good" ? "text-emerald-600 dark:text-emerald-400"
        : tone === "warn" ? "text-amber-600 dark:text-amber-400"
        : tone === "bad" ? "text-rose-600 dark:text-rose-400"
        : "text-[var(--text-primary)]"}`}>{value}</div>
      <div className="mt-0.5 text-[9.5px] font-medium uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
    </div>
  );
}

export default function EmployeeBehaviorSection({
  mode, employeeId, positionId, value, onChange, canConfigurePosition,
}: {
  mode: "create" | "edit";
  employeeId?: string;
  positionId: string;
  /** form.behavior_baseline — JSON string of BaselineRow[] (create only). */
  value: string;
  onChange: (v: string) => void;
  canConfigurePosition: boolean;
}) {
  const { t } = useTranslation(hrT);
  const [categories, setCategories] = useState<BehaviorCategory[]>([]);
  const [indicators, setIndicators] = useState<BehaviorIndicator[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  /* Edit-mode standing. */
  const [history, setHistory] = useState<{ id: string; assessment_type: string; status: string; overall_behavior_score: number | null; position_behavior_match: number | null; critical_gap_count: number | null; finalized_at: string | null; created_at: string }[]>([]);

  const rows = useMemo<BaselineRow[]>(() => {
    try { const p = JSON.parse(value || "[]"); return Array.isArray(p) ? p : []; } catch { return []; }
  }, [value]);
  const setRows = useCallback((next: BaselineRow[]) => onChange(JSON.stringify(next)), [onChange]);

  const indById = useMemo(() => new Map(indicators.map((s) => [s.id, s])), [indicators]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const reqByInd = useMemo(() => new Map(requirements.map((r) => [r.behavior_indicator_id, r])), [requirements]);

  /* Library + position requirements. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lib = await fetch("/api/behavior", { credentials: "include" }).then((r) => r.json()).catch(() => ({}));
      if (cancelled) return;
      setCategories(lib.categories ?? []);
      setIndicators(lib.indicators ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!positionId) { setRequirements([]); return; }
    (async () => {
      const res = await fetch(`/api/positions/${positionId}/behavior`, { credentials: "include" }).then((r) => r.json()).catch(() => ({ requirements: [] }));
      if (cancelled) return;
      const reqs: Requirement[] = res.requirements ?? [];
      setRequirements(reqs);
      /* Create mode: seed baseline rows for any new position indicators. */
      if (mode === "create") {
        const have = new Set(rows.map((r) => r.behavior_indicator_id));
        const additions = reqs.filter((r) => !have.has(r.behavior_indicator_id))
          .map<BaselineRow>((r) => ({ behavior_indicator_id: r.behavior_indicator_id, source: "position", employee_score: null, comment: null }));
        if (additions.length) setRows([...rows, ...additions]);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionId, configOpen === false ? 0 : 1]);

  /* Edit mode: pull the assessment history for the standing view. */
  useEffect(() => {
    let cancelled = false;
    if (mode !== "edit" || !employeeId) return;
    (async () => {
      const res = await fetch(`/api/hr/behavior?employee_id=${employeeId}`, { credentials: "include" }).then((r) => r.json()).catch(() => ({}));
      if (!cancelled) setHistory(res.assessments ?? []);
    })();
    return () => { cancelled = true; };
  }, [mode, employeeId]);

  const toScorable = useCallback((r: BaselineRow): BehaviorItem => {
    const req = reqByInd.get(r.behavior_indicator_id);
    return {
      score: r.employee_score,
      weight: req?.weight ?? 1,
      requiredScore: req ? req.required_score : null,
      isMandatory: req?.is_mandatory ?? false,
      isCritical: req ? req.is_critical : (indById.get(r.behavior_indicator_id)?.is_critical_default ?? false),
      categoryId: indById.get(r.behavior_indicator_id)?.category_id,
    };
  }, [reqByInd, indById]);

  const summary = useMemo(() => summarize(rows.map(toScorable)), [rows, toScorable]);

  const setScore = (id: string, score: number) =>
    setRows(rows.map((r) => (r.behavior_indicator_id === id ? { ...r, employee_score: score } : r)));
  const setComment = (id: string, comment: string) =>
    setRows(rows.map((r) => (r.behavior_indicator_id === id ? { ...r, comment } : r)));
  const removeRow = (id: string) => setRows(rows.filter((r) => r.behavior_indicator_id !== id));
  const addIndicator = (id: string) => {
    if (rows.some((r) => r.behavior_indicator_id === id)) return;
    setRows([...rows, { behavior_indicator_id: id, source: "additional", employee_score: null, comment: null }]);
  };

  const positionRows = rows.filter((r) => r.source === "position");
  const additionalRows = rows.filter((r) => r.source === "additional");

  const grouped = useMemo(() => {
    const byCat = new Map<string, BaselineRow[]>();
    for (const r of positionRows) {
      const cat = indById.get(r.behavior_indicator_id)?.category_id ?? "?";
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(r);
    }
    return [...byCat.entries()].sort((a, b) => (catById.get(a[0])?.sort_order ?? 0) - (catById.get(b[0])?.sort_order ?? 0));
  }, [positionRows, indById, catById]);

  const toggleCat = (id: string) => setCollapsed((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (loading) {
    return <div className="flex items-center justify-center py-10"><SpinnerIcon size={18} className="animate-spin text-[var(--text-dim)]" /></div>;
  }

  /* ── EDIT: read-only standing + history + link to HR ── */
  if (mode === "edit") {
    const latest = history.find((h) => h.status === "finalized") ?? history[0];
    return (
      <div className="space-y-4">
        {latest ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SummaryCard label={t("hr.bhv.behaviorScore")} value={latest.overall_behavior_score == null ? "—" : String(Math.round(latest.overall_behavior_score))} />
            <SummaryCard label={t("hr.bhv.positionMatch")} value={latest.position_behavior_match == null ? "—" : `${Math.round(latest.position_behavior_match)}%`} />
            <SummaryCard label={t("hr.bhv.criticalGaps")} value={String(latest.critical_gap_count ?? 0)} tone={(latest.critical_gap_count ?? 0) > 0 ? "bad" : "good"} />
            <SummaryCard label={t("hr.bhv.latest")} value={latest.status === "finalized" ? t("hr.bhv.finalized") : t("hr.bhv.draft")} />
          </div>
        ) : (
          <p className="rounded-xl bg-[var(--bg-surface-subtle)]/60 px-4 py-6 text-center text-[12.5px] text-[var(--text-faint)]">
            {t("hr.bhv.noBehaviorYet")}
          </p>
        )}

        {history.length > 0 && (
          <div className="rounded-xl border border-[var(--border-subtle)] divide-y divide-[var(--border-faint)]">
            {history.slice(0, 8).map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <span className="text-[12.5px] text-[var(--text-primary)]">{t(BHV_TYPE_KEY[h.assessment_type] ?? "hr.bhv.typeManager")}</span>
                  <span className="ms-2 text-[10.5px] text-[var(--text-faint)]">{(h.finalized_at ?? h.created_at)?.slice(0, 10)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">{h.overall_behavior_score == null ? "—" : Math.round(h.overall_behavior_score)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${h.status === "finalized" ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-[var(--bg-surface-subtle)] text-[var(--text-faint)]"}`}>{t(BHV_STATUS_KEY[h.status] ?? h.status)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <Link href="/hr?tab=behavior" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12.5px] font-semibold hover:opacity-90 transition-opacity">
          {t("hr.bhv.assessInHr")} <ArrowRightIcon size={13} className="rtl:rotate-180" />
        </Link>
        {canConfigurePosition && positionId && (
          <button type="button" onClick={() => setConfigOpen(true)} className="ms-2 inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
            <CogIcon size={13} /> {t("hr.bhv.configurePosition")}
          </button>
        )}
        {configOpen && positionId && (
          <PositionBehaviorConfig positionId={positionId} categories={categories} indicators={indicators} onClose={() => setConfigOpen(false)} />
        )}
      </div>
    );
  }

  /* ── CREATE: baseline entry ── */
  return (
    <div className="space-y-5">
      <BehaviorSliderStyles />
      <p className="text-[12px] text-[var(--text-dim)] leading-snug">
        {t("hr.bhv.baselineHint")}
      </p>

      {/* Critical alerts — surfaced no matter the average. */}
      {summary.criticalAlerts.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/[0.08] px-3.5 py-2.5">
          <TriangleWarningIcon size={15} className="mt-0.5 shrink-0 text-rose-500" />
          <p className="text-[12px] text-rose-600 dark:text-rose-300">
            {summary.criticalGaps} {t("hr.bhv.createAlert")}
          </p>
        </div>
      )}

      {/* Position behaviors */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t("hr.bhv.positionBehaviors")}</h4>
          {canConfigurePosition && positionId && (
            <button type="button" onClick={() => setConfigOpen(true)} className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
              <CogIcon size={12} /> {t("hr.bhv.configurePosition")}
            </button>
          )}
        </div>
        {!positionId ? (
          <p className="rounded-xl bg-[var(--bg-surface-subtle)]/60 px-4 py-6 text-center text-[12.5px] text-[var(--text-faint)]">{t("hr.bhv.selectPositionHint")}</p>
        ) : requirements.length === 0 ? (
          <p className="rounded-xl bg-[var(--bg-surface-subtle)]/60 px-4 py-6 text-center text-[12.5px] text-[var(--text-faint)]">
            {t("hr.bhv.noConfigured")}{canConfigurePosition && t("hr.bhv.noConfiguredHint")}
          </p>
        ) : (
          <div className="space-y-2">
            {grouped.map(([catId, catRows]) => {
              const cat = catById.get(catId);
              const assessed = catRows.filter((r) => r.employee_score != null).length;
              const gaps = catRows.filter((r) => gapStatus(toScorable(r)) === "below").length;
              const crit = catRows.filter((r) => isCriticalGap(toScorable(r))).length;
              const open = !collapsed.has(catId);
              return (
                <div key={catId} className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                  <button type="button" onClick={() => toggleCat(catId)} aria-expanded={open}
                    className="flex w-full items-center justify-between gap-3 bg-[var(--bg-surface-subtle)]/40 px-3.5 py-2.5 text-start hover:bg-[var(--bg-surface-subtle)]/70 transition-colors">
                    <span className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">{cat?.name ?? t("hr.bhv.other")}</span>
                    <span className="flex items-center gap-2 shrink-0 text-[10.5px] text-[var(--text-faint)]">
                      <span>{assessed}/{catRows.length}</span>
                      {crit > 0 && <span className="rounded-full bg-rose-500/12 px-1.5 py-0.5 font-semibold text-rose-600 dark:text-rose-400">{crit} {t("hr.bhv.criticalChip")}</span>}
                      {gaps > 0 && crit === 0 && <span className="rounded-full bg-amber-500/12 px-1.5 py-0.5 font-semibold text-amber-600 dark:text-amber-400">{gaps} {t("hr.bhv.gap")}</span>}
                      <AngleDownIcon size={12} className={`transition-transform ${open ? "" : "-rotate-90 rtl:rotate-90"}`} />
                    </span>
                  </button>
                  {open && (
                    <div className="divide-y divide-[var(--border-faint)]">
                      {catRows.map((r) => {
                        const ind = indById.get(r.behavior_indicator_id);
                        const req = reqByInd.get(r.behavior_indicator_id);
                        const critGap = isCriticalGap(toScorable(r));
                        return (
                          <div key={r.behavior_indicator_id} className="px-3.5 py-2.5">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <div className="sm:w-[240px] shrink-0 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[13px] text-[var(--text-primary)] truncate">{ind?.name ?? "—"}</span>
                                  {req?.is_critical && <span className="shrink-0 rounded bg-rose-500/12 px-1 py-px text-[9px] font-bold uppercase text-rose-600 dark:text-rose-400">{t("hr.bhv.critical")}</span>}
                                  {req?.is_mandatory && <span className="shrink-0 rounded bg-amber-500/12 px-1 py-px text-[9px] font-bold uppercase text-amber-700 dark:text-amber-400">{t("hr.bhv.req")}</span>}
                                </div>
                                <div className="text-[10.5px] text-[var(--text-faint)]">{t("hr.bhv.required")}: {req?.required_score ?? "—"}</div>
                              </div>
                              <BehaviorSlider value={r.employee_score} onChange={(v) => setScore(r.behavior_indicator_id, v)} label={ind?.name ?? "indicator"} />
                            </div>
                            {critGap && (
                              <input value={r.comment ?? ""} onChange={(e) => setComment(r.behavior_indicator_id, e.target.value)}
                                placeholder={t("hr.bhv.justPlaceholder")}
                                className="mt-2 w-full h-8 px-2.5 rounded-lg bg-[var(--bg-primary)] border border-rose-500/40 text-[12px] text-[var(--text-primary)] placeholder:text-rose-400/70 outline-none" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Additional behaviors */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t("hr.bhv.additionalBehaviors")}</h4>
          <button type="button" onClick={() => setPickerOpen(true)} className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
            <span className="w-5 h-5 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center"><PlusIcon size={10} /></span> {t("hr.bhv.addIndicator")}
          </button>
        </div>
        {additionalRows.length === 0 ? (
          <p className="text-[12px] text-[var(--text-faint)]">{t("hr.bhv.additionalNone")}</p>
        ) : (
          <div className="rounded-xl border border-[var(--border-subtle)] divide-y divide-[var(--border-faint)]">
            {additionalRows.map((r) => {
              const ind = indById.get(r.behavior_indicator_id);
              return (
                <div key={r.behavior_indicator_id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-3.5 py-2.5">
                  <div className="sm:w-[240px] shrink-0 min-w-0">
                    <span className="text-[13px] text-[var(--text-primary)] truncate block">{ind?.name ?? "—"}</span>
                    <span className="text-[10.5px] text-[var(--text-faint)]">{catById.get(ind?.category_id ?? "")?.name ?? ""}</span>
                  </div>
                  <BehaviorSlider value={r.employee_score} onChange={(v) => setScore(r.behavior_indicator_id, v)} label={ind?.name ?? "indicator"} />
                  <button type="button" onClick={() => removeRow(r.behavior_indicator_id)} aria-label={t("hr.bhv.remove")}
                    className="shrink-0 w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                    <CrossIcon size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryCard label={t("hr.bhv.overallBehavior")} value={summary.overallScore == null ? "—" : String(summary.overallScore)} />
          <SummaryCard label={t("hr.bhv.positionMatch")} value={summary.matchPct == null ? "—" : `${summary.matchPct}%`} tone={summary.matchPct == null ? undefined : summary.matchPct >= 100 ? "good" : summary.matchPct < 70 ? "warn" : undefined} />
          <SummaryCard label={t("hr.bhv.coverage")} value={summary.coveragePct == null ? "—" : `${summary.coveragePct}%`} tone={summary.coveragePct != null && summary.coveragePct < 100 ? "warn" : undefined} />
          <SummaryCard label={t("hr.bhv.criticalGaps")} value={String(summary.criticalGaps)} tone={summary.criticalGaps > 0 ? "bad" : "good"} />
          <SummaryCard label={t("hr.bhv.criticalUnassessed")} value={String(summary.criticalUnassessed)} tone={summary.criticalUnassessed > 0 ? "warn" : "good"} />
          <SummaryCard label={t("hr.bhv.meets")} value={String(summary.meets)} tone={summary.meets > 0 ? "good" : undefined} />
          <SummaryCard label={t("hr.bhv.below")} value={String(summary.below)} tone={summary.below > 0 ? "warn" : undefined} />
          <SummaryCard label={t("hr.bhv.mandatoryGaps")} value={String(summary.mandatoryGaps)} tone={summary.mandatoryGaps > 0 ? "warn" : "good"} />
          <SummaryCard label={t("hr.bhv.strongest")} value={summary.strongestCategoryId ? (catById.get(summary.strongestCategoryId)?.name ?? "—").split(" ")[0] : "—"} />
        </div>
      )}

      {pickerOpen && (
        <BehaviorPicker categories={categories} indicators={indicators}
          excludeIds={new Set(rows.map((r) => r.behavior_indicator_id))}
          onPick={addIndicator} onClose={() => setPickerOpen(false)} />
      )}
      {configOpen && positionId && (
        <PositionBehaviorConfig positionId={positionId} categories={categories} indicators={indicators} onClose={() => setConfigOpen(false)} />
      )}
    </div>
  );
}
