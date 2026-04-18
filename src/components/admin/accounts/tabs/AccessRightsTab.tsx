"use client";

/* ---------------------------------------------------------------------------
   AccessRightsTab — Granular per-module permission grid for an account.

   Redesigned to match the Roles page checkbox matrix:
     - View / Add / Edit / Delete checkboxes per module
     - Data Scope selector per module (Own / Department / All)
     - Override indicator when module differs from role defaults
     - Grouped by the same 8 permission groups as the Roles page
     - Sub-module support for apps with internal features

   Data model:
     - Role's koleex_permissions define the baseline for every module.
     - account_permission_overrides holds sparse overrides per (account, module).
     - Absence of an override row = "use role default".
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import UndoIcon from "@/components/icons/ui/UndoIcon";
import EyeOffIcon from "@/components/icons/ui/EyeOffIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import type {
  AccountWithLinks,
  AccountPermissionOverrideRow,
  DataScope,
  RoleRow,
} from "@/types/supabase";
import { replacePermissionOverrides, fetchRoles } from "@/lib/accounts-admin";
import { createRole, upsertPermissions } from "@/lib/management-admin";
import { fetchPermissions, type PermissionRow } from "@/lib/management-admin";
import { APP_REGISTRY } from "@/lib/navigation";
import { useTranslation } from "@/lib/i18n";
import { accountsT } from "@/lib/translations/accounts";
import {
  tabCardClass,
  tabSectionTitle,
  TabActionBar,
} from "./shared";

/* ═══════════════════════════════════════════════════
   PERMISSION GROUPS — same as the Roles page
   ═══════════════════════════════════════════════════ */

interface SubModule {
  name: string;
  description: string;
}

interface ModuleWithSubs {
  name: string;
  subs?: SubModule[];
}

const PERMISSION_GROUPS: { key: string; label: string; modules: ModuleWithSubs[] }[] = [
  {
    key: "operations",
    label: "Operations",
    modules: [
      { name: "Products", subs: [
        { name: "Products > Categories", description: "Product categories & subcategories" },
        { name: "Products > Brands", description: "Brand management" },
        { name: "Products > Cost Price", description: "View cost/supplier pricing" },
      ]},
      { name: "Inventory" },
      { name: "Purchase" },
      { name: "Landed Cost" },
      { name: "Catalogs" },
      { name: "Documents" },
    ],
  },
  {
    key: "commercial",
    label: "Commercial",
    modules: [
      { name: "Sales" },
      { name: "CRM" },
      { name: "Quotations" },
      { name: "Invoices" },
      { name: "Customers" },
      { name: "Suppliers" },
      { name: "Contacts" },
      { name: "Markets" },
    ],
  },
  { key: "finance", label: "Finance", modules: [{ name: "Finance" }, { name: "Expenses" }] },
  {
    key: "people",
    label: "People",
    modules: [
      { name: "Management" },
      { name: "Employees" },
      { name: "HR" },
      { name: "Recruitment" },
      { name: "Appraisals" },
      { name: "Attendance" },
    ],
  },
  {
    key: "communication",
    label: "Communication",
    modules: [{ name: "Discuss" }, { name: "Calendar" }, { name: "To-do" }, { name: "Koleex Mail" }],
  },
  {
    key: "marketing",
    label: "Marketing & Growth",
    modules: [{ name: "Website" }, { name: "Marketing" }, { name: "Events" }],
  },
  {
    key: "planning",
    label: "Planning & Knowledge",
    modules: [{ name: "Planning" }, { name: "Projects" }, { name: "Knowledge" }, { name: "AI" }],
  },
  {
    key: "system",
    label: "System",
    modules: [{ name: "Accounts" }, { name: "Settings" }, { name: "Brands" }, { name: "Price Calculator" }, { name: "Dashboard" }],
  },
];

// Flat list of all module names including sub-modules
const ALL_MODULES: string[] = PERMISSION_GROUPS.flatMap((g) =>
  g.modules.flatMap((m) => [m.name, ...(m.subs?.map((s) => s.name) || [])]),
);

const DATA_SCOPES: { value: DataScope; labelKey: string; descKey: string }[] = [
  { value: "own", labelKey: "acc.access.scopeOwn", descKey: "acc.access.scopeOwnDesc" },
  { value: "department", labelKey: "acc.access.scopeDept", descKey: "acc.access.scopeDeptDesc" },
  { value: "all", labelKey: "acc.access.scopeAll", descKey: "acc.access.scopeAllDesc" },
];

/* ═══════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════ */

interface ModulePerms {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  data_scope: DataScope;
}

const EMPTY_PERMS: ModulePerms = {
  can_view: false,
  can_create: false,
  can_edit: false,
  can_delete: false,
  data_scope: "own",
};

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */

function getAppIcon(moduleName: string) {
  const base = moduleName.includes(" > ") ? moduleName.split(" > ")[0] : moduleName;
  const app = APP_REGISTRY.find(
    (a) => a.name === base || a.name.toLowerCase() === base.toLowerCase(),
  );
  return app?.icon || null;
}

function permsEqual(a: ModulePerms, b: ModulePerms): boolean {
  return (
    a.can_view === b.can_view &&
    a.can_create === b.can_create &&
    a.can_edit === b.can_edit &&
    a.can_delete === b.can_delete &&
    a.data_scope === b.data_scope
  );
}

function hasAnyPerm(p: ModulePerms): boolean {
  return p.can_view || p.can_create || p.can_edit || p.can_delete;
}

function isFullAccess(p: ModulePerms): boolean {
  return p.can_view && p.can_create && p.can_edit && p.can_delete;
}

/* ═══════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════ */

interface Props {
  account: AccountWithLinks;
  onChanged?: (overrides: AccountPermissionOverrideRow[]) => void;
}

export default function AccessRightsTab({ account, onChanged }: Props) {
  const { t } = useTranslation(accountsT);
  const [rolePerms, setRolePerms] = useState<Record<string, ModulePerms>>({});
  const [perms, setPerms] = useState<Record<string, ModulePerms>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [allRoles, setAllRoles] = useState<RoleRow[]>([]);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  // Load role permissions + merge with account overrides
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      // 1. Fetch role's base permissions
      const roleId = account.role_id;
      let roleRows: PermissionRow[] = [];
      if (roleId) {
        roleRows = await fetchPermissions(roleId);
      }

      // Build role defaults map
      const defaults: Record<string, ModulePerms> = {};
      ALL_MODULES.forEach((m) => { defaults[m] = { ...EMPTY_PERMS }; });
      roleRows.forEach((r) => {
        if (defaults[r.module_name] !== undefined) {
          defaults[r.module_name] = {
            can_view: r.can_view,
            can_create: r.can_create,
            can_edit: r.can_edit,
            can_delete: r.can_delete,
            data_scope: (r.data_scope as DataScope) || "own",
          };
        }
      });

      // 2. Build effective perms = role defaults + account overrides
      const effective: Record<string, ModulePerms> = {};
      ALL_MODULES.forEach((m) => { effective[m] = { ...defaults[m] }; });

      for (const o of account.overrides) {
        if (effective[o.module_key] !== undefined) {
          effective[o.module_key] = {
            can_view: o.can_view,
            can_create: o.can_create,
            can_edit: o.can_edit,
            can_delete: o.can_delete,
            data_scope: o.data_scope || "own",
          };
        }
      }

      if (!cancelled) {
        setRolePerms(defaults);
        setPerms(effective);
        setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [account.role_id, account.overrides]);

  // Fetch all roles for the template selector
  useEffect(() => {
    fetchRoles().then(setAllRoles);
  }, []);

  // Save the current perm grid as a NEW role template. Prompts for a
  // name, creates a row in koleex_roles, upserts all the module perms
  // against that new role, then refreshes the dropdown. The result is
  // a reusable template other admins can pick from this same dropdown.
  const saveAsNewTemplate = useCallback(async () => {
    const name = window.prompt(
      "Name for the new role template (you can rename later in Roles & Permissions):",
      "",
    );
    const trimmed = name?.trim();
    if (!trimmed) return;

    setApplyingTemplate(true);
    const { data: newRole, error: createErr } = await createRole({
      name: trimmed,
      description: `Template created from ${account.username}'s access rights`,
    });
    if (createErr || !newRole) {
      setApplyingTemplate(false);
      setError(createErr || "Couldn't create template");
      return;
    }

    // Push the current grid into koleex_permissions for the new role.
    const rows = ALL_MODULES.map((m) => {
      const p = perms[m] || EMPTY_PERMS;
      return {
        module_name: m,
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
        data_scope: p.data_scope ?? "own",
      };
    });
    await upsertPermissions(newRole.id, rows);

    // Refresh the dropdown so the new template shows up.
    const refreshed = await fetchRoles();
    setAllRoles(refreshed);
    setApplyingTemplate(false);
    setToast(`Template "${trimmed}" created. Find it in Roles & Permissions.`);
  }, [account.username, perms]);

  // Apply a role template: load that role's permissions and fill all checkboxes
  const applyRoleTemplate = useCallback(async (roleId: string) => {
    if (!roleId) return;
    setApplyingTemplate(true);
    const templatePerms = await fetchPermissions(roleId);
    const next: Record<string, ModulePerms> = {};
    ALL_MODULES.forEach((m) => { next[m] = { ...EMPTY_PERMS }; });
    templatePerms.forEach((r) => {
      if (next[r.module_name] !== undefined) {
        next[r.module_name] = {
          can_view: r.can_view,
          can_create: r.can_create,
          can_edit: r.can_edit,
          can_delete: r.can_delete,
          data_scope: (r.data_scope as DataScope) || "own",
        };
      }
    });
    setPerms(next);
    setApplyingTemplate(false);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const tid = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(tid);
  }, [toast]);

  // Dirty check: has anything changed from initial state?
  const initialPerms = useMemo(() => {
    const initial: Record<string, ModulePerms> = {};
    ALL_MODULES.forEach((m) => { initial[m] = { ...rolePerms[m] || EMPTY_PERMS }; });
    for (const o of account.overrides) {
      if (initial[o.module_key] !== undefined) {
        initial[o.module_key] = {
          can_view: o.can_view,
          can_create: o.can_create,
          can_edit: o.can_edit,
          can_delete: o.can_delete,
          data_scope: o.data_scope || "own",
        };
      }
    }
    return initial;
  }, [rolePerms, account.overrides]);

  const dirty = useMemo(() => {
    return ALL_MODULES.some((m) => !permsEqual(perms[m] || EMPTY_PERMS, initialPerms[m] || EMPTY_PERMS));
  }, [perms, initialPerms]);

  function isOverridden(mod: string): boolean {
    const current = perms[mod];
    const roleDefault = rolePerms[mod];
    if (!current || !roleDefault) return false;
    return !permsEqual(current, roleDefault);
  }

  // Toggle functions
  function toggle(mod: string, field: keyof Omit<ModulePerms, "data_scope">) {
    setPerms((prev) => ({
      ...prev,
      [mod]: { ...prev[mod], [field]: !prev[mod]?.[field] },
    }));
  }

  function toggleFullAccess(mod: string) {
    const p = perms[mod] || EMPTY_PERMS;
    const allOn = isFullAccess(p);
    setPerms((prev) => ({
      ...prev,
      [mod]: { ...prev[mod], can_view: !allOn, can_create: !allOn, can_edit: !allOn, can_delete: !allOn },
    }));
  }

  function toggleGroupAll(group: typeof PERMISSION_GROUPS[0]) {
    const allMods = group.modules.flatMap((m) => [m.name, ...(m.subs?.map((s) => s.name) || [])]);
    const allOn = allMods.every((m) => isFullAccess(perms[m] || EMPTY_PERMS));
    setPerms((prev) => {
      const next = { ...prev };
      allMods.forEach((m) => {
        next[m] = { ...(next[m] || EMPTY_PERMS), can_view: !allOn, can_create: !allOn, can_edit: !allOn, can_delete: !allOn };
      });
      return next;
    });
  }

  function setScope(mod: string, scope: DataScope) {
    setPerms((prev) => ({ ...prev, [mod]: { ...prev[mod], data_scope: scope } }));
  }

  /** One-click hide: clear all V/C/E/D for this module so the app
   *  disappears from this account. Click again to un-hide — restores
   *  view-only permission (same semantics as the /roles page). */
  function toggleHide(mod: string) {
    setPerms((prev) => {
      const p = prev[mod] ?? EMPTY_PERMS;
      const isHidden = !p.can_view && !p.can_create && !p.can_edit && !p.can_delete;
      return {
        ...prev,
        [mod]: {
          can_view: isHidden,
          can_create: false,
          can_edit: false,
          can_delete: false,
          data_scope: p.data_scope ?? "own",
        },
      };
    });
  }

  function resetModule(mod: string) {
    setPerms((prev) => ({ ...prev, [mod]: { ...(rolePerms[mod] || EMPTY_PERMS) } }));
  }

  function resetAll() {
    const reset: Record<string, ModulePerms> = {};
    ALL_MODULES.forEach((m) => { reset[m] = { ...(initialPerms[m] || EMPTY_PERMS) }; });
    setPerms(reset);
  }

  function toggleGroupCollapse(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  function toggleSubExpand(modName: string) {
    setExpandedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(modName)) next.delete(modName); else next.add(modName);
      return next;
    });
  }

  async function saveAll() {
    setSaving(true);
    setError(null);

    // Build override set: only modules that differ from role defaults
    const nextOverrides = ALL_MODULES
      .filter((m) => !permsEqual(perms[m] || EMPTY_PERMS, rolePerms[m] || EMPTY_PERMS))
      .map((m) => ({
        module_key: m,
        can_view: perms[m]?.can_view || false,
        can_create: perms[m]?.can_create || false,
        can_edit: perms[m]?.can_edit || false,
        can_delete: perms[m]?.can_delete || false,
        data_scope: perms[m]?.data_scope || "own",
      }));

    const ok = await replacePermissionOverrides(account.id, nextOverrides);
    setSaving(false);
    if (!ok) {
      setError(t("acc.err.accessRightsFailed"));
      return;
    }
    setToast(t("acc.msg.accessRightsSaved"));

    // Derive legacy access_level for the callback
    const deriveLevel = (o: typeof nextOverrides[0]) => {
      if (o.can_delete) return "admin" as const;
      if (o.can_edit) return "manager" as const;
      if (o.can_view || o.can_create) return "user" as const;
      return "none" as const;
    };

    onChanged?.(
      nextOverrides.map((o, i) => ({
        id: `local-${i}`,
        account_id: account.id,
        module_key: o.module_key,
        can_view: o.can_view,
        can_create: o.can_create,
        can_edit: o.can_edit,
        can_delete: o.can_delete,
        data_scope: o.data_scope as DataScope,
        access_level: deriveLevel(o),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
    );
  }

  // Stats helper
  function getGroupStats(group: typeof PERMISSION_GROUPS[0]) {
    const allMods = group.modules.flatMap((m) => [m.name, ...(m.subs?.map((s) => s.name) || [])]);
    let total = 0, enabled = 0;
    allMods.forEach((m) => {
      total += 4;
      const p = perms[m] || EMPTY_PERMS;
      if (p.can_view) enabled++;
      if (p.can_create) enabled++;
      if (p.can_edit) enabled++;
      if (p.can_delete) enabled++;
    });
    return { total, enabled, pct: total > 0 ? Math.round((enabled / total) * 100) : 0 };
  }

  /* ── Checkbox cell ── */
  const CheckCell = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button onClick={onChange}
      className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
        checked ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-transparent hover:border-[var(--border-focus)]"
      }`}>
      <CheckIcon size={12} />
    </button>
  );

  /* ── Shared column widths — must match between header + every row ── */
  const COL = { view: "w-12", add: "w-12", edit: "w-12", del: "w-12", all: "w-12", scope: "w-[76px]", hide: "w-10", reset: "w-9" };

  /* ── Module row renderer ── */
  const renderModuleRow = (mod: string, isSub?: boolean, subDesc?: string) => {
    const AppIcon = getAppIcon(mod);
    const p = perms[mod] || EMPTY_PERMS;
    const overridden = isOverridden(mod);
    const full = isFullAccess(p);
    const any = hasAnyPerm(p);

    return (
      <div key={mod} className={`flex items-center px-3 py-1.5 border-t border-[var(--border-faint)] hover:bg-[var(--bg-surface-subtle)] transition-colors ${isSub ? "ps-10" : ""}`}>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {!isSub && AppIcon && <AppIcon size={13} className={`shrink-0 ${any ? "text-[var(--text-secondary)]" : "text-[var(--text-faint)]"}`} />}
          {isSub && <span className="text-[var(--text-faint)] text-[10px]">↳</span>}
          <span className={`text-[12px] font-medium truncate ${any ? "text-[var(--text-secondary)]" : "text-[var(--text-faint)]"}`}>
            {isSub ? t(`acc.mod.${mod}`) : t(`acc.mod.${mod}`)}
          </span>
          {overridden && (
            <span className="px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-300 border border-sky-500/30 shrink-0">
              {t("acc.access.override")}
            </span>
          )}
        </div>
        <div className={`${COL.view} shrink-0 flex justify-center`}><CheckCell checked={p.can_view} onChange={() => toggle(mod, "can_view")} /></div>
        <div className={`${COL.add} shrink-0 flex justify-center`}><CheckCell checked={p.can_create} onChange={() => toggle(mod, "can_create")} /></div>
        <div className={`${COL.edit} shrink-0 flex justify-center`}><CheckCell checked={p.can_edit} onChange={() => toggle(mod, "can_edit")} /></div>
        <div className={`${COL.del} shrink-0 flex justify-center`}><CheckCell checked={p.can_delete} onChange={() => toggle(mod, "can_delete")} /></div>
        <div className={`${COL.all} shrink-0 flex justify-center`}>
          <button onClick={() => toggleFullAccess(mod)}
            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
              full ? "bg-blue-500/15 border-blue-500/30 text-blue-400" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-transparent hover:border-[var(--border-focus)]"
            }`}>
            <ShieldIcon size={10} />
          </button>
        </div>
        <div className={`${COL.scope} shrink-0 flex justify-center`}>
          <select value={p.data_scope} onChange={(e) => setScope(mod, e.target.value as DataScope)}
            className="h-7 px-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors w-full">
            {DATA_SCOPES.map((s) => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
          </select>
        </div>
        <div className={`${COL.hide} shrink-0 flex justify-center`}>
          <button
            type="button"
            onClick={() => toggleHide(mod)}
            title={any ? "Hide this app from this account" : "Un-hide (grants view-only)"}
            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
              !any
                ? "bg-red-500/15 border-red-500/30 text-red-400"
                : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]"
            }`}
          >
            {!any ? <EyeOffIcon size={11} /> : <EyeIcon size={11} />}
          </button>
        </div>
        <div className={`${COL.reset} shrink-0 flex justify-center`}>
          <button onClick={() => resetModule(mod)} disabled={!overridden}
            className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all disabled:opacity-20 disabled:cursor-not-allowed"
            title={t("acc.access.resetToDefault")}>
            <UndoIcon size={10} />
          </button>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className={tabCardClass}>
        <div className="flex items-center justify-center py-12">
          <SpinnerIcon size={20} className="animate-spin text-[var(--text-dim)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <ShieldIcon className="h-3.5 w-3.5" />
          {t("acc.access.title")}
        </h2>
        <p className="text-[12px] text-[var(--text-dim)] mb-0">
          {t("acc.access.description")}
        </p>
        {account.role && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] font-semibold">
              {t("acc.access.roleLabel")}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-focus)]">
              {account.role.name}
            </span>
          </div>
        )}

        {/* Apply Role Template */}
        {allRoles.length > 0 && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] font-semibold">
              {t("acc.access.applyTemplate")}
            </span>
            <div className="relative">
              <select
                value=""
                onChange={(e) => applyRoleTemplate(e.target.value)}
                disabled={applyingTemplate}
                className="h-8 px-3 pr-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value="">{t("acc.access.selectTemplate")}</option>
                {allRoles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <AngleDownIcon size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
            </div>
            <button
              type="button"
              onClick={saveAsNewTemplate}
              disabled={applyingTemplate}
              className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11px] font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1.5"
              title="Save the current access-rights grid as a new role template. Other admins can pick it from this dropdown. Renaming happens in Roles & Permissions."
            >
              + Save as new template
            </button>
            {applyingTemplate && <SpinnerIcon size={14} className="animate-spin text-[var(--text-dim)]" />}
          </div>
        )}

        {/* Scope legend */}
        <div className="mt-4 flex items-center gap-4 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] font-semibold">{t("acc.access.scopeLabel")}</span>
          {DATA_SCOPES.map((s) => (
            <span key={s.value} className="text-[11px] text-[var(--text-dim)]">
              <strong className="text-[var(--text-primary)]">{t(s.labelKey)}</strong> — {t(s.descKey)}
            </span>
          ))}
        </div>
      </section>

      {toast && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 px-4 py-3 text-[13px] flex items-start gap-2">
          <CheckCircleIcon className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] text-red-300 px-4 py-3 text-[13px] flex items-start gap-2">
          <ExclamationIcon className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Permission groups */}
      {PERMISSION_GROUPS.map((group) => {
        const collapsed = collapsedGroups.has(group.key);
        const stats = getGroupStats(group);
        const allMods = group.modules.flatMap((m) => [m.name, ...(m.subs?.map((s) => s.name) || [])]);
        const allGroupOn = allMods.every((m) => isFullAccess(perms[m] || EMPTY_PERMS));

        return (
          <section key={group.key} className="rounded-xl border border-[var(--border-faint)] bg-[var(--bg-secondary)] overflow-hidden min-w-0">
            {/* Group header */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--bg-surface-subtle)]">
              <button onClick={() => toggleGroupCollapse(group.key)}
                className="w-5 h-5 flex items-center justify-center rounded-md shrink-0 hover:bg-[var(--bg-surface)]">
                {collapsed ? <AngleRightIcon size={12} className="text-[var(--text-dim)]" /> : <AngleDownIcon size={12} className="text-[var(--text-dim)]" />}
              </button>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] flex-1">{t(`acc.access.group.${group.key}`)}</span>
              <span className="text-[10px] font-medium text-[var(--text-faint)] mr-2">{stats.pct}%</span>
              <button onClick={() => toggleGroupAll(group)}
                className={`h-6 px-2 rounded-md text-[10px] font-semibold border transition-all ${
                  allGroupOn
                    ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
                    : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:border-[var(--border-focus)]"
                }`}>
                {allGroupOn ? t("acc.access.full") : t("acc.access.colAll")}
              </button>
            </div>

            {/* Module rows */}
            {!collapsed && (
              <div>
                {/* Column headers */}
                <div className="flex items-center px-3 py-1.5 border-t border-[var(--border-faint)]">
                  <div className="flex-1 text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium">{t("acc.access.colApp")}</div>
                  <div className={`${COL.view} shrink-0 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium`}>{t("acc.access.colView")}</div>
                  <div className={`${COL.add} shrink-0 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium`}>{t("acc.access.colAdd")}</div>
                  <div className={`${COL.edit} shrink-0 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium`}>{t("acc.access.colEdit")}</div>
                  <div className={`${COL.del} shrink-0 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium`}>{t("acc.access.colDel")}</div>
                  <div className={`${COL.all} shrink-0 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium`}>{t("acc.access.colAll")}</div>
                  <div className={`${COL.scope} shrink-0 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium`}>{t("acc.access.colScope")}</div>
                  <div className={`${COL.hide} shrink-0 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium`}>Hide</div>
                  <div className={`${COL.reset} shrink-0`} />
                </div>

                {group.modules.map((mod) => {
                  const hasSubs = mod.subs && mod.subs.length > 0;
                  const subsExpanded = expandedSubs.has(mod.name);
                  const p = perms[mod.name] || EMPTY_PERMS;
                  const AppIcon = getAppIcon(mod.name);
                  const any = hasAnyPerm(p);
                  const full = isFullAccess(p);
                  const overridden = isOverridden(mod.name);

                  return (
                    <div key={mod.name}>
                      {/* Main module row */}
                      <div className="flex items-center px-3 py-1.5 border-t border-[var(--border-faint)] hover:bg-[var(--bg-surface-subtle)] transition-colors">
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          {hasSubs && (
                            <button onClick={() => toggleSubExpand(mod.name)}
                              className="w-4 h-4 flex items-center justify-center rounded shrink-0 hover:bg-[var(--bg-surface)]">
                              {subsExpanded ? <AngleDownIcon size={10} className="text-[var(--text-dim)]" /> : <AngleRightIcon size={10} className="text-[var(--text-dim)]" />}
                            </button>
                          )}
                          {AppIcon && <AppIcon size={13} className={`shrink-0 ${any ? "text-[var(--text-secondary)]" : "text-[var(--text-faint)]"}`} />}
                          <span className={`text-[12px] font-medium truncate ${any ? "text-[var(--text-secondary)]" : "text-[var(--text-faint)]"}`}>{t(`acc.mod.${mod.name}`)}</span>
                          {overridden && (
                            <span className="px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-300 border border-sky-500/30 shrink-0">
                              {t("acc.access.override")}
                            </span>
                          )}
                        </div>
                        <div className={`${COL.view} shrink-0 flex justify-center`}><CheckCell checked={p.can_view} onChange={() => toggle(mod.name, "can_view")} /></div>
                        <div className={`${COL.add} shrink-0 flex justify-center`}><CheckCell checked={p.can_create} onChange={() => toggle(mod.name, "can_create")} /></div>
                        <div className={`${COL.edit} shrink-0 flex justify-center`}><CheckCell checked={p.can_edit} onChange={() => toggle(mod.name, "can_edit")} /></div>
                        <div className={`${COL.del} shrink-0 flex justify-center`}><CheckCell checked={p.can_delete} onChange={() => toggle(mod.name, "can_delete")} /></div>
                        <div className={`${COL.all} shrink-0 flex justify-center`}>
                          <button onClick={() => toggleFullAccess(mod.name)}
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                              full ? "bg-blue-500/15 border-blue-500/30 text-blue-400" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-transparent hover:border-[var(--border-focus)]"
                            }`}>
                            <ShieldIcon size={10} />
                          </button>
                        </div>
                        <div className={`${COL.scope} shrink-0 flex justify-center`}>
                          <select value={p.data_scope} onChange={(e) => setScope(mod.name, e.target.value as DataScope)}
                            className="h-7 px-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors w-full">
                            {DATA_SCOPES.map((s) => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
                          </select>
                        </div>
                        <div className={`${COL.hide} shrink-0 flex justify-center`}>
                          <button
                            type="button"
                            onClick={() => toggleHide(mod.name)}
                            title={any ? "Hide this app from this account" : "Un-hide (grants view-only)"}
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                              !any
                                ? "bg-red-500/15 border-red-500/30 text-red-400"
                                : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]"
                            }`}
                          >
                            {!any ? <EyeOffIcon size={11} /> : <EyeIcon size={11} />}
                          </button>
                        </div>
                        <div className={`${COL.reset} shrink-0 flex justify-center`}>
                          <button onClick={() => resetModule(mod.name)} disabled={!overridden}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                            title={t("acc.access.resetToDefault")}>
                            <UndoIcon size={10} />
                          </button>
                        </div>
                      </div>

                      {/* Sub-modules */}
                      {hasSubs && subsExpanded && mod.subs!.map((sub) =>
                        renderModuleRow(sub.name, true, sub.description),
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {/* Action bar */}
      <section className={tabCardClass}>
        <TabActionBar
          dirty={dirty}
          saving={saving}
          onSave={saveAll}
          onReset={resetAll}
        />
      </section>
    </div>
  );
}
