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
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { salesT } from "@/lib/translations/sales";

import { SALES_TAB_IDS, SALES_TAB_LABEL_KEYS, type SalesTabId } from "./shared";

import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import LineChartIcon from "@/components/icons/ui/LineChartIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import ActivityIcon from "@/components/icons/ui/ActivityIcon";
import SalesIcon from "@/components/icons/SalesIcon";

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
      {/* ═══════════ TOP BAR ═══════════ */}
      <div className="shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        {/* Title row */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
          <Link
            href="/"
            className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            aria-label="Back to apps"
          >
            <ArrowLeftIcon size={16} className="rtl:rotate-180" />
          </Link>
          <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
            <SalesIcon size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[16px] font-bold text-[var(--text-primary)] leading-tight truncate">{t("sales.title")}</h1>
            <p className="text-[11px] text-[var(--text-dim)] hidden md:block truncate">{t("sales.subtitle")}</p>
          </div>
        </div>

        {/* Horizontal tab bar */}
        <div className="flex overflow-x-auto scrollbar-hide px-3 gap-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SALES_TAB_IDS.map((tabId) => {
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
                <span>{t(SALES_TAB_LABEL_KEYS[tabId])}</span>
                {isActive && (
                  <span className="absolute bottom-0 inset-x-2 h-[2px] rounded-full bg-[var(--text-primary)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════ CONTENT ═══════════ */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ActiveModule t={t} lang={lang} />
      </div>
    </div>
  );
}
