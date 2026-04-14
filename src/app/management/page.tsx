"use client";

/* ---------------------------------------------------------------------------
   Management — Organizational engine for Koleex Hub.

   Features:
     • Department hierarchy (tree sidebar)
     • Position management + reports_to hierarchy
     • Employee assignment (person picker + inline create)
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
import ZoomInIcon from "@/components/icons/ui/ZoomInIcon";
import ZoomOutIcon from "@/components/icons/ui/ZoomOutIcon";
import CodeIcon from "@/components/icons/ui/CodeIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import UserPlusIcon from "@/components/icons/ui/UserPlusIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import UserIcon from "@/components/icons/ui/UserIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import NetworkIcon from "@/components/icons/ui/NetworkIcon";
import LayoutListIcon from "@/components/icons/ui/LayoutListIcon";
import GitBranchPlusIcon from "@/components/icons/ui/GitBranchPlusIcon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import HistoryIcon from "@/components/icons/ui/HistoryIcon";
import AngleUpIcon from "@/components/icons/ui/AngleUpIcon";
import ArrowRightLeftIcon from "@/components/icons/ui/ArrowRightLeftIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import GripVerticalIcon from "@/components/icons/ui/GripVerticalIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import SmileIcon from "@/components/icons/ui/SmileIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import ActivityIcon from "@/components/icons/ui/ActivityIcon";
import UndoIcon from "@/components/icons/ui/UndoIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import TrendingUpIcon from "@/components/icons/ui/TrendingUpIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import UserCheckIcon from "@/components/icons/ui/UserCheckIcon";
import UserXIcon from "@/components/icons/ui/UserXIcon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import Undo2Icon from "@/components/icons/ui/Undo2Icon";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import BuildingIcon from "@/components/icons/ui/BuildingIcon";
import WrenchIcon from "@/components/icons/ui/WrenchIcon";
import HeartIcon from "@/components/icons/ui/HeartIcon";
import TruckIcon from "@/components/icons/ui/TruckIcon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import HeadphonesIcon from "@/components/icons/ui/HeadphonesIcon";
import ScaleIcon from "@/components/icons/ui/ScaleIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import CpuIcon from "@/components/icons/ui/CpuIcon";
import PaletteIcon from "@/components/icons/ui/PaletteIcon";
import GraduationCapIcon from "@/components/icons/ui/GraduationCapIcon";
import WarehouseIcon from "@/components/icons/ui/WarehouseIcon";
import StethoscopeIcon from "@/components/icons/ui/StethoscopeIcon";
import LockIcon from "@/components/icons/ui/LockIcon";
import RadioIcon from "@/components/icons/ui/RadioIcon";
import ShoppingCartIcon from "@/components/icons/ui/ShoppingCartIcon";
import PlaneIcon from "@/components/icons/ui/PlaneIcon";
import FlaskConicalIcon from "@/components/icons/ui/FlaskConicalIcon";
import RulerIcon from "@/components/icons/ui/RulerIcon";
import TargetIcon from "@/components/icons/ui/TargetIcon";
import LightbulbIcon from "@/components/icons/ui/LightbulbIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import RocketIcon from "@/components/icons/ui/RocketIcon";
import CreditCardIcon from "@/components/icons/ui/CreditCardIcon";
import MegaphoneIcon from "@/components/icons/ui/MegaphoneIcon";
import MonitorIcon from "@/components/icons/ui/MonitorIcon";
import LandmarkIcon from "@/components/icons/ui/LandmarkIcon";
import PieChartIcon from "@/components/icons/ui/PieChartIcon";
import SettingsIcon2 from "@/components/icons/ui/SettingsIcon2";
import HandshakeIcon from "@/components/icons/ui/HandshakeIcon";
import ManagementIcon from "@/components/icons/ManagementIcon";
import { APP_REGISTRY } from "@/lib/navigation";
import { useTranslation } from "@/lib/i18n";
import { managementT } from "@/lib/translations/management";
import {
  fetchDepartments, createDepartment, updateDepartment, safeDeleteDepartment,
  fetchPositions, createPosition, updatePosition, safeDeletePosition, movePosition, duplicatePosition,
  fetchAssignments, createAssignment, updateAssignment, deleteAssignment,
  fetchPeopleForLinking, createInlinePerson,
  buildDepartmentTree, buildOrgChart, getDepartmentHead, detectCircularHierarchy,
  fetchRoles, createRole, updateRole, deleteRole, cloneRole,
  fetchPermissions, upsertPermissions,
  fetchPositionHistory, addPositionHistory,
  transferEmployee, fetchFullOrgData, fetchDeptStats,
  fetchEmployeeProfile, fetchRecentActivity, fetchHeadcountAnalytics,
  uploadManagementIcon,
  type DepartmentRow, type PositionRow, type AssignmentRow,
  type DeptTreeNode, type PersonRef, type OrgChartNode,
  type RoleRow, type PermissionRow, type PositionHistoryRow,
  type EmployeeProfile, type HeadcountAnalytics,
} from "@/lib/management-admin";

/* ═══════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════ */

/** Icon map for department icon picker. Key = stored string, value = component. */
const DEPT_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  building2: Building2Icon, building: BuildingIcon, briefcase: BriefcaseIcon, users: UsersIcon,
  shield: ShieldIcon, globe: GlobeIcon, "trending-up": TrendingUpIcon, "bar-chart": BarChart3Icon,
  "credit-card": CreditCardIcon, megaphone: MegaphoneIcon, code: CodeIcon, wrench: WrenchIcon,
  heart: HeartIcon, truck: TruckIcon, "book-open": BookOpenIcon, headphones: HeadphonesIcon,
  scale: ScaleIcon, factory: FactoryIcon, cpu: CpuIcon, palette: PaletteIcon,
  "graduation-cap": GraduationCapIcon, warehouse: WarehouseIcon, stethoscope: StethoscopeIcon,
  lock: LockIcon, radio: RadioIcon, "shopping-cart": ShoppingCartIcon, plane: PlaneIcon,
  flask: FlaskConicalIcon, ruler: RulerIcon, target: TargetIcon, lightbulb: LightbulbIcon,
  package: PackageIcon, rocket: RocketIcon, monitor: MonitorIcon, landmark: LandmarkIcon,
  "pie-chart": PieChartIcon, settings: SettingsIcon2, handshake: HandshakeIcon, network: NetworkIcon,
  mail: EnvelopeIcon, layers: LayersIcon, "file-text": DocumentIcon, activity: ActivityIcon,
};
const DEPT_ICON_KEYS = Object.keys(DEPT_ICON_MAP);

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

/** Permission module groups — maps to real apps from APP_REGISTRY */
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

/** Translate a department name — falls back to original if no translation key exists. */
function deptName(name: string, t: (k: string) => string): string {
  const key = `dept.${name}`;
  const v = t(key);
  return v === key ? name : v;
}

/** Translate a position title — falls back to original if no translation key exists. */
function posTitle(title: string, t: (k: string) => string): string {
  const key = `pos.${title}`;
  const v = t(key);
  return v === key ? title : v;
}

/** Lookup app icon by permission module name */
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
const selectCls = inputCls;
const cancelBtnCls = "h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-subtle)] hover:bg-[var(--bg-surface)] transition-colors";
const primaryBtnCls = "h-10 px-5 rounded-xl text-[13px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-30 transition-all";
const dangerBtnCls = "h-10 px-5 rounded-xl text-[13px] font-semibold bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 disabled:opacity-50 transition-all";

function ModalShell({ open, onClose, title, width, children, footer }: {
  open: boolean; onClose: () => void; title: string; width?: string;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  /* Lock background scroll when modal is open */
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] mb-1.5">{children}</label>;
}

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] flex items-center gap-2"><ExclamationIcon size={14} /> {message}</div>;
}

function Avatar({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0 text-[var(--text-dim)]" style={{ width: size, height: size }}>
      {size >= 28 ? <span className="font-semibold" style={{ fontSize: size * 0.38 }}>{initials || <UserIcon size={size * 0.45} />}</span> : <UserIcon size={size * 0.5} />}
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-[var(--text-dim)]">
      <div className="w-14 h-14 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center mb-4">
        <Icon size={24} className="opacity-40" />
      </div>
      <p className="text-[14px] font-semibold text-[var(--text-secondary)] mb-1">{title}</p>
      {subtitle && <p className="text-[12px] text-[var(--text-dim)]">{subtitle}</p>}
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center py-16"><SpinnerIcon size={20} className="text-[var(--text-dim)] animate-spin" /></div>;
}

/** Department icon renderer — system-style: uploaded images in rounded containers, emoji fallback */
function DeptIcon({ dept, size = 34 }: { dept: DepartmentRow; size?: number }) {
  const iconSize = Math.round(size * 0.5);
  // Uploaded / URL image
  if (dept.icon_type === "image" && dept.icon_value) {
    return (
      <div className="rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center overflow-hidden shrink-0"
        style={{ width: size, height: size }}>
        <img src={dept.icon_value} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  // Lucide icon (stored as icon_type="icon", icon_value="building2" etc.)
  const iconKey = dept.icon_type === "icon" && dept.icon_value ? dept.icon_value : "building2";
  const IconComp = DEPT_ICON_MAP[iconKey] || Building2Icon;
  return (
    <div className="rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}>
      <IconComp size={iconSize} className="text-[var(--text-muted)]" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DEPARTMENT MODAL (emoji picker + image URL)
   ═══════════════════════════════════════════════════ */
function DepartmentModal({
  open, onClose, dept, departments, onSaved, t,
}: {
  open: boolean; onClose: () => void;
  dept: DepartmentRow | null; departments: DepartmentRow[];
  onSaved: () => void; t: (key: string) => string;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("building2");
  const [iconTab, setIconTab] = useState<"icon" | "upload">("icon");
  const [iconUrl, setIconUrl] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showIcons, setShowIcons] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(dept?.name || "");
      setDescription(dept?.description || "");
      setSelectedIcon(dept?.icon_type === "icon" && dept?.icon_value ? dept.icon_value : "building2");
      setIconTab(dept?.icon_type === "image" ? "upload" : "icon");
      setIconUrl(dept?.icon_type === "image" ? dept?.icon_value || "" : "");
      setParentId(dept?.parent_id || null);
      setError(""); setShowIcons(false); setUploading(false);
    }
  }, [open, dept]);

  const parentOptions = departments.filter((d) => d.id !== dept?.id);

  const handleFileUpload = async (file: File) => {
    setUploading(true); setError("");
    const res = await uploadManagementIcon(file);
    if (res.error) { setError(res.error); setUploading(false); return; }
    setIconUrl(res.url);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError(t("mgmt.deptNameReq")); return; }
    setSaving(true); setError("");
    const isUpload = iconTab === "upload" && iconUrl.trim();
    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || null,
      icon: selectedIcon,
      icon_type: isUpload ? "image" : "icon",
      icon_value: isUpload ? iconUrl.trim() : selectedIcon,
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
    <ModalShell open={open} onClose={onClose} title={dept ? t("mgmt.editDept") : t("mgmt.newDept")} footer={
      <><button onClick={onClose} className={cancelBtnCls}>{t("mgmt.cancel")}</button>
      <button onClick={handleSave} disabled={saving || !name.trim()} className={primaryBtnCls}>{saving ? t("mgmt.saving") : dept ? t("mgmt.saveChanges") : t("mgmt.createDept")}</button></>
    }>
      <ErrorBanner message={error} />

      {/* Icon type toggle — 2 tabs: Icon, Upload */}
      <div>
        <FieldLabel>{t("mgmt.icon")}</FieldLabel>
        <div className="flex gap-2 mb-2">
          <button onClick={() => setIconTab("icon")}
            className={`h-8 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 border transition-all ${iconTab === "icon" ? "bg-[var(--bg-surface-active)] border-[var(--border-focus)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] text-[var(--text-dim)]"}`}>
            <LayersIcon size={12} /> {t("mgmt.iconTab")}
          </button>
          <button onClick={() => setIconTab("upload")}
            className={`h-8 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 border transition-all ${iconTab === "upload" ? "bg-[var(--bg-surface-active)] border-[var(--border-focus)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] text-[var(--text-dim)]"}`}>
            <UploadIcon size={12} /> {t("mgmt.upload")}
          </button>
        </div>

        {iconTab === "icon" ? (
          <div className="flex items-start gap-3">
            <div className="relative">
              <button onClick={() => setShowIcons(!showIcons)}
                className="w-12 h-12 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center hover:scale-105 transition-transform">
                {(() => { const IC = DEPT_ICON_MAP[selectedIcon] || Building2Icon; return <IC size={20} className="text-[var(--text-muted)]" />; })()}
              </button>
              {showIcons && (
                <div className="absolute top-full left-0 rtl:left-auto rtl:right-0 mt-2 z-10 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-2.5 w-[280px] grid grid-cols-7 gap-1">
                  {DEPT_ICON_KEYS.map((key) => {
                    const IC = DEPT_ICON_MAP[key];
                    return (
                      <button key={key} onClick={() => { setSelectedIcon(key); setShowIcons(false); }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center hover:scale-110 transition-transform ${selectedIcon === key ? "bg-[var(--bg-surface-active)] ring-1 ring-[var(--border-focus)]" : "hover:bg-[var(--bg-surface)]"}`}>
                        <IC size={16} className={selectedIcon === key ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex-1">
              <FieldLabel>{t("mgmt.name")} *</FieldLabel>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering" autoFocus className={inputCls} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.svg,.webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ""; }} />
            <div className="flex items-center gap-3">
              {iconUrl ? (
                <div className="w-12 h-12 rounded-xl border border-[var(--border-subtle)] overflow-hidden shrink-0">
                  <img src={iconUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[var(--bg-surface)] border border-dashed border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)]">
                  <UploadIcon size={18} />
                </div>
              )}
              <div className="flex-1">
                {uploading ? (
                  <div className="flex items-center gap-2 text-[12px] text-[var(--text-dim)]">
                    <SpinnerIcon size={14} className="animate-spin" /> {t("mgmt.uploading")}
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()}
                    className="h-9 px-4 rounded-lg text-[12px] font-medium border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-all flex items-center gap-1.5">
                    <UploadIcon size={12} /> {iconUrl ? t("mgmt.changeFile") : t("mgmt.uploadFile")}
                  </button>
                )}
              </div>
            </div>
            <div>
              <FieldLabel>{t("mgmt.name")} *</FieldLabel>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering" className={inputCls} />
            </div>
          </div>
        )}
      </div>

      <div>
        <FieldLabel>{t("mgmt.description")}</FieldLabel>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." rows={2} className={textareaCls} />
      </div>
      <div>
        <FieldLabel>{t("mgmt.parentDept")}</FieldLabel>
        <select value={parentId || ""} onChange={(e) => setParentId(e.target.value || null)} className={selectCls}>
          <option value="">{t("mgmt.noneTopLevel")}</option>
          {parentOptions.map((d) => <option key={d.id} value={d.id}>{deptName(d.name, t)}</option>)}
        </select>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════
   POSITION MODAL (with circular hierarchy validation)
   ═══════════════════════════════════════════════════ */
function PositionModal({
  open, onClose, position, departmentId, allPositions, roles, onSaved, t,
}: {
  open: boolean; onClose: () => void;
  position: PositionRow | null; departmentId: string;
  allPositions: PositionRow[]; roles: RoleRow[];
  onSaved: () => void; t: (key: string) => string;
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
    if (!title.trim()) { setError(t("mgmt.posNameReq")); return; }

    // Circular hierarchy check
    if (position && reportsTo) {
      if (detectCircularHierarchy(position.id, reportsTo, allPositions)) {
        setError(t("mgmt.circularError"));
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
    <ModalShell open={open} onClose={onClose} title={position ? t("mgmt.editPos") : t("mgmt.newPos")} width="max-w-[560px]" footer={
      <><button onClick={onClose} className={cancelBtnCls}>{t("mgmt.cancel")}</button>
      <button onClick={handleSave} disabled={saving || !title.trim()} className={primaryBtnCls}>{saving ? t("mgmt.saving") : position ? t("mgmt.saveChanges") : t("mgmt.createPos")}</button></>
    }>
      <ErrorBanner message={error} />
      <div>
        <FieldLabel>{t("mgmt.posTitle")} *</FieldLabel>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Developer" autoFocus className={inputCls} />
      </div>
      <div>
        <FieldLabel>{t("mgmt.description")}</FieldLabel>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Role overview..." rows={2} className={textareaCls} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>{t("mgmt.level")}</FieldLabel>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((l) => (
              <button key={l} onClick={() => setLevel(l)}
                className={`h-9 w-9 rounded-lg text-[12px] font-semibold border transition-all ${
                  level === l ? "bg-[var(--bg-surface-active)] border-[var(--border-focus)] text-[var(--text-primary)]" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)]"
                }`}>{l}</button>
            ))}
          </div>
          <p className="text-[11px] text-[var(--text-dim)] mt-1">{t(`mgmt.level.${level}`)}</p>
        </div>
        <div>
          <FieldLabel>{t("mgmt.role")}</FieldLabel>
          <select value={roleId || ""} onChange={(e) => setRoleId(e.target.value || null)} className={selectCls}>
            <option value="">{t("mgmt.noRole")}</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <FieldLabel>{t("mgmt.reportsTo")}</FieldLabel>
        <select value={reportsTo || ""} onChange={(e) => setReportsTo(e.target.value || null)} className={selectCls}>
          <option value="">{t("mgmt.noneTopHierarchy")}</option>
          {reportsToOptions.map((p) => <option key={p.id} value={p.id}>{posTitle(p.title, t)} (L{p.level})</option>)}
        </select>
      </div>

      <button onClick={() => setShowJD(!showJD)} className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors w-full">
        <DocumentIcon size={13} />
        <span>{t("mgmt.jobDescription")}</span>
        {showJD ? <AngleUpIcon size={12} className="ml-auto" /> : <AngleDownIcon size={12} className="ml-auto" />}
      </button>
      {showJD && (
        <div className="space-y-4 pl-1 border-l-2 border-[var(--border-subtle)] ml-1">
          <div className="pl-3">
            <FieldLabel>{t("mgmt.responsibilities")}</FieldLabel>
            <textarea value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} placeholder="Key responsibilities..." rows={3} className={textareaCls} />
          </div>
          <div className="pl-3">
            <FieldLabel>{t("mgmt.requirements")}</FieldLabel>
            <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="Skills, qualifications..." rows={3} className={textareaCls} />
          </div>
        </div>
      )}
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════
   ASSIGNMENT MODAL (person picker + inline create)
   ═══════════════════════════════════════════════════ */
function AssignmentModal({
  open, onClose, assignment, positionId, departmentId, people, onSaved, onPersonCreated, t,
}: {
  open: boolean; onClose: () => void;
  assignment: AssignmentRow | null;
  positionId: string; departmentId: string;
  people: PersonRef[]; onSaved: () => void;
  onPersonCreated: (c: PersonRef) => void;
  t: (key: string) => string;
}) {
  const [personId, setContactId] = useState<string | null>(null);
  const [isPrimary, setIsPrimary] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [personSearch, setContactSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setContactId(assignment?.person_id || null);
      setIsPrimary(assignment?.is_primary ?? true);
      setStartDate(assignment?.start_date || "");
      setError(""); setContactSearch(""); setShowPicker(false);
      setShowCreate(false); setNewFirst(""); setNewLast(""); setNewEmail(""); setNewPhone("");
    }
  }, [open, assignment]);

  const filtered = personSearch.trim()
    ? people.filter((c) => c.name.toLowerCase().includes(personSearch.toLowerCase()) || (c.email && c.email.toLowerCase().includes(personSearch.toLowerCase())))
    : people.slice(0, 30);

  const selectedPerson = personId ? people.find((c) => c.id === personId) : null;

  const handleCreatePerson = async () => {
    if (!newFirst.trim()) { setError(t("mgmt.firstNameReq")); return; }
    setCreating(true); setError("");
    const res = await createInlinePerson({
      first_name: newFirst.trim(),
      last_name: newLast.trim() || undefined,
      email: newEmail.trim() || undefined,
      phone: newPhone.trim() || undefined,
    });
    if (res.error || !res.data) { setError(res.error || "Failed to create person."); setCreating(false); return; }
    onPersonCreated(res.data);
    setContactId(res.data.id);
    setShowCreate(false);
    setShowPicker(false);
    setCreating(false);
  };

  const handleSave = async () => {
    if (!personId) { setError(t("mgmt.selectPerson")); return; }
    setSaving(true); setError("");
    const payload: Record<string, unknown> = {
      person_id: personId, position_id: positionId,
      department_id: departmentId, is_primary: isPrimary,
      start_date: startDate || null,
    };
    if (assignment) {
      const res = await updateAssignment(assignment.id, payload as Partial<AssignmentRow>);
      if (!res.ok) { setError(res.error || "Failed."); setSaving(false); return; }
    } else {
      const res = await createAssignment(payload as Partial<AssignmentRow>);
      if (res.error) { setError(res.error); setSaving(false); return; }
      await addPositionHistory({ position_id: positionId, person_id: personId, department_id: departmentId, action: "assigned" });
    }
    setSaving(false); onSaved(); onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose} title={assignment ? t("mgmt.editAssign") : t("mgmt.assignEmployee")} width="max-w-[500px]" footer={
      <><button onClick={onClose} className={cancelBtnCls}>{t("mgmt.cancel")}</button>
      <button onClick={handleSave} disabled={saving || !personId} className={primaryBtnCls}>{saving ? t("mgmt.saving") : assignment ? t("mgmt.saveChanges") : t("mgmt.assign")}</button></>
    }>
      <ErrorBanner message={error} />

      {/* Contact picker */}
      <div>
        <FieldLabel>{t("mgmt.employee")} *</FieldLabel>
        <div className="relative">
          <button onClick={() => { setShowPicker(!showPicker); setShowCreate(false); }}
            className="w-full h-10 px-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-start flex items-center gap-2.5 transition-colors hover:border-[var(--border-focus)]">
            {selectedPerson ? (
              <><Avatar src={selectedPerson.avatar} name={selectedPerson.name} size={22} />
              <span className="text-[var(--text-primary)] truncate">{selectedPerson.name}</span>
              {selectedPerson.email && <span className="text-[var(--text-dim)] text-[11px] truncate">({selectedPerson.email})</span>}</>
            ) : (
              <><UserIcon size={14} className="text-[var(--text-dim)]" /><span className="text-[var(--text-dim)]">{t("mgmt.selectOrCreate")}</span></>
            )}
          </button>

          {showPicker && (
            <div className="md:absolute md:top-full md:left-0 md:right-0 mt-1 z-20 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl max-h-[280px] overflow-hidden flex flex-col">
              <div className="p-2 shrink-0">
                <div className="relative">
                  <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                  <input type="text" value={personSearch} onChange={(e) => setContactSearch(e.target.value)}
                    placeholder={t("mgmt.searchNameEmail")} autoFocus
                    className="w-full h-8 pl-8 pr-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[12px] outline-none" />
                </div>
              </div>
              <div className="px-1 overflow-y-auto overscroll-contain flex-1">
                {filtered.length === 0 ? (
                  <div className="px-3 py-6 text-center text-[12px] text-[var(--text-dim)]">{t("mgmt.noContacts")}</div>
                ) : filtered.map((c) => (
                  <button key={c.id} onClick={() => { setContactId(c.id); setShowPicker(false); setContactSearch(""); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-start transition-colors hover:bg-[var(--bg-surface)] ${personId === c.id ? "bg-[var(--bg-surface-active)]" : ""}`}>
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
                  <UserPlusIcon size={13} /> {t("mgmt.createNewEmployee")}
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
            <span className="text-[12px] font-semibold text-[var(--text-secondary)]">{t("mgmt.newEmployee")}</span>
            <button onClick={() => setShowCreate(false)} className="text-[var(--text-dim)] hover:text-[var(--text-muted)]"><CrossIcon size={14} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>{t("mgmt.firstName")} *</FieldLabel>
              <input type="text" value={newFirst} onChange={(e) => setNewFirst(e.target.value)} placeholder="John" autoFocus className={inputCls} />
            </div>
            <div>
              <FieldLabel>{t("mgmt.lastName")}</FieldLabel>
              <input type="text" value={newLast} onChange={(e) => setNewLast(e.target.value)} placeholder="Doe" className={inputCls} />
            </div>
          </div>
          <div>
            <FieldLabel>{t("mgmt.email")}</FieldLabel>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="john@example.com" className={inputCls} />
          </div>
          <div>
            <FieldLabel>{t("mgmt.phone")}</FieldLabel>
            <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+1 234 567 890" className={inputCls} />
          </div>
          <button onClick={handleCreatePerson} disabled={creating || !newFirst.trim()} className={primaryBtnCls + " w-full"}>
            {creating ? t("mgmt.creating") : t("mgmt.createAndSelect")}
          </button>
        </div>
      )}

      {/* Primary toggle */}
      <div>
        <FieldLabel>{t("mgmt.assignType")}</FieldLabel>
        <div className="flex gap-2">
          <button onClick={() => setIsPrimary(true)}
            className={`flex-1 h-10 rounded-xl border text-[12px] font-semibold transition-all ${
              isPrimary ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)]"
            }`}>{t("mgmt.primary")}</button>
          <button onClick={() => setIsPrimary(false)}
            className={`flex-1 h-10 rounded-xl border text-[12px] font-semibold transition-all ${
              !isPrimary ? "bg-[var(--bg-surface-active)] border-[var(--border-focus)] text-[var(--text-primary)]" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)]"
            }`}>{t("mgmt.secondary")}</button>
        </div>
      </div>
      <div>
        <FieldLabel>{t("mgmt.startDate")}</FieldLabel>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════
   TRANSFER MODAL
   ═══════════════════════════════════════════════════ */
function TransferModal({
  open, onClose, assignment, personName, departments, onSaved, t,
}: {
  open: boolean; onClose: () => void;
  assignment: AssignmentRow | null; personName: string;
  departments: DepartmentRow[];
  onSaved: () => void; t: (key: string) => string;
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
    if (!assignment || !targetPosId || !targetDeptId) { setError(t("mgmt.selectTargetErr")); return; }
    setSaving(true); setError("");
    const res = await transferEmployee(assignment.id, targetPosId, targetDeptId);
    if (!res.ok) { setError(res.error || "Transfer failed."); setSaving(false); return; }
    setSaving(false); onSaved(); onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose} title={t("mgmt.transferEmployee")} width="max-w-[460px]" footer={
      <><button onClick={onClose} className={cancelBtnCls}>{t("mgmt.cancel")}</button>
      <button onClick={handleTransfer} disabled={saving || !targetPosId} className={primaryBtnCls}>{saving ? t("mgmt.transferring") : t("mgmt.transfer")}</button></>
    }>
      <ErrorBanner message={error} />
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
        <ArrowRightLeftIcon size={16} className="text-[var(--text-dim)] shrink-0" />
        <div>
          <div className="text-[13px] font-medium text-[var(--text-primary)]">{personName}</div>
          <div className="text-[11px] text-[var(--text-dim)]">{t("mgmt.movingNewPos")}</div>
        </div>
      </div>
      <div>
        <FieldLabel>{t("mgmt.targetDept")}</FieldLabel>
        <select value={targetDeptId} onChange={(e) => setTargetDeptId(e.target.value)} className={selectCls}>
          <option value="">{t("mgmt.selectDept")}</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{deptName(d.name, t)}</option>)}
        </select>
      </div>
      {targetDeptId && (
        <div>
          <FieldLabel>{t("mgmt.targetPos")}</FieldLabel>
          {loadingPos ? (
            <div className="h-10 flex items-center gap-2 text-[12px] text-[var(--text-dim)]"><SpinnerIcon size={14} className="animate-spin" /> {t("mgmt.loading")}</div>
          ) : deptPositions.length === 0 ? (
            <div className="h-10 flex items-center text-[12px] text-[var(--text-dim)]">{t("mgmt.noPosAvailable")}</div>
          ) : (
            <select value={targetPosId} onChange={(e) => setTargetPosId(e.target.value)} className={selectCls}>
              <option value="">{t("mgmt.selectPos")}</option>
              {deptPositions.map((p) => <option key={p.id} value={p.id}>{posTitle(p.title, t)} (L{p.level})</option>)}
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
function RoleModal({ open, onClose, role, onSaved, t }: {
  open: boolean; onClose: () => void; role: RoleRow | null; onSaved: () => void; t: (key: string) => string;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) { setName(role?.name || ""); setDescription(role?.description || ""); setError(""); }
  }, [open, role]);

  const handleSave = async () => {
    if (!name.trim()) { setError(t("mgmt.roleNameReq")); return; }
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
    <ModalShell open={open} onClose={onClose} title={role ? t("mgmt.editRole") : t("mgmt.newRole")} width="max-w-[420px]" footer={
      <><button onClick={onClose} className={cancelBtnCls}>{t("mgmt.cancel")}</button>
      <button onClick={handleSave} disabled={saving || !name.trim()} className={primaryBtnCls}>{saving ? t("mgmt.saving") : role ? t("mgmt.save") : t("mgmt.createRole")}</button></>
    }>
      <ErrorBanner message={error} />
      <div>
        <FieldLabel>{t("mgmt.roleName")} *</FieldLabel>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales Manager" autoFocus className={inputCls} />
      </div>
      <div>
        <FieldLabel>{t("mgmt.description")}</FieldLabel>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("mgmt.roleDescPlaceholder")} rows={2} className={textareaCls} />
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════
   DELETE MODAL (with safe delete options)
   ═══════════════════════════════════════════════════ */
function DeleteModal({ open, target, departments, onClose, onConfirm, deleting, t }: {
  open: boolean;
  target: { type: "dept" | "pos" | "assign" | "role"; id: string; name: string } | null;
  departments: DepartmentRow[];
  onClose: () => void;
  onConfirm: (strategy?: "cascade" | "reassign", reassignId?: string) => void;
  deleting: boolean; t: (key: string) => string;
}) {
  const [strategy, setStrategy] = useState<"cascade" | "reassign">("cascade");
  const [reassignDeptId, setReassignDeptId] = useState("");

  useEffect(() => { if (open) { setStrategy("cascade"); setReassignDeptId(""); } }, [open]);

  if (!open || !target) return null;

  const title = target.type === "dept" ? t("mgmt.deleteDept") : target.type === "pos" ? t("mgmt.deletePos") : target.type === "role" ? t("mgmt.deleteRole") : t("mgmt.removeAssign");

  return (
    <ModalShell open={open} onClose={onClose} title={title} width="max-w-[440px]" footer={
      <><button onClick={onClose} className={cancelBtnCls}>{t("mgmt.cancel")}</button>
      <button onClick={() => onConfirm(target.type === "dept" ? strategy : undefined, reassignDeptId || undefined)} disabled={deleting || (target.type === "dept" && strategy === "reassign" && !reassignDeptId)} className={dangerBtnCls}>
        {deleting ? t("mgmt.deleting") : t("mgmt.delete")}
      </button></>
    }>
      {target.type === "dept" ? (
        <div className="space-y-3">
          <p className="text-[13px] text-[var(--text-muted)]">Delete &ldquo;{target.name}&rdquo;? Choose what happens to its positions:</p>
          <div className="space-y-2">
            <button onClick={() => setStrategy("cascade")}
              className={`w-full text-start px-4 py-3 rounded-xl border transition-all ${strategy === "cascade" ? "border-red-500/30 bg-red-500/5" : "border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]"}`}>
              <div className="text-[13px] font-medium text-[var(--text-primary)]">{t("mgmt.deleteAllPos")}</div>
              <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{t("mgmt.deleteAllPosDesc")}</div>
            </button>
            <button onClick={() => setStrategy("reassign")}
              className={`w-full text-start px-4 py-3 rounded-xl border transition-all ${strategy === "reassign" ? "border-blue-500/30 bg-blue-500/5" : "border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]"}`}>
              <div className="text-[13px] font-medium text-[var(--text-primary)]">{t("mgmt.moveToAnotherDept")}</div>
              <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{t("mgmt.moveToAnotherDesc")}</div>
            </button>
          </div>
          {strategy === "reassign" && (
            <div>
              <FieldLabel>{t("mgmt.moveTo")}</FieldLabel>
              <select value={reassignDeptId} onChange={(e) => setReassignDeptId(e.target.value)} className={selectCls}>
                <option value="">Select department...</option>
                {departments.filter((d) => d.id !== target.id).map((d) => <option key={d.id} value={d.id}>{deptName(d.name, t)}</option>)}
              </select>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-[var(--text-muted)]">
          {target.type === "pos"
            ? `"${target.name}" — ${t("mgmt.confirmDeletePos")}`
            : target.type === "role"
              ? `"${target.name}" — ${t("mgmt.confirmDeleteRole")}`
              : `"${target.name}" ${t("mgmt.confirmRemoveAssign")}`}
        </p>
      )}
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════
   POSITION DETAIL (history + JD)
   ═══════════════════════════════════════════════════ */
function PositionDetailModal({ open, onClose, position, people, t }: {
  open: boolean; onClose: () => void; position: PositionRow | null; people: PersonRef[];
  t: (key: string) => string;
}) {
  const [history, setHistory] = useState<PositionHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && position) {
      setLoading(true);
      fetchPositionHistory(position.id).then((h) => { setHistory(h); setLoading(false); });
    }
  }, [open, position]);

  const ctcMap = new Map(people.map((c) => [c.id, c]));

  return (
    <ModalShell open={open} onClose={onClose} title={position ? posTitle(position.title, t) : t("mgmt.posDetails")} width="max-w-[540px]">
      {position && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${LEVEL_COLORS[position.level] || LEVEL_COLORS[5]}`}>
              L{position.level} — {t(`mgmt.level.${position.level}`)}
            </span>
          </div>
          {position.description && (
            <div><FieldLabel>{t("mgmt.description")}</FieldLabel><p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{position.description}</p></div>
          )}
          {position.responsibilities && (
            <div><FieldLabel>{t("mgmt.responsibilities")}</FieldLabel>
              <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap bg-[var(--bg-surface)] rounded-xl p-3.5 border border-[var(--border-subtle)]">{position.responsibilities}</div>
            </div>
          )}
          {position.requirements && (
            <div><FieldLabel>{t("mgmt.requirements")}</FieldLabel>
              <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap bg-[var(--bg-surface)] rounded-xl p-3.5 border border-[var(--border-subtle)]">{position.requirements}</div>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <HistoryIcon size={13} className="text-[var(--text-dim)]" />
              <FieldLabel>{t("mgmt.posHistory")}</FieldLabel>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-[12px] text-[var(--text-dim)] py-4"><SpinnerIcon size={14} className="animate-spin" /> {t("mgmt.loading")}</div>
            ) : history.length === 0 ? (
              <div className="text-[12px] text-[var(--text-dim)] py-4 text-center">{t("mgmt.noHistory")}</div>
            ) : (
              <div className="relative pl-4 border-l border-[var(--border-subtle)] space-y-3">
                {history.map((h) => {
                  const ctc = ctcMap.get(h.person_id);
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
  onToggle, onAssign, onClick, onDragStart, onDragOver, onDragLeave, onDrop, t,
}: {
  node: OrgChartNode; hasChildren: boolean; expanded: boolean;
  isDragOver: boolean; isDragging: boolean; showDept: boolean;
  onToggle: () => void; onAssign: (posId: string) => void;
  onClick: () => void; t: (k: string) => string;
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
        ${isDragOver ? "ring-2 ring-blue-400 border-blue-400/50 scale-[1.02]" : "border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:shadow-lg hover:shadow-black/5"}
        ${isDragging ? "opacity-40 scale-95" : ""}
      `}>
      {/* Drag handle */}
      <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-50 transition-opacity cursor-grab active:cursor-grabbing">
        <GripVerticalIcon size={12} className="text-[var(--text-dim)]" />
      </div>

      {/* Position title + level */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-[var(--text-primary)] truncate leading-tight">{posTitle(node.position.title, t)}</div>
          {showDept && node.department && (
            <div className="text-[10px] text-[var(--text-dim)] truncate mt-0.5">{deptName(node.department.name, t)}</div>
          )}
        </div>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 ${LEVEL_COLORS[node.position.level] || LEVEL_COLORS[5]}`}>
          L{node.position.level}
        </span>
      </div>

      {/* Divider */}
      <div className="h-px bg-[var(--border-faint)] -mx-3 mb-2.5" />

      {/* Person */}
      <div className="flex items-center gap-2.5">
        <Avatar src={node.person?.avatar} name={node.person?.name || "?"} size={30} />
        <div className="min-w-0 flex-1">
          {node.person ? (
            <>
              <div className="text-[12px] font-medium text-[var(--text-secondary)] truncate">{node.person.name}</div>
              {node.person.email && <div className="text-[10px] text-[var(--text-dim)] truncate">{node.person.email}</div>}
            </>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); onAssign(node.position.id); }}
              className="text-[11px] text-[var(--text-dim)] hover:text-[var(--text-muted)] flex items-center gap-1 transition-colors">
              <UserPlusIcon size={10} /> Assign
            </button>
          )}
        </div>
        {hasChildren && (
          <button onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-[var(--bg-surface)] transition-colors shrink-0">
            {expanded ? <AngleUpIcon size={11} className="text-[var(--text-dim)]" /> : <AngleDownIcon size={11} className="text-[var(--text-dim)]" />}
          </button>
        )}
      </div>
    </div>
  );
}

function OrgChartBranch({
  node, showDept, dragSourceId, dragOverId, allPositions,
  onAssign, onClickNode, setDragSourceId, setDragOverId, onDrop, t,
}: {
  node: OrgChartNode; showDept: boolean;
  dragSourceId: string | null; dragOverId: string | null;
  allPositions: PositionRow[];
  onAssign: (posId: string) => void;
  onClickNode: (pos: PositionRow) => void;
  setDragSourceId: (id: string | null) => void;
  setDragOverId: (id: string | null) => void;
  onDrop: (sourceId: string, targetId: string) => void;
  t: (k: string) => string;
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
        t={t}
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
                    t={t}
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
   PERMISSIONS EDITOR — grouped by app category
   ═══════════════════════════════════════════════════ */
function PermissionsEditor({ roleId, t }: { roleId: string; t: (key: string) => string }) {
  const [perms, setPerms] = useState<Record<string, { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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

  const toggleFullAccess = (mod: string) => {
    const p = perms[mod];
    const allOn = p?.can_view && p?.can_create && p?.can_edit && p?.can_delete;
    setPerms((prev) => ({
      ...prev,
      [mod]: { can_view: !allOn, can_create: !allOn, can_edit: !allOn, can_delete: !allOn },
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
        next[m] = { can_view: !allOn, can_create: !allOn, can_edit: !allOn, can_delete: !allOn };
      });
      return next;
    });
    setSaved(false);
  };

  const toggleGroupCollapse = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await upsertPermissions(roleId, Object.entries(perms).map(([module_name, p]) => ({ module_name, ...p })));
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
                  {/* Column headers */}
                  <div className="flex items-center px-3 py-1.5 border-t border-[var(--border-faint)]">
                    <div className="flex-1 text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium">{t("mgmt.app")}</div>
                    <div className="w-12 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium">{t("mgmt.view")}</div>
                    <div className="w-12 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium">{t("mgmt.add")}</div>
                    <div className="w-12 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium">{t("mgmt.edit")}</div>
                    <div className="w-12 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium">{t("mgmt.del")}</div>
                    <div className="w-12 text-center text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium">{t("mgmt.all")}</div>
                  </div>
                  {group.modules.map((mod) => {
                    const AppIcon = getAppIcon(mod);
                    const p = perms[mod];
                    const isFullAccess = p?.can_view && p?.can_create && p?.can_edit && p?.can_delete;
                    const hasAny = p?.can_view || p?.can_create || p?.can_edit || p?.can_delete;

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
        {saved && <span className="text-[12px] text-emerald-400 font-medium flex items-center gap-1"><CheckIcon size={12} /> {t("mgmt.saved")}</span>}
        <button onClick={handleSave} disabled={saving} className={primaryBtnCls}>{saving ? t("mgmt.saving") : t("mgmt.savePerms")}</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   EMPLOYEE PROFILE PANEL
   ═══════════════════════════════════════════════════ */
function EmployeeProfilePanel({ personId, people, onClose, onOpenEmployee, t }: {
  personId: string; people: PersonRef[];
  onClose: () => void; onOpenEmployee: (id: string) => void;
  t: (key: string) => string;
}) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchEmployeeProfile(personId).then((p) => { setProfile(p); setLoading(false); });
  }, [personId]);

  if (loading) return <Spinner />;
  if (!profile) return <EmptyState icon={UserIcon} title={t("mgmt.employeeNotFound")} />;

  const { person, assignments, reportingChain, directReports, history } = profile;
  const primary = assignments.find((a) => a.is_primary) || assignments[0];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 pt-5 pb-4 border-b border-[var(--border-color)]">
        <button onClick={onClose}
          className="md:hidden flex items-center gap-1.5 text-[12px] text-[var(--text-dim)] mb-3 hover:text-[var(--text-muted)]">
          <ArrowLeftIcon size={14} className="rtl:rotate-180" /> {t("mgmt.back")}
        </button>
        <div className="flex items-center gap-4">
          <Avatar src={person.avatar} name={person.name} size={56} />
          <div className="flex-1 min-w-0">
            <h2 className="text-[20px] font-bold text-[var(--text-primary)] truncate tracking-tight">{person.name}</h2>
            {primary && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[13px] text-[var(--text-secondary)]">{posTitle(primary.position.title, t)}</span>
                {primary.department && (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[var(--text-dim)] border border-[var(--border-faint)]">
                    {deptName(primary.department.name, t)}
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {person.email && (
                <span className="flex items-center gap-1 text-[11px] text-[var(--text-dim)]"><EnvelopeIcon size={11} /> {person.email}</span>
              )}
              {person.phone && (
                <span className="flex items-center gap-1 text-[11px] text-[var(--text-dim)]"><PhoneIcon size={11} /> {person.phone}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-6">
        {/* Current Positions */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BriefcaseIcon size={14} className="text-[var(--text-dim)]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("mgmt.currentPositions")}</span>
          </div>
          <div className="space-y-2">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center shrink-0">
                  <BriefcaseIcon size={14} className="text-[var(--text-muted)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{posTitle(a.position.title, t)}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${LEVEL_COLORS[a.position.level] || LEVEL_COLORS[5]}`}>L{a.position.level}</span>
                    {a.is_primary && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/12 text-emerald-400/80">{t("mgmt.primary")}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {a.department && <span className="text-[11px] text-[var(--text-dim)]">{deptName(a.department.name, t)}</span>}
                    {a.start_date && <><span className="text-[var(--text-dim)]">·</span><span className="text-[11px] text-[var(--text-dim)]">{t("mgmt.since")} {a.start_date}</span></>}
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
              <TrendingUpIcon size={14} className="text-[var(--text-dim)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("mgmt.reportsTo")}</span>
            </div>
            <div className="relative pl-4 border-l-2 border-[var(--border-subtle)] space-y-2">
              {reportingChain.map((r, i) => (
                <div key={r.position.id}
                  onClick={() => r.person && onOpenEmployee(r.person.id)}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] ${r.person ? "cursor-pointer hover:border-[var(--border-strong)]" : ""} transition-all`}>
                  <div className={`absolute -left-[21px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 ${LEVEL_DOT[r.position.level] || "bg-slate-400"} border-[var(--bg-primary)]`} />
                  <Avatar src={r.person?.avatar} name={r.person?.name || "Vacant"} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">{r.person?.name || "Vacant"}</div>
                    <div className="text-[11px] text-[var(--text-dim)] truncate">{posTitle(r.position.title, t)}</div>
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
              <UsersIcon size={14} className="text-[var(--text-dim)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("mgmt.directReports")} ({directReports.length})</span>
            </div>
            <div className="space-y-1.5">
              {directReports.map((r) => (
                <div key={r.position.id}
                  onClick={() => r.person && onOpenEmployee(r.person.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] ${r.person ? "cursor-pointer hover:border-[var(--border-strong)]" : ""} transition-all`}>
                  <Avatar src={r.person?.avatar} name={r.person?.name || "Vacant"} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">{r.person?.name || "Vacant"}</div>
                    <div className="text-[11px] text-[var(--text-dim)] truncate">{posTitle(r.position.title, t)}</div>
                  </div>
                  {r.department && <span className="text-[10px] text-[var(--text-dim)] shrink-0">{deptName(r.department.name, t)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Position History */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <HistoryIcon size={14} className="text-[var(--text-dim)]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("mgmt.history")}</span>
          </div>
          {history.length === 0 ? (
            <div className="text-[12px] text-[var(--text-dim)] text-center py-4">{t("mgmt.noHistoryYet")}</div>
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
function HeadcountDashboard({ onDeptClick, t }: { onDeptClick: (deptId: string) => void; t: (key: string) => string }) {
  const [analytics, setAnalytics] = useState<HeadcountAnalytics | null>(null);
  const [activity, setActivity] = useState<PositionHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchHeadcountAnalytics(), fetchRecentActivity(20)]).then(([a, act]) => {
      setAnalytics(a); setActivity(act); setLoading(false);
    });
  }, []);

  if (loading) return <Spinner />;
  if (!analytics) return <EmptyState icon={BarChart3Icon} title={t("mgmt.noData")} />;

  const StatCard = ({ icon: Icon, label, value, sub, color, accent }: {
    icon: React.ElementType; label: string; value: string | number; sub?: string; color: string; accent: string;
  }) => (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 relative overflow-hidden">
      <div className={`absolute top-0 inset-x-0 h-[2px] ${accent}`} />
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}><Icon size={15} /></div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{label}</span>
      </div>
      <div className="text-[32px] font-extrabold tracking-tight text-[var(--text-primary)] leading-none">{value}</div>
      {sub && <div className="text-[11px] text-[var(--text-dim)] mt-1.5">{sub}</div>}
    </div>
  );

  const maxDeptSize = Math.max(...analytics.departmentBreakdown.map((d) => d.total), 1);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 pt-5 pb-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center shadow-sm">
            <BarChart3Icon size={20} className="text-[var(--text-muted)]" />
          </div>
          <div>
            <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight">{t("mgmt.headcountDash")}</h2>
            <p className="text-[12px] text-[var(--text-dim)]">{t("mgmt.orgOverview")}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={UsersIcon} label={t("mgmt.employees")} value={analytics.totalEmployees} color="bg-blue-500/10 text-blue-400" accent="bg-blue-400" />
          <StatCard icon={BriefcaseIcon} label={t("mgmt.positions")} value={analytics.totalPositions} sub={`${analytics.filledPositions} ${t("mgmt.filled")}`} color="bg-violet-500/10 text-violet-400" accent="bg-violet-400" />
          <StatCard icon={UserXIcon} label={t("mgmt.vacant")} value={analytics.vacantPositions} sub={`${analytics.vacancyRate.toFixed(1)}% ${t("mgmt.rate")}`} color="bg-amber-500/10 text-amber-400" accent="bg-amber-400" />
          <StatCard icon={LayersIcon} label={t("mgmt.orgDepth")} value={analytics.maxOrgDepth} sub={`${analytics.avgSpanOfControl.toFixed(1)} ${t("mgmt.avgReports")}`} color="bg-cyan-500/10 text-cyan-400" accent="bg-cyan-400" />
        </div>

        {/* Department Breakdown */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Building2Icon size={14} className="text-[var(--text-dim)]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("mgmt.deptBreakdown")}</span>
          </div>
          <div className="space-y-2">
            {analytics.departmentBreakdown.map((dept) => (
              <div key={dept.id}
                onClick={() => onDeptClick(dept.id)}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] cursor-pointer hover:border-[var(--border-strong)] hover:shadow-sm transition-all group">
                <div className="w-9 h-9 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center shrink-0 overflow-hidden">
                  {dept.icon_type === "image" && dept.icon_value ? (
                    <img src={dept.icon_value} alt="" className="w-full h-full object-cover" />
                  ) : (() => {
                    const key = dept.icon_type === "icon" && dept.icon_value ? dept.icon_value : "building2";
                    const IC = DEPT_ICON_MAP[key] || Building2Icon;
                    return <IC size={16} className="text-[var(--text-muted)]" />;
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{deptName(dept.name, t)}</span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400">{dept.filled}</span>
                      <span className="text-[10px] text-[var(--text-faint)]">/</span>
                      <span className="text-[10px] font-medium text-[var(--text-dim)]">{dept.total}</span>
                    </div>
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
            <LayersIcon size={14} className="text-[var(--text-dim)]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("mgmt.levelDist")}</span>
          </div>
          <div className="flex items-end justify-center gap-2 h-[120px] px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            {analytics.levelDistribution.map((l) => {
              const maxCount = Math.max(...analytics.levelDistribution.map((x) => x.count), 1);
              const height = (l.count / maxCount) * 100;
              return (
                <div key={l.level} className="flex-1 min-w-[40px] max-w-[80px] flex flex-col items-center gap-1">
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
              <ActivityIcon size={14} className="text-[var(--text-dim)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("mgmt.recentActivity")}</span>
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
  const { t, lang } = useTranslation(managementT);

  /** Shorthand: translate department name. */
  const dn = useCallback((name: string) => deptName(name, t), [t]);

  /* ── Data ── */
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [people, setPeople] = useState<PersonRef[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deptStats, setDeptStats] = useState<Record<string, { total: number; assigned: number }>>({});

  /* ── Full org chart data ── */
  const [fullOrgPositions, setFullOrgPositions] = useState<PositionRow[]>([]);
  const [fullOrgAssignments, setFullOrgAssignments] = useState<AssignmentRow[]>([]);
  const [fullOrgPeople, setFullOrgPeople] = useState<PersonRef[]>([]);
  const [fullOrgLoading, setFullOrgLoading] = useState(false);

  /* ── Selection ── */
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [rightView, setRightView] = useState<"dept" | "roles" | "fullchart" | "dashboard" | "employee">("dept");
  const [search, setSearch] = useState("");
  const [expandedTree, setExpandedTree] = useState<Set<string>>(new Set());
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "chart">("list");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [posSearch, setPosSearch] = useState("");

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
  const [transferPersonName, setTransferContactName] = useState("");
  const [showPosDetail, setShowPosDetail] = useState(false);
  const [detailPos, setDetailPos] = useState<PositionRow | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  /* ── Toast ── */
  const [toast, setToast] = useState<string | null>(null);
  const [toastUndo, setToastUndo] = useState<(() => void) | null>(null);
  useEffect(() => { if (toast) { const t = setTimeout(() => { setToast(null); setToastUndo(null); }, 4000); return () => clearTimeout(t); } }, [toast]);

  /* ── Initial load ── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [depts, ctcs, rls, stats] = await Promise.all([
        fetchDepartments(), fetchPeopleForLinking(), fetchRoles(), fetchDeptStats(),
      ]);
      setDepartments(depts); setPeople(ctcs); setRoles(rls); setDeptStats(stats);
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
    setFullOrgPeople(data.people);
    setDepartments(data.departments);
    setFullOrgLoading(false);
  }, []);

  useEffect(() => {
    if (rightView === "fullchart") loadFullOrgChart();
  }, [rightView, loadFullOrgChart]);

  const selectedDept = departments.find((d) => d.id === selectedDeptId) || null;
  const tree = useMemo(() => buildDepartmentTree(departments), [departments]);
  const personMap = useMemo(() => new Map(people.map((c) => [c.id, c])), [people]);

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

  const filteredPositions = useMemo(() => {
    if (!posSearch.trim()) return positions;
    const q = posSearch.toLowerCase();
    return positions.filter((p) => {
      if (p.title.toLowerCase().includes(q)) return true;
      const posAssigns = assignmentsByPos.get(p.id) || [];
      return posAssigns.some((a) => {
        const ctc = personMap.get(a.person_id);
        return ctc?.name.toLowerCase().includes(q) || ctc?.email?.toLowerCase().includes(q);
      });
    });
  }, [positions, posSearch, assignmentsByPos, personMap]);

  /* ── Org chart trees ── */
  const deptOrgChart = useMemo(
    () => buildOrgChart(positions, assignments, people, departments),
    [positions, assignments, people, departments],
  );

  const fullOrgChart = useMemo(
    () => rightView === "fullchart" ? buildOrgChart(fullOrgPositions, fullOrgAssignments, fullOrgPeople, departments) : [],
    [rightView, fullOrgPositions, fullOrgAssignments, fullOrgPeople, departments],
  );

  /* ── Handlers ── */
  const handleSelectDept = (dept: DepartmentRow) => {
    setSelectedDeptId(dept.id); setRightView("dept"); setMobileShowDetail(true); setPosSearch("");
  };

  const reloadAll = async () => {
    const [depts, stats, ctcs] = await Promise.all([fetchDepartments(), fetchDeptStats(), fetchPeopleForLinking()]);
    setDepartments(depts); setDeptStats(stats); setPeople(ctcs);
    const pIds = new Set<string>();
    depts.forEach((d) => { if (d.parent_id) pIds.add(d.parent_id); });
    setExpandedTree(pIds);
  };

  const reloadRoles = async () => { setRoles(await fetchRoles()); };

  const handleDeptSaved = async () => { await reloadAll(); setToast(editDept ? t("mgmt.toastDeptUpdated") : t("mgmt.toastDeptCreated")); };
  const handlePosSaved = async () => {
    if (selectedDeptId) await loadDeptDetail(selectedDeptId);
    const stats = await fetchDeptStats(); setDeptStats(stats);
    setToast(editPos ? t("mgmt.toastPosUpdated") : t("mgmt.toastPosCreated"));
  };
  const handleAssignSaved = async () => { if (selectedDeptId) await loadDeptDetail(selectedDeptId); setToast(editAssign ? t("mgmt.toastAssignUpdated") : t("mgmt.toastAssigned")); };
  const handleRoleSaved = async () => { await reloadRoles(); setToast(editRole ? t("mgmt.toastRoleUpdated") : t("mgmt.toastRoleCreated")); };
  const handleTransferSaved = async () => { if (selectedDeptId) await loadDeptDetail(selectedDeptId); setToast(t("mgmt.toastTransferred")); };

  const handlePersonCreated = (c: PersonRef) => {
    setPeople((prev) => [...prev, c]);
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
    if (ok) setToast(t("mgmt.toastDeleted"));
  };

  /* ── Duplicate position handler ── */
  const handleDuplicatePosition = async (posId: string) => {
    const res = await duplicatePosition(posId);
    if (res.error || !res.data) { setToast(res.error || t("mgmt.toastDupFailed")); return; }
    if (selectedDeptId) await loadDeptDetail(selectedDeptId);
    const stats = await fetchDeptStats(); setDeptStats(stats);
    setToast(t("mgmt.toastDuplicated"));
  };

  /* ── Clone role handler ── */
  const handleCloneRole = async (roleId: string) => {
    const res = await cloneRole(roleId);
    if (res.error || !res.data) { setToast(res.error || t("mgmt.toastCloneFailed")); return; }
    await reloadRoles();
    setToast(t("mgmt.toastCloned"));
  };

  /* ── Drag & drop handler ── */
  const handleOrgDrop = async (sourceId: string, targetId: string) => {
    const posArr = rightView === "fullchart" ? fullOrgPositions : positions;
    if (detectCircularHierarchy(sourceId, targetId, posArr)) {
      setToast(t("mgmt.toastCircular"));
      return;
    }
    // Remember old parent for undo
    const sourcePos = posArr.find((p) => p.id === sourceId);
    const oldParentId = sourcePos?.reports_to_position_id || null;

    const res = await movePosition(sourceId, targetId);
    if (!res.ok) { setToast(res.error || t("mgmt.toastMoveFailed")); return; }

    if (rightView === "fullchart") await loadFullOrgChart();
    else if (selectedDeptId) await loadDeptDetail(selectedDeptId);

    setToastUndo(() => async () => {
      await movePosition(sourceId, oldParentId);
      if (rightView === "fullchart") await loadFullOrgChart();
      else if (selectedDeptId) await loadDeptDetail(selectedDeptId);
      setToast(t("mgmt.toastUndone"));
      setToastUndo(null);
    });
    setToast(t("mgmt.toastMoved"));
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
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-start transition-all duration-150 group cursor-pointer relative ${
            isSelected ? "bg-[var(--bg-surface-active)]" : "hover:bg-[var(--bg-surface)]"
          }`}
          style={{ paddingInlineStart: `${12 + depth * 20}px` }}>
          {isSelected && <div className="absolute inset-y-1.5 start-0.5 w-[3px] rounded-full bg-[var(--text-subtle)]" />}
          {hasChildren ? (
            <button onClick={(e) => { e.stopPropagation(); toggleTreeNode(node.id); }}
              className="w-5 h-5 flex items-center justify-center rounded-md shrink-0 hover:bg-[var(--bg-surface-hover)]">
              {isExpanded ? <AngleDownIcon size={12} className="text-[var(--text-dim)]" /> : <AngleRightIcon size={12} className="text-[var(--text-dim)]" />}
            </button>
          ) : <div className="w-5 shrink-0" />}
          <DeptIcon dept={node} size={34} />
          <div className="flex-1 min-w-0">
            <div className={`text-[13px] font-medium truncate ${isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{dn(node.name)}</div>
          </div>
          {stat && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0 bg-[var(--bg-surface)] text-[var(--text-faint)]">
              {stat.assigned}/{stat.total}
            </span>
          )}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={(e) => { e.stopPropagation(); setEditDept(node); setShowDeptModal(true); }}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--bg-surface-hover)]"><PencilIcon size={11} className="text-[var(--text-dim)]" /></button>
            <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "dept", id: node.id, name: dn(node.name) }); setShowDeleteModal(true); }}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-400/[0.10]"><TrashIcon size={11} className="text-red-400/60" /></button>
          </div>
        </div>
        {hasChildren && isExpanded && <div className="mt-0.5">{node.children.map((c) => renderTreeNode(c, depth + 1))}</div>}
      </div>
    );
  };

  /* ── Loading ── */
  if (loading) {
    return <div className="h-[calc(100vh-3.5rem)] bg-[var(--bg-primary)] flex items-center justify-center"><SpinnerIcon size={24} className="text-[var(--text-dim)] animate-spin" /></div>;
  }

  /* ── Zoom helpers ── */
  const zoomIn = () => setOrgChartZoom((z) => Math.min(z + 0.15, 2));
  const zoomOut = () => setOrgChartZoom((z) => Math.max(z - 0.15, 0.3));
  const zoomReset = () => setOrgChartZoom(1);

  /* ── Open employee profile ── */
  const openEmployeeProfile = (personId: string) => {
    setSelectedEmployeeId(personId);
    setRightView("employee");
    setMobileShowDetail(true);
  };

  /* ── Render org chart helper ── */
  const renderOrgChart = (chartNodes: OrgChartNode[], posArr: PositionRow[], showDept: boolean, withZoom = false) => (
    <div className="overflow-auto pb-8 relative flex-1">
      {withZoom && (
        <div className="sticky top-2 left-2 z-10 flex items-center gap-1 mb-2 ml-2">
          <button onClick={zoomIn} className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center hover:bg-[var(--bg-surface)] transition-colors" title="Zoom in">
            <ZoomInIcon size={14} className="text-[var(--text-dim)]" />
          </button>
          <button onClick={zoomOut} className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center hover:bg-[var(--bg-surface)] transition-colors" title="Zoom out">
            <ZoomOutIcon size={14} className="text-[var(--text-dim)]" />
          </button>
          <button onClick={zoomReset} className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center hover:bg-[var(--bg-surface)] transition-colors" title="Reset zoom">
            <UndoIcon size={14} className="text-[var(--text-dim)]" />
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
            t={t}
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
                <ArrowLeftIcon size={16} className="rtl:rotate-180" />
              </Link>
              <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
                <ManagementIcon size={16} />
              </div>
              <h1 className="text-[16px] font-bold text-[var(--text-primary)] truncate flex-1">{t("mgmt.title")}</h1>
              <button onClick={() => { setEditDept(null); setShowDeptModal(true); }}
                className="h-8 w-8 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 flex items-center justify-center transition-colors shrink-0">
                <PlusIcon size={16} />
              </button>
            </div>

            <div className="relative">
              <SearchIcon size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("mgmt.searchDepts")}
                className="w-full h-9 ps-9 pe-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-faint)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors" />
              {search && <button onClick={() => setSearch("")} className="absolute end-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-primary)]"><CrossIcon size={14} /></button>}
            </div>

            <div className="flex items-center justify-between mt-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">{t("mgmt.departments")}</span>
              <span className="text-[10px] font-medium text-[var(--text-faint)]">{departments.length}</span>
            </div>
          </div>

          {/* Department tree */}
          <div className="flex-1 overflow-y-auto will-change-scroll px-2.5 py-2 space-y-0.5">
            {departments.length === 0 ? (
              <EmptyState icon={Building2Icon} title={t("mgmt.noDepts")} subtitle={t("mgmt.noDeptsDesc")} />
            ) : filteredDepts ? (
              filteredDepts.map((dept) => (
                <button key={dept.id} onClick={() => handleSelectDept(dept)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-start transition-all group ${
                    selectedDeptId === dept.id ? "bg-[var(--bg-surface-active)]" : "hover:bg-[var(--bg-surface)]"
                  }`}>
                  <DeptIcon dept={dept} size={34} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate text-[var(--text-secondary)]">{dn(dept.name)}</div>
                  </div>
                </button>
              ))
            ) : tree.map((node) => renderTreeNode(node))}
          </div>

          {/* Bottom links */}
          <div className="px-3 py-2.5 border-t border-[var(--border-color)] space-y-0.5">
            <div className="px-3 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">{t("mgmt.views")}</span>
            </div>
            <button onClick={() => { setRightView("dashboard"); setSelectedDeptId(null); setMobileShowDetail(true); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-start transition-all ${
                rightView === "dashboard" ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
              }`}>
              <BarChart3Icon size={16} />
              <span className="text-[13px] font-medium">{t("mgmt.dashboard")}</span>
            </button>
            <button onClick={() => { setRightView("fullchart"); setSelectedDeptId(null); setMobileShowDetail(true); setOrgChartZoom(1); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-start transition-all ${
                rightView === "fullchart" ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
              }`}>
              <GlobeIcon size={16} />
              <span className="text-[13px] font-medium">{t("mgmt.fullOrgChart")}</span>
            </button>
            <button onClick={() => { setRightView("roles"); setSelectedDeptId(null); setMobileShowDetail(true); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-start transition-all ${
                rightView === "roles" ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
              }`}>
              <ShieldIcon size={16} />
              <span className="text-[13px] font-medium">{t("mgmt.rolesPerms")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════ RIGHT PANEL ═══════════ */}
      <div className={`${mobileShowDetail ? "flex" : "hidden md:flex"} flex-col flex-1 min-w-0 h-full bg-[var(--bg-primary)]`}>

        {/* ── DASHBOARD VIEW ── */}
        {rightView === "dashboard" ? (
          <HeadcountDashboard t={t} onDeptClick={(deptId) => {
            const dept = departments.find((d) => d.id === deptId);
            if (dept) handleSelectDept(dept);
          }} />
        ) : rightView === "employee" && selectedEmployeeId ? (
          /* ── EMPLOYEE PROFILE VIEW ── */
          <EmployeeProfilePanel
            personId={selectedEmployeeId}
            people={people}
            onClose={() => { setRightView("dept"); setMobileShowDetail(false); }}
            onOpenEmployee={openEmployeeProfile}
            t={t}
          />
        ) : rightView === "fullchart" ? (
          /* ── FULL ORG CHART VIEW ── */
          <div className="flex flex-col h-full">
            <div className="px-4 md:px-6 pt-5 pb-4 border-b border-[var(--border-color)]">
              <button onClick={() => { setMobileShowDetail(false); setRightView("dept"); }}
                className="md:hidden flex items-center gap-1.5 text-[12px] text-[var(--text-dim)] mb-3 hover:text-[var(--text-muted)]">
                <ArrowLeftIcon size={14} className="rtl:rotate-180" /> {t("mgmt.back")}
              </button>
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center shadow-sm">
                  <GlobeIcon size={20} className="text-[var(--text-muted)]" />
                </div>
                <div>
                  <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight">{t("mgmt.companyOrgChart")}</h2>
                  <p className="text-[12px] text-[var(--text-dim)]">{t("mgmt.dragDropHint")}</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {fullOrgLoading ? <Spinner /> : fullOrgChart.length === 0 ? (
                <EmptyState icon={GitBranchPlusIcon} title={t("mgmt.noPosToViz")} subtitle={t("mgmt.createDeptsPosFirst")} />
              ) : renderOrgChart(fullOrgChart, fullOrgPositions, true, true)}
            </div>
          </div>
        ) : rightView === "roles" ? (
          /* ── ROLES VIEW ── */
          <div className="flex flex-col h-full">
            <div className="px-4 md:px-6 pt-5 pb-4 border-b border-[var(--border-color)]">
              <button onClick={() => { setMobileShowDetail(false); setRightView("dept"); }}
                className="md:hidden flex items-center gap-1.5 text-[12px] text-[var(--text-dim)] mb-3 hover:text-[var(--text-muted)]">
                <ArrowLeftIcon size={14} className="rtl:rotate-180" /> {t("mgmt.back")}
              </button>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center shadow-sm">
                    <ShieldIcon size={20} className="text-[var(--text-muted)]" />
                  </div>
                  <div>
                    <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight">{t("mgmt.rolesPerms")}</h2>
                    <p className="text-[12px] text-[var(--text-dim)]">{t("mgmt.manageAccess")}</p>
                  </div>
                </div>
                <button onClick={() => { setEditRole(null); setShowRoleModal(true); }}
                  className="h-8 px-3.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 transition-all">
                  <PlusIcon size={13} /> {t("mgmt.newRole")}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {roles.length === 0 ? (
                <EmptyState icon={ShieldIcon} title={t("mgmt.noRoles")} subtitle={t("mgmt.noRolesSub")} />
              ) : (
                <div className="px-4 md:px-6 py-4 space-y-3">
                  {roles.map((role) => (
                    <div key={role.id} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden hover:border-[var(--border-strong)] transition-all">
                      <div className="flex items-center gap-3.5 px-4 py-3.5 group">
                        <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center shrink-0">
                          <ShieldIcon size={16} className="text-[var(--text-muted)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] font-semibold text-[var(--text-primary)]">{role.name}</div>
                          {role.description && <p className="text-[11px] text-[var(--text-dim)] truncate mt-0.5">{role.description}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSelectedRoleId(selectedRoleId === role.id ? null : role.id)}
                            className={`h-7 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                              selectedRoleId === role.id ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "hover:bg-[var(--bg-surface)] text-[var(--text-faint)]"
                            }`}>
                            {selectedRoleId === role.id ? <AngleUpIcon size={11} /> : <AngleDownIcon size={11} />}
                            {t("mgmt.permissions")}
                          </button>
                          <button onClick={() => handleCloneRole(role.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-surface-hover)] transition-all" title={t("mgmt.cloneRole")}>
                            <CopyIcon size={11} className="text-[var(--text-dim)]" />
                          </button>
                          <button onClick={() => { setEditRole(role); setShowRoleModal(true); }}
                            className="w-7 h-7 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-surface-hover)] transition-all">
                            <PencilIcon size={11} className="text-[var(--text-dim)]" />
                          </button>
                          <button onClick={() => { setDeleteTarget({ type: "role", id: role.id, name: role.name }); setShowDeleteModal(true); }}
                            className="w-7 h-7 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-400/10 transition-all">
                            <TrashIcon size={11} className="text-red-400/60" />
                          </button>
                        </div>
                      </div>
                      {selectedRoleId === role.id && (
                        <div className="px-4 pb-4 border-t border-[var(--border-color)]">
                          <div className="pt-3"><PermissionsEditor roleId={role.id} t={t} /></div>
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
          <div className="flex-1 flex items-center justify-center">
            <EmptyState icon={Building2Icon} title={t("mgmt.selectDeptPrompt")} subtitle={t("mgmt.selectDeptDesc")} />
          </div>
        ) : (
          /* ── DEPARTMENT DETAIL ── */
          <>
            <div className="px-4 md:px-6 pt-5 pb-4 border-b border-[var(--border-color)]">
              <button onClick={() => setMobileShowDetail(false)}
                className="md:hidden flex items-center gap-1.5 text-[12px] text-[var(--text-dim)] mb-3 hover:text-[var(--text-muted)]">
                <ArrowLeftIcon size={14} className="rtl:rotate-180" /> {t("mgmt.allDepartments")}
              </button>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <DeptIcon dept={selectedDept} size={44} />
                  <div className="min-w-0">
                    <h2 className="text-[20px] font-bold text-[var(--text-primary)] truncate tracking-tight">{dn(selectedDept.name)}</h2>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {(() => {
                        const head = getDepartmentHead(positions, assignments, people);
                        return head ? <span className="text-[12px] text-[var(--text-muted)]">{head.name} — {posTitle(head.title, t)}</span> : null;
                      })()}
                      {selectedDept.description && <span className="text-[12px] text-[var(--text-dim)] italic">{selectedDept.description}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => { setEditDept(selectedDept); setShowDeptModal(true); }}
                    className="h-8 w-8 rounded-lg flex items-center justify-center border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-colors">
                    <PencilIcon size={13} className="text-[var(--text-dim)]" />
                  </button>
                  <button onClick={() => { setDeleteTarget({ type: "dept", id: selectedDept.id, name: dn(selectedDept.name) }); setShowDeleteModal(true); }}
                    className="h-8 w-8 rounded-lg flex items-center justify-center border border-[var(--border-subtle)] hover:bg-red-400/[0.08] transition-colors">
                    <TrashIcon size={13} className="text-red-400/60" />
                  </button>
                </div>
              </div>

              {/* Analytics + View toggle */}
              <div className="flex items-center justify-between mt-3 gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)]">
                    <BriefcaseIcon size={12} className="text-[var(--text-dim)]" />
                    <span className="text-[11px] font-medium text-[var(--text-secondary)]">{analytics.totalPositions} {t("mgmt.nPositions")}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/10">
                    <UsersIcon size={12} className="text-emerald-400/70" />
                    <span className="text-[11px] font-medium text-emerald-400/70">{analytics.totalAssigned} {t("mgmt.assigned")}</span>
                  </div>
                  {analytics.emptyPositions > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/[0.06] border border-amber-500/10">
                      <ExclamationIcon size={12} className="text-amber-400/70" />
                      <span className="text-[11px] font-medium text-amber-400/70">{analytics.emptyPositions} {t("mgmt.vacant").toLowerCase()}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center border border-[var(--border-subtle)] rounded-lg overflow-hidden shrink-0">
                  <button onClick={() => setViewMode("list")}
                    className={`h-7 px-2.5 flex items-center gap-1 text-[11px] font-medium transition-colors ${viewMode === "list" ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-muted)]"}`}>
                    <LayoutListIcon size={12} /> {t("mgmt.list")}
                  </button>
                  <button onClick={() => setViewMode("chart")}
                    className={`h-7 px-2.5 flex items-center gap-1 text-[11px] font-medium transition-colors ${viewMode === "chart" ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-muted)]"}`}>
                    <GitBranchPlusIcon size={12} /> {t("mgmt.orgChart")}
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
                    <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("mgmt.orgChartTitle")}</h3>
                    <button onClick={() => { setEditPos(null); setShowPosModal(true); }}
                      className="h-8 px-3 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-all">
                      <PlusIcon size={12} /> {t("mgmt.addPosition")}
                    </button>
                  </div>
                  {positions.length === 0 ? (
                    <EmptyState icon={GitBranchPlusIcon} title={t("mgmt.noPosToViz")} subtitle={t("mgmt.noPosYetSub")} />
                  ) : renderOrgChart(deptOrgChart, positions, false)}
                </div>
              ) : (
                /* ── LIST VIEW ── */
                <div className="px-4 md:px-6 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("mgmt.positions")}</h3>
                    <button onClick={() => { setEditPos(null); setShowPosModal(true); }}
                      className="h-8 px-3 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-all">
                      <PlusIcon size={12} /> {t("mgmt.addPosition")}
                    </button>
                  </div>

                  {/* Position search */}
                  {positions.length > 3 && (
                    <div className="relative">
                      <SearchIcon size={13} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                      <input type="text" value={posSearch} onChange={(e) => setPosSearch(e.target.value)}
                        placeholder={t("mgmt.filterPosOrPeople")}
                        className="w-full h-8 ps-8 pe-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-faint)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors" />
                      {posSearch && <button onClick={() => setPosSearch("")} className="absolute end-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-primary)]"><CrossIcon size={12} /></button>}
                    </div>
                  )}

                  {positions.length === 0 ? (
                    <EmptyState icon={BriefcaseIcon} title={t("mgmt.noPosYet")} subtitle={t("mgmt.noPosYetSub")} />
                  ) : filteredPositions.length === 0 ? (
                    <div className="text-center py-8 text-[12px] text-[var(--text-dim)]">{t("mgmt.noPosMatch")} &ldquo;{posSearch}&rdquo;</div>
                  ) : (
                    filteredPositions.map((pos) => {
                      const posAssignments = assignmentsByPos.get(pos.id) || [];
                      const roleName = pos.role_id ? roles.find((r) => r.id === pos.role_id)?.name : null;

                      return (
                        <div key={pos.id} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden hover:border-[var(--border-strong)] transition-all duration-200 relative">
                          <div className={`absolute inset-y-0 left-0 w-[3px] rounded-l-xl ${LEVEL_DOT[pos.level] || "bg-slate-400"} opacity-60`} />
                          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-faint)] group">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              pos.level <= 1 ? "bg-amber-500/[0.08] border border-amber-500/15" :
                              pos.level <= 3 ? "bg-violet-500/[0.08] border border-violet-500/15" :
                              "bg-blue-500/[0.08] border border-blue-500/15"
                            }`}>
                              <BriefcaseIcon size={15} className={`${
                                pos.level <= 1 ? "text-amber-400" : pos.level <= 3 ? "text-violet-400" : "text-blue-400"
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[14px] font-semibold text-[var(--text-primary)]">{posTitle(pos.title, t)}</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${LEVEL_COLORS[pos.level] || LEVEL_COLORS[5]}`}>L{pos.level}</span>
                                {roleName && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-400/80 border border-violet-500/15">{roleName}</span>}
                              </div>
                              {pos.description && <p className="text-[11px] text-[var(--text-dim)] truncate mt-0.5">{pos.description}</p>}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setDetailPos(pos); setShowPosDetail(true); }}
                                className="h-7 px-2 rounded-md text-[11px] font-medium flex items-center gap-1 hover:bg-[var(--bg-surface)] text-[var(--text-faint)] transition-colors">
                                <DocumentIcon size={11} /> {t("mgmt.details")}
                              </button>
                              <button onClick={() => { setAssignPosId(pos.id); setEditAssign(null); setShowAssignModal(true); }}
                                className="h-7 px-2 rounded-md text-[11px] font-medium flex items-center gap-1 hover:bg-[var(--bg-surface)] text-[var(--text-faint)] transition-colors">
                                <UserPlusIcon size={11} /> {t("mgmt.assign")}
                              </button>
                              <button onClick={() => handleDuplicatePosition(pos.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--bg-surface-hover)]" title={t("mgmt.duplicatePos")}>
                                <CopyIcon size={11} className="text-[var(--text-dim)]" />
                              </button>

                              <button onClick={() => { setEditPos(pos); setShowPosModal(true); }}
                                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--bg-surface-hover)]">
                                <PencilIcon size={11} className="text-[var(--text-dim)]" />
                              </button>
                              <button onClick={() => { setDeleteTarget({ type: "pos", id: pos.id, name: posTitle(pos.title, t) }); setShowDeleteModal(true); }}
                                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-400/[0.10]">
                                <TrashIcon size={11} className="text-red-400/60" />
                              </button>
                            </div>
                          </div>

                          {posAssignments.length === 0 ? (
                            <div className="px-4 py-3">
                              <button onClick={() => { setAssignPosId(pos.id); setEditAssign(null); setShowAssignModal(true); }}
                                className="w-full h-9 rounded-lg border border-dashed border-[var(--border-subtle)] flex items-center justify-center gap-1.5 text-[12px] font-medium text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-muted)] hover:border-[var(--border-strong)] transition-all">
                                <UserPlusIcon size={12} /> {t("mgmt.assignSomeone")}
                              </button>
                            </div>
                          ) : (
                            <div className="divide-y divide-[var(--border-faint)]">
                              {posAssignments.map((a) => {
                                const ctc = personMap.get(a.person_id);
                                return (
                                  <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 group/row hover:bg-[var(--bg-surface-subtle)] transition-colors">
                                    <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); if (ctc) openEmployeeProfile(ctc.id); }}>
                                      <Avatar src={ctc?.avatar} name={ctc?.name || "?"} size={32} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[13px] font-medium text-[var(--text-primary)] truncate cursor-pointer hover:underline"
                                          onClick={(e) => { e.stopPropagation(); if (ctc) openEmployeeProfile(ctc.id); }}>{ctc?.name || "Unknown"}</span>
                                        {a.is_primary && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/[0.12] text-emerald-400/80">{t("mgmt.primary")}</span>}
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        {ctc?.email && <span className="text-[11px] text-[var(--text-dim)] truncate">{ctc.email}</span>}
                                        {a.start_date && <><span className="text-[var(--text-dim)]">·</span><span className="text-[11px] text-[var(--text-dim)]">{t("mgmt.since")} {a.start_date}</span></>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                      <button onClick={() => { setTransferAssignment(a); setTransferContactName(ctc?.name || "Employee"); setShowTransferModal(true); }}
                                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--bg-surface-hover)]" title={t("mgmt.transfer")}>
                                        <ArrowRightLeftIcon size={11} className="text-[var(--text-dim)]" />
                                      </button>
                                      <button onClick={() => { setAssignPosId(a.position_id); setEditAssign(a); setShowAssignModal(true); }}
                                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--bg-surface-hover)]" title="Edit">
                                        <PencilIcon size={10} className="text-[var(--text-dim)]" />
                                      </button>
                                      <button onClick={() => { setDeleteTarget({ type: "assign", id: a.id, name: ctc?.name || "this assignment" }); setShowDeleteModal(true); }}
                                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-400/[0.10]" title="Remove">
                                        <TrashIcon size={10} className="text-red-400/60" />
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
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="px-5 py-2.5 rounded-xl text-[13px] font-medium shadow-2xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] border border-[var(--border-subtle)] flex items-center gap-2">
            {toast}
            {toastUndo && (
              <button onClick={() => { toastUndo(); setToast(null); setToastUndo(null); }}
                className="ml-1 flex items-center gap-1 text-[12px] font-semibold underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity">
                <Undo2Icon size={11} /> {t("mgmt.undo")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ MODALS ═══════════ */}
      <DepartmentModal open={showDeptModal} onClose={() => setShowDeptModal(false)} dept={editDept} departments={departments} onSaved={handleDeptSaved} t={t} />

      {selectedDeptId && (
        <>
          <PositionModal open={showPosModal} onClose={() => setShowPosModal(false)}
            position={editPos} departmentId={selectedDeptId} allPositions={positions} roles={roles} onSaved={handlePosSaved} t={t} />
          <AssignmentModal open={showAssignModal} onClose={() => setShowAssignModal(false)}
            assignment={editAssign} positionId={assignPosId} departmentId={selectedDeptId}
            people={people} onSaved={handleAssignSaved} onPersonCreated={handlePersonCreated} t={t} />
        </>
      )}

      <TransferModal open={showTransferModal} onClose={() => setShowTransferModal(false)}
        assignment={transferAssignment} personName={transferPersonName}
        departments={departments} onSaved={handleTransferSaved} t={t} />

      <RoleModal open={showRoleModal} onClose={() => setShowRoleModal(false)} role={editRole} onSaved={handleRoleSaved} t={t} />

      <PositionDetailModal open={showPosDetail} onClose={() => setShowPosDetail(false)}
        position={detailPos} people={people} t={t} />

      <DeleteModal open={showDeleteModal} target={deleteTarget} departments={departments}
        onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
        onConfirm={handleDeleteConfirm} deleting={deleting} t={t} />
    </div>
  );
}
