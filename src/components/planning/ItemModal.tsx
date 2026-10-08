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
   the user's edits intact, the parent shows a toast (or the conflict
   dialog), and Save/Publish/Delete are disabled while a request is in
   flight (no double submit).

   Recurrence: a new item (or one not yet in a series) can repeat weekly on
   chosen weekdays until a date — the server expands it into concrete rows
   (lib/planning-recurrence); the live count comes from the same expander.
   A row that belongs to a series asks whether a save / delete applies to
   "this item only" or "this and following".

   Templates: "Start from a template" fills type, title, role, resource and
   the template's times on the chosen day (in the planner's zone).

   Time zone: the start / end inputs read and write wall time on the
   planner's clock (lib/planning-tz) — the same clock as the grid and the
   timeline — not the browser's. A grid cell's `preset.date` is a wall date
   in that zone; a timeline click's `preset.start` is a real instant.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/kds/Modal";
import { useConfirm } from "@/components/kds/useConfirm";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import RepeatIcon from "@/components/icons/ui/RepeatIcon";
import EntityPicker from "@/components/planning/EntityPicker";
import { useTranslation } from "@/lib/i18n";
import { planningT } from "@/lib/translations/planning";
import { fmtDMY } from "@/lib/finance/format";
import { zonedParts, zonedToUtc } from "@/lib/calendar-tz";
import { expandWeekly } from "@/lib/planning-recurrence";
import { plannerNow } from "@/lib/planning-tz";
import {
  ITEM_TYPE_LABELS,
  type PlanningTemplate,
  type RecurrenceInput,
  type SeriesScope,
  type PickerEntityType,
  type PlanningItem,
  type PlanningItemType,
  type PlanningResource,
  type PlanningRole,
} from "@/lib/planning";
import { PLANNING_LIMITS } from "@/lib/planning-validate";

export interface ItemModalPreset {
  resource_id?: string | null;
  /** A wall date in the planner's zone (the grid cell's day). */
  date?: Date;
  /** Exact start (timeline click); end defaults to +1h. */
  start?: Date;
  end?: Date;
}

export interface ItemSaveOptions {
  recurrence?: RecurrenceInput;
  scope?: SeriesScope;
}

/* Monday-first weekday order (JS numbers: 0 = Sunday). */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
/** A Monday, so WEEK_ORDER maps to a real date for localised names. */
const REF_MONDAY = new Date(2026, 0, 5);

function weekdayInZone(ms: number, tz: string): number {
  const p = zonedParts(ms, tz);
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}
function dateKeyInZone(ms: number, tz: string): string {
  const p = zonedParts(ms, tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
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
  templates = [],
  tz,
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
  templates?: PlanningTemplate[];
  /** The planner's zone (start/end inputs, templates, recurrence weekdays). */
  tz: string;
  /** Throws on failure — the modal then stays open. */
  onSave: (payload: Partial<PlanningItem> & { start_at: string; end_at: string }, opts: ItemSaveOptions) => Promise<void>;
  onDelete: (id: string, scope: SeriesScope) => Promise<void>;
}) {
  const { askConfirm, confirmDialog } = useConfirm();
  const { t, lang } = useTranslation(planningT);
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
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [until, setUntil] = useState("");
  const [scope, setScope] = useState<SeriesScope>("this");
  /* The zone the start/end inputs are written in — fixed when the form is
     seeded, so a zone that resolves later never reinterprets them. */
  const [formTz, setFormTz] = useState(tz);
  const inSeries = !!editing?.recurrence_parent_id;
  /* Read through a ref: the zone can resolve a moment after the modal opens
     (bootstrap), and that must not reseed — and wipe — the form. */
  const tzRef = useRef(tz);
  useEffect(() => {
    tzRef.current = tz;
  }, [tz]);

  useEffect(() => {
    if (!open) return;
    /* Seeding the form from the item being opened is a one-shot sync from
       props, not derived state — the user edits these fields afterwards. */
    setError(null);
    setSaving(false);
    setRepeat(false);
    setScope("this");
    const zone = tzRef.current;
    setFormTz(zone);
    /* A new item from a grid cell: 09:00–17:00 on that wall day. */
    const cellDay = preset?.date ?? plannerNow(zone);
    const atCell = (h: number) => zonedToUtc(cellDay.getFullYear(), cellDay.getMonth() + 1, cellDay.getDate(), h, 0, 0, 0, zone);
    {
      const baseMs = editing ? Date.parse(editing.start_at) : preset?.start ? preset.start.getTime() : atCell(9);
      setWeekdays([weekdayInZone(baseMs, zone)]);
      setUntil(dateKeyInZone(baseMs + 27 * 86_400_000, zone));
    }
    if (editing) {
      setType(editing.type);
      setTitle(editing.title);
      setNotes(editing.notes ?? "");
      setResourceId(editing.resource_id ?? "");
      setRoleId(editing.role_id ?? "");
      setStartAt(toDTLocal(editing.start_at, zone));
      setEndAt(toDTLocal(editing.end_at, zone));
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
      const startMs0 = preset?.start ? preset.start.getTime() : atCell(9);
      const endMs0 = preset?.end ? preset.end.getTime() : preset?.start ? startMs0 + 3_600_000 : atCell(17);
      setStartAt(toDTLocal(new Date(startMs0).toISOString(), zone));
      setEndAt(toDTLocal(new Date(endMs0).toISOString(), zone));
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
  const startMs = fromDTLocal(startAt, formTz);
  const endMs = fromDTLocal(endAt, formTz);
  const datesMissing = !startAt || !endAt || Number.isNaN(startMs) || Number.isNaN(endMs);
  const endBeforeStart = !datesMissing && endMs <= startMs;
  const titleTooLong = title.trim().length > PLANNING_LIMITS.title;
  const canRepeat = !readOnly && !inSeries;
  const recurrence: RecurrenceInput | undefined = canRepeat && repeat ? { weekdays, until } : undefined;
  const occurrences = useMemo(() => {
    if (!canRepeat || !repeat || datesMissing || endBeforeStart || !until || weekdays.length === 0) return null;
    return expandWeekly(new Date(startMs).toISOString(), new Date(endMs).toISOString(), { weekdays, until }, tz)?.length ?? null;
  }, [canRepeat, repeat, datesMissing, endBeforeStart, until, weekdays, startMs, endMs, tz]);
  const invalidKey = datesMissing
    ? "val.required"
    : endBeforeStart
      ? "val.endAfterStart"
      : titleTooLong
        ? "val.titleLong"
        : recurrence && occurrences == null
          ? "val.recurrence"
          : null;

  /** Fill the form from a template, on the day currently chosen. */
  const applyTemplate = (id: string) => {
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    const dayMs = Number.isNaN(startMs) ? Date.now() : startMs;
    const p = zonedParts(dayMs, formTz);
    const [h, mi] = tpl.start_time.split(":").map(Number);
    const s0 = zonedToUtc(p.y, p.m, p.d, h, mi, 0, 0, formTz);
    const e0 = s0 + tpl.duration_hours * 3_600_000;
    setType(tpl.type);
    if (!title.trim()) setTitle(tpl.name);
    if (tpl.role_id) setRoleId(tpl.role_id);
    if (tpl.resource_id && !resourceId) setResourceId(tpl.resource_id);
    if (tpl.default_note && !notes.trim()) setNotes(tpl.default_note);
    setStartAt(toDTLocal(new Date(s0).toISOString(), formTz));
    setEndAt(toDTLocal(new Date(e0).toISOString(), formTz));
  };

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
      await onSave(buildPayload(overrides), { recurrence, scope: inSeries ? scope : undefined });
    } catch {
      /* The parent already showed a toast; keep the form open and editable. */
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!editing || saving || readOnly) return;
    askConfirm(
      inSeries && scope === "future" ? t("rec.deleteSeries") : t("modal.deleteConfirm"),
      async () => {
        setSaving(true);
        try {
          await onDelete(editing.id, inSeries ? scope : "this");
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

        {/* Start from a template (new items) */}
        {!editing && templates.length > 0 && (
          <select
            value=""
            onChange={(e) => applyTemplate(e.target.value)}
            aria-label={t("modal.template")}
            className={selectCls}
          >
            <option value="">{t("modal.template")}…</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name} · {tpl.start_time}–{tpl.end_time}
              </option>
            ))}
          </select>
        )}

        {/* Series scope (rows of a recurring series) */}
        {inSeries && !readOnly && (
          <div className="rounded-lg border border-[#567FB2]/30 bg-[#567FB2]/[0.06] px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#567FB2] dark:text-[#7FA9D6]">
              <RepeatIcon size={12} />
              {t("rec.series")}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span id="pl-scope-label" className="text-[11px] text-[var(--text-dim)]">{t("rec.applyTo")}</span>
              <div role="radiogroup" aria-labelledby="pl-scope-label" className="flex gap-1">
                {(["this", "future"] as const).map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    role="radio"
                    aria-checked={scope === sc}
                    onClick={() => setScope(sc)}
                    className={`h-7 px-2.5 rounded-md text-[11px] font-semibold border transition-colors ${
                      scope === sc
                        ? "kx-seg-on bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                        : "kx-seg-off bg-[var(--bg-surface)] text-[var(--text-dim)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {t(sc === "this" ? "rec.this" : "rec.future")}
                  </button>
                ))}
              </div>
            </div>
          </div>
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

        {/* Weekly recurrence */}
        {canRepeat && (
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={repeat}
                onChange={(e) => setRepeat(e.target.checked)}
                className="h-4 w-4 accent-[#567FB2]"
              />
              <RepeatIcon size={12} className="text-[var(--text-dim)]" />
              {t("rec.repeat")}
            </label>
            {repeat && (
              <div className="ps-6 space-y-2">
                <div className="space-y-1">
                  <div id="pl-rec-days" className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("rec.on")}</div>
                  <div role="group" aria-labelledby="pl-rec-days" className="flex gap-1 flex-wrap">
                    {WEEK_ORDER.map((wd, i) => {
                      const on = weekdays.includes(wd);
                      const d = new Date(REF_MONDAY);
                      d.setDate(REF_MONDAY.getDate() + i);
                      return (
                        <button
                          key={wd}
                          type="button"
                          aria-pressed={on}
                          aria-label={d.toLocaleDateString(lang, { weekday: "long" })}
                          onClick={() => setWeekdays((cur) => (on ? cur.filter((x) => x !== wd) : [...cur, wd]))}
                          className={`h-8 min-w-9 px-2 rounded-lg text-[11px] font-semibold border transition-colors ${
                            on
                              ? "kx-seg-on bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
                              : "kx-seg-off bg-[var(--bg-surface)] text-[var(--text-dim)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {d.toLocaleDateString(lang, { weekday: "short" })}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
                  <Field label={t("rec.until")} htmlFor="pl-rec-until">
                    <input
                      id="pl-rec-until"
                      type="date"
                      value={until}
                      onChange={(e) => setUntil(e.target.value)}
                      aria-invalid={occurrences == null}
                      className={inputCls}
                    />
                  </Field>
                  <p className="text-[12px] text-[var(--text-dim)] pb-2.5" aria-live="polite">
                    {until ? fmtDMY(new Date(`${until}T00:00:00`)) : "—"}
                    {occurrences != null ? ` · ${t("rec.count").replace("{n}", String(occurrences))}` : ""}
                  </p>
                </div>
              </div>
            )}
          </div>
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

/** ISO → `<input type="datetime-local">` value on the planner's clock. */
function toDTLocal(iso: string, tz: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const p = zonedParts(ms, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** `<input type="datetime-local">` value on the planner's clock → ms (NaN when empty/invalid). */
function fromDTLocal(v: string, tz: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(v);
  if (!m) return NaN;
  return zonedToUtc(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0), 0, tz);
}
