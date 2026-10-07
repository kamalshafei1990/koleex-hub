"use client";

/* ---------------------------------------------------------------------------
   HRApp — Main HR application shell with horizontal tab bar navigation.
   Each tab's content is a self-contained module under ./modules/.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useCallback, type ComponentType } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "@/lib/i18n";
import { hrT } from "@/lib/translations/hr";
import type { EmployeeListItem } from "@/lib/employees-admin";
import { cachedEmployeeList, fetchHrModulePresence, type HrModulePresence } from "@/lib/hr-admin";
import { type TabId, TAB_IDS, TAB_LABEL_KEYS } from "./shared";
import { useTabMotion } from "@/components/ui/useTabMotion";

/* ── Icons ── */
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import CalendarPlusIcon from "@/components/icons/ui/CalendarPlusIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import UserPlusIcon from "@/components/icons/ui/UserPlusIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import AwardIcon from "@/components/icons/ui/AwardIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import WalletIcon from "@/components/icons/ui/WalletIcon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import BrandLoading from "@/components/ui/BrandLoading";
import HrIcon from "@/components/icons/HrIcon";
import PageHeader from "@/components/ui/PageHeader";
import { useSearchPlaceholder } from "@/lib/searchPlaceholders";

/* ── Module components (lazy‑loaded) ── */
import DashboardModule from "./modules/Dashboard";

/* ── The other eleven sections load on their own ──
   They were all static imports, so opening HR downloaded payroll, leave,
   appraisals, attendance… (6,300 lines) to show the dashboard — about
   400 KB of script, measured from a phone tapping HR on Home (26/09). Each
   is now its own chunk, fetched when its tab opens, and all of them are
   warmed once the dashboard is up and the network is quiet (see HRApp), so
   switching tabs stays instant. */
const HR_MODULE_LOADERS = {
  leave:       () => import("./modules/LeaveManagement"),
  attendance:  () => import("./modules/Attendance"),
  recruitment: () => import("./modules/Recruitment"),
  appraisals:  () => import("./modules/Appraisals"),
  ratings:     () => import("./modules/Ratings"),
  skills:      () => import("./modules/Skills"),
  behavior:    () => import("./modules/Behavior"),
  onboarding:  () => import("./modules/Onboarding"),
  payroll:     () => import("./modules/Payroll"),
  training:    () => import("./modules/Training"),
  documents:   () => import("./modules/Documents"),
  reports:     () => import("./modules/Reports"),
} satisfies Record<Exclude<TabId, "dashboard">, () => Promise<{ default: ComponentType<HRModuleProps> }>>;
const moduleLoading = () => <BrandLoading className="h-full min-h-[40vh]" />;
const LeaveModule       = dynamic(HR_MODULE_LOADERS.leave,       { ssr: false, loading: moduleLoading });
const AttendanceModule  = dynamic(HR_MODULE_LOADERS.attendance,  { ssr: false, loading: moduleLoading });
const RecruitmentModule = dynamic(HR_MODULE_LOADERS.recruitment, { ssr: false, loading: moduleLoading });
const AppraisalsModule  = dynamic(HR_MODULE_LOADERS.appraisals,  { ssr: false, loading: moduleLoading });
const RatingsModule     = dynamic(HR_MODULE_LOADERS.ratings,     { ssr: false, loading: moduleLoading });
const SkillsModule      = dynamic(HR_MODULE_LOADERS.skills,      { ssr: false, loading: moduleLoading });
const BehaviorModule    = dynamic(HR_MODULE_LOADERS.behavior,    { ssr: false, loading: moduleLoading });
const OnboardingModule  = dynamic(HR_MODULE_LOADERS.onboarding,  { ssr: false, loading: moduleLoading });
const PayrollModule     = dynamic(HR_MODULE_LOADERS.payroll,     { ssr: false, loading: moduleLoading });
const TrainingModule    = dynamic(HR_MODULE_LOADERS.training,    { ssr: false, loading: moduleLoading });
const DocumentsModule   = dynamic(HR_MODULE_LOADERS.documents,   { ssr: false, loading: moduleLoading });
const ReportsModule     = dynamic(HR_MODULE_LOADERS.reports,     { ssr: false, loading: moduleLoading });

/* ── Tab icon mapping ── */
const TAB_ICONS: Record<TabId, ComponentType<{ size?: number; className?: string }>> = {
  dashboard:   BarChart3Icon,
  leave:       CalendarPlusIcon,
  attendance:  ClockIcon,
  recruitment: UserPlusIcon,
  appraisals:  StarIcon,
  ratings:     AwardIcon,
  skills:      SparklesIcon,
  behavior:    ShieldIcon,
  onboarding:  CheckCircleIcon,
  payroll:     WalletIcon,
  training:    BookOpenIcon,
  documents:   DocumentIcon,
  reports:     BarChart3Icon,
};

/* ── Tabs that only earn their place once they hold something ──
   Recruitment and Training sit out of the strip while their tables are
   empty (owner, 20/09/2026). The module itself still mounts through the
   ?tab= deep link, which is how the first row gets in. */
const OPTIONAL_TABS: Partial<Record<TabId, keyof HrModulePresence>> = {
  recruitment: "recruitment",
  training:    "training",
};
const PRESENCE_KEY = "kx:hr:presence";
const PRESENCE_HIDDEN: HrModulePresence = { recruitment: false, training: false };

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
  ratings:     RatingsModule,
  skills:      SkillsModule,
  behavior:    BehaviorModule,
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
  const searchPlaceholder = useSearchPlaceholder("hr");

  /* ── Navigation ── */
  /* Deep links (e.g. the employee edit form's "Assess in HR › Behavior")
     pass ?tab=behavior; honour it on first paint. */
  const initialTab = ((): TabId => {
    if (typeof window === "undefined") return "dashboard";
    const t = new URLSearchParams(window.location.search).get("tab");
    return (TAB_IDS as string[]).includes(t ?? "") ? (t as TabId) : "dashboard";
  })();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  /* A client-side navigation here (a notification's /hr?tab=leave, the
     Reports Library's attendance sheet) renders this BEFORE the router
     writes the new URL, so initialTab still read the old one. Read ?tab=
     again once the navigation has committed. */
  useEffect(() => {
    void Promise.resolve().then(() => {
      const q = new URLSearchParams(window.location.search).get("tab");
      if ((TAB_IDS as string[]).includes(q ?? "")) setActiveTab(q as TabId);
    });
  }, []);

  /* ── Which optional tabs are in the strip ──
     Warm-start from the last session's answer so the strip does not
     reflow after first paint; refresh in the background. Unknown = hidden,
     which is the common case (both modules are empty today). */
  const [presence, setPresence] = useState<HrModulePresence>(() => {
    if (typeof window === "undefined") return PRESENCE_HIDDEN;
    try {
      const raw = sessionStorage.getItem(PRESENCE_KEY);
      return raw ? { ...PRESENCE_HIDDEN, ...(JSON.parse(raw) as Partial<HrModulePresence>) } : PRESENCE_HIDDEN;
    } catch { return PRESENCE_HIDDEN; }
  });
  useEffect(() => {
    let cancelled = false;
    fetchHrModulePresence().then((p) => {
      if (cancelled) return;
      setPresence(p);
      try { sessionStorage.setItem(PRESENCE_KEY, JSON.stringify(p)); } catch { /* full */ }
    });
    return () => { cancelled = true; };
  }, []);
  /* A hidden tab reached by deep link still shows, so the strip always
     names where the person is. */
  const visibleTabs = TAB_IDS.filter((id) => {
    const flag = OPTIONAL_TABS[id];
    return flag === undefined || presence[flag] || id === activeTab;
  });

  /* Directional pane swap (owner pick 3A) — direction from the tab's index
     in the strip order; RTL flips in CSS. */
  const tabMotion = useTabMotion(visibleTabs.indexOf(activeTab));

  /* ── Shared employee list (many modules need it) ──
     Warm-start: hydrate instantly from the last session's snapshot so the
     app paints without a spinner on revisit, then refresh in the
     background. Same pattern as the Customers list. */
  const [employees, setEmployees] = useState<EmployeeListItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = sessionStorage.getItem("kx:hr:employees");
      return raw ? (JSON.parse(raw) as EmployeeListItem[]) : [];
    } catch { return []; }
  });
  const [empLoading, setEmpLoading] = useState(() => employees.length === 0);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await cachedEmployeeList();
      setEmployees(data);
      try { sessionStorage.setItem("kx:hr:employees", JSON.stringify(data)); } catch { /* full */ }
    } catch (err) {
      console.error("[HR] Employee load error:", err);
    } finally {
      setEmpLoading(false);
    }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  /* Warm every section's chunk once the first screen is up and the network
     has gone quiet — tab switches stay instant without the first paint
     paying for them. import() de-dupes, so an opened tab is not fetched twice. */
  useEffect(() => {
    let gone = false;
    const run = () => {
      void import("@/lib/net-idle")
        .then(({ whenNetworkQuiet }) => whenNetworkQuiet({ quietMs: 700, maxWaitMs: 8000 }))
        .then(() => { if (!gone) Object.values(HR_MODULE_LOADERS).forEach((load) => { void load().catch(() => {}); }); })
        .catch(() => {});
    };
    const t = window.setTimeout(run, 1200);
    return () => { gone = true; window.clearTimeout(t); };
  }, []);

  /* ── Active module component ── */
  const ActiveModule = MODULE_MAP[activeTab];

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="h-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden max-w-[100vw]">

      {/* ═══════════ TOP BAR — Odoo-style compact header with inline menu ═══════════ */}
      <div className="shrink-0 px-4 sm:px-5 pt-4 sm:pt-5">
        <PageHeader
          title={t("hr.title")}
          icon={<HrIcon size={16} />}
          searchPlaceholder={searchPlaceholder}
          tabs={visibleTabs.map((tabId) => {
            const Icon = TAB_ICONS[tabId];
            return {
              key: tabId,
              label: t(TAB_LABEL_KEYS[tabId]),
              icon: <Icon size={12} />,
              onClick: () => setActiveTab(tabId),
              active: activeTab === tabId,
            };
          })}
        />
      </div>

      {/* ═══════════ CONTENT ═══════════ */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {empLoading ? (
          <BrandLoading className="h-full min-h-[40vh]" />
        ) : (
          <div key={activeTab} className={tabMotion}>
            <ActiveModule employees={employees} t={t} lang={lang} setActiveTab={setActiveTab} />
          </div>
        )}
      </div>
    </div>
  );
}
