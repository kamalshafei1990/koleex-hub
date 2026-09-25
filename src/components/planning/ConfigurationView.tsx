"use client";

/* ---------------------------------------------------------------------------
   ConfigurationView — roles + non-employee resources. Split out of
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
import { useTranslation } from "@/lib/i18n";
import { planningT } from "@/lib/translations/planning";
import {
  createResource,
  createRole,
  deleteResource,
  deleteRole,
  updateResource,
  updateRole,
  type PlanningResource,
  type PlanningResourceType,
  type PlanningRole,
} from "@/lib/planning";

type Reload = () => Promise<void>;
type OnError = (e: unknown) => void;

export default function ConfigurationView({
  roles,
  resources,
  onRolesChanged,
  onResourcesChanged,
  onError,
}: {
  roles: PlanningRole[];
  resources: PlanningResource[];
  onRolesChanged: Reload;
  onResourcesChanged: Reload;
  onError: OnError;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <RoleConfig roles={roles} onReload={onRolesChanged} onError={onError} />
      <ResourceConfig resources={resources} onReload={onResourcesChanged} onError={onError} />
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
