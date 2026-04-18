"use client";

/* ---------------------------------------------------------------------------
   Appraisals — Appraisal cycles, reviews, and employee goals.
   --------------------------------------------------------------------------- */

import { useState, useEffect } from "react";
import type { HRModuleProps } from "@/components/hr/HRApp";
import {
  ModalShell,
  FieldLabel,
  EmptyState,
  StatusBadge,
  inputCls,
  textareaCls,
  selectCls,
  primaryBtnCls,
  cancelBtnCls,
  fmtDate,
  makeTranslationHelpers,
} from "@/components/hr/shared";
import {
  fetchAppraisalCycles,
  createAppraisalCycle,
  fetchAppraisals,
  fetchGoals,
  createGoal,
  type AppraisalWithName,
} from "@/lib/hr-admin";
import type { AppraisalCycleRow, GoalRow } from "@/types/supabase";

/* ── Icons ── */
import PlusIcon from "@/components/icons/ui/PlusIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* ── Inline status maps ── */
const APPRAISAL_STATUS_MAP: Record<string, string> = {
  draft:       "bg-slate-500/15 text-slate-400 border-slate-500/20",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  completed:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

const GOAL_STATUS_MAP: Record<string, string> = {
  not_started: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  completed:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  deferred:    "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */

export default function AppraisalsModule({ employees, t, lang }: HRModuleProps) {
  /* ── state ── */
  const [cycles, setCycles] = useState<AppraisalCycleRow[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [appraisals, setAppraisals] = useState<AppraisalWithName[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [cycleForm, setCycleForm] = useState({ name: "", start_date: "", end_date: "" });
  const [selectedAppraisal, setSelectedAppraisal] = useState<AppraisalWithName | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalForm, setGoalForm] = useState({
    employee_id: "",
    title: "",
    description: "",
    weight: "1",
    due_date: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ── translation helpers ── */
  const { tStatus } = makeTranslationHelpers(t);

  /* ── data loading ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cs = await fetchAppraisalCycles();
        if (cancelled) return;
        setCycles(cs);
        if (cs.length > 0) {
          setSelectedCycleId(cs[0].id);
          const ap = await fetchAppraisals(cs[0].id);
          if (cancelled) return;
          setAppraisals(ap);
        }
      } catch (err) {
        console.error("[Appraisals] Load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── actions ── */

  async function handleCreateCycle() {
    setSaving(true);
    try {
      await createAppraisalCycle({
        name: cycleForm.name,
        start_date: cycleForm.start_date,
        end_date: cycleForm.end_date,
        status: "active",
      });
      const cs = await fetchAppraisalCycles();
      setCycles(cs);
      setShowCycleModal(false);
      setCycleForm({ name: "", start_date: "", end_date: "" });
    } catch (err) {
      console.error("[Appraisals] Create cycle error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectCycle(cycleId: string) {
    setSelectedCycleId(cycleId);
    setSelectedAppraisal(null);
    setGoals([]);
    try {
      const ap = await fetchAppraisals(cycleId);
      setAppraisals(ap);
    } catch (err) {
      console.error("[Appraisals] Load appraisals error:", err);
    }
  }

  async function handleSelectAppraisal(a: AppraisalWithName) {
    setSelectedAppraisal(a);
    try {
      const g = await fetchGoals(a.employee_id);
      setGoals(g);
    } catch (err) {
      console.error("[Appraisals] Load goals error:", err);
    }
  }

  async function handleCreateGoal() {
    if (!selectedAppraisal) return;
    setSaving(true);
    try {
      await createGoal({
        employee_id: selectedAppraisal.employee_id,
        appraisal_id: selectedAppraisal.id,
        title: goalForm.title,
        description: goalForm.description || null,
        target_value: null,
        actual_value: null,
        weight: Number(goalForm.weight) || 1,
        progress: 0,
        status: "not_started",
        due_date: goalForm.due_date || null,
      });
      const g = await fetchGoals(selectedAppraisal.employee_id);
      setGoals(g);
      setShowGoalModal(false);
      setGoalForm({ employee_id: "", title: "", description: "", weight: "1", due_date: "" });
    } catch (err) {
      console.error("[Appraisals] Create goal error:", err);
    } finally {
      setSaving(false);
    }
  }

  /* ── loading spinner ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <SpinnerIcon size={28} className="text-[var(--text-dim)] animate-spin" />
      </div>
    );
  }

  /* ── render helpers ── */

  function renderRating(value: number | null, max = 5) {
    if (value == null) return <span className="text-[11px] text-[var(--text-dim)]">-</span>;
    return (
      <span className="text-[11px] text-amber-400">
        {"★".repeat(Math.min(Math.round(value), max))}{"☆".repeat(Math.max(0, max - Math.round(value)))}
      </span>
    );
  }

  /* ── render ── */
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {selectedAppraisal && (
            <button
              onClick={() => { setSelectedAppraisal(null); setGoals([]); }}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface)] transition-colors"
            >
              <ArrowLeftIcon size={16} className="text-[var(--text-dim)]" />
            </button>
          )}
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
            {selectedAppraisal ? selectedAppraisal.employee_name : t("hr.appraisals")}
          </h2>
        </div>

        <button
          className={`${primaryBtnCls} flex items-center gap-2`}
          onClick={() => selectedAppraisal ? setShowGoalModal(true) : setShowCycleModal(true)}
        >
          <PlusIcon size={14} />
          {selectedAppraisal ? t("hr.addGoal") : t("hr.newCycle")}
        </button>
      </div>

      {/* ── Content ── */}
      {!selectedAppraisal ? (
        <>
          {/* ── Cycle selector ── */}
          {cycles.length > 0 && (
            <div>
              <select
                className={selectCls}
                value={selectedCycleId}
                onChange={(e) => handleSelectCycle(e.target.value)}
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({fmtDate(c.start_date)} — {fmtDate(c.end_date)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ── Appraisal list ── */}
          {cycles.length === 0 ? (
            <EmptyState
              icon={StarIcon}
              title={t("hr.noAppraisals")}
              subtitle={t("hr.selectCyclePrompt")}
            />
          ) : appraisals.length === 0 ? (
            <EmptyState
              icon={StarIcon}
              title={t("hr.noAppraisalsCycle")}
              subtitle={t("hr.selectCyclePrompt")}
            />
          ) : (
            <div className="space-y-2">
              {appraisals.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleSelectAppraisal(a)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--bg-surface)] transition-colors text-left"
                >
                  <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                    <UserIcon size={16} className="text-[var(--text-dim)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                      {a.employee_name}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-[var(--text-dim)]">
                        {t("hr.selfLabel")}: {renderRating(a.self_rating)}
                      </span>
                      <span className="text-[11px] text-[var(--text-dim)]">
                        {t("hr.reviewerLabel")}: {renderRating(a.reviewer_rating)}
                      </span>
                      <span className="text-[11px] text-[var(--text-dim)]">
                        {t("hr.overallLabel")}: {a.overall_score != null ? a.overall_score : "-"}
                      </span>
                    </div>
                  </div>
                  <StatusBadge
                    status={a.status}
                    map={APPRAISAL_STATUS_MAP}
                    label={tStatus(a.status)}
                  />
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ── Selected Appraisal detail ── */
        <div className="space-y-6">
          {/* ── Appraisal info ── */}
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] mb-1">
                  {t("hr.selfRating")}
                </div>
                <div className="text-[14px] text-[var(--text-primary)]">
                  {renderRating(selectedAppraisal.self_rating)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] mb-1">
                  {t("hr.reviewerRating")}
                </div>
                <div className="text-[14px] text-[var(--text-primary)]">
                  {renderRating(selectedAppraisal.reviewer_rating)}
                </div>
              </div>
            </div>

            {selectedAppraisal.self_comments && (
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] mb-1">
                  {t("hr.selfComments")}
                </div>
                <div className="text-[13px] text-[var(--text-subtle)]">
                  {selectedAppraisal.self_comments}
                </div>
              </div>
            )}

            {selectedAppraisal.reviewer_comments && (
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] mb-1">
                  {t("hr.reviewerComments")}
                </div>
                <div className="text-[13px] text-[var(--text-subtle)]">
                  {selectedAppraisal.reviewer_comments}
                </div>
              </div>
            )}

            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] mb-1">
                {t("hr.overallScore")}
              </div>
              <div className="text-[20px] font-bold text-[var(--text-primary)]">
                {selectedAppraisal.overall_score != null ? selectedAppraisal.overall_score : "-"}
              </div>
            </div>
          </div>

          {/* ── Goals ── */}
          <div>
            <div className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <StarIcon size={14} className="text-[var(--text-dim)]" />
              {t("hr.goals")}
            </div>

            {goals.length === 0 ? (
              <EmptyState
                icon={StarIcon}
                title={t("hr.noGoals")}
              />
            ) : (
              <div className="space-y-2">
                {goals.map((g) => (
                  <div
                    key={g.id}
                    className="px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[13px] font-medium text-[var(--text-primary)]">
                        {g.title}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[var(--text-dim)]">
                          {t("hr.weight")}: {g.weight}
                        </span>
                        <StatusBadge
                          status={g.status}
                          map={GOAL_STATUS_MAP}
                          label={tStatus(g.status)}
                        />
                      </div>
                    </div>

                    {g.description && (
                      <div className="text-[12px] text-[var(--text-subtle)] mb-2">
                        {g.description}
                      </div>
                    )}

                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            g.progress >= 100
                              ? "bg-emerald-400"
                              : g.progress >= 50
                                ? "bg-blue-400"
                                : "bg-amber-400"
                          }`}
                          style={{ width: `${Math.min(g.progress, 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-[var(--text-dim)] w-8 text-right">
                        {g.progress}%
                      </span>
                    </div>

                    {g.due_date && (
                      <div className="text-[11px] text-[var(--text-dim)] mt-1.5">
                        {fmtDate(g.due_date)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create Cycle Modal ── */}
      <ModalShell
        open={showCycleModal}
        onClose={() => setShowCycleModal(false)}
        title={t("hr.newAppraisalCycle")}
        footer={
          <>
            <button className={cancelBtnCls} onClick={() => setShowCycleModal(false)}>
              {t("hr.cancel")}
            </button>
            <button
              className={primaryBtnCls}
              disabled={!cycleForm.name || !cycleForm.start_date || !cycleForm.end_date || saving}
              onClick={handleCreateCycle}
            >
              {saving ? <SpinnerIcon size={14} className="animate-spin" /> : t("hr.create")}
            </button>
          </>
        }
      >
        <div>
          <FieldLabel>{t("hr.name")}</FieldLabel>
          <input
            className={inputCls}
            value={cycleForm.name}
            onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel>{t("hr.startDate")}</FieldLabel>
          <input
            className={inputCls}
            type="date"
            value={cycleForm.start_date}
            onChange={(e) => setCycleForm({ ...cycleForm, start_date: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel>{t("hr.endDate")}</FieldLabel>
          <input
            className={inputCls}
            type="date"
            value={cycleForm.end_date}
            onChange={(e) => setCycleForm({ ...cycleForm, end_date: e.target.value })}
          />
        </div>
      </ModalShell>

      {/* ── Add Goal Modal ── */}
      <ModalShell
        open={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        title={t("hr.addGoal")}
        footer={
          <>
            <button className={cancelBtnCls} onClick={() => setShowGoalModal(false)}>
              {t("hr.cancel")}
            </button>
            <button
              className={primaryBtnCls}
              disabled={!goalForm.title || saving}
              onClick={handleCreateGoal}
            >
              {saving ? <SpinnerIcon size={14} className="animate-spin" /> : t("hr.add")}
            </button>
          </>
        }
      >
        <div>
          <FieldLabel>{t("hr.title_field")}</FieldLabel>
          <input
            className={inputCls}
            placeholder={t("hr.goalTitle")}
            value={goalForm.title}
            onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel>{t("hr.description")}</FieldLabel>
          <textarea
            className={textareaCls}
            rows={3}
            value={goalForm.description}
            onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>{t("hr.weightField")}</FieldLabel>
            <input
              className={inputCls}
              type="number"
              min="1"
              value={goalForm.weight}
              onChange={(e) => setGoalForm({ ...goalForm, weight: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel>{t("hr.dueDate")}</FieldLabel>
            <input
              className={inputCls}
              type="date"
              value={goalForm.due_date}
              onChange={(e) => setGoalForm({ ...goalForm, due_date: e.target.value })}
            />
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
