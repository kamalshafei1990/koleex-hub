"use client";

/* ---------------------------------------------------------------------------
   SalesApp — unified Sales hub.

   This is the consolidated entry point for everything sales-related:
   pipeline, quotations, orders, invoices, customers, activities,
   and reports. Mirrors the structural pattern of HRApp.tsx —
   horizontal tab bar at the top, one self-contained module per tab.

   Each module is intentionally short + focused. For deep-dive
   editing (creating a new quotation, drilling into one customer)
   we link out to the dedicated app (/quotations, /customers, /crm,
   /invoices) instead of duplicating their UIs. Keeping the modules
   thin avoids 4000-line clones and keeps the hub fast.
   --------------------------------------------------------------------------- */

import { useState, type ComponentType } from "react";
import { useTranslation } from "@/lib/i18n";
import { salesT } from "@/lib/translations/sales";

import { SALES_TAB_IDS, SALES_TAB_LABEL_KEYS, type SalesTabId } from "./shared";

import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import LineChartIcon from "@/components/icons/ui/LineChartIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import ActivityIcon from "@/components/icons/ui/ActivityIcon";
import SalesIcon from "@/components/icons/SalesIcon";
import PageHeader from "@/components/ui/PageHeader";

import DashboardModule  from "./modules/Dashboard";
import PipelineModule   from "./modules/Pipeline";
import QuotationsModule from "./modules/Quotations";
import OrdersModule     from "./modules/Orders";
import InvoicesModule   from "./modules/Invoices";
import CustomersModule  from "./modules/Customers";
import ActivitiesModule from "./modules/Activities";
import ReportsModule    from "./modules/Reports";

const TAB_ICONS: Record<SalesTabId, ComponentType<{ size?: number; className?: string }>> = {
  dashboard:  BarChart3Icon,
  pipeline:   LayoutGridIcon,
  quotations: DocumentIcon,
  orders:     BoxesIcon,
  invoices:   DocumentIcon,
  customers:  UsersIcon,
  activities: ActivityIcon,
  reports:    LineChartIcon,
};

export interface SalesModuleProps {
  t: (key: string) => string;
  lang: string;
  /** Allow modules (especially Dashboard) to switch to another tab. */
  setActiveTab?: (next: SalesTabId) => void;
}

const MODULE_MAP: Record<SalesTabId, ComponentType<SalesModuleProps>> = {
  dashboard:  DashboardModule,
  pipeline:   PipelineModule,
  quotations: QuotationsModule,
  orders:     OrdersModule,
  invoices:   InvoicesModule,
  customers:  CustomersModule,
  activities: ActivitiesModule,
  reports:    ReportsModule,
};

export default function SalesApp() {
  const { t, lang } = useTranslation(salesT);
  const [activeTab, setActiveTab] = useState<SalesTabId>("dashboard");
  const ActiveModule = MODULE_MAP[activeTab];

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="h-[calc(100vh-3.5rem)] bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden max-w-[100vw]"
    >
      {/* ═══════════ TOP BAR — canonical Hub PageHeader + state-tab strip ═══════════ */}
      <div className="shrink-0 border-b border-[var(--border-color)] px-5 pt-4">
        <PageHeader
          title={t("sales.title")}
          subtitle={t("sales.subtitle")}
          icon={<SalesIcon size={16} />}
          showTabs={false}
        />
        {activeTab !== "dashboard" && (
        <nav
          aria-label="Sales navigation"
          className="mt-6 flex items-center gap-1.5 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SALES_TAB_IDS.map((tabId) => {
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
                {t(SALES_TAB_LABEL_KEYS[tabId])}
              </button>
            );
          })}
        </nav>
        )}
      </div>

      {/* ═══════════ CONTENT ═══════════ */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ActiveModule t={t} lang={lang} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
}
