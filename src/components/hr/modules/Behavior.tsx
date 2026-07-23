"use client";

/* ---------------------------------------------------------------------------
   HR › Behavior — the review workspace.

   Managers / HR run behavior assessments here: pick an employee, see their
   standing + history, start a new assessment (seeded from the position
   template), score each indicator with comments/evidence, and finalize.
   Finalized assessments are immutable and stamp overall / match / critical-gap
   snapshots. Critical gaps are surfaced no matter how high the average is.
   A top strip shows tenant-wide behavior reporting.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import EmployeePicker from "@/components/hr/EmployeePicker";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import { usePermissions } from "@/lib/permissions";
import { BehaviorSlider, BehaviorSliderStyles, BehaviorPicker, type BehaviorCategory, type BehaviorIndicator } from "@/components/behavior/BehaviorShared";
import { summarize, gapStatus, isCriticalGap, requiresJustification, canFinalize, criticalStatus, type BehaviorItem } from "@/lib/behavior/scoring";
import type { HRModuleProps } from "@/components/hr/HRApp";

interface AssessmentHeader { id: string; assessment_type: string; status: string; assessment_period_start: string | null; assessment_period_end: string | null; overall_behavior_score: number | null; position_behavior_match: number | null; critical_gap_count: number | null; recommendation: string | null; finalized_at: string | null; created_at: string }
interface Requirement { behavior_indicator_id: string; required_score: number; weight: number; is_mandatory: boolean; is_critical: boolean }
interface DraftItem { behavior_indicator_id: string; source: "position" | "additional"; employee_score: number | null; comment: string | null; evidence: string | null; required_score_snapshot: number | null; weight_snapshot: number | null; mandatory_snapshot: boolean; critical_snapshot: boolean }

const TYPES = [["manager","hr.bhv.typeManager"],["hr_review","hr.bhv.typeHrReview"],["probation","hr.bhv.typeProbation"],["periodic","hr.bhv.typePeriodic"],["annual","hr.bhv.typeAnnual"],["quarterly","hr.bhv.typeQuarterly"],["incident","hr.bhv.typeIncident"]] as const;
const RECS = [["confirm","hr.bhv.recConfirm"],["extend","hr.bhv.recExtend"],["develop","hr.bhv.recDevelop"],["escalate","hr.bhv.recEscalate"]] as const;
/* assessment_type / status → translation key, for labels rendered from data. */
const TYPE_KEY: Record<string, string> = { manager: "hr.bhv.typeManager", hr_review: "hr.bhv.typeHrReview", probation: "hr.bhv.typeProbation", periodic: "hr.bhv.typePeriodic", annual: "hr.bhv.typeAnnual", quarterly: "hr.bhv.typeQuarterly", incident: "hr.bhv.typeIncident", baseline: "hr.bhv.typeManager", self: "hr.bhv.typeManager", peer: "hr.bhv.typeManager" };
const STATUS_KEY: Record<string, string> = { draft: "hr.bhv.draft", reviewed: "hr.bhv.reviewed", finalized: "hr.bhv.finalized" };
const REC_KEY: Record<string, string> = { confirm: "hr.bhv.recConfirm", extend: "hr.bhv.recExtend", develop: "hr.bhv.recDevelop", escalate: "hr.bhv.recEscalate" };

function Card({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className="rounded-xl bg-[var(--bg-surface-subtle)] px-3 py-2.5 text-center">
      <div className={`text-[16px] font-semibold tabular-nums ${tone === "good" ? "text-emerald-600 dark:text-emerald-400" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : tone === "bad" ? "text-rose-600 dark:text-rose-400" : "text-[var(--text-primary)]"}`}>{value}</div>
      <div className="mt-0.5 text-[9.5px] font-medium uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
    </div>
  );
}

export default function BehaviorModule({ employees, t }: HRModuleProps) {
  const perms = usePermissions();
  const canEdit = perms.can("HR", "edit");
  const canCreate = perms.can("HR", "create");

  const [employeeId, setEmployeeId] = useState("");
  const [categories, setCategories] = useState<BehaviorCategory[]>([]);
  const [indicators, setIndicators] = useState<BehaviorIndicator[]>([]);
  const [assessments, setAssessments] = useState<AssessmentHeader[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<null | { assessedEmployees: number; averageBehaviorScore: number | null; averagePositionMatch: number | null; withCriticalGaps: number; belowAcceptable: number; awaitingReview: number; distribution: Record<string, number> }>(null);

  /* Draft editor state. */
  const [editing, setEditing] = useState<null | { id: string | null; type: string; items: DraftItem[]; summary: string; recommendation: string }>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const indById = useMemo(() => new Map(indicators.map((s) => [s.id, s])), [indicators]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const reqByInd = useMemo(() => new Map(requirements.map((r) => [r.behavior_indicator_id, r])), [requirements]);

  useEffect(() => {
    (async () => {
      const [lib, rep] = await Promise.all([
        fetch("/api/behavior", { credentials: "include" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/hr/behavior/reports", { credentials: "include" }).then((r) => r.json()).catch(() => null),
      ]);
      setCategories(lib.categories ?? []);
      setIndicators(lib.indicators ?? []);
      setReports(rep);
    })();
  }, []);

  const load = useCallback(async (empId: string) => {
    setLoading(true); setEditing(null);
    try {
      const res = await fetch(`/api/hr/behavior?employee_id=${empId}`, { credentials: "include" }).then((r) => r.json()).catch(() => ({}));
      setAssessments(res.assessments ?? []);
      setRequirements(res.requirements ?? []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (employeeId) void load(employeeId); }, [employeeId, load]);

  /* Start a new assessment — seed items from the position template. */
  const startNew = (type: string) => {
    const items: DraftItem[] = requirements.map((r) => ({
      behavior_indicator_id: r.behavior_indicator_id, source: "position",
      employee_score: null, comment: null, evidence: null,
      required_score_snapshot: r.required_score, weight_snapshot: r.weight,
      mandatory_snapshot: r.is_mandatory, critical_snapshot: r.is_critical,
    }));
    setEditing({ id: null, type, items, summary: "", recommendation: "" });
    setError(null);
  };

  /* Open an existing DRAFT for editing. */
  const openDraft = async (a: AssessmentHeader) => {
    if (a.status === "finalized") { openView(a); return; }
    const res = await fetch(`/api/hr/behavior?assessment_id=${a.id}`, { credentials: "include" }).then((r) => r.json()).catch(() => ({}));
    const items: DraftItem[] = (res.items ?? []).map((i: DraftItem) => ({ ...i }));
    setEditing({ id: a.id, type: a.assessment_type, items, summary: res.assessment?.summary ?? "", recommendation: res.assessment?.recommendation ?? "" });
    setError(null);
  };
  const [viewing, setViewing] = useState<null | { header: AssessmentHeader; items: DraftItem[] }>(null);
  const openView = async (a: AssessmentHeader) => {
    const res = await fetch(`/api/hr/behavior?assessment_id=${a.id}`, { credentials: "include" }).then((r) => r.json()).catch(() => ({}));
    setViewing({ header: a, items: res.items ?? [] });
  };

  const toScorable = useCallback((i: DraftItem): BehaviorItem => ({
    score: i.employee_score, weight: i.weight_snapshot, requiredScore: i.required_score_snapshot,
    isMandatory: i.mandatory_snapshot, isCritical: i.critical_snapshot,
    categoryId: indById.get(i.behavior_indicator_id)?.category_id,
  }), [indById]);

  const draftSummary = useMemo(() => editing ? summarize(editing.items.map(toScorable)) : null, [editing, toScorable]);

  const setItem = (id: string, patch: Partial<DraftItem>) =>
    setEditing((e) => e ? { ...e, items: e.items.map((i) => i.behavior_indicator_id === id ? { ...i, ...patch } : i) } : e);
  const removeItem = (id: string) =>
    setEditing((e) => e ? { ...e, items: e.items.filter((i) => i.behavior_indicator_id !== id) } : e);
  const addIndicator = (id: string) => {
    if (!editing || editing.items.some((i) => i.behavior_indicator_id === id)) return;
    setEditing({ ...editing, items: [...editing.items, {
      behavior_indicator_id: id, source: "additional", employee_score: null, comment: null, evidence: null,
      required_score_snapshot: null, weight_snapshot: 1, mandatory_snapshot: false,
      critical_snapshot: indById.get(id)?.is_critical_default ?? false,
    }] });
  };

  const save = async (finalize: boolean) => {
    if (!editing) return;
    /* Client-side gates mirror the server so the user sees the problem before
       the round-trip: (1) mandatory/critical indicators must all be assessed,
       (2) extreme scores and critical gaps must carry a justification. */
    if (finalize) {
      const s = summarize(editing.items.map(toScorable));
      if (!canFinalize(s)) { setError(t("hr.bhv.finalizeBlocked")); return; }
      const missing = editing.items.find((i) => requiresJustification(toScorable(i), i.comment));
      if (missing) { setError(t("hr.bhv.justError")); return; }
    }
    setSaving(true); setError(null);
    try {
      const payloadItems = editing.items.map((i) => ({ behavior_indicator_id: i.behavior_indicator_id, source: i.source, employee_score: i.employee_score, comment: i.comment, evidence: i.evidence }));
      let res: Response;
      if (editing.id) {
        res = await fetch(`/api/hr/behavior?assessment_id=${editing.id}`, {
          method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary: editing.summary, recommendation: editing.recommendation || null, status: finalize ? "finalized" : "draft",
            scores: editing.items.map((i) => ({ behavior_indicator_id: i.behavior_indicator_id, employee_score: i.employee_score, comment: i.comment, evidence: i.evidence })) }),
        });
      } else {
        res = await fetch("/api/hr/behavior", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employee_id: employeeId, assessment_type: editing.type, summary: editing.summary, recommendation: editing.recommendation || null, status: finalize ? "finalized" : "draft", items: payloadItems }),
        });
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || t("hr.bhv.saveFailed")); return; }
      setEditing(null);
      await load(employeeId);
    } finally { setSaving(false); }
  };

  const grouped = useMemo(() => {
    if (!editing) return [];
    const byCat = new Map<string, DraftItem[]>();
    for (const i of editing.items) {
      const cat = indById.get(i.behavior_indicator_id)?.category_id ?? "?";
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(i);
    }
    return [...byCat.entries()].sort((a, b) => (catById.get(a[0])?.sort_order ?? 0) - (catById.get(b[0])?.sort_order ?? 0));
  }, [editing, indById, catById]);
  const toggleCat = (id: string) => setCollapsed((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="space-y-4">
      <BehaviorSliderStyles />

      {/* Reports strip */}
      {reports && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">{t("hr.bhv.overview")}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <Card label={t("hr.bhv.assessed")} value={String(reports.assessedEmployees)} />
            <Card label={t("hr.bhv.avgScore")} value={reports.averageBehaviorScore == null ? "—" : String(reports.averageBehaviorScore)} />
            <Card label={t("hr.bhv.avgMatch")} value={reports.averagePositionMatch == null ? "—" : `${reports.averagePositionMatch}%`} />
            <Card label={t("hr.bhv.criticalGaps")} value={String(reports.withCriticalGaps)} tone={reports.withCriticalGaps ? "bad" : "good"} />
            <Card label={t("hr.bhv.belowAcceptable")} value={String(reports.belowAcceptable)} tone={reports.belowAcceptable ? "warn" : undefined} />
            <Card label={t("hr.bhv.awaitingReview")} value={String(reports.awaitingReview)} tone={reports.awaitingReview ? "warn" : undefined} />
          </div>
        </div>
      )}

      {/* Employee picker */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
        <label className="block text-[11px] font-medium text-[var(--text-dim)] mb-1">{t("hr.bhv.employee")}</label>
        <EmployeePicker employees={employees} value={employeeId} onChange={setEmployeeId}
          placeholder={t("hr.bhv.selectEmployee")} searchPlaceholder={t("hr.bhv.searchEmployees")} emptyLabel="—" />
      </div>

      {!employeeId ? null : loading ? (
        <div className="flex justify-center py-12"><SpinnerIcon size={20} className="animate-spin text-[var(--text-dim)]" /></div>
      ) : editing ? (
        /* ── Draft editor ── */
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[14px] font-bold text-[var(--text-primary)]">{t(TYPE_KEY[editing.type] ?? "hr.bhv.typeManager")} · {t("hr.bhv.assessmentSuffix")}</h3>
            <button type="button" onClick={() => setEditing(null)} className="text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("hr.bhv.cancel")}</button>
          </div>

          {draftSummary && draftSummary.criticalAlerts.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/[0.08] px-3.5 py-2.5">
              <TriangleWarningIcon size={15} className="mt-0.5 shrink-0 text-rose-500" />
              <p className="text-[12px] text-rose-600 dark:text-rose-300">{t("hr.bhv.attentionPrefix")} — {draftSummary.criticalGaps} {t("hr.bhv.attentionBody")}</p>
            </div>
          )}

          {grouped.map(([catId, items]) => {
            const open = !collapsed.has(catId);
            const crit = items.filter((i) => isCriticalGap(toScorable(i))).length;
            return (
              <div key={catId} className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                <button type="button" onClick={() => toggleCat(catId)} aria-expanded={open}
                  className="flex w-full items-center justify-between gap-3 bg-[var(--bg-surface-subtle)]/40 px-3.5 py-2.5 text-start hover:bg-[var(--bg-surface-subtle)]/70 transition-colors">
                  <span className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">{catById.get(catId)?.name ?? t("hr.bhv.other")}</span>
                  <span className="flex items-center gap-2 shrink-0 text-[10.5px] text-[var(--text-faint)]">
                    {crit > 0 && <span className="rounded-full bg-rose-500/12 px-1.5 py-0.5 font-semibold text-rose-600 dark:text-rose-400">{crit} {t("hr.bhv.criticalChip")}</span>}
                    <AngleDownIcon size={12} className={`transition-transform ${open ? "" : "-rotate-90 rtl:rotate-90"}`} />
                  </span>
                </button>
                {open && (
                  <div className="divide-y divide-[var(--border-faint)]">
                    {items.map((i) => {
                      const ind = indById.get(i.behavior_indicator_id);
                      const critGap = isCriticalGap(toScorable(i));
                      const needsJust = requiresJustification(toScorable(i), i.comment);
                      return (
                        <div key={i.behavior_indicator_id} className="px-3.5 py-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <div className="sm:w-[240px] shrink-0 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[13px] text-[var(--text-primary)] truncate">{ind?.name ?? "—"}</span>
                                {i.critical_snapshot && <span className="shrink-0 rounded bg-rose-500/12 px-1 py-px text-[9px] font-bold uppercase text-rose-600 dark:text-rose-400">{t("hr.bhv.critical")}</span>}
                                {i.mandatory_snapshot && <span className="shrink-0 rounded bg-amber-500/12 px-1 py-px text-[9px] font-bold uppercase text-amber-700 dark:text-amber-400">{t("hr.bhv.req")}</span>}
                              </div>
                              <div className="text-[10.5px] text-[var(--text-faint)]">{i.required_score_snapshot != null ? `${t("hr.bhv.required")}: ${i.required_score_snapshot}` : t("hr.bhv.additional")}</div>
                            </div>
                            <BehaviorSlider value={i.employee_score} onChange={(v) => setItem(i.behavior_indicator_id, { employee_score: v })} label={ind?.name ?? "indicator"} disabled={!canEdit && !canCreate} />
                            {i.source === "additional" && (
                              <button type="button" onClick={() => removeItem(i.behavior_indicator_id)} aria-label={t("hr.bhv.remove")}
                                className="shrink-0 w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"><CrossIcon size={10} /></button>
                            )}
                          </div>
                          <input value={i.comment ?? ""} onChange={(e) => setItem(i.behavior_indicator_id, { comment: e.target.value })}
                            placeholder={critGap ? t("hr.bhv.justPlaceholder") : t("hr.bhv.commentPlaceholder")}
                            className={`mt-2 w-full h-8 px-2.5 rounded-lg bg-[var(--bg-primary)] border text-[12px] text-[var(--text-primary)] outline-none ${needsJust ? "border-rose-500/50 placeholder:text-rose-400/70" : "border-[var(--border-subtle)] placeholder:text-[var(--text-faint)]"}`} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <button type="button" onClick={() => setPickerOpen(true)} className="flex items-center gap-2 text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">
            <span className="w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center"><PlusIcon size={11} /></span>{t("hr.bhv.addIndicator")}
          </button>

          {editing.type === "probation" && (
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-dim)] mb-1">{t("hr.bhv.probationRec")}</label>
              <select value={editing.recommendation} onChange={(e) => setEditing({ ...editing, recommendation: e.target.value })}
                className="h-9 px-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] outline-none">
                <option value="">{t("hr.bhv.select")}</option>
                {RECS.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
              </select>
            </div>
          )}

          <textarea value={editing.summary} onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
            placeholder={t("hr.bhv.summaryPlaceholder")} rows={2}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none" />

          {draftSummary && (() => {
            const cs = criticalStatus(draftSummary);
            const csLabel = cs === "clear" ? t("hr.bhv.csClear") : cs === "attention" ? t("hr.bhv.csAttention") : t("hr.bhv.csIncomplete");
            const csTone: "good" | "warn" | "bad" = cs === "clear" ? "good" : cs === "attention" ? "bad" : "warn";
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Card label={t("hr.bhv.overall")} value={draftSummary.overallScore == null ? "—" : String(draftSummary.overallScore)} />
                <Card label={t("hr.bhv.match")} value={draftSummary.matchPct == null ? "—" : `${draftSummary.matchPct}%`} />
                <Card label={t("hr.bhv.coverage")} value={draftSummary.coveragePct == null ? "—" : `${draftSummary.coveragePct}%`} tone={draftSummary.coveragePct != null && draftSummary.coveragePct < 100 ? "warn" : undefined} />
                <Card label={t("hr.bhv.criticalStatus")} value={csLabel} tone={csTone} />
                <Card label={t("hr.bhv.criticalGaps")} value={String(draftSummary.criticalGaps)} tone={draftSummary.criticalGaps ? "bad" : "good"} />
                <Card label={t("hr.bhv.criticalUnassessed")} value={String(draftSummary.criticalUnassessed)} tone={draftSummary.criticalUnassessed ? "warn" : "good"} />
                <Card label={t("hr.bhv.mandatoryGaps")} value={String(draftSummary.mandatoryGaps)} tone={draftSummary.mandatoryGaps ? "warn" : "good"} />
                <Card label={t("hr.bhv.mandatoryUnassessed")} value={String(draftSummary.mandatoryUnassessed)} tone={draftSummary.mandatoryUnassessed ? "warn" : "good"} />
              </div>
            );
          })()}

          <div className="flex items-center justify-end gap-3">
            {error && <span className="text-[12px] text-rose-400">{error}</span>}
            <button type="button" onClick={() => save(false)} disabled={saving} className="h-10 px-4 rounded-xl border border-[var(--border-subtle)] text-[12.5px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] disabled:opacity-50">{t("hr.bhv.saveDraft")}</button>
            <button type="button" onClick={() => save(true)} disabled={saving} className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">{saving ? t("hr.bhv.saving") : t("hr.bhv.finalize")}</button>
          </div>

          {pickerOpen && (
            <BehaviorPicker categories={categories} indicators={indicators}
              excludeIds={new Set(editing.items.map((i) => i.behavior_indicator_id))}
              onPick={addIndicator} onClose={() => setPickerOpen(false)} />
          )}
        </div>
      ) : (
        /* ── Employee standing + history ── */
        <>
          {(() => {
            const latest = assessments.find((a) => a.status === "finalized") ?? assessments[0];
            return latest ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Card label={t("hr.bhv.behaviorScore")} value={latest.overall_behavior_score == null ? "—" : String(Math.round(latest.overall_behavior_score))} />
                <Card label={t("hr.bhv.positionMatch")} value={latest.position_behavior_match == null ? "—" : `${Math.round(latest.position_behavior_match)}%`} />
                <Card label={t("hr.bhv.criticalGaps")} value={String(latest.critical_gap_count ?? 0)} tone={(latest.critical_gap_count ?? 0) > 0 ? "bad" : "good"} />
                <Card label={t("hr.bhv.latest")} value={latest.status === "finalized" ? t("hr.bhv.finalized") : t("hr.bhv.draft")} />
              </div>
            ) : (
              <p className="rounded-xl bg-[var(--bg-surface-subtle)]/60 px-4 py-6 text-center text-[12.5px] text-[var(--text-faint)]">{t("hr.bhv.noAssessments")}</p>
            );
          })()}

          {canCreate && (
            <div className="flex flex-wrap items-center gap-2">
              {TYPES.map(([v, k]) => (
                <button key={v} type="button" onClick={() => startNew(v)}
                  className="h-9 px-3.5 rounded-xl border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors">
                  + {t(k)}
                </button>
              ))}
            </div>
          )}

          {assessments.length > 0 && (
            <div className="rounded-xl border border-[var(--border-subtle)] divide-y divide-[var(--border-faint)]">
              {assessments.map((a) => (
                <button key={a.id} type="button" onClick={() => openDraft(a)}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-start hover:bg-[var(--bg-surface-hover)] transition-colors">
                  <div className="min-w-0">
                    <span className="text-[12.5px] text-[var(--text-primary)]">{t(TYPE_KEY[a.assessment_type] ?? "hr.bhv.typeManager")}</span>
                    <span className="ms-2 text-[10.5px] text-[var(--text-faint)]">{(a.finalized_at ?? a.created_at)?.slice(0, 10)}</span>
                    {a.recommendation && <span className="ms-2 text-[10.5px] text-[var(--text-muted)]">· {t(REC_KEY[a.recommendation] ?? a.recommendation)}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(a.critical_gap_count ?? 0) > 0 && <span className="rounded-full bg-rose-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">{a.critical_gap_count} {t("hr.bhv.criticalChip")}</span>}
                    <span className="text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">{a.overall_behavior_score == null ? "—" : Math.round(a.overall_behavior_score)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.status === "finalized" ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-[var(--bg-surface-subtle)] text-[var(--text-faint)]"}`}>{t(STATUS_KEY[a.status] ?? a.status)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-bold text-[var(--text-primary)]">{t(TYPE_KEY[viewing.header.assessment_type] ?? "hr.bhv.typeManager")} · {t("hr.bhv.finalized")}</h3>
              <button type="button" onClick={() => setViewing(null)} aria-label={t("hr.bhv.close")} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)]"><CrossIcon size={13} /></button>
            </div>
            <div className="divide-y divide-[var(--border-faint)]">
              {viewing.items.map((i) => (
                <div key={i.behavior_indicator_id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-[12.5px] text-[var(--text-primary)] truncate flex items-center gap-1.5">
                    {indById.get(i.behavior_indicator_id)?.name ?? "—"}
                    {i.critical_snapshot && isCriticalGap(toScorable(i)) && <TriangleWarningIcon size={12} className="text-rose-500 shrink-0" />}
                  </span>
                  <span className="text-[12.5px] tabular-nums text-[var(--text-primary)] shrink-0">{i.employee_score ?? "—"}{i.required_score_snapshot != null && <span className="text-[var(--text-faint)]"> / {i.required_score_snapshot}</span>}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
