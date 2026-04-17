"use client";

/* ---------------------------------------------------------------------------
   Roles & Permissions — Standalone app for managing organisational roles
   and their per-module permission grids.

   Features:
     • Create / edit / clone / delete roles
     • Per-module permission matrix (View / Add / Edit / Delete)
     • Group-level toggles (Operations, Commercial, Finance, etc.)
     • Data scope per module (Own / Department / All)
     • Sensitive fields per module
   --------------------------------------------------------------------------- */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import AngleUpIcon from "@/components/icons/ui/AngleUpIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import { APP_REGISTRY } from "@/lib/navigation";
import {
  fetchRoles, createRole, updateRole, deleteRole, cloneRole,
  fetchPermissions, upsertPermissions,
  type RoleRow, type PermissionRow, type DataScope,
} from "@/lib/management-admin";

/* ═══════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════ */

const PERMISSION_GROUPS: { label: string; modules: string[] }[] = [
  { label: "Operations", modules: ["Products", "Inventory", "Purchase", "Landed Cost", "Catalogs", "Documents"] },
  { label: "Commercial", modules: ["Sales", "CRM", "Quotations", "Invoices", "Customers", "Suppliers", "Contacts", "Markets"] },
  { label: "Finance", modules: ["Finance", "Expenses"] },
  { label: "People", modules: ["Management", "Employees", "Recruitment", "Appraisals", "Attendance"] },
  { label: "Communication", modules: ["Discuss", "Calendar", "To-do", "Koleex Mail"] },
  { label: "Marketing & Growth", modules: ["Website", "Marketing", "Events"] },
  { label: "Planning & Knowledge", modules: ["Planning", "Projects", "Knowledge", "AI"] },
  { label: "System", modules: ["Accounts", "Settings", "Brands", "Price Calculator", "Dashboard"] },
];

const PERMISSION_MODULES = PERMISSION_GROUPS.flatMap((g) => g.modules);

const getAppIcon = (moduleName: string) => {
  const app = APP_REGISTRY.find((a) =>
    a.name === moduleName || a.name.toLowerCase() === moduleName.toLowerCase(),
  );
  return app?.icon || null;
};

/* ═══════════════════════════════════════════════════
   SHARED UI
   ═══════════════════════════════════════════════════ */

const inputCls = "w-full h-10 px-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--border-focus)] text-[var(--text-primary)] text-[13px] outline-none transition-colors";
const textareaCls = "w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--border-focus)] text-[var(--text-primary)] text-[13px] outline-none transition-colors resize-none";
const cancelBtnCls = "h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-subtle)] hover:bg-[var(--bg-surface)] transition-colors";
const primaryBtnCls = "h-10 px-5 rounded-xl text-[13px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-30 transition-all";

/* ═══════════════════════════════════════════════════
   MODAL SHELL
   ═══════════════════════════════════════════════════ */

function ModalShell({ open, onClose, title, width, children, footer }: {
  open: boolean; onClose: () => void; title: string; width?: string;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onTouchMove={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${width || "max-w-[520px]"} bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl flex flex-col max-h-[85vh]`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface)] transition-colors">
            <CrossIcon size={16} className="text-[var(--text-dim)]" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto overscroll-contain flex-1">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-color)] shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ROLE MODAL
   ═══════════════════════════════════════════════════ */

function RoleModal({ open, onClose, role, onSaved }: {
  open: boolean; onClose: () => void; role: RoleRow | null; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canViewPrivate, setCanViewPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(role?.name || "");
      setDescription(role?.description || "");
      setIsSuperAdmin(role?.is_super_admin ?? false);
      setCanViewPrivate(role?.can_view_private ?? false);
      setError("");
    }
  }, [open, role]);

  const handleSave = async () => {
    if (!name.trim()) { setError("Role name is required."); return; }
    setSaving(true); setError("");
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      is_super_admin: isSuperAdmin,
      can_view_private: canViewPrivate,
    };
    if (role) {
      const res = await updateRole(role.id, payload);
      if (!res.ok) { setError(res.error || "Failed."); setSaving(false); return; }
    } else {
      const res = await createRole(payload);
      if (res.error) { setError(res.error); setSaving(false); return; }
    }
    setSaving(false); onSaved(); onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose} title={role ? "Edit Role" : "New Role"} width="max-w-[480px]" footer={
      <><button onClick={onClose} className={cancelBtnCls}>Cancel</button>
      <button onClick={handleSave} disabled={saving || !name.trim()} className={primaryBtnCls}>{saving ? "Saving..." : role ? "Save" : "Create Role"}</button></>
    }>
      {error && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] flex items-center gap-2"><ExclamationIcon size={14} /> {error}</div>}
      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] mb-1.5">Role Name *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales Manager" autoFocus className={inputCls} />
      </div>
      <div>
        <label className="block text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] mb-1.5">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this role do?" rows={2} className={textareaCls} />
      </div>

      {/* ── Advanced role flags ──
          Two orthogonal overrides that bypass the normal scope rules.
          is_super_admin is safe-ish (still blocked from private records);
          can_view_private is the break-glass flag — warn the user with a
          red border + explanation since it's audit-logged. */}
      <div className="rounded-xl border border-[var(--border-faint)] p-4 space-y-3 bg-[var(--bg-surface-subtle)]">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-dim)]">
          Advanced — scope overrides
        </p>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isSuperAdmin}
            onChange={(e) => setIsSuperAdmin(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--border-subtle)] bg-[var(--bg-surface)] accent-emerald-500 cursor-pointer"
          />
          <div className="flex-1">
            <div className="text-[12.5px] font-semibold text-[var(--text-primary)]">
              Super Admin
            </div>
            <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
              Bypasses all data scope rules (Own / Dept / All). Sees every record except those marked Private.
            </div>
          </div>
        </label>

        <label className={`flex items-start gap-3 cursor-pointer p-2 -m-2 rounded-lg ${canViewPrivate ? "bg-red-500/[0.08] border border-red-500/25" : ""}`}>
          <input
            type="checkbox"
            checked={canViewPrivate}
            onChange={(e) => setCanViewPrivate(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--border-subtle)] bg-[var(--bg-surface)] accent-red-500 cursor-pointer"
          />
          <div className="flex-1">
            <div className="text-[12.5px] font-semibold text-[var(--text-primary)]">
              Break-glass: view Private records
            </div>
            <div className={`text-[11px] mt-0.5 ${canViewPrivate ? "text-red-300" : "text-[var(--text-dim)]"}`}>
              Grants access to records marked Private (personal mail, notes, sensitive HR). Every read is logged to koleex_private_access_log. Grant sparingly — typically only during legal discovery.
            </div>
          </div>
        </label>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════
   DELETE CONFIRM MODAL
   ═══════════════════════════════════════════════════ */

function DeleteConfirm({ open, roleName, onClose, onConfirm, deleting }: {
  open: boolean; roleName: string; onClose: () => void; onConfirm: () => void; deleting: boolean;
}) {
  if (!open) return null;
  return (
    <ModalShell open={open} onClose={onClose} title="Delete Role" width="max-w-[400px]" footer={
      <><button onClick={onClose} className={cancelBtnCls}>Cancel</button>
      <button onClick={onConfirm} disabled={deleting}
        className="h-10 px-5 rounded-xl text-[13px] font-semibold bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 disabled:opacity-50 transition-all"
      >{deleting ? "Deleting..." : "Delete"}</button></>
    }>
      <p className="text-[13px] text-[var(--text-secondary)]">
        Are you sure you want to delete <strong className="text-[var(--text-primary)]">{roleName}</strong>? This will unlink any positions using this role. This action cannot be undone.
      </p>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════
   PERMISSIONS EDITOR
   ═══════════════════════════════════════════════════ */

/** Local permission cell shape for the editor. Mirrors the Supabase row
 *  minus the id / role_id (those are re-derived when we upsert). */
type PermCell = {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  data_scope: DataScope;
};

const EMPTY_PERM: PermCell = {
  can_view: false,
  can_create: false,
  can_edit: false,
  can_delete: false,
  data_scope: "all",
};

/** Cycle order for the scope button: all → department → own → private → all. */
const SCOPE_CYCLE: Record<DataScope, DataScope> = {
  all: "department",
  department: "own",
  own: "private",
  private: "all",
};

/** Type-C modules — personal productivity data. For these, Scope is not
 *  configurable: the rule is always "Own + explicit sharing + SA-bypass".
 *  The Scope chip is replaced with a locked "Personal" badge in the UI
 *  to make the hard rule visible to admins editing roles. */
const TYPE_C_MODULE_NAMES = new Set([
  "To-do",
  "Calendar",
  "Koleex Mail",
  "Inbox",
]);

function PermissionsEditor({ roleId }: { roleId: string }) {
  const [perms, setPerms] = useState<Record<string, PermCell>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    fetchPermissions(roleId).then((rows) => {
      const map: Record<string, PermCell> = {};
      PERMISSION_MODULES.forEach((m) => { map[m] = { ...EMPTY_PERM }; });
      rows.forEach((r) => {
        if (map[r.module_name]) {
          map[r.module_name] = {
            can_view: r.can_view,
            can_create: r.can_create,
            can_edit: r.can_edit,
            can_delete: r.can_delete,
            data_scope: (r.data_scope as DataScope) ?? "all",
          };
        }
      });
      setPerms(map); setLoading(false);
    });
  }, [roleId]);

  const toggle = (mod: string, field: "can_view" | "can_create" | "can_edit" | "can_delete") => {
    setPerms((prev) => ({ ...prev, [mod]: { ...prev[mod], [field]: !prev[mod][field] } }));
    setSaved(false);
  };

  /** Rotate the module's scope through all → department → own → all. */
  const cycleScope = (mod: string) => {
    setPerms((prev) => {
      const current = prev[mod]?.data_scope ?? "all";
      return { ...prev, [mod]: { ...prev[mod], data_scope: SCOPE_CYCLE[current] } };
    });
    setSaved(false);
  };

  const toggleFullAccess = (mod: string) => {
    const p = perms[mod];
    const allOn = p?.can_view && p?.can_create && p?.can_edit && p?.can_delete;
    setPerms((prev) => ({
      ...prev,
      [mod]: {
        can_view: !allOn,
        can_create: !allOn,
        can_edit: !allOn,
        can_delete: !allOn,
        data_scope: prev[mod]?.data_scope ?? "all",
      },
    }));
    setSaved(false);
  };

  const toggleGroupAll = (group: typeof PERMISSION_GROUPS[0]) => {
    const allOn = group.modules.every((m) => {
      const p = perms[m];
      return p?.can_view && p?.can_create && p?.can_edit && p?.can_delete;
    });
    setPerms((prev) => {
      const next = { ...prev };
      group.modules.forEach((m) => {
        next[m] = {
          can_view: !allOn,
          can_create: !allOn,
          can_edit: !allOn,
          can_delete: !allOn,
          data_scope: prev[m]?.data_scope ?? "all",
        };
      });
      return next;
    });
    setSaved(false);
  };

  const toggleGroupCollapse = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await upsertPermissions(
      roleId,
      Object.entries(perms).map(([module_name, p]) => ({
        module_name,
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
        data_scope: p.data_scope,
      })),
    );
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="flex items-center justify-center py-8"><SpinnerIcon size={16} className="text-[var(--text-dim)] animate-spin" /></div>;

  const CheckCell = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button onClick={onChange}
      className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
        checked ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-transparent hover:border-[var(--border-focus)]"
      }`}>
      <CheckIcon size={12} />
    </button>
  );

  /** Compact pill that shows the module's data scope and cycles it on click.
   *  - All        → emerald (full visibility, the default)
   *  - Department → blue    (team-level scope)
   *  - Own        → amber   (personal scope, most restrictive)
   *
   *  Dimmed when no V/C/E/D is enabled — the scope then has no effect
   *  but stays clickable so the admin can still pre-configure it. */
  const ScopeChip = ({ scope, disabled, onClick }: { scope: DataScope; disabled?: boolean; onClick: () => void }) => {
    const labels: Record<DataScope, { label: string; cls: string; dot: string }> = {
      all:        { label: "All",     cls: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300", dot: "bg-emerald-400" },
      department: { label: "Dept",    cls: "bg-blue-500/15 border-blue-500/30 text-blue-300",         dot: "bg-blue-400" },
      own:        { label: "Own",     cls: "bg-amber-500/15 border-amber-500/30 text-amber-300",      dot: "bg-amber-400" },
      private:    { label: "Private", cls: "bg-red-500/15 border-red-500/30 text-red-300",            dot: "bg-red-400" },
    };
    const cfg = labels[scope];
    return (
      <button
        type="button"
        onClick={onClick}
        title={`Data scope: ${cfg.label}. Click to cycle (All → Dept → Own → Private).`}
        className={`h-7 px-2 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5 transition-all ${
          cfg.cls
        } ${disabled ? "opacity-40" : "hover:brightness-110"}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
        <span>{cfg.label}</span>
      </button>
    );
  };

  const getGroupStats = (group: typeof PERMISSION_GROUPS[0]) => {
    let total = 0;
    let enabled = 0;
    group.modules.forEach((m) => {
      total += 4;
      const p = perms[m];
      if (p?.can_view) enabled++;
      if (p?.can_create) enabled++;
      if (p?.can_edit) enabled++;
      if (p?.can_delete) enabled++;
    });
    return { total, enabled, pct: total > 0 ? Math.round((enabled / total) * 100) : 0 };
  };

  return (
    <div>
      <div className="space-y-3 overflow-x-auto">
        {PERMISSION_GROUPS.map((group) => {
          const collapsed = collapsedGroups.has(group.label);
          const stats = getGroupStats(group);
          const allGroupOn = group.modules.every((m) => {
            const p = perms[m];
            return p?.can_view && p?.can_create && p?.can_edit && p?.can_delete;
          });

          return (
            <div key={group.label} className="rounded-xl border border-[var(--border-faint)] overflow-hidden min-w-[420px]">
              {/* Group header */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--bg-surface-subtle)]">
                <button onClick={() => toggleGroupCollapse(group.label)}
                  className="w-5 h-5 flex items-center justify-center rounded-md shrink-0 hover:bg-[var(--bg-surface)]">
                  {collapsed ? <AngleRightIcon size={12} className="text-[var(--text-dim)]" /> : <AngleDownIcon size={12} className="text-[var(--text-dim)]" />}
                </button>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] flex-1">{group.label}</span>
                <span className="text-[10px] font-medium text-[var(--text-faint)] mr-2">{stats.pct}%</span>
                <button onClick={() => toggleGroupAll(group)}
                  className={`h-6 px-2 rounded-md text-[10px] font-semibold border transition-all ${
                    allGroupOn
                      ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
                      : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:border-[var(--border-focus)]"
                  }`}>
                  {allGroupOn ? "Full" : "All"}
                </button>
              </div>

              {/* Module rows */}
              {!collapsed && (
                <div>
                  <div className="flex items-center px-3 py-1.5 border-t border-[var(--border-faint)]">
                    <div className="flex-1 text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium">App</div>
                    <div className="w-12 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium">View</div>
                    <div className="w-12 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium">Add</div>
                    <div className="w-12 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium">Edit</div>
                    <div className="w-12 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium">Del</div>
                    <div className="w-12 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium">All</div>
                    <div className="w-24 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium">Scope</div>
                  </div>
                  {group.modules.map((mod) => {
                    const AppIcon = getAppIcon(mod);
                    const p = perms[mod];
                    const isFullAccess = p?.can_view && p?.can_create && p?.can_edit && p?.can_delete;
                    const hasAny = p?.can_view || p?.can_create || p?.can_edit || p?.can_delete;
                    const scope = p?.data_scope ?? "all";

                    return (
                      <div key={mod} className="flex items-center px-3 py-1.5 border-t border-[var(--border-faint)] hover:bg-[var(--bg-surface-subtle)] transition-colors">
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          {AppIcon && <AppIcon size={13} className={`shrink-0 ${hasAny ? "text-[var(--text-secondary)]" : "text-[var(--text-faint)]"}`} />}
                          <span className={`text-[12px] font-medium truncate ${hasAny ? "text-[var(--text-secondary)]" : "text-[var(--text-faint)]"}`}>{mod}</span>
                        </div>
                        <div className="w-12 flex justify-center"><CheckCell checked={p?.can_view} onChange={() => toggle(mod, "can_view")} /></div>
                        <div className="w-12 flex justify-center"><CheckCell checked={p?.can_create} onChange={() => toggle(mod, "can_create")} /></div>
                        <div className="w-12 flex justify-center"><CheckCell checked={p?.can_edit} onChange={() => toggle(mod, "can_edit")} /></div>
                        <div className="w-12 flex justify-center"><CheckCell checked={p?.can_delete} onChange={() => toggle(mod, "can_delete")} /></div>
                        <div className="w-12 flex justify-center">
                          <button onClick={() => toggleFullAccess(mod)}
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                              isFullAccess ? "bg-blue-500/15 border-blue-500/30 text-blue-400" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-transparent hover:border-[var(--border-focus)]"
                            }`}>
                            <ShieldIcon size={10} />
                          </button>
                        </div>
                        {/* Scope pill — cycles through All → Department → Own → Private on click.
                            Dimmed when the row has no V/C/E/D permissions.
                            For Type C (personal productivity) modules, Scope is not configurable
                            — replaced with a locked "Personal" badge so admins understand that
                            no role setting can expose one user's calendar/todos to another. */}
                        <div className="w-24 flex justify-center">
                          {TYPE_C_MODULE_NAMES.has(mod) ? (
                            <span
                              title="Personal productivity data. Always scoped to the owner + explicit sharing. Only Super Admin can view others'."
                              className="h-7 px-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-[10px] font-semibold flex items-center gap-1.5"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                              <span>Personal</span>
                            </span>
                          ) : (
                            <ScopeChip
                              scope={scope}
                              disabled={!hasAny}
                              onClick={() => cycleScope(mod)}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-2 mt-4">
        {saved && <span className="text-[12px] text-emerald-400 font-medium flex items-center gap-1"><CheckIcon size={12} /> Saved</span>}
        <button onClick={handleSave} disabled={saving} className={primaryBtnCls}>{saving ? "Saving..." : "Save Permissions"}</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════ */

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  /* ── Modal state ── */
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editRole, setEditRole] = useState<RoleRow | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");

  /* ── Load ── */
  const loadRoles = useCallback(async () => {
    setLoading(true);
    const data = await fetchRoles();
    setRoles(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  /* ── Toast ── */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ── Handlers ── */
  const handleRoleSaved = async () => {
    await loadRoles();
    setToast(editRole ? "Role updated" : "Role created");
  };

  const handleCloneRole = async (roleId: string) => {
    await cloneRole(roleId);
    await loadRoles();
    setToast("Role cloned");
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteRole(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (selectedRoleId === deleteTarget.id) setSelectedRoleId(null);
    await loadRoles();
    setToast("Role deleted");
  };

  /* ── Filtering ── */
  const filtered = search.trim()
    ? roles.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()) || r.description?.toLowerCase().includes(search.toLowerCase()))
    : roles;

  /* ── Stats ── */
  const totalRoles = roles.length;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Link href="/" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
              <ShieldIcon className="h-4 w-4" />
            </div>
            <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
              Roles & Permissions
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setEditRole(null); setShowRoleModal(true); }}
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg"
            >
              <PlusIcon className="h-4 w-4" /> New Role
            </button>
          </div>
        </div>
        <p className="text-[12px] text-[var(--text-dim)] mb-6 md:mb-8 ml-0 md:ml-11">
          {totalRoles} {totalRoles === 1 ? "role" : "roles"} configured
        </p>

        {/* Search + Filters */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-4 mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-dim)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search roles..."
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-primary)]">
                  <CrossIcon size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-violet-400" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-500/10 text-violet-400"><ShieldIcon size={15} /></div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">Total Roles</span>
            </div>
            <div className="text-[32px] font-extrabold tracking-tight text-[var(--text-primary)] leading-none">{totalRoles}</div>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-blue-400" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-400"><LayersIcon size={15} /></div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">Module Groups</span>
            </div>
            <div className="text-[32px] font-extrabold tracking-tight text-[var(--text-primary)] leading-none">{PERMISSION_GROUPS.length}</div>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-emerald-400" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-400"><CheckIcon size={15} /></div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">Total Modules</span>
            </div>
            <div className="text-[32px] font-extrabold tracking-tight text-[var(--text-primary)] leading-none">{PERMISSION_MODULES.length}</div>
          </div>
        </div>

        {/* Roles list */}
        {loading ? (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-16 text-center">
            <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin mx-auto" />
            <p className="text-[13px] mt-3 text-[var(--text-dim)]">Loading roles...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center mx-auto mb-4">
              <ShieldIcon size={24} className="text-[var(--text-dim)] opacity-40" />
            </div>
            <p className="text-[14px] font-semibold text-[var(--text-secondary)] mb-1">
              {roles.length === 0 ? "No roles yet" : "No results found"}
            </p>
            <p className="text-[12px] text-[var(--text-dim)]">
              {roles.length === 0
                ? "Create your first role to start managing permissions."
                : "Try adjusting your search."
              }
            </p>
            {roles.length === 0 && (
              <button
                onClick={() => { setEditRole(null); setShowRoleModal(true); }}
                className="mt-4 inline-flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 transition-all"
              >
                <PlusIcon className="h-4 w-4" /> Create Role
              </button>
            )}
          </div>
        ) : (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
            {filtered.map((role) => (
              <div key={role.id}>
                {/* Role row */}
                <div className="flex items-center gap-4 p-4 group hover:bg-[var(--bg-surface-subtle)] transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center shrink-0">
                    <ShieldIcon size={16} className="text-[var(--text-muted)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-[var(--text-primary)]">{role.name}</div>
                    {role.description && <p className="text-[12px] text-[var(--text-dim)] truncate mt-0.5">{role.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setSelectedRoleId(selectedRoleId === role.id ? null : role.id)}
                      className={`h-8 px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-colors ${
                        selectedRoleId === role.id ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "hover:bg-[var(--bg-surface)] text-[var(--text-faint)]"
                      }`}>
                      {selectedRoleId === role.id ? <AngleUpIcon size={12} /> : <AngleDownIcon size={12} />}
                      Permissions
                    </button>
                    <button onClick={() => handleCloneRole(role.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-surface-hover)] transition-all" title="Clone role">
                      <CopyIcon size={13} className="text-[var(--text-dim)]" />
                    </button>
                    <button onClick={() => { setEditRole(role); setShowRoleModal(true); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-surface-hover)] transition-all">
                      <PencilIcon size={13} className="text-[var(--text-dim)]" />
                    </button>
                    <button onClick={() => setDeleteTarget(role)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-400/10 transition-all">
                      <TrashIcon size={13} className="text-red-400/60" />
                    </button>
                  </div>
                </div>

                {/* Expanded permissions editor */}
                {selectedRoleId === role.id && (
                  <div className="px-4 pb-4 border-t border-[var(--border-color)] bg-[var(--bg-primary)]">
                    <div className="pt-4">
                      <PermissionsEditor roleId={role.id} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-medium shadow-lg flex items-center gap-2">
          <CheckIcon size={14} /> {toast}
        </div>
      )}

      {/* Modals */}
      <RoleModal open={showRoleModal} onClose={() => setShowRoleModal(false)} role={editRole} onSaved={handleRoleSaved} />
      <DeleteConfirm open={!!deleteTarget} roleName={deleteTarget?.name || ""} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm} deleting={deleting} />
    </div>
  );
}
