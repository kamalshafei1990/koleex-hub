"use client";

/* ---------------------------------------------------------------------------
   ProjectModals — the project and task editors, split out of ProjectsApp so
   they (and the TaskExtras panels inside them) load only when first opened.

   FORM STATE IS SEEDED ONCE, AT MOUNT. The parent mounts a modal only while
   it is open and keys it by the edited row's id, so:
     · opening (closed → open) or switching to another row starts fresh;
     · a background refresh that hands the modal a NEW `stages` array or a
       NEW `editing` object for the same row changes NOTHING the user typed.
   The old version re-seeded every field from an effect keyed on
   [open, editing, stages] — and the board refreshed every 20s, so a
   half-typed task description was silently wiped three times a minute.

   Dialog semantics: role="dialog", aria-modal, labelled by its heading,
   Escape closes (unless a confirm dialog is up on top of it).
   --------------------------------------------------------------------------- */

import { useEffect, useId, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useConfirm } from "@/components/kds/useConfirm";
import { useToast } from "@/components/kds/useToast";
import { useTranslation } from "@/lib/i18n";
import { usePermissions } from "@/lib/permissions";
import { projectsT } from "@/lib/translations/projects";
import { ScrollLockOverlay } from "@/hooks/useScrollLock";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import LinkIcon from "@/components/icons/ui/LinkIcon";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import { ArchiveIcon, UndoIcon } from "@/components/icons/ui";
import EntityPicker from "@/components/planning/EntityPicker";
import { createItem as createPlanningItem } from "@/lib/planning";
import { KX_RANGE_CLASS, kxRangeStyle } from "@/components/ui/rangeSlider";
import {
  accountLabel,
  archiveProject,
  createProject,
  createTask,
  deleteProject,
  deleteTask,
  fetchAccounts,
  fetchProjects,
  fetchStages,
  PRIORITY_COLOR,
  restoreProject,
  todayLocalISO,
  updateProject,
  updateTask,
  type AccountLite,
  type ProjectRow,
  type ProjectStage,
  type ProjectTag,
  type TaskPriority,
  type TaskRow,
  type TaskStatus,
} from "@/lib/projects";

const SubtasksPanel = dynamic(() => import("./TaskExtras").then((m) => m.SubtasksPanel), { ssr: false });
const ChecklistPanel = dynamic(() => import("./TaskExtras").then((m) => m.ChecklistPanel), { ssr: false });
const CommentsPanel = dynamic(() => import("./TaskExtras").then((m) => m.CommentsPanel), { ssr: false });
const TimePanel = dynamic(() => import("./TaskExtras").then((m) => m.TimePanel), { ssr: false });
const AttachmentsPanel = dynamic(() => import("./TaskExtras").then((m) => m.AttachmentsPanel), { ssr: false });

/** Hub Blue — the default project colour (was Tailwind indigo #818cf8). */
export const DEFAULT_PROJECT_COLOR = "#567fb2";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const inputCls = "w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-focus)]";
const segOn = "kx-seg-on bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent";
const segOff = "kx-seg-off bg-[var(--bg-surface)] text-[var(--text-dim)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]";

/* ── Dialog behaviour shared by both editors ── */
function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      /* A confirm dialog on top owns the moment — don't close underneath it. */
      if (document.querySelector('[role="alertdialog"]')) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
}

/* Suggested project colours — one tap instead of the native colour bar.
   The trailing swatch still opens the native picker for a custom value. */
const PROJECT_COLORS = [
  DEFAULT_PROJECT_COLOR, "#60a5fa", "#2dd4bf", "#34d399",
  "#fbbf24", "#fb923c", "#f87171", "#f472b6",
];

function ColorSwatchPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const { t } = useTranslation(projectsT);
  const custom = !PROJECT_COLORS.includes(value.toLowerCase());
  return (
    <div className="h-10 px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between gap-1">
      {PROJECT_COLORS.map((c) => {
        const active = value.toLowerCase() === c;
        return (
          <button key={c} type="button" onClick={() => onChange(c)} aria-label={c} aria-pressed={active}
            className={`h-6 w-6 rounded-full flex items-center justify-center transition-all duration-150 ${
              active
                ? "scale-110 shadow-[0_0_0_1.5px_var(--bg-surface),0_0_0_3px_currentColor]"
                : "opacity-80 hover:opacity-100 hover:scale-110"
            }`}
            style={{ background: c, color: c }}>
            {active && <CheckIcon size={10} className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />}
          </button>
        );
      })}
      <label title={t("form.customColor")}
        className={`relative h-6 w-6 rounded-full cursor-pointer flex items-center justify-center overflow-hidden transition-all duration-150 ${
          custom
            ? "scale-110 shadow-[0_0_0_1.5px_var(--bg-surface),0_0_0_3px_var(--border-color)]"
            : "border border-dashed border-[var(--border-color)] opacity-80 hover:opacity-100 hover:scale-110"
        }`}
        style={custom ? { background: value } : undefined}>
        {custom
          ? <CheckIcon size={10} className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
          : <PlusIcon size={10} className="text-[var(--text-dim)]" />}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer" aria-label={t("form.customColor")} />
      </label>
    </div>
  );
}

function AccountSelect({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder: string;
  label: string;
}) {
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  useEffect(() => {
    fetchAccounts().then(setAccounts);
  }, []);
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label={label}
      className="w-full h-10 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
    >
      <option value="">{placeholder}</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>{accountLabel(a)}</option>
      ))}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
      {children}
    </label>
  );
}

function ModalFrame({
  titleId,
  title,
  onClose,
  children,
  footer,
  tabs,
}: {
  titleId: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  tabs?: React.ReactNode;
}) {
  const { t } = useTranslation(projectsT);
  useEscapeToClose(onClose);
  return (
    <ScrollLockOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="kx-glass-pop w-full max-w-xl sm:max-w-2xl rounded-t-2xl sm:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-color)]">
          <h2 id={titleId} className="text-[15px] font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t("tip.close")} className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center">
            <CrossIcon size={14} />
          </button>
        </div>
        {tabs}
        {children}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[var(--border-color)]">{footer}</div>
      </div>
    </ScrollLockOverlay>
  );
}

function SaveButton({ saving, disabled, label, onClick }: { saving: boolean; disabled?: boolean; label: string; onClick: () => void }) {
  const { t } = useTranslation(projectsT);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving || disabled}
      aria-busy={saving}
      className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
    >
      {saving ? t("btn.saving") : label}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PROJECT FORM MODAL
   ══════════════════════════════════════════════════════════════════ */

export function ProjectFormModal({
  editing,
  onClose,
  onSaved,
  onDeleted,
}: {
  editing: ProjectRow | null;
  onClose: () => void;
  onSaved: (p: ProjectRow) => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation(projectsT);
  const titleId = useId();
  const { askConfirm, confirmDialog } = useConfirm();
  const { showToast, toastElement } = useToast();
  const [name, setName] = useState(editing?.name ?? "");
  const [code, setCode] = useState(editing?.code ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [color, setColor] = useState(editing?.color ?? DEFAULT_PROJECT_COLOR);
  const [isBillable, setIsBillable] = useState(editing?.is_billable ?? false);
  const [plannedStart, setPlannedStart] = useState(editing?.planned_start ?? "");
  const [plannedEnd, setPlannedEnd] = useState(editing?.planned_end ?? "");
  const [budgetHours, setBudgetHours] = useState<string>(editing?.budget_hours?.toString() ?? "");
  const [budgetAmount, setBudgetAmount] = useState<string>(editing?.budget_amount?.toString() ?? "");
  const [billingRate, setBillingRate] = useState<string>(editing?.billing_rate?.toString() ?? "");
  const [currency, setCurrency] = useState<string>(editing?.currency ?? "");
  const { isSuperAdmin } = usePermissions();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isTemplate, setIsTemplate] = useState(editing?.is_template ?? false);
  const [templateId, setTemplateId] = useState<string>("");
  const [templates, setTemplates] = useState<ProjectRow[]>([]);
  const [status, setStatus] = useState<"active" | "on_hold" | "completed" | "archived">(editing?.status ?? "active");
  const [customerId, setCustomerId] = useState<string | null>(editing?.customer_id ?? null);
  const [customerLabel, setCustomerLabel] = useState<string>(editing?.customer?.display_name ?? editing?.customer?.company_name ?? "");
  const [managerId, setManagerId] = useState<string | null>(editing?.manager_account_id ?? null);
  const [saving, setSaving] = useState(false);

  /* Template gallery — only needed when starting a NEW project. */
  useEffect(() => {
    if (editing) return;
    let cancelled = false;
    fetchProjects({ templates: true }).then((rows) => {
      if (!cancelled) setTemplates(rows);
    });
    return () => { cancelled = true; };
  }, [editing]);

  /* Picking a template pre-fills the commercial defaults; the name stays
     yours. The stage pipeline + task checklist are copied server-side on
     Create via template_id. */
  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    setColor(tpl.color ?? DEFAULT_PROJECT_COLOR);
    setDescription(tpl.description ?? "");
    setIsBillable(tpl.is_billable);
    setBillingRate(tpl.billing_rate?.toString() ?? "");
    setBudgetAmount(tpl.budget_amount?.toString() ?? "");
    setBudgetHours(tpl.budget_hours?.toString() ?? "");
  };

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      code: code.trim() || null,
      description: description.trim() || null,
      color,
      is_billable: isBillable,
      planned_start: plannedStart || null,
      planned_end: plannedEnd || null,
      budget_hours: budgetHours ? Number(budgetHours) : null,
      budget_amount: budgetAmount ? Number(budgetAmount) : null,
      billing_rate: billingRate ? Number(billingRate) : null,
      /* Only sent when set/changed, so a DB without the column (migration
         pending) never sees it on an ordinary edit. */
      ...(currency.trim() || editing?.currency ? { currency: currency.trim().toUpperCase() || null } : {}),
      is_template: isTemplate,
      status,
      customer_id: customerId,
      manager_account_id: managerId,
    };
    try {
      const saved = editing
        ? await updateProject(editing.id, payload)
        : await createProject({ ...payload, template_id: templateId || null });
      onSaved(saved);
    } catch (e) {
      showToast(t("toast.saveFailed").replace("{err}", errText(e)), "error");
      setSaving(false);
    }
  };

  /* Archive is the everyday "remove" — restorable. Permanent delete is for
     super admins only, behind a typed-name confirm (the server enforces
     the SA rule too). */
  const archived = editing?.status === "archived";
  const toggleArchive = () => {
    if (!editing) return;
    const go = async () => {
      try {
        const saved = archived ? await restoreProject(editing.id) : await archiveProject(editing.id);
        onSaved(saved);
      } catch (e) {
        showToast(t("toast.saveFailed").replace("{err}", errText(e)), "error");
      }
    };
    if (archived) void go();
    else askConfirm(t("archive.confirm"), go, { confirmLabel: t("action.archive"), tone: "neutral" });
  };
  const removeForever = async () => {
    if (!editing) return;
    try {
      await deleteProject(editing.id);
      onDeleted();
    } catch (e) {
      setDeleteOpen(false);
      showToast(t("toast.deleteFailed").replace("{err}", errText(e)), "error");
    }
  };

  return (
    <ModalFrame
      titleId={titleId}
      title={editing ? t("form.title.edit") : t("form.title.new")}
      onClose={onClose}
      footer={
        <>
          <div className="flex items-center gap-1">
            {editing && (
              <button type="button" onClick={toggleArchive} className="h-10 px-4 rounded-xl text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] text-[13px] font-medium flex items-center gap-1.5 transition-colors">
                {archived ? <UndoIcon size={13} /> : <ArchiveIcon size={13} />} {archived ? t("action.restore") : t("action.archive")}
              </button>
            )}
            {editing && isSuperAdmin && (
              <button type="button" onClick={() => setDeleteOpen(true)} className="h-10 px-4 rounded-xl text-red-400 hover:bg-red-500/10 text-[13px] font-medium flex items-center gap-1.5 transition-colors">
                <TrashIcon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t("delete.permanent")}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="h-10 px-5 rounded-xl text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] text-[13px] font-medium transition-colors">{t("btn.cancel")}</button>
            <SaveButton saving={saving} disabled={!name.trim()} onClick={save} label={editing ? t("btn.save") : t("btn.create")} />
          </div>
        </>
      }
    >
      {confirmDialog}
      {toastElement}
      {deleteOpen && editing && (
        <TypedDeleteConfirm name={editing.name} onCancel={() => setDeleteOpen(false)} onConfirm={removeForever} />
      )}
      <div className="px-5 py-4 space-y-3 overflow-y-auto">
        {!editing && templates.length > 0 && (
          <Field label={t("form.template", "Start from template")}>
            <select value={templateId} onChange={(e) => applyTemplate(e.target.value)} className={inputCls}>
              <option value="">{t("form.template.blank", "Blank project")}</option>
              {templates.map((tp) => (
                <option key={tp.id} value={tp.id}>{tp.name}</option>
              ))}
            </select>
            {templateId && (
              <div className="text-[11px] text-[var(--text-dim)] pt-1">
                {t("form.template.hint", "Stages and the task checklist will be copied from this template.")}
              </div>
            )}
          </Field>
        )}
        <Field label={t("form.name")}>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label={t("form.code")}>
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} />
          </Field>
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("form.color")}</div>
            <ColorSwatchPicker value={color} onChange={setColor} />
          </div>
        </div>
        <Field label={t("form.description")}>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none resize-none focus:border-[var(--border-focus)]" />
        </Field>
        <div className="pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-faint)]">
          {t("form.section.clientTeam", "Client & team")}
        </div>
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("form.customer")}</div>
          <EntityPicker
            entityType="customer"
            entityId={customerId}
            entityLabel={customerLabel || null}
            onChange={(id, label) => { setCustomerId(id); setCustomerLabel(label ?? ""); }}
            placeholder={t("form.customer")}
          />
        </div>
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("form.manager", "Project manager")}</div>
          <AccountSelect value={managerId} onChange={setManagerId} placeholder={t("form.manager", "Project manager")} label={t("form.manager", "Project manager")} />
        </div>
        <div className="pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-faint)]">
          {t("form.section.scheduleBudget", "Schedule & budget")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label={t("form.plannedStart")}>
            <input type="date" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} className={inputCls} />
          </Field>
          <Field label={t("form.plannedEnd")}>
            <input type="date" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label={t("form.billingRate", "Billing rate / hour")}>
            <input type="number" min={0} value={billingRate} onChange={(e) => setBillingRate(e.target.value)} className={inputCls} />
          </Field>
          <Field label={t("form.budgetAmount", "Budget amount")}>
            <div className="flex gap-1.5">
              <input type="number" min={0} value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} className={`${inputCls} flex-1 min-w-0`} />
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase())}
                placeholder="USD"
                aria-label={t("form.currency")}
                title={t("form.currency")}
                className={`${inputCls} !w-20 text-center uppercase`}
              />
            </div>
          </Field>
          <Field label={t("form.budgetHours")}>
            <input type="number" min={0} value={budgetHours} onChange={(e) => setBudgetHours(e.target.value)} className={inputCls} />
          </Field>
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("form.billable")}</div>
            <label className="flex items-center gap-2 h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] cursor-pointer">
              <input type="checkbox" checked={isBillable} onChange={(e) => setIsBillable(e.target.checked)} className="accent-[#567FB2]" />
              <span className="text-[13px] text-[var(--text-dim)]">{t("form.billableHint", "Bill logged time to the customer")}</span>
            </label>
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("form.isTemplate", "Template")}</div>
          <label className="flex items-center gap-2 min-h-10 py-2 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] cursor-pointer">
            <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} className="accent-[#567FB2]" />
            <span className="text-[13px] text-[var(--text-dim)]">{t("form.isTemplateHint", "Save as a reusable template — hidden from project lists, offered when creating new projects")}</span>
          </label>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("form.status")}</div>
          <div className="flex gap-1.5 flex-wrap" role="group" aria-label={t("form.status")}>
            {(["active", "on_hold", "completed", "archived"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                aria-pressed={status === s}
                className={`h-8 px-3 rounded-lg text-[11px] font-semibold border transition-colors ${status === s ? segOn : segOff}`}
              >
                {s === "active" && t("filter.active")}
                {s === "on_hold" && t("filter.onHold")}
                {s === "completed" && t("filter.completed")}
                {s === "archived" && t("filter.archived")}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ModalFrame>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TASK FORM MODAL
   ══════════════════════════════════════════════════════════════════ */

type DetailTab = "details" | "subtasks" | "checklist" | "comments" | "time" | "files";

export function TaskFormModal({
  editing,
  projectId,
  presetStageId,
  stages,
  tags,
  allTasks = [],
  onClose,
  onSaved,
}: {
  editing: TaskRow | null;
  projectId: string;
  presetStageId: string | null;
  stages: ProjectStage[];
  tags: ProjectTag[];
  allTasks?: TaskRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(projectsT);
  const titleId = useId();
  const { askConfirm, confirmDialog } = useConfirm();
  const { showToast, toastElement } = useToast();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [stageId, setStageId] = useState<string>(
    editing ? editing.stage_id ?? "" : presetStageId ?? stages.find((s) => s.is_default_new)?.id ?? stages[0]?.id ?? "",
  );
  const [priority, setPriority] = useState<TaskPriority>(editing?.priority ?? "normal");
  const [dueDate, setDueDate] = useState(editing?.due_date ?? "");
  const [startDate, setStartDate] = useState(editing?.start_date ?? "");
  const [estimated, setEstimated] = useState<string>(editing?.estimated_hours?.toString() ?? "");
  const [progress, setProgress] = useState<number>(editing?.progress_pct ?? 0);
  const [status, setStatus] = useState<TaskStatus>(editing?.status ?? "open");
  const [assigneeId, setAssigneeId] = useState<string | null>(editing?.assignee_account_id ?? null);
  const [tagIds, setTagIds] = useState<string[]>(editing?.tag_ids ?? []);
  const [linkedType, setLinkedType] = useState<string>(editing?.linked_entity_type ?? "");
  const [linkedId, setLinkedId] = useState<string | null>(editing?.linked_entity_id ?? null);
  const [linkedLabel, setLinkedLabel] = useState<string>(editing?.linked_entity_label ?? "");
  const [blockedBy, setBlockedBy] = useState<string[]>(editing?.blocked_by_task_ids ?? []);
  const [scheduling, setScheduling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("details");

  const save = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    /* logged_hours is NOT sent — it is derived from time entries. */
    const payload = {
      project_id: editing ? editing.project_id : projectId,
      title: title.trim(),
      description: description.trim() || null,
      stage_id: stageId || null,
      priority,
      due_date: dueDate || null,
      /* Only when set or previously set — never blank a start date the
         caller's row simply didn't carry. */
      ...(startDate || editing?.start_date ? { start_date: startDate || null } : {}),
      estimated_hours: estimated ? Number(estimated) : null,
      progress_pct: progress,
      status,
      assignee_account_id: assigneeId,
      tag_ids: tagIds,
      linked_entity_type: linkedType || null,
      linked_entity_id: linkedId,
      linked_entity_label: linkedLabel || null,
      blocked_by_task_ids: blockedBy,
    };
    try {
      if (editing) await updateTask(editing.id, payload);
      else await createTask(payload);
      onSaved();
    } catch (e) {
      showToast(t("toast.saveFailed").replace("{err}", errText(e)), "error");
      setSaving(false);
    }
  };

  const remove = () => {
    if (!editing) return;
    askConfirm(t("task.deleteConfirm"), async () => {
      try {
        await deleteTask(editing.id);
        onSaved();
      } catch (e) {
        showToast(t("toast.deleteFailed").replace("{err}", errText(e)), "error");
      }
    }, { confirmLabel: t("btn.delete") });
  };

  const toggleTag = (id: string) => {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleBlocker = (id: string) => {
    setBlockedBy((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  /* Two-way sync: create a draft Planning item for this task (on its due
     date — or the user's LOCAL today — 09:00-17:00) and remember the link
     on the task, so completing the shift later logs its hours back here. */
  const scheduleInPlanning = async () => {
    if (!editing || scheduling) return;
    setScheduling(true);
    try {
      const day = editing.due_date ?? todayLocalISO();
      const start = new Date(`${day}T09:00:00`);
      const end = new Date(`${day}T17:00:00`);
      const item = await createPlanningItem({
        type: "project_task",
        title: editing.title,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        allocated_hours: editing.estimated_hours ?? null,
        linked_entity_type: "project",
        linked_entity_id: editing.project_id,
        linked_entity_label: editing.project?.name ?? editing.title,
        status: "draft",
      });
      if (item) {
        await updateTask(editing.id, { linked_planning_item_id: item.id });
        onSaved();
      }
    } catch (e) {
      showToast(t("toast.saveFailed").replace("{err}", errText(e)), "error");
    } finally {
      setScheduling(false);
    }
  };

  const blockerChoices = allTasks.filter((tk) => tk.id !== editing?.id && tk.status !== "cancelled");

  const tabs = editing ? (
    <div role="tablist" className="flex items-center gap-1 px-3 pt-2 border-b border-[var(--border-color)] overflow-x-auto scrollbar-none">
      {([
        ["details", t("task.tab.details", "Details")],
        ["subtasks", t("task.tab.subtasks", "Subtasks")],
        ["checklist", t("task.tab.checklist", "Checklist")],
        ["comments", t("task.tab.comments", "Comments")],
        ["time", t("task.tab.time", "Time")],
        ["files", t("task.tab.files", "Files")],
      ] as const).map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={detailTab === key}
          onClick={() => setDetailTab(key)}
          className={`h-8 px-3 rounded-t-lg text-[12px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
            detailTab === key
              ? "border-[var(--text-primary)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-dim)] hover:text-[var(--text-primary)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  ) : undefined;

  return (
    <ModalFrame
      titleId={titleId}
      title={editing ? t("task.title.edit") : t("task.title.new")}
      onClose={onClose}
      tabs={tabs}
      footer={
        <>
          <div className="flex items-center gap-1.5">
            {editing && (
              <button type="button" onClick={remove} className="h-10 px-5 rounded-xl text-red-400 hover:bg-red-500/10 text-[13px] font-medium flex items-center gap-1.5 transition-colors">
                <TrashIcon className="h-3.5 w-3.5" /> {t("btn.delete")}
              </button>
            )}
            {editing && !editing.linked_planning_item_id && (
              <button
                type="button"
                onClick={scheduleInPlanning}
                disabled={scheduling}
                className="h-9 px-3 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                <ClockIcon size={13} /> {scheduling ? t("task.scheduling", "Scheduling…") : t("task.schedule", "Schedule in Planning")}
              </button>
            )}
            {editing?.linked_planning_item_id && (
              <Link href="/planning" className="h-10 px-5 rounded-xl text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] text-[13px] font-medium flex items-center gap-1.5 transition-colors">
                <LinkIcon size={13} /> {t("task.viewPlanning", "View in Planning")}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="h-10 px-5 rounded-xl text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] text-[13px] font-medium transition-colors">{t("btn.cancel")}</button>
            <SaveButton saving={saving} disabled={!title.trim()} onClick={save} label={editing ? t("btn.save") : t("btn.create")} />
          </div>
        </>
      }
    >
      {confirmDialog}
      {toastElement}
      {editing && detailTab !== "details" && (
        <div className="px-5 py-4 overflow-y-auto" role="tabpanel">
          {detailTab === "subtasks" && <SubtasksPanel taskId={editing.id} projectId={editing.project_id} />}
          {detailTab === "checklist" && <ChecklistPanel taskId={editing.id} />}
          {detailTab === "comments" && <CommentsPanel taskId={editing.id} />}
          {detailTab === "time" && <TimePanel taskId={editing.id} />}
          {detailTab === "files" && <AttachmentsPanel taskId={editing.id} />}
        </div>
      )}

      <div className={`px-5 py-4 space-y-3 overflow-y-auto ${editing && detailTab !== "details" ? "hidden" : ""}`}>
        <Field label={t("task.namePh")}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("task.namePh")} className={inputCls} />
        </Field>
        <Field label={t("task.description")}>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none resize-none focus:border-[var(--border-focus)]" />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label={t("task.stage")}>
            <select value={stageId} onChange={(e) => setStageId(e.target.value)} disabled={stages.length === 0} className="w-full h-10 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px]">
              <option value="">—</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("task.priority")}</div>
            <div className="flex gap-1" role="group" aria-label={t("task.priority")}>
              {(["low", "normal", "high", "urgent"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  aria-pressed={priority === p}
                  className={`flex-1 h-10 rounded-lg text-[11px] font-semibold border transition-colors ${
                    priority === p ? "border-transparent" : "bg-[var(--bg-surface)] text-[var(--text-dim)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                  }`}
                  style={priority === p ? { background: `${PRIORITY_COLOR[p]}22`, color: PRIORITY_COLOR[p] } : undefined}
                >
                  {t(`priority.${p}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("task.assignee", "Assignee")}</div>
          <AccountSelect value={assigneeId} onChange={setAssigneeId} placeholder={t("task.unassigned", "Unassigned")} label={t("task.assignee", "Assignee")} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Field label={t("task.startDate")}>
            <input type="date" value={startDate} max={dueDate || undefined} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label={t("task.dueDate")}>
            <input type="date" value={dueDate} min={startDate || undefined} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label={t("task.estimated")}>
            <input type="number" min={0} value={estimated} onChange={(e) => setEstimated(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Read-only: logged hours are the sum of the task's time entries. */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("task.logged")}</div>
            <div className="h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-between text-[13px]">
              <span className="font-semibold tabular-nums">{(Number(editing?.logged_hours) || 0).toFixed(2)}h</span>
              <span className="text-[11px] text-[var(--text-dim)]">{t("task.loggedHint")}</span>
            </div>
          </div>
          <Field label={t("task.progress")}>
            <div className="flex items-center gap-2 h-10">
              <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className={`flex-1 ${KX_RANGE_CLASS}`} style={kxRangeStyle(progress)} />
              <span className="text-[11px] font-semibold text-[var(--text-muted)] w-10 text-end">{progress}%</span>
            </div>
          </Field>
        </div>

        {tags.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("task.tags")}</div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tg) => {
                const on = tagIds.includes(tg.id);
                return (
                  <button
                    key={tg.id}
                    type="button"
                    onClick={() => toggleTag(tg.id)}
                    aria-pressed={on}
                    className={`text-[11px] font-semibold px-2 py-1 rounded border transition-colors ${on ? "" : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}
                    style={on ? { background: `${tg.color ?? "#94a3b8"}22`, color: tg.color ?? "#94a3b8", borderColor: "transparent" } : undefined}
                  >
                    {tg.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
          <select value={linkedType} aria-label={t("task.linked")} onChange={(e) => { setLinkedType(e.target.value); setLinkedId(null); setLinkedLabel(""); }} className="h-10 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px]">
            <option value="">{t("task.linked")}</option>
            <option value="customer">{t("entity.customer")}</option>
            <option value="supplier">{t("entity.supplier")}</option>
            <option value="contact">{t("entity.contact")}</option>
            <option value="product">{t("entity.product")}</option>
          </select>
          {linkedType === "customer" || linkedType === "supplier" || linkedType === "contact" || linkedType === "product" ? (
            <EntityPicker
              entityType={linkedType as "customer" | "supplier" | "contact" | "product"}
              entityId={linkedId}
              entityLabel={linkedLabel || null}
              onChange={(id, label) => { setLinkedId(id); setLinkedLabel(label ?? ""); }}
            />
          ) : (
            <div className="h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center text-[12px] text-[var(--text-ghost)]">—</div>
          )}
        </div>

        {(blockerChoices.length > 0 || blockedBy.length > 0) && (
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("task.blockedBy", "Blocked by")}</div>
            <div className="flex flex-wrap gap-1.5">
              {blockerChoices.slice(0, 40).map((tk) => {
                const on = blockedBy.includes(tk.id);
                return (
                  <button
                    key={tk.id}
                    type="button"
                    onClick={() => toggleBlocker(tk.id)}
                    aria-pressed={on}
                    className={`text-[11px] font-semibold px-2 py-1 rounded border transition-colors max-w-[220px] truncate ${
                      on
                        ? "bg-red-500/10 text-red-400 border-red-500/30"
                        : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                    } ${tk.status === "done" ? "line-through opacity-60" : ""}`}
                  >
                    <AutoTranslatedText text={tk.title} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("task.status")}</div>
          <div className="flex gap-1.5 flex-wrap" role="group" aria-label={t("task.status")}>
            {(["open", "done", "cancelled"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                aria-pressed={status === s}
                className={`h-8 px-3 rounded-lg text-[11px] font-semibold border transition-colors ${status === s ? segOn : segOff}`}
              >
                {t(`status.${s}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ModalFrame>
  );
}

/** Task editor opened from the flat My/All Tasks views — loads the task's
 *  project stages on demand so the Stage selector isn't stuck on "—". The
 *  form state is independent of this load, so it never resets. */
export function FlatTaskFormModal({
  editing,
  tags,
  onClose,
  onSaved,
}: {
  editing: TaskRow;
  tags: ProjectTag[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [stages, setStages] = useState<ProjectStage[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchStages(editing.project_id)
      .then((s) => { if (!cancelled) setStages(s); })
      .catch(() => { /* the selector simply stays disabled */ });
    return () => { cancelled = true; };
  }, [editing.project_id]);

  return (
    <TaskFormModal
      editing={editing}
      projectId={editing.project_id}
      presetStageId={null}
      stages={stages}
      tags={tags}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

/** Permanent-delete confirm: the project's exact name must be typed. */
function TypedDeleteConfirm({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => Promise<void> }) {
  const { t } = useTranslation(projectsT);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const match = typed.trim() === name.trim();
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm" onClick={onCancel} role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="kx-glass-pop w-full max-w-sm rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3.5 space-y-2.5">
          <p id={titleId} className="text-[13px] font-semibold text-[var(--text-primary)]">{t("delete.permanent")}</p>
          <p className="text-[12px] text-[var(--text-muted)]">{t("delete.typeName")}</p>
          <p className="text-[12px] font-bold text-[var(--text-primary)] break-words" dir="auto">{name}</p>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}
            placeholder={t("delete.namePh")}
            aria-label={t("delete.namePh")}
            className="w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-4 py-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">{t("btn.cancel")}</button>
          <button
            type="button"
            disabled={!match || busy}
            onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[12px] font-semibold text-rose-400 hover:bg-rose-500/15 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? t("btn.saving") : t("delete.permanent")}
          </button>
        </div>
      </div>
    </div>
  );
}
