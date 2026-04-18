"use client";

/* ---------------------------------------------------------------------------
   HR Shared — reusable UI primitives for the HR module components.
   Matches the Koleex Hub admin design system.
   --------------------------------------------------------------------------- */

import { useEffect, type ReactNode, type ComponentType } from "react";
import CrossIcon from "@/components/icons/ui/CrossIcon";

/* ── CSS class constants ── */

export const inputCls =
  "w-full h-10 px-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--border-focus)] text-[var(--text-primary)] text-[13px] outline-none transition-colors";

export const textareaCls =
  "w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--border-focus)] text-[var(--text-primary)] text-[13px] outline-none transition-colors resize-none";

export const selectCls = inputCls;

export const primaryBtnCls =
  "h-10 px-5 rounded-xl text-[13px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-30 transition-all";

export const cancelBtnCls =
  "h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-subtle)] hover:bg-[var(--bg-surface)] transition-colors";

export const dangerBtnCls =
  "h-10 px-5 rounded-xl text-[13px] font-semibold bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 disabled:opacity-50 transition-all";

export const cardCls =
  "bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)]";

export const sectionTitleCls =
  "text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-4 flex items-center gap-2";

/* ── Status color maps ── */

export const LEAVE_STATUS_MAP: Record<string, string> = {
  pending:   "bg-amber-500/15 text-amber-400 border-amber-500/20",
  approved:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  rejected:  "bg-red-500/15 text-red-400 border-red-500/20",
  cancelled: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

export const JOB_STATUS_MAP: Record<string, string> = {
  draft:  "bg-slate-500/15 text-slate-400 border-slate-500/20",
  open:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  closed: "bg-red-500/15 text-red-400 border-red-500/20",
  filled: "bg-blue-500/15 text-blue-400 border-blue-500/20",
};

export const STAGE_MAP: Record<string, string> = {
  new:       "bg-slate-500/15 text-slate-400 border-slate-500/20",
  screening: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  interview: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  offer:     "bg-violet-500/15 text-violet-400 border-violet-500/20",
  hired:     "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  rejected:  "bg-red-500/15 text-red-400 border-red-500/20",
};

export const ATTENDANCE_STATUS_MAP: Record<string, string> = {
  present:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  late:     "bg-amber-500/15 text-amber-400 border-amber-500/20",
  absent:   "bg-red-500/15 text-red-400 border-red-500/20",
  half_day: "bg-blue-500/15 text-blue-400 border-blue-500/20",
};

export const PAYSLIP_STATUS_MAP: Record<string, string> = {
  draft:    "bg-slate-500/15 text-slate-400 border-slate-500/20",
  approved: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  paid:     "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

export const TRAINING_STATUS_MAP: Record<string, string> = {
  enrolled:    "bg-blue-500/15 text-blue-400 border-blue-500/20",
  in_progress: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  completed:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  failed:      "bg-red-500/15 text-red-400 border-red-500/20",
  expired:     "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

export const DOC_CATEGORY_MAP: Record<string, string> = {
  identity:      "bg-blue-500/15 text-blue-400 border-blue-500/20",
  contract:      "bg-violet-500/15 text-violet-400 border-violet-500/20",
  certification: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  medical:       "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  other:         "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

/* ── Helper functions ── */

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtTime(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function daysUntil(d: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

export function sumObj(obj: Record<string, number> | null | undefined): number {
  if (!obj) return 0;
  return Object.values(obj).reduce((s, v) => s + (v || 0), 0);
}

/* ── Shared components ── */

export function ModalShell({
  open,
  onClose,
  title,
  width,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: string;
  children: ReactNode;
  footer?: ReactNode;
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

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] mb-1.5">
      {children}
    </label>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-12 w-12 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center mb-3">
        <Icon size={20} className="text-[var(--text-dim)]" />
      </div>
      <div className="text-[14px] font-medium text-[var(--text-muted)] mb-1">{title}</div>
      {subtitle && <div className="text-[12px] text-[var(--text-dim)]">{subtitle}</div>}
    </div>
  );
}

export function StatusBadge({
  status,
  map,
  label,
}: {
  status: string;
  map: Record<string, string>;
  label?: string;
}) {
  const cls = map[status] || "bg-slate-500/15 text-slate-400 border-slate-500/20";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${cls}`}>
      {label || status}
    </span>
  );
}

/* ── Tab definition types ── */

export type TabId =
  | "dashboard"
  | "leave"
  | "attendance"
  | "recruitment"
  | "appraisals"
  | "onboarding"
  | "payroll"
  | "training"
  | "documents"
  | "reports";

export const TAB_IDS: TabId[] = [
  "dashboard",
  "leave",
  "attendance",
  "recruitment",
  "appraisals",
  "onboarding",
  "payroll",
  "training",
  "documents",
  "reports",
];

export const TAB_LABEL_KEYS: Record<TabId, string> = {
  dashboard:   "hr.tabDashboard",
  leave:       "hr.tabLeave",
  attendance:  "hr.tabAttendance",
  recruitment: "hr.tabRecruitment",
  appraisals:  "hr.tabAppraisals",
  onboarding:  "hr.tabOnboarding",
  payroll:     "hr.tabPayroll",
  training:    "hr.tabTraining",
  documents:   "hr.tabDocuments",
  reports:     "hr.tabReports",
};

/* ── Translation helpers for dynamic values ── */

export function makeTranslationHelpers(t: (key: string) => string) {
  const tStatus = (status: string): string => {
    const k = `hr.status.${status}`;
    const v = t(k);
    return v !== k ? v : status;
  };
  const tStage = (stage: string): string => {
    const k = `hr.stage.${stage}`;
    const v = t(k);
    return v !== k ? v : stage;
  };
  const tCat = (cat: string): string => {
    const k = `hr.cat.${cat}`;
    const v = t(k);
    return v !== k ? v : cat;
  };
  const tEmpType = (typ: string): string => {
    const k = `hr.empType.${typ}`;
    const v = t(k);
    return v !== k ? v : typ;
  };
  const tLeaveType = (name: string): string => {
    const code = name.toLowerCase().replace(/\s+leave$/i, "").replace(/\s+/g, "_");
    const k = `hr.leaveType.${code}`;
    const v = t(k);
    return v !== k ? v : name;
  };

  return { tStatus, tStage, tCat, tEmpType, tLeaveType };
}
