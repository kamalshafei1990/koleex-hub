"use client";

/* ---------------------------------------------------------------------------
   Management — Organizational engine for Koleex Hub.

   Features:
     • Department hierarchy (tree sidebar)
     • Position management + reports_to hierarchy
     • Employee assignment (contact picker + inline create)
     • Real org chart (tree with connectors, expand/collapse, drag-drop)
     • Full company org chart (cross-department)
     • Roles & Permissions (per-module access grid)
     • Position history / audit trail
     • Employee transfer
     • Circular hierarchy validation
     • Safe delete with cascade / reassign
   --------------------------------------------------------------------------- */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Plus, Search, Pencil, Trash2, X, Loader2, ChevronRight, ChevronDown,
  Users, UserPlus, Building2, User, ArrowLeft,
  Briefcase, Network, LayoutList, GitBranchPlus, Shield,
  Check, History, ChevronUp, ArrowRightLeft, FileText, AlertCircle,
  GripVertical, Image, Smile, Globe, BarChart3, Activity,
  ZoomIn, ZoomOut, RotateCcw, Mail, Phone, Clock,
  TrendingUp, Layers, UserCheck, UserX,
} from "lucide-react";
import {
  fetchDepartments, createDepartment, updateDepartment, safeDeleteDepartment,
  fetchPositions, createPosition, updatePosition, safeDeletePosition, movePosition,
  fetchAssignments, createAssignment, updateAssignment, deleteAssignment,
  fetchContactsForLinking, createInlineContact,
  buildDepartmentTree, buildOrgChart, getDepartmentHead, detectCircularHierarchy,
  fetchRoles, createRole, updateRole, deleteRole,
  fetchPermissions, upsertPermissions,
  fetchPositionHistory, addPositionHistory,
  transferEmployee, fetchFullOrgData, fetchDeptStats,
  fetchEmployeeProfile, fetchRecentActivity, fetchHeadcountAnalytics,
  type DepartmentRow, type PositionRow, type AssignmentRow,
  type DeptTreeNode, type ContactRef, type OrgChartNode,
  type RoleRow, type PermissionRow, type PositionHistoryRow,
  type EmployeeProfile, type HeadcountAnalytics,
} from "@/lib/management-admin";

/* ═══════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════ */

const DEPT_ICONS = [
  "🏢","🏗️","💼","📊","🎯","⚙️","🔧","💡",
  "📦","🚀","🛡️","💰","📈","🎨","📱","🌍",
  "🔬","⚖️","🏭","🧑‍💻","📋","🤝","📣","🎓",
  "🏦","🩺","🔒","📡","🛒","✈️","🧪","📐",
];

const LEVEL_LABELS: Record<number, string> = {
  0: "Executive", 1: "Senior Management", 2: "Management",
  3: "Senior", 4: "Mid-Level", 5: "Entry Level",
};

const LEVEL_COLORS: Record<number, string> = {
  0: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  1: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  2: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  3: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  4: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  5: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

const LEVEL_DOT: Record<number, string> = {
  0: "bg-amber-400", 1: "bg-violet-400", 2: "bg-blue-400",
  3: "bg-emerald-400", 4: "bg-cyan-400", 5: "bg-slate-400",
};

const PERMISSION_MODULES = [
  "Products", "Inventory", "Purchase", "Landed Cost",
  "Sales", "CRM", "Quotations", "Invoices",
  "Customers", "Suppliers", "Contacts", "Markets",
  "Finance", "Expenses",
  "Management", "Employees",
  "Discuss", "Calendar", "To-do",
  "Website", "Catalogs",
  "Settings", "Accounts",
];

/* ═══════════════════════════════════════════════════
   SHARED UI
   ═══════════════════════════════════════════════════ */

const inputCls = "w-full h-10 px-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--border-focus)] text-[var(--text-primary)] text-[13px] outline-none transition-colors";
const textareaCls = "w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--border-focus)] text-[var(--text-primary)] text-[13px] outline-none transition-colors resize-none";
const selectCls = inputCls;
const cancelBtnCls = "h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-subtle)] hover:bg-[var(--bg-surface)] transition-colors";
const primaryBtnCls = "h-10 px-5 rounded-xl text-[13px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-30 transition-all";
const dangerBtnCls = "h-10 px-5 rounded-xl text-[13px] font-semibold bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 disabled:opacity-50 transition-all";

function ModalShell({ open, onClose, title, width, children, footer }: {
  open: boolean; onClose: () => void; title: string; width?: string;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${width || "max-w-[520px]"} bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl flex flex-col max-h-[85vh]`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface)] transition-colors">
            <X size={16} className="text-[var(--text-dim)]" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-color)] shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] mb-1.5">{children}</label>;
}

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] flex items-center gap-2"><AlertCircle size={14} /> {message}</div>;
}

function Avatar({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0 text-[var(--text-dim)]" style={{ width: size, height: size }}>
      {size >= 28 ? <span className="font-semibold" style={{ fontSize: size * 0.38 }}>{initials || <User size={size * 0.45} />}</span> : <User size={size * 0.5} />}
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-[var(--text-dim)]">
      <Icon size={32} className="mb-3 opacity-40" />
      <p className="text-[13px] font-medium mb-1">{title}</p>
      {subtitle && <p className="text-[11px]">{subtitle}</p>}
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center py-16"><Loader2 size={20} className="text-[var(--text-dim)] animate-spin" /></div>;
}

/** Department icon renderer — supports emoji, image URL, fallback */
function DeptIcon({ dept, size = 24 }: { dept: DepartmentRow; size?: number }) {
  if (dept.icon_type === "image" && dept.icon_value) {
    return <img src={dept.icon_value} alt="" className="rounded-lg object-cover" style={{ width: size, height: size }} />;
  }
  return <span style={{ fontSize: size * 0.85 }}>{dept.icon || "🏢"}</span>;
}

/* ═══════════════════════════════════════════════════
   DEPARTMENT MODAL (emoji picker + image URL)
   ═══════════════════════════════════════════════════ */
function DepartmentModal({
  open, onClose, dept, departments, onSaved,
}: {
  open: boolean; onClose: () => void;
  dept: DepartmentRow | null; departments: DepartmentRow[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🏢");
  const [iconType, setIconType] = useState<"emoji" | "image">("emoji");
  const [iconUrl, setIconUrl] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showIcons, setShowIcons] = useState(false);

  useEffect(() => {
    if (open) {
      setName(dept?.name || "");
      setDescription(dept?.description || "");
      setIcon(dept?.icon || "🏢");
      setIconType((dept?.icon_type as "emoji" | "image") || "emoji");
      setIconUrl(dept?.icon_type === "image" ? dept?.icon_value || "" : "");
      setParentId(dept?.parent_id || null);
      setError(""); setShowIcons(false);
    }
  }, [open, dept]);

  const parentOptions = departments.filter((d) => d.id !== dept?.id);

  const handleSave = async () => {
    if (!name.trim()) { setError("Department name is required."); return; }
    setSaving(true); setError("");
    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || null,
      icon: iconType === "emoji" ? icon : "🏢",
      icon_type: iconType,
      icon_value: iconType === "image" ? iconUrl.trim() || null : icon,
      parent_id: parentId || null,
    };
    if (dept) {
      const res = await updateDepartment(dept.id, payload as Partial<DepartmentRow>);
      if (!res.ok) { setError(res.error || "Failed."); setSaving(false); return; }
    } else {
      const res = await createDepartment(payload as Partial<DepartmentRow>);
      if (res.error) { setError(res.error); setSaving(false); return; }
    }
    setSaving(false); onSaved(); onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose} title={dept ? "Edit Department" : "New Department"} footer={
      <><button onClick={onClose} className={cancelBtnCls}>Cancel</button>
      <button onClick={handleSave} disabled={saving || !name.trim()} className={primaryBtnCls}>{saving ? "Saving..." : dept ? "Save Changes" : "Create Department"}</button></>
    }>
      <ErrorBanner message={error} />

      {/* Icon type toggle */}
      <div>
        <FieldLabel>Icon</FieldLabel>
        <div className="flex gap-2 mb-2">
          <button onClick={() => setIconType("emoji")}
            className={`h-8 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 border transition-all ${iconType === "emoji" ? "bg-[var(--bg-surface-active)] border-[var(--border-focus)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] text-[var(--text-dim)]"}`}>
            <Smile size={12} /> Emoji
          </button>
          <button onClick={() => setIconType("image")}
            className={`h-8 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 border transition-all ${iconType === "image" ? "bg-[var(--bg-surface-active)] border-[var(--border-focus)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] text-[var(--text-dim)]"}`}>
            <Image size={12} /> Image URL
          </button>
        </div>

        {iconType === "emoji" ? (
          <div className="flex items-start gap-3">
            <div className="relative">
              <button onClick={() => setShowIcons(!showIcons)}
                className="w-12 h-12 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-2xl hover:scale-105 transition-transform">{icon}</button>
              {showIcons && (
                <div className="absolute top-full left-0 mt-2 z-10 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-2 w-[240px] grid grid-cols-8 gap-1">
                  {DEPT_ICONS.map((e) => (
                    <button key={e} onClick={() => { setIcon(e); setShowIcons(false); }}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-base hover:scale-110 transition-transform ${icon === e ? "bg-[var(--bg-surface-active)]" : ""}`}>{e}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1">
              <FieldLabel>Name *</FieldLabel>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering" autoFocus className={inputCls} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {iconUrl ? (
                <img src={iconUrl} alt="" className="w-12 h-12 rounded-xl object-cover border border-[var(--border-subtle)]" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)]"><Image size={18} /></div>
              )}
              <div className="flex-1">
                <input type="url" value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="https://example.com/icon.png" className={inputCls} />
              </div>
            </div>
            <div>
              <FieldLabel>Name *</FieldLabel>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering" className={inputCls} />
            </div>
          </div>
        )}
      </div>

      <div>
        <FieldLabel>Description</FieldLabel>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." rows={2} className={textareaCls} />
      </div>
      <div>
        <FieldLabel>Parent Department</FieldLabel>
        <select value={parentId || ""} onChange={(e) => setParentId(e.target.value || null)} className={selectCls}>
          <option value="">None (Top Level)</option>
          {parentOptions.map((d) => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
        </select>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════
   POSITION MODAL (with circular hierarchy validation)
   ═══════════════════════════════════════════════════ */
function PositionModal({
  open, onClose, position, departmentId, allPositions, roles, onSaved,
}: {
  open: boolean; onClose: () => void;
  position: PositionRow | null; departmentId: string;
  allPositions: PositionRow[]; roles: RoleRow[];
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState(0);
  const [reportsTo, setReportsTo] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [responsibilities, setResponsibilities] = useState("");
  const [requirements, setRequirements] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showJD, setShowJD] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(position?.title || ""); setDescription(position?.description || "");
      setLevel(position?.level || 0); setReportsTo(position?.reports_to_position_id || null);
      setRoleId(position?.role_id || null);
      setResponsibilities(position?.responsibilities || "");
      setRequirements(position?.requirements || "");
      setError(""); setShowJD(!!(position?.responsibilities || position?.requirements));
    }
  }, [open, position]);

  const reportsToOptions = allPositions.filter((p) => p.id !== position?.id);

  const handleSave = async () => {
    if (!title.trim()) { setError("Position title is required."); return; }

    // Circular hierarchy check
    if (position && reportsTo) {
      if (detectCircularHierarchy(position.id, reportsTo, allPositions)) {
        setError("Cannot report to this position — it would create a circular hierarchy.");
        return;
      }
    }

    setSaving(true); setError("");
    const payload: Record<string, unknown> = {
      title: title.trim(), description: description.trim() || null,
      level, department_id: departmentId,
      reports_to_position_id: reportsTo || null,
      role_id: roleId || null,
      responsibilities: responsibilities.trim() || null,
      requirements: requirements.trim() || null,
    };
    if (position) {
      const res = await updatePosition(position.id, payload as Partial<PositionRow>);
      if (!res.ok) { setError(res.error || "Failed."); setSaving(false); return; }
    } else {
      const res = await createPosition(payload as Partial<PositionRow>);
      if (res.error) { setError(res.error); setSaving(false); return; }
    }
    setSaving(false); onSaved(); onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose} title={position ? "Edit Position" : "New Position"} width="max-w-[560px]" footer={
      <><button onClick={onClose} className={cancelBtnCls}>Cancel</button>
      <button onClick={handleSave} disabled={saving || !title.trim()} className={primaryBtnCls}>{saving ? "Saving..." : position ? "Save Changes" : "Create Position"}</button></>
    }>
      <ErrorBanner message={error} />
      <div>
        <FieldLabel>Title *</FieldLabel>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Developer" autoFocus className={inputCls} />
      </div>
      <div>
        <FieldLabel>Description</FieldLabel>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Role overview..." rows={2} className={textareaCls} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>Level</FieldLabel>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((l) => (
              <button key={l} onClick={() => setLevel(l)}
                className={`h-9 w-9 rounded-lg text-[12px] font-semibold border transition-all ${
                  level === l ? "bg-[var(--bg-surface-active)] border-[var(--border-focus)] text-[var(--text-primary)]" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)]"
                }`}>{l}</button>
            ))}
          </div>
          <p className="text-[11px] text-[var(--text-dim)] mt-1">{LEVEL_LABELS[level]}</p>
        </div>
        <div>
          <FieldLabel>Role</FieldLabel>
          <select value={roleId || ""} onChange={(e) => setRoleId(e.target.value || null)} className={selectCls}>
            <option value="">No Role</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <FieldLabel>Reports To</FieldLabel>
        <select value={reportsTo || ""} onChange={(e) => setReportsTo(e.target.value || null)} className={selectCls}>
          <option value="">None (Top of hierarchy)</option>
          {reportsToOptions.map((p) => <option key={p.id} value={p.id}>{p.title} (L{p.level})</option>)}
        </select>
      </div>

      <button onClick={() => setShowJD(!showJD)} className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors w-full">
        <FileText size={13} />
        <span>Job Description</span>
        {showJD ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
      </button>
      {showJD && (
        <div className="space-y-4 pl-1 border-l-2 border-[var(--border-subtle)] ml-1">
          <div className="pl-3">
            <FieldLabel>Responsibilities</FieldLabel>
            <textarea value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} placeholder="Key responsibilities..." rows={3} className={textareaCls} />
          </div>
          <div className="pl-3">
            <FieldLabel>Requirements</FieldLabel>
            <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="Skills, qualifications..." rows={3} className={textareaCls} />
          </div>
        </div>
      )}
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════
   ASSIGNMENT MODAL (contact picker + inline create)
   ═══════════════════════════════════════════════════ */
function AssignmentModal({
  open, onClose, assignment, positionId, departmentId, contacts, onSaved, onContactCreated,
}: {
  open: boolean; onClose: () => void;
  assignment: AssignmentRow | null;
  positionId: string; departmentId: string;
  contacts: ContactRef[]; onSaved: () => void;
  onContactCreated: (c: ContactRef) => void;
}) {
  const [contactId, setContactId] = useState<string | null>(null);
  const [isPrimary, setIsPrimary] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setContactId(assignment?.contact_id || null);
      setIsPrimary(assignment?.is_primary ?? true);
      setStartDate(assignment?.start_date || "");
      setError(""); setContactSearch(""); setShowPicker(false);
      setShowCreate(false); setNewFirst(""); setNewLast(""); setNewEmail(""); setNewPhone("");
    }
  }, [open, assignment]);

  const filtered = contactSearch.trim()
    ? contacts.filter((c) => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || (c.email && c.email.toLowerCase().includes(contactSearch.toLowerCase())))
    : contacts.slice(0, 30);

  const selectedContact = contactId ? contacts.find((c) => c.id === contactId) : null;

  const handleCreateContact = async () => {
    if (!newFirst.trim()) { setError("First name is required."); return; }
    setCreating(true); setError("");
    const res = await createInlineContact({
      first_name: newFirst.trim(),
      last_name: newLast.trim() || undefined,
      email: newEmail.trim() || undefined,
      phone: newPhone.trim() || undefined,
    });
    if (res.error || !res.data) { setError(res.error || "Failed to create contact."); setCreating(false); return; }
    onContactCreated(res.data);
    setContactId(res.data.id);
    setShowCreate(false);
    setShowPicker(false);
    setCreating(false);
  };

  const handleSave = async () => {
    if (!contactId) { setError("Select a person."); return; }
    setSaving(true); setError("");
    const payload: Record<string, unknown> = {
      contact_id: contactId, position_id: positionId,
      department_id: departmentId, is_primary: isPrimary,
      start_date: startDate || null,
    };
    if (assignment) {
      const res = await updateAssignment(assignment.id, payload as Partial<AssignmentRow>);
      if (!res.ok) { setError(res.error || "Failed."); setSaving(false); return; }
    } else {
      const res = await createAssignment(payload as Partial<AssignmentRow>);
      if (res.error) { setError(res.error); setSaving(false); return; }
      await addPositionHistory({ position_id: positionId, contact_id: contactId, department_id: departmentId, action: "assigned" });
    }
    setSaving(false); onSaved(); onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose} title={assignment ? "Edit Assignment" : "Assign Employee"} width="max-w-[500px]" footer={
      <><button onClick={onClose} className={cancelBtnCls}>Cancel</button>
      <button onClick={handleSave} disabled={saving || !contactId} className={primaryBtnCls}>{saving ? "Saving..." : assignment ? "Save Changes" : "Assign"}</button></>
    }>
      <ErrorBanner message={error} />

      {/* Contact picker */}
      <div>
        <FieldLabel>Employee *</FieldLabel>
        <div className="relative">
          <button onClick={() => { setShowPicker(!showPicker); setShowCreate(false); }}
            className="w-full h-10 px-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-start flex items-center gap-2.5 transition-colors hover:border-[var(--border-focus)]">
            {selectedContact ? (
              <><Avatar src={selectedContact.avatar} name={selectedContact.name} size={22} />
              <span className="text-[var(--text-primary)] truncate">{selectedContact.name}</span>
              {selectedContact.email && <span className="text-[var(--text-dim)] text-[11px] truncate">({selectedContact.email})</span>}</>
            ) : (
              <><User size={14} className="text-[var(--text-dim)]" /><span className="text-[var(--text-dim)]">Select or create an employee...</span></>
            )}
          </button>

          {showPicker && (
            <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl max-h-[320px] overflow-hidden flex flex-col">
              <div className="p-2 shrink-0">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                  <input type="text" value={contactSearch} onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search by name or email..." autoFocus
                    className="w-full h-8 pl-8 pr-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[12px] outline-none" />
                </div>
              </div>
              <div className="px-1 overflow-y-auto flex-1">
                {filtered.length === 0 ? (
                  <div className="px-3 py-6 text-center text-[12px] text-[var(--text-dim)]">No contacts found.</div>
                ) : filtered.map((c) => (
                  <button key={c.id} onClick={() => { setContactId(c.id); setShowPicker(false); setContactSearch(""); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-start transition-colors hover:bg-[var(--bg-surface)] ${contactId === c.id ? "bg-[var(--bg-surface-active)]" : ""}`}>
                    <Avatar src={c.avatar} name={c.name} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">{c.name}</div>
                      {c.email && <div className="text-[11px] text-[var(--text-dim)] truncate">{c.email}</div>}
                    </div>
                  </button>
                ))}
              </div>
              {/* Create new button */}
              <div className="p-2 border-t border-[var(--border-color)] shrink-0">
                <button onClick={() => { setShowCreate(true); setShowPicker(false); }}
                  className="w-full h-9 rounded-lg text-[12px] font-medium flex items-center justify-center gap-1.5 border border-dashed border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors">
                  <UserPlus size={13} /> Create New Employee
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline create form */}
      {showCreate && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] font-semibold text-[var(--text-secondary)]">New Employee</span>
            <button onClick={() => setShowCreate(false)} className="text-[var(--text-dim)] hover:text-[var(--text-muted)]"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>First Name *</FieldLabel>
              <input type="text" value={newFirst} onChange={(e) => setNewFirst(e.target.value)} placeholder="John" autoFocus className={inputCls} />
            </div>
            <div>
              <FieldLabel>Last Name</FieldLabel>
              <input type="text" value={newLast} onChange={(e) => setNewLast(e.target.value)} placeholder="Doe" className={inputCls} />
            </div>
          </div>
          <div>
            <FieldLabel>Email</FieldLabel>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="john@example.com" className={inputCls} />
          </div>
          <div>
            <FieldLabel>Phone</FieldLabel>
            <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+1 234 567 890" className={inputCls} />
          </div>
          <button onClick={handleCreateContact} disabled={creating || !newFirst.trim()} className={primaryBtnCls + " w-full"}>
            {creating ? "Creating..." : "Create & Select"}
          </button>
        </div>
      )}

      {/* Primary toggle */}
      <div>
        <FieldLabel>Assignment Type</FieldLabel>
        <div className="flex gap-2">
          <button onClick={() => setIsPrimary(true)}
            className={`flex-1 h-10 rounded-xl border text-[12px] font-semibold transition-all ${
              isPrimary ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)]"
            }`}>Primary</button>
          <button onClick={() => setIsPrimary(false)}
            className={`flex-1 h-10 rounded-xl border text-[12px] font-semibold transition-all ${
              !isPrimary ? "bg-[var(--bg-surface-active)] border-[var(--border-focus)] text-[var(--text-primary)]" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)]"
            }`}>Secondary</button>
        </div>
      </div>
      <div>
        <FieldLabel>Start Date</FieldLabel>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════
   TRANSFER MODAL
   ═══════════════════════════════════════════════════ */
function TransferModal({
  open, onClose, assignment, contactName, departments, onSaved,
}: {
  open: boolean; onClose: () => void;
  assignment: AssignmentRow | null; contactName: string;
  departments: DepartmentRow[];
  onSaved: () => void;
}) {
  const [targetDeptId, setTargetDeptId] = useState("");
  const [targetPosId, setTargetPosId] = useState("");
  const [deptPositions, setDeptPositions] = useState<PositionRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadingPos, setLoadingPos] = useState(false);

  useEffect(() => {
    if (open) { setTargetDeptId(""); setTargetPosId(""); setDeptPositions([]); setError(""); }
  }, [open]);

  useEffect(() => {
    if (!targetDeptId) { setDeptPositions([]); setTargetPosId(""); return; }
    (async () => {
      setLoadingPos(true);
      setDeptPositions(await fetchPositions(targetDeptId));
      setLoadingPos(false);
    })();
  }, [targetDeptId]);

  const handleTransfer = async () => {
    if (!assignment || !targetPosId || !targetDeptId) { setError("Select target department and position."); return; }
    setSaving(true); setError("");
    const res = await transferEmployee(assignment.id, targetPosId, targetDeptId);
    if (!res.ok) { setError(res.error || "Transfer failed."); setSaving(false); return; }
    setSaving(false); onSaved(); onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Transfer Employee" width="max-w-[460px]" footer={
      <><button onClick={onClose} className={cancelBtnCls}>Cancel</button>
      <button onClick={handleTransfer} disabled={saving || !targetPosId} className={primaryBtnCls}>{saving ? "Transferring..." : "Transfer"}</button></>
    }>
      <ErrorBanner message={error} />
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
        <ArrowRightLeft size={16} className="text-[var(--text-dim)] shrink-0" />
        <div>
          <div className="text-[13px] font-medium text-[var(--text-primary)]">{contactName}</div>
          <div className="text-[11px] text-[var(--text-dim)]">Moving to a new position</div>
        </div>
      </div>
      <div>
        <FieldLabel>Target Department</FieldLabel>
        <select value={targetDeptId} onChange={(e) => setTargetDeptId(e.target.value)} className={selectCls}>
          <option value="">Select department...</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
        </select>
      </div>
      {targetDeptId && (
        <div>
          <FieldLabel>Target Position</FieldLabel>
          {loadingPos ? (
            <div className="h-10 flex items-center gap-2 text-[12px] text-[var(--text-dim)]"><Loader2 size={14} className="animate-spin" /> Loading...</div>
          ) : deptPositions.length === 0 ? (
            <div className="h-10 flex items-center text-[12px] text-[var(--text-dim)]">No positions available.</div>
          ) : (
            <select value={targetPosId} onChange={(e) => setTargetPosId(e.target.value)} className={selectCls}>
              <option value="">Select position...</option>
              {deptPositions.map((p) => <option key={p.id} value={p.id}>{p.title} (L{p.level})</option>)}
            </select>
          )}
        </div>
      )}
    </ModalShell>
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) { setName(role?.name || ""); setDescription(role?.description || ""); setError(""); }
  }, [open, role]);

  const handleSave = async () => {
    if (!name.trim()) { setError("Role name is required."); return; }
    setSaving(true); setError("");
    if (role) {
      const res = await updateRole(role.id, { name: name.trim(), description: description.trim() || null });
      if (!res.ok) { setError(res.error || "Failed."); setSaving(false); return; }
    } else {
      const res = await createRole({ name: name.trim(), description: description.trim() || null });
      if (res.error) { setError(res.error); setSaving(false); return; }
    }
    setSaving(false); onSaved(); onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose} title={role ? "Edit Role" : "New Role"} width="max-w-[420px]" footer={
      <><button onClick={onClose} className={cancelBtnCls}>Cancel</button>
      <button onClick={handleSave} disabled={saving || !name.trim()} className={primaryBtnCls}>{saving ? "Saving..." : role ? "Save" : "Create Role"}</button></>
    }>
      <ErrorBanner message={error} />
      <div>
        <FieldLabel>Role Name *</FieldLabel>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales Manager" autoFocus className={inputCls} />
      </div>
      <div>
        <FieldLabel>Description</FieldLabel>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role does..." rows={2} className={textareaCls} />
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════
   DELETE MODAL (with safe delete options)
   ═══════════════════════════════════════════════════ */
function DeleteModal({ open, target, departments, onClose, onConfirm, deleting }: {
  open: boolean;
  target: { type: "dept" | "pos" | "assign" | "role"; id: string; name: string } | null;
  departments: DepartmentRow[];
  onClose: () => void;
  onConfirm: (strategy?: "cascade" | "reassign", reassignId?: string) => void;
  deleting: boolean;
}) {
  const [strategy, setStrategy] = useState<"cascade" | "reassign">("cascade");
  const [reassignDeptId, setReassignDeptId] = useState("");

  useEffect(() => { if (open) { setStrategy("cascade"); setReassignDeptId(""); } }, [open]);

  if (!open || !target) return null;

  const title = target.type === "dept" ? "Delete Department" : target.type === "pos" ? "Delete Position" : target.type === "role" ? "Delete Role" : "Remove Assignment";

  return (
    <ModalShell open={open} onClose={onClose} title={title} width="max-w-[440px]" footer={
      <><button onClick={onClose} className={cancelBtnCls}>Cancel</button>
      <button onClick={() => onConfirm(target.type === "dept" ? strategy : undefined, reassignDeptId || undefined)} disabled={deleting || (target.type === "dept" && strategy === "reassign" && !reassignDeptId)} className={dangerBtnCls}>
        {deleting ? "Deleting..." : "Delete"}
      </button></>
    }>
      {target.type === "dept" ? (
        <div className="space-y-3">
          <p className="text-[13px] text-[var(--text-muted)]">Delete &ldquo;{target.name}&rdquo;? Choose what happens to its positions:</p>
          <div className="space-y-2">
            <button onClick={() => setStrategy("cascade")}
              className={`w-full text-start px-4 py-3 rounded-xl border transition-all ${strategy === "cascade" ? "border-red-500/30 bg-red-500/5" : "border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]"}`}>
              <div className="text-[13px] font-medium text-[var(--text-primary)]">Delete all positions</div>
              <div className="text-[11px] text-[var(--text-dim)] mt-0.5">All positions and assignments will be permanently removed.</div>
            </button>
            <button onClick={() => setStrategy("reassign")}
              className={`w-full text-start px-4 py-3 rounded-xl border transition-all ${strategy === "reassign" ? "border-blue-500/30 bg-blue-500/5" : "border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]"}`}>
              <div className="text-[13px] font-medium text-[var(--text-primary)]">Move positions to another department</div>
              <div className="text-[11px] text-[var(--text-dim)] mt-0.5">Positions and assignments will be transferred.</div>
            </button>
          </div>
          {strategy === "reassign" && (
            <div>
              <FieldLabel>Move to</FieldLabel>
              <select value={reassignDeptId} onChange={(e) => setReassignDeptId(e.target.value)} className={selectCls}>
                <option value="">Select department...</option>
                {departments.filter((d) => d.id !== target.id).map((d) => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
              </select>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-[var(--text-muted)]">
          {target.type === "pos"
            ? `Delete "${target.name}"? Subordinate positions will be reassigned to its parent. Assignments will be removed.`
            : target.type === "role"
              ? `Delete role "${target.name}"? Positions using this role will be unlinked.`
              : `Remove "${target.name}" from this position?`}
        </p>
      )}
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════
   POSITION DETAIL (history + JD)
   ═══════════════════════════════════════════════════ */
function PositionDetailModal({ open, onClose, position, contacts }: {
  open: boolean; onClose: () => void; position: PositionRow | null; contacts: ContactRef[];
}) {
  const [history, setHistory] = useState<PositionHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && position) {
      setLoading(true);
      fetchPositionHistory(position.id).then((h) => { setHistory(h); setLoading(false); });
    }
  }, [open, position]);

  const ctcMap = new Map(contacts.map((c) => [c.id, c]));

  return (
    <ModalShell open={open} onClose={onClose} title={position?.title || "Position Details"} width="max-w-[540px]">
      {position && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${LEVEL_COLORS[position.level] || LEVEL_COLORS[5]}`}>
              L{position.level} — {LEVEL_LABELS[position.level]}
            </span>
          </div>
          {position.description && (
            <div><FieldLabel>Description</FieldLabel><p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{position.description}</p></div>
          )}
          {position.responsibilities && (
            <div><FieldLabel>Responsibilities</FieldLabel>
              <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap bg-[var(--bg-surface)] rounded-xl p-3.5 border border-[var(--border-subtle)]">{position.responsibilities}</div>
            </div>
          )}
          {position.requirements && (
            <div><FieldLabel>Requirements</FieldLabel>
              <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap bg-[var(--bg-surface)] rounded-xl p-3.5 border border-[var(--border-subtle)]">{position.requirements}</div>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <History size={13} className="text-[var(--text-dim)]" />
              <FieldLabel>Position History</FieldLabel>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-[12px] text-[var(--text-dim)] py-4"><Loader2 size={14} className="animate-spin" /> Loading...</div>
            ) : history.length === 0 ? (
              <div className="text-[12px] text-[var(--text-dim)] py-4 text-center">No history yet.</div>
            ) : (
              <div className="relative pl-4 border-l border-[var(--border-subtle)] space-y-3">
                {history.map((h) => {
                  const ctc = ctcMap.get(h.contact_id);
                  return (
                    <div key={h.id} className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[var(--bg-surface)] border-2 border-[var(--border-strong)]" />
                      <div className="text-[12px] font-medium text-[var(--text-primary)]">{ctc?.name || "Unknown"}</div>
                      <div className="text-[11px] text-[var(--text-dim)] flex items-center gap-2">
                        <span className={`capitalize ${h.action === "assigned" ? "text-emerald-400" : h.action === "transferred" ? "text-blue-400" : "text-red-400"}`}>{h.action}</span>
                        <span>·</span>
                        <span>{new Date(h.created_at).toLocaleDateString()}</span>
                      </div>
                      {h.notes && <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{h.notes}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════
   ORG CHART — Real tree with connectors, DnD, animation
   ═══════════════════════════════════════════════════ */

function OrgChartCard({
  node, hasChildren, expanded, isDragOver, isDragging, showDept,
  onToggle, onAssign, onClick, onDragStart, onDragOver, onDragLeave, onDrop,
}: {
  node: OrgChartNode; hasChildren: boolean; expanded: boolean;
  isDragOver: boolean; isDragging: boolean; showDept: boolean;
  onToggle: () => void; onAssign: (posId: string) => void;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      className={`w-[240px] rounded-xl border bg-[var(--bg-secondary)] p-3 cursor-pointer group relative select-none transition-all duration-200
        ${isDragOver ? "ring-2 ring-blue-400 border-blue-400/50 scale-[1.02]" : "border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:shadow-lg hover:shadow-black/10"}
        ${isDragging ? "opacity-40 scale-95" : ""}
      `}>
      {/* Drag handle */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-50 transition-opacity cursor-grab active:cursor-grabbing">
        <GripVertical size={12} className="text-[var(--text-dim)]" />
      </div>

      {/* Person */}
      <div className="flex items-center gap-2.5 mb-2">
        <Avatar src={node.contact?.avatar} name={node.contact?.name || "?"} size={34} />
        <div className="min-w-0 flex-1">
          {node.contact ? (
            <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">{node.contact.name}</div>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); onAssign(node.position.id); }}
              className="text-[11px] text-[var(--text-dim)] hover:text-[var(--text-muted)] flex items-center gap-1 transition-colors">
              <UserPlus size={10} /> Assign
            </button>
          )}
          {node.contact?.email && <div className="text-[10px] text-[var(--text-dim)] truncate">{node.contact.email}</div>}
        </div>
      </div>

      {/* Position title */}
      <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate leading-tight">{node.position.title}</div>

      {/* Meta: level + department */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${LEVEL_COLORS[node.position.level] || LEVEL_COLORS[5]}`}>
          L{node.position.level}
        </span>
        {showDept && node.department && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[var(--bg-surface)] text-[var(--text-dim)] border border-[var(--border-faint)] truncate max-w-[120px]">
            {node.department.icon} {node.department.name}
          </span>
        )}
        {hasChildren && (
          <button onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="ml-auto w-5 h-5 flex items-center justify-center rounded-md hover:bg-[var(--bg-surface)] transition-colors">
            {expanded ? <ChevronUp size={11} className="text-[var(--text-dim)]" /> : <ChevronDown size={11} className="text-[var(--text-dim)]" />}
          </button>
        )}
      </div>
    </div>
  );
}

function OrgChartBranch({
  node, showDept, dragSourceId, dragOverId, allPositions,
  onAssign, onClickNode, setDragSourceId, setDragOverId, onDrop,
}: {
  node: OrgChartNode; showDept: boolean;
  dragSourceId: string | null; dragOverId: string | null;
  allPositions: PositionRow[];
  onAssign: (posId: string) => void;
  onClickNode: (pos: PositionRow) => void;
  setDragSourceId: (id: string | null) => void;
  setDragOverId: (id: string | null) => void;
  onDrop: (sourceId: string, targetId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      <OrgChartCard
        node={node}
        hasChildren={hasChildren}
        expanded={expanded}
        isDragOver={dragOverId === node.position.id}
        isDragging={dragSourceId === node.position.id}
        showDept={showDept}
        onToggle={() => setExpanded(!expanded)}
        onAssign={onAssign}
        onClick={() => onClickNode(node.position)}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", node.position.id);
          e.dataTransfer.effectAllowed = "move";
          setTimeout(() => setDragSourceId(node.position.id), 0);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (dragOverId !== node.position.id) setDragOverId(node.position.id);
        }}
        onDragLeave={() => { if (dragOverId === node.position.id) setDragOverId(null); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const sourceId = e.dataTransfer.getData("text/plain");
          if (sourceId && sourceId !== node.position.id) {
            onDrop(sourceId, node.position.id);
          }
          setDragSourceId(null);
          setDragOverId(null);
        }}
      />

      {/* Children with connectors + animation */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded && hasChildren ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"}`}>
        {hasChildren && (
          <>
            {/* Vertical connector from parent */}
            <div className="flex justify-center">
              <div className="w-px h-6 bg-[var(--border-color)]" />
            </div>

            {/* Children row */}
            <div className="flex">
              {node.children.map((child, i) => (
                <div key={child.position.id} className="flex flex-col items-center relative px-3 min-w-0">
                  {/* Horizontal connector segment */}
                  {node.children.length > 1 && (
                    <div className={`absolute top-0 h-px bg-[var(--border-color)] ${
                      i === 0 ? "left-1/2 right-0" :
                      i === node.children.length - 1 ? "left-0 right-1/2" :
                      "left-0 right-0"
                    }`} />
                  )}
                  {/* Vertical connector to child */}
                  <div className="w-px h-6 bg-[var(--border-color)]" />
                  {/* Recurse */}
                  <OrgChartBranch
                    node={child}
                    showDept={showDept}
                    dragSourceId={dragSourceId}
                    dragOverId={dragOverId}
                    allPositions={allPositions}
                    onAssign={onAssign}
                    onClickNode={onClickNode}
                    setDragSourceId={setDragSourceId}
                    setDragOverId={setDragOverId}
                    onDrop={onDrop}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PERMISSIONS EDITOR
   ═══════════════════════════════════════════════════ */
function PermissionsEditor({ roleId }: { roleId: string }) {
  const [perms, setPerms] = useState<Record<string, { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchPermissions(roleId).then((rows) => {
      const map: typeof perms = {};
      PERMISSION_MODULES.forEach((m) => { map[m] = { can_view: false, can_create: false, can_edit: false, can_delete: false }; });
      rows.forEach((r) => { if (map[r.module_name]) map[r.module_name] = { can_view: r.can_view, can_create: r.can_create, can_edit: r.can_edit, can_delete: r.can_delete }; });
      setPerms(map); setLoading(false);
    });
  }, [roleId]);

  const toggle = (mod: string, field: "can_view" | "can_create" | "can_edit" | "can_delete") => {
    setPerms((prev) => ({ ...prev, [mod]: { ...prev[mod], [field]: !prev[mod][field] } }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await upsertPermissions(roleId, Object.entries(perms).map(([module_name, p]) => ({ module_name, ...p })));
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 size={16} className="text-[var(--text-dim)] animate-spin" /></div>;

  const CheckCell = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button onClick={onChange}
      className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
        checked ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-transparent hover:border-[var(--border-focus)]"
      }`}>
      <Check size={12} />
    </button>
  );

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
              <th className="text-start py-2 px-2 font-medium">Module</th>
              <th className="text-center py-2 px-2 font-medium w-16">View</th>
              <th className="text-center py-2 px-2 font-medium w-16">Create</th>
              <th className="text-center py-2 px-2 font-medium w-16">Edit</th>
              <th className="text-center py-2 px-2 font-medium w-16">Delete</th>
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MODULES.map((mod) => (
              <tr key={mod} className="border-t border-[var(--border-faint)] hover:bg-[var(--bg-surface-subtle)] transition-colors">
                <td className="py-2 px-2 text-[var(--text-secondary)] font-medium">{mod}</td>
                <td className="py-2 px-2 text-center"><CheckCell checked={perms[mod]?.can_view} onChange={() => toggle(mod, "can_view")} /></td>
                <td className="py-2 px-2 text-center"><CheckCell checked={perms[mod]?.can_create} onChange={() => toggle(mod, "can_create")} /></td>
                <td className="py-2 px-2 text-center"><CheckCell checked={perms[mod]?.can_edit} onChange={() => toggle(mod, "can_edit")} /></td>
                <td className="py-2 px-2 text-center"><CheckCell checked={perms[mod]?.can_delete} onChange={() => toggle(mod, "can_delete")} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 mt-4">
        {saved && <span className="text-[12px] text-emerald-400 font-medium">Saved!</span>}
        <button onClick={handleSave} disabled={saving} className={primaryBtnCls}>{saving ? "Saving..." : "Save Permissions"}</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   EMPLOYEE PROFILE PANEL
   ═══════════════════════════════════════════════════ */
function EmployeeProfilePanel({ contactId, contacts, onClose, onOpenEmployee }: {
  contactId: string; contacts: ContactRef[];
  onClose: () => void; onOpenEmployee: (id: string) => void;
}) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchEmployeeProfile(contactId).then((p) => { setProfile(p); setLoading(false); });
  }, [contactId]);

  if (loading) return <Spinner />;
  if (!profile) return <EmptyState icon={User} title="Employee not found" />;

  const { contact, assignments, reportingChain, directReports, history } = profile;
  const primary = assignments.find((a) => a.is_primary) || assignments[0];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 pt-5 pb-4 border-b border-[var(--border-color)]">
        <button onClick={onClose}
          className="md:hidden flex items-center gap-1.5 text-[12px] text-[var(--text-dim)] mb-3 hover:text-[var(--text-muted)]">
          <ArrowLeft size={14} className="rtl:rotate-180" /> Back
        </button>
        <div className="flex items-center gap-4">
          <Avatar src={contact.avatar} name={contact.name} size={56} />
          <div className="flex-1 min-w-0">
            <h2 className="text-[20px] font-bold text-[var(--text-primary)] truncate">{contact.name}</h2>
            {primary && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[13px] text-[var(--text-secondary)]">{primary.position.title}</span>
                {primary.department && (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[var(--text-dim)] border border-[var(--border-faint)]">
                    {primary.department.icon} {primary.department.name}
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {contact.email && (
                <span className="flex items-center gap-1 text-[11px] text-[var(--text-dim)]"><Mail size={11} /> {contact.email}</span>
              )}
              {contact.phone && (
                <span className="flex items-center gap-1 text-[11px] text-[var(--text-dim)]"><Phone size={11} /> {contact.phone}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-6">
        {/* Current Positions */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Briefcase size={14} className="text-[var(--text-dim)]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">Current Positions</span>
          </div>
          <div className="space-y-2">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Briefcase size={14} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{a.position.title}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${LEVEL_COLORS[a.position.level] || LEVEL_COLORS[5]}`}>L{a.position.level}</span>
                    {a.is_primary && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/12 text-emerald-400/80">Primary</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {a.department && <span className="text-[11px] text-[var(--text-dim)]">{a.department.icon} {a.department.name}</span>}
                    {a.start_date && <><span className="text-[var(--text-dim)]">·</span><span className="text-[11px] text-[var(--text-dim)]">Since {a.start_date}</span></>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reporting Chain */}
        {reportingChain.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-[var(--text-dim)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">Reports To</span>
            </div>
            <div className="relative pl-4 border-l-2 border-[var(--border-subtle)] space-y-2">
              {reportingChain.map((r, i) => (
                <div key={r.position.id}
                  onClick={() => r.contact && onOpenEmployee(r.contact.id)}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] ${r.contact ? "cursor-pointer hover:border-[var(--border-strong)]" : ""} transition-all`}>
                  <div className={`absolute -left-[21px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 ${LEVEL_DOT[r.position.level] || "bg-slate-400"} border-[var(--bg-primary)]`} />
                  <Avatar src={r.contact?.avatar} name={r.contact?.name || "Vacant"} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">{r.contact?.name || "Vacant"}</div>
                    <div className="text-[11px] text-[var(--text-dim)] truncate">{r.position.title}</div>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${LEVEL_COLORS[r.position.level] || LEVEL_COLORS[5]}`}>L{r.position.level}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Direct Reports */}
        {directReports.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-[var(--text-dim)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">Direct Reports ({directReports.length})</span>
            </div>
            <div className="space-y-1.5">
              {directReports.map((r) => (
                <div key={r.position.id}
                  onClick={() => r.contact && onOpenEmployee(r.contact.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] ${r.contact ? "cursor-pointer hover:border-[var(--border-strong)]" : ""} transition-all`}>
                  <Avatar src={r.contact?.avatar} name={r.contact?.name || "Vacant"} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">{r.contact?.name || "Vacant"}</div>
                    <div className="text-[11px] text-[var(--text-dim)] truncate">{r.position.title}</div>
                  </div>
                  {r.department && <span className="text-[10px] text-[var(--text-dim)] shrink-0">{r.department.icon}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Position History */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <History size={14} className="text-[var(--text-dim)]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">History</span>
          </div>
          {history.length === 0 ? (
            <div className="text-[12px] text-[var(--text-dim)] text-center py-4">No history recorded yet.</div>
          ) : (
            <div className="relative pl-4 border-l border-[var(--border-subtle)] space-y-3">
              {history.map((h) => (
                <div key={h.id} className="relative">
                  <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-primary)] ${
                    h.action === "assigned" ? "bg-emerald-400" : h.action === "transferred" ? "bg-blue-400" : "bg-red-400"
                  }`} />
                  <div className="text-[12px] font-medium text-[var(--text-primary)] capitalize">{h.action}</div>
                  <div className="text-[11px] text-[var(--text-dim)]">{new Date(h.created_at).toLocaleDateString()}</div>
                  {h.notes && <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{h.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   HEADCOUNT DASHBOARD
   ═══════════════════════════════════════════════════ */
function HeadcountDashboard({ onDeptClick }: { onDeptClick: (deptId: string) => void }) {
  const [analytics, setAnalytics] = useState<HeadcountAnalytics | null>(null);
  const [activity, setActivity] = useState<PositionHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchHeadcountAnalytics(), fetchRecentActivity(20)]).then(([a, act]) => {
      setAnalytics(a); setActivity(act); setLoading(false);
    });
  }, []);

  if (loading) return <Spinner />;
  if (!analytics) return <EmptyState icon={BarChart3} title="No data available" />;

  const StatCard = ({ icon: Icon, label, value, sub, color }: {
    icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
  }) => (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}><Icon size={15} /></div>
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">{label}</span>
      </div>
      <div className="text-[28px] font-bold text-[var(--text-primary)] leading-none">{value}</div>
      {sub && <div className="text-[11px] text-[var(--text-dim)] mt-1">{sub}</div>}
    </div>
  );

  const maxDeptSize = Math.max(...analytics.departmentBreakdown.map((d) => d.total), 1);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 pt-5 pb-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <BarChart3 size={18} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Headcount Dashboard</h2>
            <p className="text-[12px] text-[var(--text-dim)]">Organization overview and workforce analytics</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Users} label="Employees" value={analytics.totalEmployees} color="bg-blue-500/10 text-blue-400" />
          <StatCard icon={Briefcase} label="Positions" value={analytics.totalPositions} sub={`${analytics.filledPositions} filled`} color="bg-violet-500/10 text-violet-400" />
          <StatCard icon={UserX} label="Vacant" value={analytics.vacantPositions} sub={`${analytics.vacancyRate.toFixed(1)}% rate`} color="bg-amber-500/10 text-amber-400" />
          <StatCard icon={Layers} label="Org Depth" value={analytics.maxOrgDepth} sub={`${analytics.avgSpanOfControl.toFixed(1)} avg reports`} color="bg-cyan-500/10 text-cyan-400" />
        </div>

        {/* Department Breakdown */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={14} className="text-[var(--text-dim)]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">Department Breakdown</span>
          </div>
          <div className="space-y-2">
            {analytics.departmentBreakdown.map((dept) => (
              <div key={dept.id}
                onClick={() => onDeptClick(dept.id)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] cursor-pointer hover:border-[var(--border-strong)] transition-all group">
                <span className="text-lg shrink-0">{dept.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">{dept.name}</span>
                    <span className="text-[11px] text-[var(--text-dim)] shrink-0 ml-2">{dept.filled}/{dept.total}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500 flex">
                      <div className="h-full bg-emerald-400/70 rounded-l-full" style={{ width: `${(dept.filled / maxDeptSize) * 100}%` }} />
                      <div className="h-full bg-amber-400/30 rounded-r-full" style={{ width: `${(dept.vacant / maxDeptSize) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Level Distribution */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Layers size={14} className="text-[var(--text-dim)]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">Level Distribution</span>
          </div>
          <div className="flex items-end gap-2 h-[120px] px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            {analytics.levelDistribution.map((l) => {
              const maxCount = Math.max(...analytics.levelDistribution.map((x) => x.count), 1);
              const height = (l.count / maxCount) * 100;
              return (
                <div key={l.level} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-[var(--text-primary)]">{l.count}</span>
                  <div className={`w-full rounded-t-md ${LEVEL_DOT[l.level] || "bg-slate-400"} transition-all duration-500`}
                    style={{ height: `${Math.max(height, 8)}%`, opacity: 0.7 }} />
                  <span className="text-[9px] text-[var(--text-dim)] text-center leading-tight">{l.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Feed */}
        {activity.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Activity size={14} className="text-[var(--text-dim)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">Recent Activity</span>
            </div>
            <div className="relative pl-4 border-l border-[var(--border-subtle)] space-y-2.5">
              {activity.slice(0, 10).map((h) => (
                <div key={h.id} className="relative">
                  <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-primary)] ${
                    h.action === "assigned" ? "bg-emerald-400" : h.action === "transferred" ? "bg-blue-400" : "bg-red-400"
                  }`} />
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold capitalize ${
                      h.action === "assigned" ? "text-emerald-400" : h.action === "transferred" ? "text-blue-400" : "text-red-400"
                    }`}>{h.action}</span>
                    <span className="text-[11px] text-[var(--text-dim)]">·</span>
                    <span className="text-[11px] text-[var(--text-dim)]">{new Date(h.created_at).toLocaleDateString()}</span>
                  </div>
                  {h.notes && <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{h.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════ */
export default function ManagementPage() {
  /* ── Data ── */
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [contacts, setContacts] = useState<ContactRef[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deptStats, setDeptStats] = useState<Record<string, { total: number; assigned: number }>>({});

  /* ── Full org chart data ── */
  const [fullOrgPositions, setFullOrgPositions] = useState<PositionRow[]>([]);
  const [fullOrgAssignments, setFullOrgAssignments] = useState<AssignmentRow[]>([]);
  const [fullOrgContacts, setFullOrgContacts] = useState<ContactRef[]>([]);
  const [fullOrgLoading, setFullOrgLoading] = useState(false);

  /* ── Selection ── */
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [rightView, setRightView] = useState<"dept" | "roles" | "fullchart" | "dashboard" | "employee">("dept");
  const [search, setSearch] = useState("");
  const [expandedTree, setExpandedTree] = useState<Set<string>>(new Set());
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "chart">("list");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  /* ── Org Chart Zoom ── */
  const [orgChartZoom, setOrgChartZoom] = useState(1);

  /* ── Drag & Drop ── */
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  /* ── Modals ── */
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editDept, setEditDept] = useState<DepartmentRow | null>(null);
  const [showPosModal, setShowPosModal] = useState(false);
  const [editPos, setEditPos] = useState<PositionRow | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editAssign, setEditAssign] = useState<AssignmentRow | null>(null);
  const [assignPosId, setAssignPosId] = useState<string>("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "dept" | "pos" | "assign" | "role"; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editRole, setEditRole] = useState<RoleRow | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAssignment, setTransferAssignment] = useState<AssignmentRow | null>(null);
  const [transferContactName, setTransferContactName] = useState("");
  const [showPosDetail, setShowPosDetail] = useState(false);
  const [detailPos, setDetailPos] = useState<PositionRow | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  /* ── Toast ── */
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); } }, [toast]);

  /* ── Initial load ── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [depts, ctcs, rls, stats] = await Promise.all([
        fetchDepartments(), fetchContactsForLinking(), fetchRoles(), fetchDeptStats(),
      ]);
      setDepartments(depts); setContacts(ctcs); setRoles(rls); setDeptStats(stats);
      const pIds = new Set<string>();
      depts.forEach((d) => { if (d.parent_id) pIds.add(d.parent_id); });
      setExpandedTree(pIds);
      setLoading(false);
    })();
  }, []);

  /* ── Load department detail ── */
  const loadDeptDetail = useCallback(async (deptId: string) => {
    setDetailLoading(true);
    const [pos, asgn] = await Promise.all([fetchPositions(deptId), fetchAssignments(deptId)]);
    setPositions(pos); setAssignments(asgn);
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    if (selectedDeptId && rightView === "dept") loadDeptDetail(selectedDeptId);
    else if (rightView !== "fullchart") { setPositions([]); setAssignments([]); }
  }, [selectedDeptId, rightView, loadDeptDetail]);

  /* ── Load full org chart ── */
  const loadFullOrgChart = useCallback(async () => {
    setFullOrgLoading(true);
    const data = await fetchFullOrgData();
    setFullOrgPositions(data.positions);
    setFullOrgAssignments(data.assignments);
    setFullOrgContacts(data.contacts);
    setDepartments(data.departments);
    setFullOrgLoading(false);
  }, []);

  useEffect(() => {
    if (rightView === "fullchart") loadFullOrgChart();
  }, [rightView, loadFullOrgChart]);

  const selectedDept = departments.find((d) => d.id === selectedDeptId) || null;
  const tree = useMemo(() => buildDepartmentTree(departments), [departments]);
  const contactMap = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  const filteredDepts = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return departments.filter((d) => d.name.toLowerCase().includes(q) || (d.description && d.description.toLowerCase().includes(q)));
  }, [departments, search]);

  const assignmentsByPos = useMemo(() => {
    const map = new Map<string, AssignmentRow[]>();
    assignments.forEach((a) => { const arr = map.get(a.position_id) || []; arr.push(a); map.set(a.position_id, arr); });
    return map;
  }, [assignments]);

  const analytics = useMemo(() => {
    const totalPositions = positions.length;
    const assignedPositions = new Set(assignments.map((a) => a.position_id)).size;
    return { totalPositions, assignedPositions, emptyPositions: totalPositions - assignedPositions, totalAssigned: assignments.length };
  }, [positions, assignments]);

  /* ── Org chart trees ── */
  const deptOrgChart = useMemo(
    () => buildOrgChart(positions, assignments, contacts, departments),
    [positions, assignments, contacts, departments],
  );

  const fullOrgChart = useMemo(
    () => rightView === "fullchart" ? buildOrgChart(fullOrgPositions, fullOrgAssignments, fullOrgContacts, departments) : [],
    [rightView, fullOrgPositions, fullOrgAssignments, fullOrgContacts, departments],
  );

  /* ── Handlers ── */
  const handleSelectDept = (dept: DepartmentRow) => {
    setSelectedDeptId(dept.id); setRightView("dept"); setMobileShowDetail(true);
  };

  const reloadAll = async () => {
    const [depts, stats, ctcs] = await Promise.all([fetchDepartments(), fetchDeptStats(), fetchContactsForLinking()]);
    setDepartments(depts); setDeptStats(stats); setContacts(ctcs);
    const pIds = new Set<string>();
    depts.forEach((d) => { if (d.parent_id) pIds.add(d.parent_id); });
    setExpandedTree(pIds);
  };

  const reloadRoles = async () => { setRoles(await fetchRoles()); };

  const handleDeptSaved = async () => { await reloadAll(); setToast(editDept ? "Department updated." : "Department created."); };
  const handlePosSaved = async () => {
    if (selectedDeptId) await loadDeptDetail(selectedDeptId);
    const stats = await fetchDeptStats(); setDeptStats(stats);
    setToast(editPos ? "Position updated." : "Position created.");
  };
  const handleAssignSaved = async () => { if (selectedDeptId) await loadDeptDetail(selectedDeptId); setToast(editAssign ? "Assignment updated." : "Employee assigned."); };
  const handleRoleSaved = async () => { await reloadRoles(); setToast(editRole ? "Role updated." : "Role created."); };
  const handleTransferSaved = async () => { if (selectedDeptId) await loadDeptDetail(selectedDeptId); setToast("Employee transferred."); };

  const handleContactCreated = (c: ContactRef) => {
    setContacts((prev) => [...prev, c]);
  };

  const handleDeleteConfirm = async (strategy?: "cascade" | "reassign", reassignId?: string) => {
    if (!deleteTarget) return;
    setDeleting(true);
    let ok = false;
    if (deleteTarget.type === "dept") {
      ok = (await safeDeleteDepartment(deleteTarget.id, strategy || "cascade", reassignId)).ok;
      if (ok && selectedDeptId === deleteTarget.id) { setSelectedDeptId(null); setMobileShowDetail(false); }
      if (ok) await reloadAll();
    } else if (deleteTarget.type === "pos") {
      ok = (await safeDeletePosition(deleteTarget.id)).ok;
      if (ok && selectedDeptId) await loadDeptDetail(selectedDeptId);
      if (ok) { const stats = await fetchDeptStats(); setDeptStats(stats); }
    } else if (deleteTarget.type === "assign") {
      ok = (await deleteAssignment(deleteTarget.id)).ok;
      if (ok && selectedDeptId) await loadDeptDetail(selectedDeptId);
    } else if (deleteTarget.type === "role") {
      ok = (await deleteRole(deleteTarget.id)).ok;
      if (ok) { await reloadRoles(); if (selectedRoleId === deleteTarget.id) setSelectedRoleId(null); }
    }
    setDeleting(false); setShowDeleteModal(false); setDeleteTarget(null);
    if (ok) setToast("Deleted.");
  };

  /* ── Drag & drop handler ── */
  const handleOrgDrop = async (sourceId: string, targetId: string) => {
    const posArr = rightView === "fullchart" ? fullOrgPositions : positions;
    if (detectCircularHierarchy(sourceId, targetId, posArr)) {
      setToast("Cannot move — would create circular hierarchy.");
      return;
    }
    const res = await movePosition(sourceId, targetId);
    if (!res.ok) { setToast(res.error || "Move failed."); return; }
    setToast("Position moved.");
    if (rightView === "fullchart") await loadFullOrgChart();
    else if (selectedDeptId) await loadDeptDetail(selectedDeptId);
  };

  const toggleTreeNode = (id: string) => {
    setExpandedTree((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  /* ── Tree node renderer ── */
  const renderTreeNode = (node: DeptTreeNode, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedTree.has(node.id);
    const isSelected = selectedDeptId === node.id && rightView === "dept";
    const stat = deptStats[node.id];

    return (
      <div key={node.id}>
        <div role="button" tabIndex={0} onClick={() => handleSelectDept(node)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleSelectDept(node); }}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-start transition-all duration-150 group cursor-pointer ${
            isSelected ? "bg-[var(--bg-surface-active)] shadow-[inset_3px_0_0_var(--text-subtle)]" : "hover:bg-[var(--bg-surface)]"
          }`}
          style={{ paddingInlineStart: `${12 + depth * 20}px` }}>
          {hasChildren ? (
            <button onClick={(e) => { e.stopPropagation(); toggleTreeNode(node.id); }}
              className="w-5 h-5 flex items-center justify-center rounded-md shrink-0 hover:bg-[var(--bg-surface-hover)]">
              {isExpanded ? <ChevronDown size={12} className="text-[var(--text-dim)]" /> : <ChevronRight size={12} className="text-[var(--text-dim)]" />}
            </button>
          ) : <div className="w-5 shrink-0" />}
          <DeptIcon dept={node} size={20} />
          <div className="flex-1 min-w-0">
            <div className={`text-[13px] font-medium truncate ${isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{node.name}</div>
          </div>
          {stat && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0 bg-[var(--bg-surface)] text-[var(--text-faint)]">
              {stat.assigned}/{stat.total}
            </span>
          )}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={(e) => { e.stopPropagation(); setEditDept(node); setShowDeptModal(true); }}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--bg-surface-hover)]"><Pencil size={11} className="text-[var(--text-dim)]" /></button>
            <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "dept", id: node.id, name: node.name }); setShowDeleteModal(true); }}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-400/[0.10]"><Trash2 size={11} className="text-red-400/60" /></button>
          </div>
        </div>
        {hasChildren && isExpanded && <div className="mt-0.5">{node.children.map((c) => renderTreeNode(c, depth + 1))}</div>}
      </div>
    );
  };

  /* ── Loading ── */
  if (loading) {
    return <div className="h-[calc(100vh-3.5rem)] bg-[var(--bg-primary)] flex items-center justify-center"><Loader2 size={24} className="text-[var(--text-dim)] animate-spin" /></div>;
  }

  /* ── Zoom helpers ── */
  const zoomIn = () => setOrgChartZoom((z) => Math.min(z + 0.15, 2));
  const zoomOut = () => setOrgChartZoom((z) => Math.max(z - 0.15, 0.3));
  const zoomReset = () => setOrgChartZoom(1);

  /* ── Open employee profile ── */
  const openEmployeeProfile = (contactId: string) => {
    setSelectedEmployeeId(contactId);
    setRightView("employee");
    setMobileShowDetail(true);
  };

  /* ── Render org chart helper ── */
  const renderOrgChart = (chartNodes: OrgChartNode[], posArr: PositionRow[], showDept: boolean, withZoom = false) => (
    <div className="overflow-auto pb-8 relative flex-1">
      {withZoom && (
        <div className="sticky top-2 left-2 z-10 flex items-center gap-1 mb-2 ml-2">
          <button onClick={zoomIn} className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center hover:bg-[var(--bg-surface)] transition-colors" title="Zoom in">
            <ZoomIn size={14} className="text-[var(--text-dim)]" />
          </button>
          <button onClick={zoomOut} className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center hover:bg-[var(--bg-surface)] transition-colors" title="Zoom out">
            <ZoomOut size={14} className="text-[var(--text-dim)]" />
          </button>
          <button onClick={zoomReset} className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center hover:bg-[var(--bg-surface)] transition-colors" title="Reset zoom">
            <RotateCcw size={14} className="text-[var(--text-dim)]" />
          </button>
          <span className="text-[10px] font-medium text-[var(--text-dim)] ml-1">{Math.round(orgChartZoom * 100)}%</span>
        </div>
      )}
      <div className="flex justify-center gap-6 pt-4 min-w-max origin-top transition-transform duration-200"
        style={withZoom ? { transform: `scale(${orgChartZoom})` } : undefined}>
        {chartNodes.map((node) => (
          <OrgChartBranch
            key={node.position.id}
            node={node}
            showDept={showDept}
            dragSourceId={dragSourceId}
            dragOverId={dragOverId}
            allPositions={posArr}
            onAssign={(posId) => { setAssignPosId(posId); setEditAssign(null); setShowAssignModal(true); }}
            onClickNode={(pos) => { setDetailPos(pos); setShowPosDetail(true); }}
            setDragSourceId={setDragSourceId}
            setDragOverId={setDragOverId}
            onDrop={handleOrgDrop}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-[var(--bg-primary)] text-[var(--text-primary)] flex overflow-hidden max-w-[100vw]"
      onDragEnd={() => { setDragSourceId(null); setDragOverId(null); }}>

      {/* ═══════════ LEFT PANEL ═══════════ */}
      <div className={`${mobileShowDetail ? "hidden md:flex" : "flex"} flex-col w-full md:w-[340px] lg:w-[380px] md:border-e border-[var(--border-color)] shrink-0 h-full bg-[var(--bg-secondary)] min-w-0`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2.5 mb-3">
              <Link href="/" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                <ArrowLeft size={16} className="rtl:rotate-180" />
              </Link>
              <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
                <Network size={16} />
              </div>
              <h1 className="text-[16px] font-bold text-[var(--text-primary)] truncate flex-1">Management</h1>
              <button onClick={() => { setEditDept(null); setShowDeptModal(true); }}
                className="h-8 w-8 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 flex items-center justify-center transition-colors shrink-0">
                <Plus size={16} />
              </button>
            </div>

            <div className="relative">
              <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search departments..."
                className="w-full h-9 ps-9 pe-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors" />
              {search && <button onClick={() => setSearch("")} className="absolute end-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-primary)]"><X size={14} /></button>}
            </div>

            <div className="mt-2.5 text-[11px] font-medium text-[var(--text-faint)]">
              {departments.length} department{departments.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Department tree */}
          <div className="flex-1 overflow-y-auto will-change-scroll px-2.5 py-2 space-y-0.5">
            {departments.length === 0 ? (
              <EmptyState icon={Building2} title="No departments yet" subtitle="Create your first department to get started." />
            ) : filteredDepts ? (
              filteredDepts.map((dept) => (
                <button key={dept.id} onClick={() => handleSelectDept(dept)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-start transition-all group ${
                    selectedDeptId === dept.id ? "bg-[var(--bg-surface-active)]" : "hover:bg-[var(--bg-surface)]"
                  }`}>
                  <DeptIcon dept={dept} size={20} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate text-[var(--text-secondary)]">{dept.name}</div>
                  </div>
                </button>
              ))
            ) : tree.map((node) => renderTreeNode(node))}
          </div>

          {/* Bottom links */}
          <div className="px-3 py-2 border-t border-[var(--border-color)] space-y-1">
            <button onClick={() => { setRightView("dashboard"); setSelectedDeptId(null); setMobileShowDetail(true); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-start transition-all ${
                rightView === "dashboard" ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
              }`}>
              <BarChart3 size={16} />
              <span className="text-[13px] font-medium">Dashboard</span>
            </button>
            <button onClick={() => { setRightView("fullchart"); setSelectedDeptId(null); setMobileShowDetail(true); setOrgChartZoom(1); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-start transition-all ${
                rightView === "fullchart" ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
              }`}>
              <Globe size={16} />
              <span className="text-[13px] font-medium">Full Org Chart</span>
            </button>
            <button onClick={() => { setRightView("roles"); setSelectedDeptId(null); setMobileShowDetail(true); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-start transition-all ${
                rightView === "roles" ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
              }`}>
              <Shield size={16} />
              <span className="text-[13px] font-medium">Roles & Permissions</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════ RIGHT PANEL ═══════════ */}
      <div className={`${mobileShowDetail ? "flex" : "hidden md:flex"} flex-col flex-1 min-w-0 h-full bg-[var(--bg-primary)]`}>

        {/* ── DASHBOARD VIEW ── */}
        {rightView === "dashboard" ? (
          <HeadcountDashboard onDeptClick={(deptId) => {
            const dept = departments.find((d) => d.id === deptId);
            if (dept) handleSelectDept(dept);
          }} />
        ) : rightView === "employee" && selectedEmployeeId ? (
          /* ── EMPLOYEE PROFILE VIEW ── */
          <EmployeeProfilePanel
            contactId={selectedEmployeeId}
            contacts={contacts}
            onClose={() => { setRightView("dept"); setMobileShowDetail(false); }}
            onOpenEmployee={openEmployeeProfile}
          />
        ) : rightView === "fullchart" ? (
          /* ── FULL ORG CHART VIEW ── */
          <div className="flex flex-col h-full">
            <div className="px-4 md:px-6 pt-5 pb-4 border-b border-[var(--border-color)]">
              <button onClick={() => { setMobileShowDetail(false); setRightView("dept"); }}
                className="md:hidden flex items-center gap-1.5 text-[12px] text-[var(--text-dim)] mb-3 hover:text-[var(--text-muted)]">
                <ArrowLeft size={14} className="rtl:rotate-180" /> Back
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Globe size={18} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Company Org Chart</h2>
                  <p className="text-[12px] text-[var(--text-dim)]">Drag & drop to reorganize hierarchy</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {fullOrgLoading ? <Spinner /> : fullOrgChart.length === 0 ? (
                <EmptyState icon={GitBranchPlus} title="No positions to visualize" subtitle="Create departments and positions first." />
              ) : renderOrgChart(fullOrgChart, fullOrgPositions, true, true)}
            </div>
          </div>
        ) : rightView === "roles" ? (
          /* ── ROLES VIEW ── */
          <div className="flex flex-col h-full">
            <div className="px-4 md:px-6 pt-5 pb-4 border-b border-[var(--border-color)]">
              <button onClick={() => { setMobileShowDetail(false); setRightView("dept"); }}
                className="md:hidden flex items-center gap-1.5 text-[12px] text-[var(--text-dim)] mb-3 hover:text-[var(--text-muted)]">
                <ArrowLeft size={14} className="rtl:rotate-180" /> Back
              </button>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <Shield size={18} className="text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Roles & Permissions</h2>
                    <p className="text-[12px] text-[var(--text-dim)]">Manage access control across modules</p>
                  </div>
                </div>
                <button onClick={() => { setEditRole(null); setShowRoleModal(true); }}
                  className="h-8 px-3.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 transition-all">
                  <Plus size={13} /> New Role
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {roles.length === 0 ? (
                <EmptyState icon={Shield} title="No roles defined" subtitle="Create roles and assign module permissions." />
              ) : (
                <div className="px-4 md:px-6 py-4 space-y-3">
                  {roles.map((role) => (
                    <div key={role.id} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 group">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                          <Shield size={14} className="text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-semibold text-[var(--text-primary)]">{role.name}</div>
                          {role.description && <p className="text-[11px] text-[var(--text-dim)] truncate">{role.description}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSelectedRoleId(selectedRoleId === role.id ? null : role.id)}
                            className={`h-7 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                              selectedRoleId === role.id ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "hover:bg-[var(--bg-surface)] text-[var(--text-faint)]"
                            }`}>
                            {selectedRoleId === role.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            Permissions
                          </button>
                          <button onClick={() => { setEditRole(role); setShowRoleModal(true); }}
                            className="w-7 h-7 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-surface-hover)] transition-all">
                            <Pencil size={11} className="text-[var(--text-dim)]" />
                          </button>
                          <button onClick={() => { setDeleteTarget({ type: "role", id: role.id, name: role.name }); setShowDeleteModal(true); }}
                            className="w-7 h-7 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-400/10 transition-all">
                            <Trash2 size={11} className="text-red-400/60" />
                          </button>
                        </div>
                      </div>
                      {selectedRoleId === role.id && (
                        <div className="px-4 pb-4 border-t border-[var(--border-color)]">
                          <div className="pt-3"><PermissionsEditor roleId={role.id} /></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : !selectedDept ? (
          /* ── EMPTY STATE ── */
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-surface-subtle)] flex items-center justify-center mb-4">
              <Building2 size={28} className="text-[var(--text-dim)]" />
            </div>
            <p className="text-[15px] font-semibold text-[var(--text-secondary)] mb-1">Select a department</p>
            <p className="text-[12px] text-[var(--text-dim)]">Choose a department to manage positions and people.</p>
          </div>
        ) : (
          /* ── DEPARTMENT DETAIL ── */
          <>
            <div className="px-4 md:px-6 pt-5 pb-4 border-b border-[var(--border-color)]">
              <button onClick={() => setMobileShowDetail(false)}
                className="md:hidden flex items-center gap-1.5 text-[12px] text-[var(--text-dim)] mb-3 hover:text-[var(--text-muted)]">
                <ArrowLeft size={14} className="rtl:rotate-180" /> All Departments
              </button>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 overflow-hidden">
                    <DeptIcon dept={selectedDept} size={28} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[18px] font-bold text-[var(--text-primary)] truncate">{selectedDept.name}</h2>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {(() => {
                        const head = getDepartmentHead(positions, assignments, contacts);
                        return head ? <span className="text-[12px] text-[var(--text-secondary)]">{head.name} — {head.title}</span> : null;
                      })()}
                      {selectedDept.description && <span className="text-[12px] text-[var(--text-dim)]">{selectedDept.description}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => { setEditDept(selectedDept); setShowDeptModal(true); }}
                    className="h-8 w-8 rounded-lg flex items-center justify-center border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-colors">
                    <Pencil size={13} className="text-[var(--text-dim)]" />
                  </button>
                  <button onClick={() => { setDeleteTarget({ type: "dept", id: selectedDept.id, name: selectedDept.name }); setShowDeleteModal(true); }}
                    className="h-8 w-8 rounded-lg flex items-center justify-center border border-[var(--border-subtle)] hover:bg-red-400/[0.08] transition-colors">
                    <Trash2 size={13} className="text-red-400/60" />
                  </button>
                </div>
              </div>

              {/* Analytics + View toggle */}
              <div className="flex items-center justify-between mt-3 gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)]">
                    <Briefcase size={12} className="text-[var(--text-dim)]" />
                    <span className="text-[11px] font-medium text-[var(--text-secondary)]">{analytics.totalPositions} positions</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/10">
                    <Users size={12} className="text-emerald-400/70" />
                    <span className="text-[11px] font-medium text-emerald-400/70">{analytics.totalAssigned} assigned</span>
                  </div>
                  {analytics.emptyPositions > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/[0.06] border border-amber-500/10">
                      <AlertCircle size={12} className="text-amber-400/70" />
                      <span className="text-[11px] font-medium text-amber-400/70">{analytics.emptyPositions} vacant</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center border border-[var(--border-subtle)] rounded-lg overflow-hidden shrink-0">
                  <button onClick={() => setViewMode("list")}
                    className={`h-7 px-2.5 flex items-center gap-1 text-[11px] font-medium transition-colors ${viewMode === "list" ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-muted)]"}`}>
                    <LayoutList size={12} /> List
                  </button>
                  <button onClick={() => setViewMode("chart")}
                    className={`h-7 px-2.5 flex items-center gap-1 text-[11px] font-medium transition-colors ${viewMode === "chart" ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-muted)]"}`}>
                    <GitBranchPlus size={12} /> Org Chart
                  </button>
                </div>
              </div>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto">
              {detailLoading ? <Spinner /> : viewMode === "chart" ? (
                /* ── DEPT ORG CHART ── */
                <div className="px-4 md:px-6 py-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-dim)]">Organizational Chart</h3>
                    <button onClick={() => { setEditPos(null); setShowPosModal(true); }}
                      className="h-8 px-3 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-all">
                      <Plus size={12} /> Add Position
                    </button>
                  </div>
                  {positions.length === 0 ? (
                    <EmptyState icon={GitBranchPlus} title="No positions to visualize" subtitle="Create positions to see the org chart." />
                  ) : renderOrgChart(deptOrgChart, positions, false)}
                </div>
              ) : (
                /* ── LIST VIEW ── */
                <div className="px-4 md:px-6 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-dim)]">Positions</h3>
                    <button onClick={() => { setEditPos(null); setShowPosModal(true); }}
                      className="h-8 px-3 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-all">
                      <Plus size={12} /> Add Position
                    </button>
                  </div>

                  {positions.length === 0 ? (
                    <EmptyState icon={Briefcase} title="No positions defined yet" subtitle="Create positions, then assign people to them." />
                  ) : (
                    positions.map((pos) => {
                      const posAssignments = assignmentsByPos.get(pos.id) || [];
                      const roleName = pos.role_id ? roles.find((r) => r.id === pos.role_id)?.name : null;

                      return (
                        <div key={pos.id} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden hover:border-[var(--border-strong)] transition-all duration-200">
                          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-faint)] group">
                            <div className="w-9 h-9 rounded-lg bg-violet-500/[0.10] border border-violet-500/15 flex items-center justify-center shrink-0">
                              <Briefcase size={15} className="text-violet-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[14px] font-semibold text-[var(--text-primary)]">{pos.title}</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${LEVEL_COLORS[pos.level] || LEVEL_COLORS[5]}`}>L{pos.level}</span>
                                {roleName && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-400/80 border border-violet-500/15">{roleName}</span>}
                              </div>
                              {pos.description && <p className="text-[11px] text-[var(--text-dim)] truncate mt-0.5">{pos.description}</p>}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setDetailPos(pos); setShowPosDetail(true); }}
                                className="h-7 px-2 rounded-md text-[11px] font-medium flex items-center gap-1 hover:bg-[var(--bg-surface)] text-[var(--text-faint)] transition-colors">
                                <FileText size={11} /> Details
                              </button>
                              <button onClick={() => { setAssignPosId(pos.id); setEditAssign(null); setShowAssignModal(true); }}
                                className="h-7 px-2 rounded-md text-[11px] font-medium flex items-center gap-1 hover:bg-[var(--bg-surface)] text-[var(--text-faint)] transition-colors">
                                <UserPlus size={11} /> Assign
                              </button>
                              <button onClick={() => { setEditPos(pos); setShowPosModal(true); }}
                                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--bg-surface-hover)]">
                                <Pencil size={11} className="text-[var(--text-dim)]" />
                              </button>
                              <button onClick={() => { setDeleteTarget({ type: "pos", id: pos.id, name: pos.title }); setShowDeleteModal(true); }}
                                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-400/[0.10]">
                                <Trash2 size={11} className="text-red-400/60" />
                              </button>
                            </div>
                          </div>

                          {posAssignments.length === 0 ? (
                            <div className="px-4 py-3">
                              <button onClick={() => { setAssignPosId(pos.id); setEditAssign(null); setShowAssignModal(true); }}
                                className="text-[12px] flex items-center gap-1.5 text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors">
                                <UserPlus size={12} /> Assign someone to this position
                              </button>
                            </div>
                          ) : (
                            <div className="divide-y divide-[var(--border-faint)]">
                              {posAssignments.map((a) => {
                                const ctc = contactMap.get(a.contact_id);
                                return (
                                  <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 group/row hover:bg-[var(--bg-surface-subtle)] transition-colors">
                                    <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); if (ctc) openEmployeeProfile(ctc.id); }}>
                                      <Avatar src={ctc?.avatar} name={ctc?.name || "?"} size={32} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[13px] font-medium text-[var(--text-primary)] truncate cursor-pointer hover:underline"
                                          onClick={(e) => { e.stopPropagation(); if (ctc) openEmployeeProfile(ctc.id); }}>{ctc?.name || "Unknown"}</span>
                                        {a.is_primary && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/[0.12] text-emerald-400/80">Primary</span>}
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        {ctc?.email && <span className="text-[11px] text-[var(--text-dim)] truncate">{ctc.email}</span>}
                                        {a.start_date && <><span className="text-[var(--text-dim)]">·</span><span className="text-[11px] text-[var(--text-dim)]">Since {a.start_date}</span></>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                      <button onClick={() => { setTransferAssignment(a); setTransferContactName(ctc?.name || "Employee"); setShowTransferModal(true); }}
                                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--bg-surface-hover)]" title="Transfer">
                                        <ArrowRightLeft size={11} className="text-[var(--text-dim)]" />
                                      </button>
                                      <button onClick={() => { setAssignPosId(a.position_id); setEditAssign(a); setShowAssignModal(true); }}
                                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--bg-surface-hover)]" title="Edit">
                                        <Pencil size={10} className="text-[var(--text-dim)]" />
                                      </button>
                                      <button onClick={() => { setDeleteTarget({ type: "assign", id: a.id, name: ctc?.name || "this assignment" }); setShowDeleteModal(true); }}
                                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-400/[0.10]" title="Remove">
                                        <Trash2 size={10} className="text-red-400/60" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="px-5 py-2.5 rounded-xl text-[13px] font-medium shadow-2xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] border border-[var(--border-subtle)]">{toast}</div>
        </div>
      )}

      {/* ═══════════ MODALS ═══════════ */}
      <DepartmentModal open={showDeptModal} onClose={() => setShowDeptModal(false)} dept={editDept} departments={departments} onSaved={handleDeptSaved} />

      {selectedDeptId && (
        <>
          <PositionModal open={showPosModal} onClose={() => setShowPosModal(false)}
            position={editPos} departmentId={selectedDeptId} allPositions={positions} roles={roles} onSaved={handlePosSaved} />
          <AssignmentModal open={showAssignModal} onClose={() => setShowAssignModal(false)}
            assignment={editAssign} positionId={assignPosId} departmentId={selectedDeptId}
            contacts={contacts} onSaved={handleAssignSaved} onContactCreated={handleContactCreated} />
        </>
      )}

      <TransferModal open={showTransferModal} onClose={() => setShowTransferModal(false)}
        assignment={transferAssignment} contactName={transferContactName}
        departments={departments} onSaved={handleTransferSaved} />

      <RoleModal open={showRoleModal} onClose={() => setShowRoleModal(false)} role={editRole} onSaved={handleRoleSaved} />

      <PositionDetailModal open={showPosDetail} onClose={() => setShowPosDetail(false)}
        position={detailPos} contacts={contacts} />

      <DeleteModal open={showDeleteModal} target={deleteTarget} departments={departments}
        onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
        onConfirm={handleDeleteConfirm} deleting={deleting} />
    </div>
  );
}
