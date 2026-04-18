"use client";

/* ---------------------------------------------------------------------------
   Onboarding / Offboarding — Combined module with sub-toggle for managing
   employee onboarding and offboarding checklists.
   --------------------------------------------------------------------------- */

import { useState, useEffect } from "react";
import type { HRModuleProps } from "@/components/hr/HRApp";
import {
  ModalShell,
  FieldLabel,
  EmptyState,
  inputCls,
  selectCls,
  primaryBtnCls,
  cancelBtnCls,
  fmtDate,
  cardCls,
  sectionTitleCls,
} from "@/components/hr/shared";
import {
  fetchChecklists,
  fetchChecklistInstances,
  assignChecklist,
  toggleChecklistItem,
  type ChecklistInstanceWithName,
} from "@/lib/hr-admin";
import type { ChecklistRow } from "@/types/supabase";

/* ── Icons ── */
import PlusIcon from "@/components/icons/ui/PlusIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import SignOutIcon from "@/components/icons/ui/SignOutIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */

export default function OnboardingModule({ employees, t, lang }: HRModuleProps) {
  /* ── state ── */
  const [boardType, setBoardType] = useState<"onboarding" | "offboarding">("onboarding");
  const [onboardChecklists, setOnboardChecklists] = useState<ChecklistRow[]>([]);
  const [offboardChecklists, setOffboardChecklists] = useState<ChecklistRow[]>([]);
  const [onboardInstances, setOnboardInstances] = useState<ChecklistInstanceWithName[]>([]);
  const [offboardInstances, setOffboardInstances] = useState<ChecklistInstanceWithName[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    employee_id: "",
    checklist_id: "",
    start_date: new Date().toISOString().split("T")[0],
  });
  const [expandedInstance, setExpandedInstance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ── computed ── */
  const checklists = boardType === "onboarding" ? onboardChecklists : offboardChecklists;
  const instances = boardType === "onboarding" ? onboardInstances : offboardInstances;

  /* ── data loading ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [onChecklists, offChecklists, allInstances] = await Promise.all([
          fetchChecklists("onboarding"),
          fetchChecklists("offboarding"),
          fetchChecklistInstances(),
        ]);
        if (cancelled) return;
        setOnboardChecklists(onChecklists);
        setOffboardChecklists(offChecklists);
        setOnboardInstances(
          allInstances.filter((i) => {
            const cl = onChecklists.find((c) => c.id === i.checklist_id);
            return cl?.type === "onboarding";
          }),
        );
        setOffboardInstances(
          allInstances.filter((i) => {
            const cl = offChecklists.find((c) => c.id === i.checklist_id);
            return cl?.type === "offboarding";
          }),
        );
      } catch (err) {
        console.error("[Onboarding] Load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── actions ── */
  const handleAssignChecklist = async () => {
    if (!assignForm.employee_id || !assignForm.checklist_id) return;
    setSaving(true);
    try {
      await assignChecklist(assignForm.checklist_id, assignForm.employee_id, assignForm.start_date);
      // Reload instances
      const allInstances = await fetchChecklistInstances();
      setOnboardInstances(
        allInstances.filter((i) => {
          const cl = onboardChecklists.find((c) => c.id === i.checklist_id);
          return cl?.type === "onboarding";
        }),
      );
      setOffboardInstances(
        allInstances.filter((i) => {
          const cl = offboardChecklists.find((c) => c.id === i.checklist_id);
          return cl?.type === "offboarding";
        }),
      );
      setShowAssignModal(false);
      setAssignForm({ employee_id: "", checklist_id: "", start_date: new Date().toISOString().split("T")[0] });
    } catch (err) {
      console.error("[Onboarding] Assign error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleItem = async (instanceId: string, itemIndex: number, completed: boolean) => {
    try {
      await toggleChecklistItem(instanceId, itemIndex, completed);
      // Reload instances
      const allInstances = await fetchChecklistInstances();
      setOnboardInstances(
        allInstances.filter((i) => {
          const cl = onboardChecklists.find((c) => c.id === i.checklist_id);
          return cl?.type === "onboarding";
        }),
      );
      setOffboardInstances(
        allInstances.filter((i) => {
          const cl = offboardChecklists.find((c) => c.id === i.checklist_id);
          return cl?.type === "offboarding";
        }),
      );
    } catch (err) {
      console.error("[Onboarding] Toggle error:", err);
    }
  };

  /* ── loading spinner ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <SpinnerIcon size={28} className="text-[var(--text-dim)] animate-spin" />
      </div>
    );
  }

  /* ── helper: find checklist template items for an instance ── */
  const getTemplateItems = (checklistId: string) => {
    const all = [...onboardChecklists, ...offboardChecklists];
    return all.find((c) => c.id === checklistId)?.items || [];
  };

  /* ── render ── */
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
          {boardType === "onboarding" ? t("hr.onboarding") : t("hr.offboarding")}
        </h2>
        <button onClick={() => setShowAssignModal(true)} className={primaryBtnCls + " flex items-center gap-2"}>
          <PlusIcon size={14} />
          {t("hr.assignChecklist")}
        </button>
      </div>

      {/* ── Sub-toggle bar ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setBoardType("onboarding")}
          className={`h-9 px-4 rounded-xl text-[13px] font-medium transition-colors ${
            boardType === "onboarding"
              ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]"
              : "text-[var(--text-subtle)] hover:bg-[var(--bg-surface)]"
          }`}
        >
          {t("hr.onboarding")}
        </button>
        <button
          onClick={() => setBoardType("offboarding")}
          className={`h-9 px-4 rounded-xl text-[13px] font-medium transition-colors ${
            boardType === "offboarding"
              ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]"
              : "text-[var(--text-subtle)] hover:bg-[var(--bg-surface)]"
          }`}
        >
          {t("hr.offboarding")}
        </button>
      </div>

      {/* ── Templates section ── */}
      <div className={cardCls}>
        <div className="p-5">
          <div className={sectionTitleCls}>
            <CheckCircleIcon size={14} className="text-[var(--text-dim)]" />
            {t("hr.templates")}
          </div>

          {checklists.length === 0 ? (
            <div className="text-[13px] text-[var(--text-dim)] text-center py-8">
              {t("hr.noTemplates")}
            </div>
          ) : (
            <div className="space-y-2">
              {checklists.map((cl) => (
                <div
                  key={cl.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                    {boardType === "onboarding" ? (
                      <CheckCircleIcon size={14} className="text-[var(--text-dim)]" />
                    ) : (
                      <SignOutIcon size={14} className="text-[var(--text-dim)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                      {cl.name}
                    </div>
                    <div className="text-[11px] text-[var(--text-dim)]">
                      {cl.items.length} {t("hr.items")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Active instances section ── */}
      <div className={cardCls}>
        <div className="p-5">
          <div className={sectionTitleCls}>
            {boardType === "onboarding" ? (
              <CheckCircleIcon size={14} className="text-[var(--text-dim)]" />
            ) : (
              <SignOutIcon size={14} className="text-[var(--text-dim)]" />
            )}
            {t("hr.active")}
          </div>

          {instances.length === 0 ? (
            <EmptyState
              icon={boardType === "onboarding" ? CheckCircleIcon : SignOutIcon}
              title={boardType === "onboarding" ? t("hr.noActiveOnboarding") : t("hr.noActiveOffboarding")}
              subtitle={t("hr.assignChecklistBegin")}
            />
          ) : (
            <div className="space-y-2">
              {instances.map((inst) => {
                const templateItems = getTemplateItems(inst.checklist_id);
                const completedCount = inst.items_status.filter((s) => s.completed).length;
                const totalCount = inst.items_status.length;
                const isExpanded = expandedInstance === inst.id;

                return (
                  <div key={inst.id} className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                    {/* Instance header */}
                    <button
                      onClick={() => setExpandedInstance(isExpanded ? null : inst.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors text-left"
                    >
                      <div className="h-8 w-8 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                        <UserIcon size={14} className="text-[var(--text-dim)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                          {inst.employee_name}
                        </div>
                        <div className="text-[11px] text-[var(--text-dim)]">
                          {inst.checklist_name}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[12px] text-[var(--text-subtle)] font-medium">
                          {completedCount}/{totalCount}
                        </span>
                        <span className="text-[11px] text-[var(--text-dim)]">
                          {fmtDate(inst.start_date)}
                        </span>
                        <AngleDownIcon
                          size={14}
                          className={`text-[var(--text-dim)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </div>
                    </button>

                    {/* Expanded items */}
                    {isExpanded && (
                      <div className="border-t border-[var(--border-subtle)] px-4 py-3 space-y-2 bg-[var(--bg-surface)]">
                        {templateItems.map((item, idx) => {
                          const status = inst.items_status.find((s) => s.item_index === idx);
                          const isDone = status?.completed ?? false;

                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-3 py-1.5"
                            >
                              <button
                                onClick={() => handleToggleItem(inst.id, idx, !isDone)}
                                className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                  isDone
                                    ? "bg-emerald-500/15 border-emerald-500/30"
                                    : "border-[var(--border-subtle)] hover:border-[var(--border-focus)]"
                                }`}
                              >
                                {isDone && <CheckIcon size={12} className="text-emerald-400" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className={`text-[13px] ${isDone ? "text-[var(--text-dim)] line-through" : "text-[var(--text-primary)]"}`}>
                                  {item.title}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[11px] text-[var(--text-dim)]">
                                    {item.assignee_role}
                                  </span>
                                  {item.due_days > 0 && (
                                    <span className="text-[11px] text-[var(--text-dim)]">
                                      {t("hr.due")}: {item.due_days}d
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isDone && (
                                <CheckIcon size={14} className="text-emerald-400 shrink-0" />
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
      </div>

      {/* ── Assign Checklist Modal ── */}
      <ModalShell
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title={boardType === "onboarding" ? t("hr.assignOnboardingChecklist") : t("hr.assignOffboardingChecklist")}
        footer={
          <>
            <button onClick={() => setShowAssignModal(false)} className={cancelBtnCls}>
              {t("hr.cancel")}
            </button>
            <button
              onClick={handleAssignChecklist}
              disabled={saving || !assignForm.employee_id || !assignForm.checklist_id}
              className={primaryBtnCls + " flex items-center gap-2"}
            >
              {saving && <SpinnerIcon size={14} className="animate-spin" />}
              {t("hr.assign")}
            </button>
          </>
        }
      >
        {/* Employee */}
        <div>
          <FieldLabel>{t("hr.employee")}</FieldLabel>
          <select
            value={assignForm.employee_id}
            onChange={(e) => setAssignForm((f) => ({ ...f, employee_id: e.target.value }))}
            className={selectCls}
          >
            <option value="">{t("hr.selectEmployee")}</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.person.full_name}
              </option>
            ))}
          </select>
        </div>

        {/* Checklist Template */}
        <div>
          <FieldLabel>{t("hr.checklistTemplate")}</FieldLabel>
          <select
            value={assignForm.checklist_id}
            onChange={(e) => setAssignForm((f) => ({ ...f, checklist_id: e.target.value }))}
            className={selectCls}
          >
            <option value="">{t("hr.selectChecklist")}</option>
            {checklists.map((cl) => (
              <option key={cl.id} value={cl.id}>
                {cl.name}
              </option>
            ))}
          </select>
        </div>

        {/* Start Date */}
        <div>
          <FieldLabel>{t("hr.startDate")}</FieldLabel>
          <input
            type="date"
            value={assignForm.start_date}
            onChange={(e) => setAssignForm((f) => ({ ...f, start_date: e.target.value }))}
            className={inputCls}
          />
        </div>
      </ModalShell>
    </div>
  );
}
