"use client";

/* ---------------------------------------------------------------------------
   ItemModal — create / edit any kind of planning item.

   Split out of PlanningApp and loaded with next/dynamic: it is only needed
   once someone opens an item.

   Rendered through the KDS Modal (role="dialog", aria-modal, backdrop
   close) plus an Escape handler. Validation runs here first — required
   start/end, end after start, title length — so an empty datetime can no
   longer reach `new Date("").toISOString()` (a RangeError that used to kill
   the click silently). The server validates again and is authoritative.

   Saving: the parent's onSave THROWS on failure. The modal stays open with
   the user's edits intact, the parent shows a toast, and Save/Publish/
   Delete are disabled while a request is in flight (no double submit).
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Modal from "@/components/kds/Modal";
import { useConfirm } from "@/components/kds/useConfirm";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import EntityPicker from "@/components/planning/EntityPicker";
import { useTranslation } from "@/lib/i18n";
import { planningT } from "@/lib/translations/planning";
import {
  ITEM_TYPE_LABELS,
  type PickerEntityType,
  type PlanningItem,
  type PlanningItemType,
  type PlanningResource,
  type PlanningRole,
} from "@/lib/planning";
import { PLANNING_LIMITS } from "@/lib/planning-validate";

export interface ItemModalPreset {
  resource_id?: string | null;
  date?: Date;
}

/* Linked types the modal offers for NEW links. "contact" searches every
   contact and stores the contact's real customer/supplier type. Quotation
   and invoice had only a free-text box (no id, so the strip could never
   find them) and are no longer offered; an existing row keeps showing its
   label read-only. */
const PICKER_TYPES: PickerEntityType[] = ["customer", "supplier", "contact", "product", "project"];
const LEGACY_TYPES = new Set(["quotation", "invoice"]);

export default function ItemModal({
  open,
  editing,
  preset,
  resources,
  roles,
  readOnly = false,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  editing: PlanningItem | null;
  preset?: ItemModalPreset;
  resources: PlanningResource[];
  roles: PlanningRole[];
  /** The caller may view but not change this item (server enforces too). */
  readOnly?: boolean;
  onClose: () => void;
  /** Throws on failure — the modal then stays open. */
  onSave: (payload: Partial<PlanningItem> & { start_at: string; end_at: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { askConfirm, confirmDialog } = useConfirm();
  const { t } = useTranslation(planningT);
  const [type, setType] = useState<PlanningItemType>("shift");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [resourceId, setResourceId] = useState<string>("");
  const [roleId, setRoleId] = useState<string>("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [linkedType, setLinkedType] = useState<string>("");
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const [linkedLabel, setLinkedLabel] = useState<string>("");
  const [status, setStatus] = useState<PlanningItem["status"]>("draft");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    /* Seeding the form from the item being opened is a one-shot sync from
       props, not derived state — the user edits these fields afterwards. */
    setError(null);
    setSaving(false);
    if (editing) {
      setType(editing.type);
      setTitle(editing.title);
      setNotes(editing.notes ?? "");
      setResourceId(editing.resource_id ?? "");
      setRoleId(editing.role_id ?? "");
      setStartAt(toDTLocal(editing.start_at));
      setEndAt(toDTLocal(editing.end_at));
      setLinkedType(editing.linked_entity_type ?? "");
      setLinkedId(editing.linked_entity_id ?? null);
      setLinkedLabel(editing.linked_entity_label ?? "");
      setStatus(editing.status);
    } else {
      setType("shift");
      setTitle("");
      setNotes("");
      setResourceId(preset?.resource_id ?? "");
      setRoleId("");
      const base = preset?.date ?? new Date();
      const startD = new Date(base);
      startD.setHours(9, 0, 0, 0);
      const endD = new Date(base);
      endD.setHours(17, 0, 0, 0);
      setStartAt(toDTLocal(startD.toISOString()));
      setEndAt(toDTLocal(endD.toISOString()));
      setLinkedType("");
      setLinkedId(null);
      setLinkedLabel("");
      setStatus("draft");
    }
  }, [open, editing, preset]);

  const requestClose = () => {
    if (saving) return;
    onClose();
  };

  /* Escape closes — unless a confirm dialog is stacked on top. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector('[role="alertdialog"]')) return;
      if (saving) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  /* Live validity of the date pair — shown inline, blocks Save. */
  const startMs = startAt ? Date.parse(startAt) : NaN;
  const endMs = endAt ? Date.parse(endAt) : NaN;
  const datesMissing = !startAt || !endAt || Number.isNaN(startMs) || Number.isNaN(endMs);
  const endBeforeStart = !datesMissing && endMs <= startMs;
  const titleTooLong = title.trim().length > PLANNING_LIMITS.title;
  const invalidKey = datesMissing
    ? "val.required"
    : endBeforeStart
      ? "val.endAfterStart"
      : titleTooLong
        ? "val.titleLong"
        : null;

  const buildPayload = (overrides: Partial<PlanningItem> = {}) => ({
    type,
    title: title.trim(),
    notes: notes.trim() || null,
    resource_id: resourceId || null,
    role_id: roleId || null,
    start_at: new Date(startMs).toISOString(),
    end_at: new Date(endMs).toISOString(),
    linked_entity_type: linkedType || null,
    linked_entity_id: linkedType ? linkedId : null,
    linked_entity_label: linkedType ? linkedLabel.trim() || null : null,
    status,
    ...overrides,
  });

  const submit = async (overrides: Partial<PlanningItem> = {}) => {
    if (saving || readOnly) return;
    if (invalidKey) {
      setError(invalidKey);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(buildPayload(overrides));
    } catch {
      /* The parent already showed a toast; keep the form open and editable. */
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!editing || saving || readOnly) return;
    askConfirm(
      t("modal.deleteConfirm"),
      async () => {
        setSaving(true);
        try {
          await onDelete(editing.id);
        } catch {
          /* toast shown by the parent */
        } finally {
          setSaving(false);
        }
      },
      { confirmLabel: t("btn.delete") },
    );
  };

  const selectCls =
    "w-full h-10 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] disabled:opacity-60";
  const inputCls =
    "w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none disabled:opacity-60";
  const isLegacyLinked = LEGACY_TYPES.has(linkedType);
  const shownError = error ?? (endBeforeStart ? "val.endAfterStart" : null);

  return (
    <Modal
      open={open}
      onClose={requestClose}
      maxWidth="max-w-lg"
      title={editing ? t("modal.edit") : t("modal.new")}
      actions={
        <div className="flex w-full flex-wrap items-center gap-2">
          {!readOnly && (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving}
              aria-busy={saving}
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? t("btn.saving") : editing ? t("btn.save") : t("btn.create")}
            </button>
          )}
          {!readOnly && editing && editing.status === "draft" && (
            <button
              type="button"
              onClick={() => void submit({ status: "published" })}
              disabled={saving}
              className="h-10 px-3 rounded-xl border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-[12px] font-semibold hover:bg-emerald-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {t("btn.publish")}
            </button>
          )}
          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            className="h-10 px-4 rounded-xl text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] text-[13px] font-medium transition-colors disabled:opacity-60"
          >
            {t("btn.cancel")}
          </button>
          {!readOnly && editing && (
            <button
              type="button"
              onClick={remove}
              disabled={saving}
              aria-label={t("btn.delete")}
              className="ms-auto h-10 px-4 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-500/10 text-[13px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-60"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("btn.delete")}</span>
            </button>
          )}
        </div>
      }
    >
      {confirmDialog}
      <fieldset disabled={readOnly || saving} className="space-y-3 min-w-0">
        {readOnly && (
          <p className="text-[12px] text-[var(--text-dim)]">{t("err.forbidden")}</p>
        )}

        {/* Type + Title */}
        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as PlanningItemType)}
            aria-label={t("aria.itemType")}
            className={selectCls}
          >
            {(Object.keys(ITEM_TYPE_LABELS) as PlanningItemType[]).map((k) => (
              <option key={k} value={k}>
                {t(`type.${k}`, ITEM_TYPE_LABELS[k])}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("modal.titlePlaceholder")}
            aria-label={t("aria.itemTitle")}
            maxLength={PLANNING_LIMITS.title}
            className={inputCls}
          />
        </div>

        {/* Resource + Role */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label={t("modal.resource")} htmlFor="pl-resource">
            <select
              id="pl-resource"
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              className={selectCls}
            >
              <option value="">{t("modal.unassignedOption")}</option>
              {(["employee", "room", "vehicle", "material", "other"] as const).map((typ) => {
                const rs = resources.filter((r) => r.is_active && r.type === typ);
                if (!rs.length) return null;
                const labelKey = typ === "employee" ? "sched.employees" : `cfg.resources.type.${typ}`;
                return (
                  <optgroup key={typ} label={t(labelKey).toUpperCase()}>
                    {rs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </Field>
          <Field label={t("modal.role")} htmlFor="pl-role">
            <select
              id="pl-role"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className={selectCls}
            >
              <option value="">{t("modal.noneOption")}</option>
              {roles
                .filter((r) => r.is_active)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label={t("modal.start")} htmlFor="pl-start">
            <input
              id="pl-start"
              type="datetime-local"
              value={startAt}
              required
              onChange={(e) => setStartAt(e.target.value)}
              aria-invalid={!startAt || Number.isNaN(startMs)}
              className={inputCls}
            />
          </Field>
          <Field label={t("modal.end")} htmlFor="pl-end">
            <input
              id="pl-end"
              type="datetime-local"
              value={endAt}
              required
              onChange={(e) => setEndAt(e.target.value)}
              aria-invalid={!endAt || Number.isNaN(endMs) || endBeforeStart}
              aria-describedby={shownError ? "pl-date-error" : undefined}
              className={inputCls}
            />
          </Field>
        </div>
        {shownError && (
          <p id="pl-date-error" role="alert" className="text-[12px] text-red-600 dark:text-red-400">
            {t(shownError)}
          </p>
        )}

        {/* Linked entity — a real picker for every offered type; free text
            only for "other". */}
        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
          <select
            value={linkedType}
            aria-label={t("aria.linkedType")}
            onChange={(e) => {
              setLinkedType(e.target.value);
              // A new kind must not inherit the previous kind's record.
              setLinkedId(null);
              setLinkedLabel("");
            }}
            className={selectCls}
          >
            <option value="">{t("modal.notLinked")}</option>
            <option value="customer">{t("linked.customer")}</option>
            <option value="supplier">{t("linked.supplier")}</option>
            <option value="contact">{t("linked.anyContact")}</option>
            <option value="product">{t("linked.product")}</option>
            <option value="project">{t("linked.project")}</option>
            {isLegacyLinked && (
              <option value={linkedType}>{t(`linked.${linkedType}`)}</option>
            )}
            <option value="other">{t("linked.other")}</option>
          </select>
          {(PICKER_TYPES as string[]).includes(linkedType) ? (
            <EntityPicker
              key={linkedType}
              entityType={linkedType as PickerEntityType}
              entityId={linkedId}
              entityLabel={linkedLabel || null}
              onChange={(id, label, kind) => {
                setLinkedId(id);
                setLinkedLabel(label ?? "");
                /* A generic contact pick stores the contact's real type. */
                if (id && linkedType === "contact" && (kind === "customer" || kind === "supplier")) {
                  setLinkedType(kind);
                }
              }}
              placeholder={t("picker.searchPh")}
            />
          ) : linkedType === "other" ? (
            <input
              value={linkedLabel}
              onChange={(e) => setLinkedLabel(e.target.value)}
              placeholder={t("modal.linkedLabelPlaceholder")}
              aria-label={t("aria.linkedLabel")}
              maxLength={PLANNING_LIMITS.linkedLabel}
              className={inputCls}
            />
          ) : isLegacyLinked ? (
            <div className="h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center text-[13px] text-[var(--text-primary)] truncate">
              {linkedLabel || "—"}
            </div>
          ) : (
            <div className="h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center text-[12px] text-[var(--text-ghost)]">
              —
            </div>
          )}
        </div>

        {/* Notes */}
        <Field label={t("modal.notes")} htmlFor="pl-notes">
          <textarea
            id="pl-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={PLANNING_LIMITS.notes}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none resize-none disabled:opacity-60"
          />
        </Field>

        {/* Status */}
        <Field label={t("modal.status")}>
          <div className="flex gap-1.5 flex-wrap" role="group" aria-label={t("modal.status")}>
            {(["draft", "published", "completed", "cancelled"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                aria-pressed={status === s}
                className={`h-8 px-3 rounded-lg text-[11px] font-semibold border transition-colors ${
                  status === s
                    ? "kx-seg-on bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                    : "kx-seg-off bg-[var(--bg-surface)] text-[var(--text-dim)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t(`status.${s}`)}
              </button>
            ))}
          </div>
        </Field>
      </fieldset>
    </Modal>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
          {label}
        </label>
      ) : (
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
      )}
      {children}
    </div>
  );
}

/** ISO → `<input type="datetime-local">` value using the user's local TZ. */
function toDTLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
