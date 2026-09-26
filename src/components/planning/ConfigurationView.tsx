"use client";

/* ---------------------------------------------------------------------------
   ConfigurationView — roles, non-employee resources and shift templates.
   Split out of
   PlanningApp and loaded with next/dynamic (only the Configuration tab
   needs it).

   Every mutation reports failure through `onError` (the app's toast) and
   refetches only the list it touched — roles or resources, never the week.
   Add buttons are disabled while their request is in flight.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import { useConfirm } from "@/components/kds/useConfirm";
import { useInput } from "@/components/kds/useInput";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import CogIcon from "@/components/icons/ui/CogIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import { useTranslation } from "@/lib/i18n";
import { planningT } from "@/lib/translations/planning";
import {
  createResource,
  createRole,
  createTemplate,
  deleteResource,
  deleteRole,
  deleteTemplate,
  ITEM_TYPE_LABELS,
  updateResource,
  updateRole,
  updateTemplate,
  type PlanningItemType,
  type PlanningTemplate,
  type TemplateInput,
  type PlanningResource,
  type PlanningResourceType,
  type PlanningRole,
} from "@/lib/planning";

type Reload = () => Promise<void>;
type OnError = (e: unknown) => void;

export default function ConfigurationView({
  roles,
  resources,
  templates,
  onRolesChanged,
  onResourcesChanged,
  onTemplatesChanged,
  onError,
}: {
  roles: PlanningRole[];
  resources: PlanningResource[];
  templates: PlanningTemplate[];
  onRolesChanged: Reload;
  onResourcesChanged: Reload;
  onTemplatesChanged: Reload;
  onError: OnError;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <RoleConfig roles={roles} onReload={onRolesChanged} onError={onError} />
      <ResourceConfig resources={resources} onReload={onResourcesChanged} onError={onError} />
      <TemplateConfig templates={templates} roles={roles} resources={resources} onReload={onTemplatesChanged} onError={onError} />
    </div>
  );
}

/* ── Shift templates ─────────────────────────────────────────────────── */

/* 15-minute slots, always 24-hour (a native time input follows the OS
   locale and shows AM/PM on many machines). */
const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);

const EMPTY_TPL: TemplateInput = {
  name: "",
  type: "shift",
  start_time: "09:00",
  end_time: "17:00",
  role_id: null,
  resource_id: null,
  color: "#567FB2",
};

function TemplateConfig({
  templates,
  roles,
  resources,
  onReload,
  onError,
}: {
  templates: PlanningTemplate[];
  roles: PlanningRole[];
  resources: PlanningResource[];
  onReload: Reload;
  onError: OnError;
}) {
  const { t } = useTranslation(planningT);
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const add = async (v: TemplateInput) => {
    if (busy) return;
    setBusy(true);
    try {
      await createTemplate(v);
      setFormKey((k) => k + 1);
      await onReload();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-3 lg:col-span-2">
      <div className="flex items-center gap-2">
        <LayersIcon size={14} className="text-[var(--text-dim)]" />
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{t("cfg.tpl.title")}</h3>
      </div>
      <p className="text-[11px] text-[var(--text-dim)]">{t("cfg.tpl.help")}</p>

      <TemplateForm key={formKey} initial={EMPTY_TPL} roles={roles} resources={resources} busy={busy} submitLabel={t("btn.add")} onSubmit={add} />

      <div className="space-y-1.5 pt-1">
        {templates.map((tpl) => (
          <TemplateRow key={tpl.id} tpl={tpl} roles={roles} resources={resources} onReload={onReload} onError={onError} />
        ))}
        {templates.length === 0 && <div className="text-[12px] text-[var(--text-dim)] py-3">{t("cfg.tpl.empty")}</div>}
      </div>
    </div>
  );
}

function TemplateForm({
  initial,
  roles,
  resources,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: TemplateInput;
  roles: PlanningRole[];
  resources: PlanningResource[];
  busy: boolean;
  submitLabel: string;
  onSubmit: (v: TemplateInput) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const { t } = useTranslation(planningT);
  const [v, setV] = useState<TemplateInput>(initial);
  const set = <K extends keyof TemplateInput>(k: K, val: TemplateInput[K]) => setV((cur) => ({ ...cur, [k]: val }));
  const cls = "h-9 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] min-w-0";
  const overnight = v.end_time <= v.start_time;
  const submit = () => {
    if (!v.name.trim() || busy) return;
    void onSubmit({ ...v, name: v.name.trim() });
  };
  return (
    <div className="grid grid-cols-2 sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto_minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5 sm:gap-2 items-center">
      <input
        type="color"
        value={v.color ?? "#567FB2"}
        onChange={(e) => set("color", e.target.value)}
        aria-label={t("aria.color")}
        className="h-9 w-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] cursor-pointer"
      />
      <input
        value={v.name}
        onChange={(e) => set("name", e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        placeholder={t("cfg.tpl.placeholder")}
        aria-label={t("cfg.tpl.name")}
        maxLength={120}
        className={`${cls} px-3 outline-none`}
      />
      <select value={v.type} onChange={(e) => set("type", e.target.value as PlanningItemType)} aria-label={t("aria.itemType")} className={cls}>
        {(Object.keys(ITEM_TYPE_LABELS) as PlanningItemType[]).map((k) => (
          <option key={k} value={k}>{t(`type.${k}`, ITEM_TYPE_LABELS[k])}</option>
        ))}
      </select>
      <select value={v.start_time} onChange={(e) => set("start_time", e.target.value)} aria-label={t("cfg.tpl.start")} className={`${cls} tabular-nums`}>
        {TIME_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <div className="flex items-center gap-1">
        <select value={v.end_time} onChange={(e) => set("end_time", e.target.value)} aria-label={t("cfg.tpl.end")} className={`${cls} tabular-nums`}>
          {TIME_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {overnight && <span className="text-[10px] font-semibold text-[var(--text-dim)] whitespace-nowrap">{t("cfg.tpl.nextDay")}</span>}
      </div>
      <select value={v.role_id ?? ""} onChange={(e) => set("role_id", e.target.value || null)} aria-label={t("modal.role")} className={cls}>
        <option value="">{t("modal.noneOption")}</option>
        {roles.filter((r) => r.is_active).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <select value={v.resource_id ?? ""} onChange={(e) => set("resource_id", e.target.value || null)} aria-label={t("modal.resource")} className={cls}>
        <option value="">{t("cfg.tpl.anyResource")}</option>
        {resources.filter((r) => r.is_active).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <div className="flex items-center gap-1 justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !v.name.trim()}
          className="h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("aria.cancelEdit")}
            title={t("aria.cancelEdit")}
            className="h-9 w-9 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"
          >
            <CrossIcon size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function TemplateRow({
  tpl,
  roles,
  resources,
  onReload,
  onError,
}: {
  tpl: PlanningTemplate;
  roles: PlanningRole[];
  resources: PlanningResource[];
  onReload: Reload;
  onError: OnError;
}) {
  const { t } = useTranslation(planningT);
  const { askConfirm, confirmDialog } = useConfirm();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const role = roles.find((r) => r.id === tpl.role_id);
  const res = resources.find((r) => r.id === tpl.resource_id);

  const save = async (v: TemplateInput) => {
    setBusy(true);
    try {
      await updateTemplate(tpl.id, v);
      setEditing(false);
      await onReload();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  const remove = () =>
    askConfirm(
      t("cfg.tpl.deleteConfirm"),
      async () => {
        try {
          await deleteTemplate(tpl.id);
          await onReload();
        } catch (e) {
          onError(e);
        }
      },
      { confirmLabel: t("btn.delete") },
    );

  if (editing) {
    return (
      <div className="px-2.5 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
        <TemplateForm
          initial={{ name: tpl.name, type: tpl.type, start_time: tpl.start_time, end_time: tpl.end_time, role_id: tpl.role_id, resource_id: tpl.resource_id, color: tpl.color }}
          roles={roles}
          resources={resources}
          busy={busy}
          submitLabel={t("btn.save")}
          onSubmit={save}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
      {confirmDialog}
      <div className="w-2 h-6 rounded-full shrink-0" style={{ background: tpl.color ?? role?.color ?? "var(--border-subtle)" }} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{tpl.name}</div>
        <div className="text-[10px] text-[var(--text-dim)] truncate tabular-nums">
          {tpl.start_time}–{tpl.end_time}
          {tpl.end_time <= tpl.start_time ? ` ${t("cfg.tpl.nextDay")}` : ""} · {t(`type.${tpl.type}`, tpl.type)}
          {role ? ` · ${role.name}` : ""}
          {res ? ` · ${res.name}` : ""}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`${t("aria.edit")}: ${tpl.name}`}
        title={t("aria.edit")}
        className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"
      >
        <PencilIcon className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={remove}
        aria-label={`${t("aria.delete")}: ${tpl.name}`}
        title={t("aria.delete")}
        className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-rose-500 flex items-center justify-center"
      >
        <TrashIcon className="h-3 w-3" />
      </button>
    </div>
  );
}

function RoleConfig({ roles, onReload, onError }: { roles: PlanningRole[]; onReload: Reload; onError: OnError }) {
  const { t } = useTranslation(planningT);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#60a5fa");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await createRole({ name: name.trim(), color });
      setName("");
      await onReload();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UsersIcon size={14} className="text-[var(--text-dim)]" />
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{t("cfg.roles.title")}</h3>
      </div>
      <p className="text-[11px] text-[var(--text-dim)]">{t("cfg.roles.help")}</p>

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label={t("aria.color")}
          className="h-9 w-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] cursor-pointer"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
          placeholder={t("cfg.roles.placeholder")}
          aria-label={t("aria.roleName")}
          maxLength={120}
          className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none"
        />
        <button
          type="button"
          onClick={() => void add()}
          disabled={busy || !name.trim()}
          className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("btn.add")}
        </button>
      </div>

      <div className="space-y-1.5 pt-1">
        {roles.map((r) => (
          <RoleRow key={r.id} role={r} onReload={onReload} onError={onError} />
        ))}
        {roles.length === 0 && (
          <div className="text-[12px] text-[var(--text-dim)] py-3">{t("cfg.roles.empty")}</div>
        )}
      </div>
    </div>
  );
}

function RoleRow({ role, onReload, onError }: { role: PlanningRole; onReload: Reload; onError: OnError }) {
  const { t } = useTranslation(planningT);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(role.name);
  const [color, setColor] = useState(role.color ?? "#60a5fa");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      await updateRole(role.id, { name: name.trim(), color });
      setEditing(false);
      await onReload();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  const { askConfirm, confirmDialog } = useConfirm();
  const remove = () =>
    askConfirm(
      t("cfg.roles.deleteConfirm"),
      async () => {
        try {
          await deleteRole(role.id);
          await onReload();
        } catch (e) {
          onError(e);
        }
      },
      { confirmLabel: t("btn.delete") },
    );

  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
      {confirmDialog}
      {editing ? (
        <>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label={t("aria.color")}
            className="h-7 w-8 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void save(); }}
            aria-label={t("aria.roleName")}
            maxLength={120}
            className="flex-1 min-w-0 h-7 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none"
          />
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="h-7 px-2.5 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11px] font-semibold disabled:opacity-50"
          >
            {t("btn.save")}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            aria-label={t("aria.cancelEdit")}
            title={t("aria.cancelEdit")}
            className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"
          >
            <CrossIcon size={12} />
          </button>
        </>
      ) : (
        <>
          <div className="w-2 h-6 rounded-full" style={{ background: role.color ?? "var(--border-subtle)" }} />
          <div className="flex-1 min-w-0 truncate text-[12px] font-semibold text-[var(--text-primary)]">{role.name}</div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`${t("aria.edit")}: ${role.name}`}
            title={t("aria.edit")}
            className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"
          >
            <PencilIcon className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={remove}
            aria-label={`${t("aria.delete")}: ${role.name}`}
            title={t("aria.delete")}
            className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-rose-500 flex items-center justify-center"
          >
            <TrashIcon className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  );
}

function ResourceConfig({
  resources,
  onReload,
  onError,
}: {
  resources: PlanningResource[];
  onReload: Reload;
  onError: OnError;
}) {
  const { t } = useTranslation(planningT);
  const [type, setType] = useState<PlanningResourceType>("room");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await createResource({ type, name: name.trim(), description: null });
      setName("");
      await onReload();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const nonEmployeeRes = resources.filter((r) => r.type !== "employee");
  const employees = resources.filter((r) => r.type === "employee");

  return (
    <div className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CogIcon size={14} className="text-[var(--text-dim)]" />
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{t("cfg.resources.title")}</h3>
      </div>
      <p className="text-[11px] text-[var(--text-dim)]">{t("cfg.resources.help")}</p>

      <div className="grid grid-cols-[90px_1fr_auto] sm:grid-cols-[110px_1fr_auto] gap-1.5 sm:gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as PlanningResourceType)}
          aria-label={t("aria.resourceType")}
          className="h-9 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] min-w-0"
        >
          <option value="room">{t("cfg.resources.type.room")}</option>
          <option value="vehicle">{t("cfg.resources.type.vehicle")}</option>
          <option value="material">{t("cfg.resources.type.material")}</option>
          <option value="other">{t("cfg.resources.type.other")}</option>
        </select>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
          placeholder={t("cfg.resources.placeholder")}
          aria-label={t("aria.resourceName")}
          maxLength={200}
          className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none min-w-0"
        />
        <button
          type="button"
          onClick={() => void add()}
          disabled={busy || !name.trim()}
          className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("btn.add")}
        </button>
      </div>

      <div className="space-y-1.5 pt-1">
        {nonEmployeeRes.map((r) => (
          <ResourceRow key={r.id} resource={r} onReload={onReload} onError={onError} />
        ))}
        {nonEmployeeRes.length === 0 && (
          <div className="text-[12px] text-[var(--text-dim)] py-3">{t("cfg.resources.empty")}</div>
        )}
      </div>

      <div className="pt-3 border-t border-[var(--border-subtle)]">
        <div className="text-[11px] text-[var(--text-dim)] mb-1">{t("cfg.resources.syncedLabel")}</div>
        <div className="flex flex-wrap gap-1.5">
          {employees.map((r) => (
            <span
              key={r.id}
              className="px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)]"
            >
              {r.name}
            </span>
          ))}
          {employees.length === 0 && (
            <span className="text-[11px] text-[var(--text-dim)]">{t("cfg.resources.syncedEmpty")}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ResourceRow({ resource, onReload, onError }: { resource: PlanningResource; onReload: Reload; onError: OnError }) {
  const { t } = useTranslation(planningT);
  const { askConfirm, confirmDialog } = useConfirm();
  const remove = () =>
    askConfirm(
      t("cfg.resources.deleteConfirm"),
      async () => {
        try {
          await deleteResource(resource.id);
          await onReload();
        } catch (e) {
          onError(e);
        }
      },
      { confirmLabel: t("btn.delete") },
    );
  const { askInput, inputDialog } = useInput();
  const rename = () =>
    askInput(
      t("cfg.resources.renamePrompt"),
      async (next) => {
        const v = next?.trim();
        if (!v || v === resource.name) return;
        try {
          await updateResource(resource.id, { name: v });
          await onReload();
        } catch (e) {
          onError(e);
        }
      },
      { initial: resource.name, confirmLabel: t("btn.save", "Save") },
    );
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
      {confirmDialog}
      {inputDialog}
      <span className="px-1.5 py-0.5 rounded-md bg-[var(--bg-surface)] text-[9px] uppercase tracking-wider font-bold text-[var(--text-dim)] border border-[var(--border-subtle)]">
        {t(`cfg.resources.type.${resource.type}`, resource.type)}
      </span>
      <div className="flex-1 min-w-0 text-[12px] font-semibold text-[var(--text-primary)] truncate">{resource.name}</div>
      <button
        type="button"
        onClick={rename}
        aria-label={`${t("aria.rename")}: ${resource.name}`}
        title={t("aria.rename")}
        className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"
      >
        <PencilIcon className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={remove}
        aria-label={`${t("aria.delete")}: ${resource.name}`}
        title={t("aria.delete")}
        className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-rose-500 flex items-center justify-center"
      >
        <TrashIcon className="h-3 w-3" />
      </button>
    </div>
  );
}
