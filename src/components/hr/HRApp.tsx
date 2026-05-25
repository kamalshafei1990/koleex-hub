"use client";

/* ---------------------------------------------------------------------------
   HRApp — Main HR application shell with horizontal tab bar navigation.
   Each tab's content is a self-contained module under ./modules/.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useCallback, type ComponentType } from "react";
import { useTranslation } from "@/lib/i18n";
import { hrT } from "@/lib/translations/hr";
import { fetchEmployeeList, type EmployeeListItem } from "@/lib/employees-admin";
import { type TabId, TAB_IDS, TAB_LABEL_KEYS } from "./shared";

/* ── Icons ── */
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
import PageHeader from "@/components/ui/PageHeader";

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
  setActiveTab?: (next: TabId) => void;
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

      {/* ═══════════ TOP BAR — canonical Hub PageHeader + state tab strip ═══════════ */}
      <div className="shrink-0 border-b border-[var(--border-color)] px-4 pt-4 pb-4 sm:px-5">
        <PageHeader
          title={t("hr.title")}
          icon={<HrIcon size={16} />}
          showTabs={false}
        />
        {activeTab !== "dashboard" && (
        <nav
          aria-label="HR navigation"
          className="mt-6 flex items-center gap-1.5 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TAB_IDS.map((tabId) => {
            const Icon = TAB_ICONS[tabId];
            const isActive = activeTab === tabId;
            return (
              <button
                key={tabId}
                type="button"
                onClick={() => setActiveTab(tabId)}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] shadow-sm"
                    : "border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon size={12} className={isActive ? "" : "text-[var(--text-dim)]"} />
                {t(TAB_LABEL_KEYS[tabId])}
              </button>
            );
          })}
        </nav>
        )}
      </div>

      {/* ═══════════ CONTENT ═══════════ */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {empLoading ? (
          <div className="flex-1 h-full flex items-center justify-center">
            <SpinnerIcon size={24} className="animate-spin text-[var(--text-dim)]" />
          </div>
        ) : (
          <ActiveModule employees={employees} t={t} lang={lang} setActiveTab={setActiveTab} />
        )}
      </div>
    </div>
  );
}
