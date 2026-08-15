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
  EmployeeLink,
} from "@/components/hr/shared";
import {
  fetchAppraisalCycles,
  createAppraisalCycle,
  fetchAppraisals,
  fetchGoals,
  createGoal,
  createAppraisal,
  updateAppraisal,
  type AppraisalWithName,
} from "@/lib/hr-admin";
import EmployeePicker from "@/components/hr/EmployeePicker";
import type { AppraisalCycleRow, GoalRow } from "@/types/supabase";

/* ── Icons ── */
import PlusIcon from "@/components/icons/ui/PlusIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
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
  const [cycleForm, setCycleForm] = useState({
    name: "", start_date: "", end_date: "", status: "active",
    description: "", notes: "",
  });
  /* A cycle with no reviews in it is the state the owner hit: the app could
     create the container and then offered no way to put anything in it. */
  const [showAppraisalModal, setShowAppraisalModal] = useState(false);
  const [appraisalForm, setAppraisalForm] = useState({ employee_id: "", reviewer_id: "" });
  const [bulkAdding, setBulkAdding] = useState(false);
  /* The detail panel could DISPLAY ratings and comments but offered no way to
     enter any of them, so every appraisal stayed permanently blank — the
     "no information at all" the owner hit. This is the form behind it. */
  const [editing, setEditing] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    self_rating: "", reviewer_rating: "", self_comments: "", reviewer_comments: "",
    strengths: "", improvements: "", goals_met: "", overall_score: "", status: "pending",
  });
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

  /* Cycle facts for the summary strip. */
  const activeCycle = cycles.find((c) => c.id === selectedCycleId) ?? null;
  const cycleDone = appraisals.filter((a) => a.status === "completed").length;

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
        description: cycleForm.description.trim() || null,
        notes: cycleForm.notes.trim() || null,
        status: cycleForm.status,
      });
      const cs = await fetchAppraisalCycles();
      setCycles(cs);
      setShowCycleModal(false);
      setCycleForm({ name: "", start_date: "", end_date: "", status: "active", description: "", notes: "" });
    } catch (err) {
      console.error("[Appraisals] Create cycle error:", err);
    } finally {
      setSaving(false);
    }
  }

  /* Add one review to the open cycle. */
  async function handleCreateAppraisal() {
    if (!selectedCycleId || !appraisalForm.employee_id || saving) return;
    setSaving(true);
    try {
      await createAppraisal({
        cycle_id: selectedCycleId,
        employee_id: appraisalForm.employee_id,
        reviewer_id: appraisalForm.reviewer_id || null,
        status: "pending",
        self_rating: null,
        reviewer_rating: null,
        self_comments: null,
        reviewer_comments: null,
        goals_met: null,
        strengths: null,
        improvements: null,
        overall_score: null,
        completed_at: null,
      });
      setAppraisals(await fetchAppraisals(selectedCycleId));
      setShowAppraisalModal(false);
      setAppraisalForm({ employee_id: "", reviewer_id: "" });
    } catch (err) {
      console.error("[Appraisals] Create appraisal error:", err);
    } finally {
      setSaving(false);
    }
  }

  /* Add everyone who isn't in the cycle yet. A cycle normally covers the whole
     team, and adding eight people one modal at a time is the kind of chore
     that makes people stop using the module. Skips anyone already present so
     it is safe to press twice. */
  async function handleAddEveryone() {
    if (!selectedCycleId || bulkAdding) return;
    const already = new Set(appraisals.map((a) => a.employee_id));
    const missing = employees.filter((e) => !already.has(e.id));
    if (missing.length === 0) return;
    setBulkAdding(true);
    try {
      for (const e of missing) {
        await createAppraisal({
          cycle_id: selectedCycleId,
          employee_id: e.id,
          reviewer_id: null,
          status: "pending",
          self_rating: null,
          reviewer_rating: null,
          self_comments: null,
          reviewer_comments: null,
          goals_met: null,
          strengths: null,
          improvements: null,
          overall_score: null,
          completed_at: null,
        });
      }
      setAppraisals(await fetchAppraisals(selectedCycleId));
    } catch (err) {
      console.error("[Appraisals] Bulk add error:", err);
    } finally {
      setBulkAdding(false);
    }
  }

  function startEditing(a: AppraisalWithName) {
    setReviewForm({
      self_rating: a.self_rating != null ? String(a.self_rating) : "",
      reviewer_rating: a.reviewer_rating != null ? String(a.reviewer_rating) : "",
      self_comments: a.self_comments ?? "",
      reviewer_comments: a.reviewer_comments ?? "",
      strengths: a.strengths ?? "",
      improvements: a.improvements ?? "",
      goals_met: a.goals_met ?? "",
      overall_score: a.overall_score != null ? String(a.overall_score) : "",
      status: a.status || "pending",
    });
    setEditing(true);
  }

  async function handleSaveReview() {
    const current = selectedAppraisal;
    if (!current || saving) return;
    setSaving(true);
    try {
      /* Empty means "not answered yet", not zero — a blank rating must stay
         NULL or a review nobody has filled in reads as a score of nothing. */
      const num = (v: string) => (v.trim() === "" ? null : Number(v));
      const txt = (v: string) => (v.trim() === "" ? null : v.trim());
      const patch = {
        self_rating: num(reviewForm.self_rating),
        reviewer_rating: num(reviewForm.reviewer_rating),
        self_comments: txt(reviewForm.self_comments),
        reviewer_comments: txt(reviewForm.reviewer_comments),
        strengths: txt(reviewForm.strengths),
        improvements: txt(reviewForm.improvements),
        goals_met: txt(reviewForm.goals_met),
        overall_score: num(reviewForm.overall_score),
        status: reviewForm.status,
        /* Stamp the completion the moment it is marked completed, and clear
           it again if it is reopened. */
        completed_at:
          reviewForm.status === "completed" ? new Date().toISOString() : null,
      };
      const ok = await updateAppraisal(current.id, patch);
      if (!ok) return;
      setEditing(false);
      if (selectedCycleId) {
        const fresh = await fetchAppraisals(selectedCycleId);
        setAppraisals(fresh);
        setSelectedAppraisal(fresh.find((x) => x.id === current.id) ?? null);
      }
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
        <SpinnerIcon size={28} className="text-[var(--text-dim)]" />
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

        <div className="flex items-center gap-2">
          {/* "New Cycle" was the only action on this screen, which is why a
              cycle could exist with nothing in it and no way in. Adding a
              review to the OPEN cycle is the common action, so it takes the
              primary button and New Cycle steps back to secondary. */}
          {!selectedAppraisal && selectedCycleId && (
            <button
              className={`${primaryBtnCls} flex items-center gap-2`}
              onClick={() => { setAppraisalForm({ employee_id: "", reviewer_id: "" }); setShowAppraisalModal(true); }}
            >
              <PlusIcon size={14} />
              {t("hr.addAppraisal")}
            </button>
          )}
          {selectedAppraisal && !editing && (
            <button
              className={`${primaryBtnCls} flex items-center gap-2`}
              onClick={() => startEditing(selectedAppraisal)}
            >
              <PencilIcon className="h-3.5 w-3.5" />
              {t("hr.editReview")}
            </button>
          )}
          <button
            className={
              !selectedCycleId
                ? `${primaryBtnCls} flex items-center gap-2`
                : `${cancelBtnCls} flex items-center gap-2`
            }
            onClick={() => selectedAppraisal ? setShowGoalModal(true) : setShowCycleModal(true)}
          >
            <PlusIcon size={14} />
            {selectedAppraisal ? t("hr.addGoal") : t("hr.newCycle")}
          </button>
        </div>
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

          {/* ── Cycle summary ──
              The cycle selector showed a name and two dates and nothing else,
              so an open cycle told you nothing about its own state. These are
              the four facts you actually want before opening a review. */}
          {activeCycle && (
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: t("hr.startDate"), value: fmtDate(activeCycle.start_date) },
                { label: t("hr.endDate"), value: fmtDate(activeCycle.end_date) },
                { label: t("hr.appraisals"), value: String(appraisals.length) },
                { label: t("hr.completed"), value: `${cycleDone}/${appraisals.length}` },
              ].map((chip) => (
                <span
                  key={chip.label}
                  className="px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[11px] text-[var(--text-dim)]"
                >
                  {chip.label}{" "}
                  <span className="text-[var(--text-primary)] font-medium tabular-nums">{chip.value}</span>
                </span>
              ))}
              <StatusBadge
                status={activeCycle.status}
                map={APPRAISAL_STATUS_MAP}
                label={tStatus(activeCycle.status)}
              />
            </div>
          )}

          {/* What the cycle is for, in the cycle's own words. */}
          {activeCycle && (activeCycle.description || activeCycle.notes) && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 space-y-2">
              {activeCycle.description && (
                <p className="text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap">
                  {activeCycle.description}
                </p>
              )}
              {activeCycle.notes && (
                <p className="text-[12px] text-[var(--text-dim)] whitespace-pre-wrap">
                  {activeCycle.notes}
                </p>
              )}
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
            /* Not a dead end any more: the empty cycle now offers the two ways
               out of it, which is what was missing entirely. */
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="h-12 w-12 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center mb-3">
                <StarIcon size={20} className="text-[var(--text-dim)]" />
              </div>
              <div className="text-[13px] text-[var(--text-primary)] font-medium">
                {t("hr.noAppraisalsCycle")}
              </div>
              <div className="text-[11px] text-[var(--text-dim)] mt-1 mb-4">
                {t("hr.emptyCycleHint")}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`${primaryBtnCls} flex items-center gap-2`}
                  onClick={() => { setAppraisalForm({ employee_id: "", reviewer_id: "" }); setShowAppraisalModal(true); }}
                >
                  <PlusIcon size={14} />
                  {t("hr.addAppraisal")}
                </button>
                <button
                  className={`${cancelBtnCls} flex items-center gap-2`}
                  onClick={handleAddEveryone}
                  disabled={bulkAdding || employees.length === 0}
                >
                  {bulkAdding ? <SpinnerIcon size={14} /> : <UserIcon size={14} />}
                  {t("hr.addEveryone")}
                </button>
              </div>
            </div>
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
                      <EmployeeLink id={a.employee_id} name={a.employee_name} />
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
          {editing ? (
            <div className="kx-glass bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>{t("hr.selfRating")}</FieldLabel>
                  <input
                    className={inputCls} type="number" min={1} max={5} inputMode="numeric"
                    placeholder="1-5"
                    value={reviewForm.self_rating}
                    onChange={(e) => setReviewForm((f) => ({ ...f, self_rating: e.target.value }))}
                  />
                </div>
                <div>
                  <FieldLabel>{t("hr.reviewerRating")}</FieldLabel>
                  <input
                    className={inputCls} type="number" min={1} max={5} inputMode="numeric"
                    placeholder="1-5"
                    value={reviewForm.reviewer_rating}
                    onChange={(e) => setReviewForm((f) => ({ ...f, reviewer_rating: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <FieldLabel>{t("hr.selfComments")}</FieldLabel>
                <textarea className={textareaCls} rows={2} value={reviewForm.self_comments}
                  onChange={(e) => setReviewForm((f) => ({ ...f, self_comments: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>{t("hr.reviewerComments")}</FieldLabel>
                <textarea className={textareaCls} rows={2} value={reviewForm.reviewer_comments}
                  onChange={(e) => setReviewForm((f) => ({ ...f, reviewer_comments: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>{t("hr.strengths")}</FieldLabel>
                  <textarea className={textareaCls} rows={2} value={reviewForm.strengths}
                    onChange={(e) => setReviewForm((f) => ({ ...f, strengths: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel>{t("hr.improvements")}</FieldLabel>
                  <textarea className={textareaCls} rows={2} value={reviewForm.improvements}
                    onChange={(e) => setReviewForm((f) => ({ ...f, improvements: e.target.value }))} />
                </div>
              </div>
              <div>
                <FieldLabel>{t("hr.goalsMet")}</FieldLabel>
                <textarea className={textareaCls} rows={2} value={reviewForm.goals_met}
                  onChange={(e) => setReviewForm((f) => ({ ...f, goals_met: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>{t("hr.overallScore")}</FieldLabel>
                  <input className={inputCls} type="number" step="0.1" inputMode="decimal"
                    value={reviewForm.overall_score}
                    onChange={(e) => setReviewForm((f) => ({ ...f, overall_score: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel>{t("hr.status")}</FieldLabel>
                  <select className={selectCls} value={reviewForm.status}
                    onChange={(e) => setReviewForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="pending">{t("hr.pending")}</option>
                    <option value="in_progress">{t("hr.inProgress")}</option>
                    <option value="completed">{t("hr.completed")}</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button className={cancelBtnCls} onClick={() => setEditing(false)}>
                  {t("hr.cancel")}
                </button>
                <button className={primaryBtnCls} onClick={handleSaveReview} disabled={saving}>
                  {saving ? <SpinnerIcon size={14} /> : t("hr.save")}
                </button>
              </div>
            </div>
          ) : (
          <div className="kx-glass bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
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

            {selectedAppraisal.strengths && (
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] mb-1">
                  {t("hr.strengths")}
                </div>
                <div className="text-[13px] text-[var(--text-subtle)] whitespace-pre-wrap">
                  {selectedAppraisal.strengths}
                </div>
              </div>
            )}

            {selectedAppraisal.improvements && (
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] mb-1">
                  {t("hr.improvements")}
                </div>
                <div className="text-[13px] text-[var(--text-subtle)] whitespace-pre-wrap">
                  {selectedAppraisal.improvements}
                </div>
              </div>
            )}

            {selectedAppraisal.goals_met && (
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] mb-1">
                  {t("hr.goalsMet")}
                </div>
                <div className="text-[13px] text-[var(--text-subtle)] whitespace-pre-wrap">
                  {selectedAppraisal.goals_met}
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
          )}

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

      {/* ── Add Appraisal Modal ── */}
      <ModalShell
        open={showAppraisalModal}
        onClose={() => setShowAppraisalModal(false)}
        title={t("hr.addAppraisal")}
        footer={
          <>
            <button className={cancelBtnCls} onClick={() => setShowAppraisalModal(false)}>
              {t("hr.cancel")}
            </button>
            <button
              className={primaryBtnCls}
              disabled={!appraisalForm.employee_id || saving}
              onClick={handleCreateAppraisal}
            >
              {saving ? <SpinnerIcon size={14} /> : t("hr.create")}
            </button>
          </>
        }
      >
        <div>
          <FieldLabel>{t("hr.employee")}</FieldLabel>
          <EmployeePicker
            employees={employees}
            value={appraisalForm.employee_id}
            onChange={(id) => setAppraisalForm((f) => ({ ...f, employee_id: id }))}
            placeholder={t("hr.selectEmployee")}
            searchPlaceholder={t("hr.searchEmployees")}
            emptyLabel={t("hr.noEmployeesFound")}
          />
        </div>
        <div>
          {/* Optional: a review can be filed before anyone is assigned to
              conduct it, which is how most cycles actually start. */}
          <FieldLabel>{t("hr.reviewer")}</FieldLabel>
          <EmployeePicker
            employees={employees}
            value={appraisalForm.reviewer_id}
            onChange={(id) => setAppraisalForm((f) => ({ ...f, reviewer_id: id }))}
            placeholder={t("hr.selectReviewerOptional")}
            searchPlaceholder={t("hr.searchEmployees")}
            emptyLabel={t("hr.noEmployeesFound")}
          />
        </div>
      </ModalShell>

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
              {saving ? <SpinnerIcon size={14} /> : t("hr.create")}
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
        {/* A cycle used to carry a name and two dates and nothing else, so
            nobody opening it later could tell what it was measuring. */}
        <div>
          <FieldLabel>{t("hr.status")}</FieldLabel>
          <select
            className={selectCls}
            value={cycleForm.status}
            onChange={(e) => setCycleForm({ ...cycleForm, status: e.target.value })}
          >
            <option value="draft">{t("hr.draft")}</option>
            <option value="active">{t("hr.active")}</option>
            <option value="completed">{t("hr.completed")}</option>
          </select>
        </div>
        <div>
          <FieldLabel>{t("hr.description")}</FieldLabel>
          <textarea
            className={textareaCls}
            rows={2}
            value={cycleForm.description}
            placeholder={t("hr.cycleDescriptionPh")}
            onChange={(e) => setCycleForm({ ...cycleForm, description: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel>{t("hr.notes")}</FieldLabel>
          <textarea
            className={textareaCls}
            rows={2}
            value={cycleForm.notes}
            placeholder={t("hr.cycleNotesPh")}
            onChange={(e) => setCycleForm({ ...cycleForm, notes: e.target.value })}
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
              {saving ? <SpinnerIcon size={14} /> : t("hr.add")}
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
