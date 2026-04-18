"use client";

/* ---------------------------------------------------------------------------
   HRApp — Main HR application shell with horizontal tab bar navigation.
   Each tab's content is a self-contained module under ./modules/.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useCallback, type ComponentType } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { hrT } from "@/lib/translations/hr";
import { fetchEmployeeList, type EmployeeListItem } from "@/lib/employees-admin";
import { type TabId, TAB_IDS, TAB_LABEL_KEYS } from "./shared";

/* ── Icons ── */
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import CalendarPlusIcon from "@/components/icons/ui/CalendarPlusIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import UserPlusIcon from "@/components/icons/ui/UserPlusIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import WalletIcon from "@/components/icons/ui/WalletIcon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import HrIcon from "@/components/icons/HrIcon";

/* ── Module components (lazy‑loaded) ── */
import DashboardModule from "./modules/Dashboard";
import LeaveModule from "./modules/LeaveManagement";
import AttendanceModule from "./modules/Attendance";
import RecruitmentModule from "./modules/Recruitment";
import AppraisalsModule from "./modules/Appraisals";
import OnboardingModule from "./modules/Onboarding";
import PayrollModule from "./modules/Payroll";
import TrainingModule from "./modules/Training";
import DocumentsModule from "./modules/Documents";
import ReportsModule from "./modules/Reports";

/* ── Tab icon mapping ── */
const TAB_ICONS: Record<TabId, ComponentType<{ size?: number; className?: string }>> = {
  dashboard:   BarChart3Icon,
  leave:       CalendarPlusIcon,
  attendance:  ClockIcon,
  recruitment: UserPlusIcon,
  appraisals:  StarIcon,
  onboarding:  CheckCircleIcon,
  payroll:     WalletIcon,
  training:    BookOpenIcon,
  documents:   DocumentIcon,
  reports:     BarChart3Icon,
};

/* ── Shared props interface for every module ── */
export interface HRModuleProps {
  employees: EmployeeListItem[];
  t: (key: string) => string;
  lang: string;
}

/* ── Module component map ── */
const MODULE_MAP: Record<TabId, ComponentType<HRModuleProps>> = {
  dashboard:   DashboardModule,
  leave:       LeaveModule,
  attendance:  AttendanceModule,
  recruitment: RecruitmentModule,
  appraisals:  AppraisalsModule,
  onboarding:  OnboardingModule,
  payroll:     PayrollModule,
  training:    TrainingModule,
  documents:   DocumentsModule,
  reports:     ReportsModule,
};

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */

export default function HRApp() {
  const { t, lang } = useTranslation(hrT);

  /* ── Navigation ── */
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  /* ── Shared employee list (many modules need it) ── */
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [empLoading, setEmpLoading] = useState(true);

  const loadEmployees = useCallback(async () => {
    setEmpLoading(true);
    try {
      const data = await fetchEmployeeList();
      setEmployees(data);
    } catch (err) {
      console.error("[HR] Employee load error:", err);
    } finally {
      setEmpLoading(false);
    }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  /* ── Active module component ── */
  const ActiveModule = MODULE_MAP[activeTab];

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="h-[calc(100vh-3.5rem)] bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden max-w-[100vw]">

      {/* ═══════════ TOP BAR ═══════════ */}
      <div className="shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        {/* Title row */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
          <Link href="/" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
            <ArrowLeftIcon size={16} className="rtl:rotate-180" />
          </Link>
          <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
            <HrIcon size={16} />
          </div>
          <h1 className="text-[16px] font-bold text-[var(--text-primary)] truncate">{t("hr.title")}</h1>
        </div>

        {/* Horizontal tab bar */}
        <div className="flex overflow-x-auto scrollbar-hide px-3 gap-0.5">
          {TAB_IDS.map((tabId) => {
            const Icon = TAB_ICONS[tabId];
            const isActive = activeTab === tabId;
            return (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`relative flex items-center gap-1.5 px-3.5 py-2.5 whitespace-nowrap text-[12px] font-semibold uppercase tracking-wider transition-colors ${
                  isActive
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                }`}
              >
                <Icon size={14} />
                <span>{t(TAB_LABEL_KEYS[tabId])}</span>
                {isActive && (
                  <span className="absolute bottom-0 inset-x-2 h-[2px] rounded-full bg-[var(--text-primary)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════ CONTENT ═══════════ */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {empLoading ? (
          <div className="flex-1 h-full flex items-center justify-center">
            <SpinnerIcon size={24} className="animate-spin text-[var(--text-dim)]" />
          </div>
        ) : (
          <ActiveModule employees={employees} t={t} lang={lang} />
        )}
      </div>
    </div>
  );
}
