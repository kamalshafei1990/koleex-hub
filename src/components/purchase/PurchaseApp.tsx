"use client";

/* ---------------------------------------------------------------------------
   PurchaseApp — unified procure-to-pay hub.

   Mirrors the Sales app structurally so the two sides of the
   transaction (order-to-cash on Sales, procure-to-pay here) feel
   like siblings. Workflow groups follow the standard ERP pipeline
   used by Odoo, SAP MM and Cisco:

     Procurement  → Requisitions · RFQs · Purchase Orders · Receipts
     Bills        → Vendor Bills · Payments · Returns
     Vendors      → Suppliers · Contracts
     Setup        → Categories · Price Lists · Approvals
     Reports      → Spend analytics

   Each module is intentionally short + focused. Deep CRUD lives in
   the dedicated apps (e.g. /contacts for supplier detail) — keeping
   the modules thin avoids 4000-line clones and keeps the hub fast.
   --------------------------------------------------------------------------- */

import { useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";

import {
  PURCHASE_GROUPS,
  PURCHASE_GROUP_LABEL_KEYS,
  PURCHASE_TAB_LABEL_KEYS,
  groupForTab,
  type PurchaseGroupId,
  type PurchaseTabId,
} from "./shared";

import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import LineChartIcon from "@/components/icons/ui/LineChartIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import WalletIcon from "@/components/icons/ui/WalletIcon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import HandCoinsIcon from "@/components/icons/ui/HandCoinsIcon";
import FileBadge2Icon from "@/components/icons/ui/FileBadge2Icon";
import FilePlusIcon from "@/components/icons/ui/FilePlusIcon";
import ClipboardCheckIcon from "@/components/icons/ui/ClipboardCheckIcon";
import CornerUpLeftIcon from "@/components/icons/ui/CornerUpLeftIcon";
import PurchaseIcon from "@/components/icons/PurchaseIcon";

import DashboardModule    from "./modules/Dashboard";
import RequisitionsModule from "./modules/Requisitions";
import RFQsModule         from "./modules/RFQs";
import OrdersModule       from "./modules/Orders";
import ReceiptsModule     from "./modules/Receipts";
import BillsModule        from "./modules/Bills";
import PaymentsModule     from "./modules/Payments";
import ReturnsModule      from "./modules/Returns";
import SuppliersModule    from "./modules/Suppliers";
import ContractsModule    from "./modules/Contracts";
import CategoriesModule   from "./modules/Categories";
import PriceListsModule   from "./modules/PriceLists";
import ApprovalsModule    from "./modules/Approvals";
import ReportsModule      from "./modules/Reports";

type IconType = ComponentType<{ size?: number; className?: string }>;

const TAB_ICONS: Record<PurchaseTabId, IconType> = {
  dashboard:    BarChart3Icon,
  requisitions: FilePlusIcon,
  rfqs:         FileBadge2Icon,
  orders:       BoxesIcon,
  receipts:     ClipboardCheckIcon,
  bills:        DocumentIcon,
  payments:     WalletIcon,
  returns:      CornerUpLeftIcon,
  suppliers:    UsersIcon,
  contracts:    BookOpenIcon,
  categories:   LayoutGridIcon,
  pricelists:   TagsIcon,
  approvals:    HandCoinsIcon,
  reports:      LineChartIcon,
};

export interface PurchaseModuleProps {
  t: (key: string) => string;
  lang: string;
}

const MODULE_MAP: Record<PurchaseTabId, ComponentType<PurchaseModuleProps>> = {
  dashboard:    DashboardModule,
  requisitions: RequisitionsModule,
  rfqs:         RFQsModule,
  orders:       OrdersModule,
  receipts:     ReceiptsModule,
  bills:        BillsModule,
  payments:     PaymentsModule,
  returns:      ReturnsModule,
  suppliers:    SuppliersModule,
  contracts:    ContractsModule,
  categories:   CategoriesModule,
  pricelists:   PriceListsModule,
  approvals:    ApprovalsModule,
  reports:      ReportsModule,
};

export default function PurchaseApp() {
  const { t, lang } = useTranslation(purchaseT);
  const [activeTab, setActiveTab] = useState<PurchaseTabId>("dashboard");

  const activeGroup: PurchaseGroupId = useMemo(() => groupForTab(activeTab), [activeTab]);
  const activeGroupConfig = PURCHASE_GROUPS.find((g) => g.id === activeGroup)!;
  const showSubBar = activeGroupConfig.tabs.length > 1;

  const handleGroupClick = (groupId: PurchaseGroupId) => {
    const grp = PURCHASE_GROUPS.find((g) => g.id === groupId);
    if (grp) setActiveTab(grp.tabs[0]);
  };

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
            <PurchaseIcon size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[16px] font-bold text-[var(--text-primary)] leading-tight truncate">{t("purchase.title")}</h1>
            <p className="text-[11px] text-[var(--text-dim)] hidden md:block truncate">{t("purchase.subtitle")}</p>
          </div>
        </div>

        {/* Primary group bar — text-only, mixed case (matches Sales). */}
        <div className="relative">
          <div className="flex overflow-x-auto scrollbar-hide px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {PURCHASE_GROUPS.map((g) => {
              const isActive = activeGroup === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => handleGroupClick(g.id)}
                  className={`relative px-3 py-2.5 whitespace-nowrap text-[13px] transition-colors ${
                    isActive
                      ? "text-[var(--text-primary)] font-semibold"
                      : "text-[var(--text-dim)] hover:text-[var(--text-muted)] font-medium"
                  }`}
                >
                  <span>{t(PURCHASE_GROUP_LABEL_KEYS[g.id])}</span>
                  {isActive && (
                    <span className="absolute bottom-0 inset-x-2 h-[2px] rounded-full bg-[var(--text-primary)]" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--bg-secondary)] to-transparent rtl:left-0 rtl:right-auto rtl:bg-gradient-to-r" />
        </div>
      </div>

      {/* Secondary sub-tab bar */}
      {showSubBar && (
        <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] relative">
          <div className="flex overflow-x-auto scrollbar-hide px-3 py-2 gap-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {activeGroupConfig.tabs.map((tabId) => {
              const Icon = TAB_ICONS[tabId];
              const isActive = activeTab === tabId;
              return (
                <button
                  key={tabId}
                  onClick={() => setActiveTab(tabId)}
                  className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg whitespace-nowrap text-[12px] font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                      : "border border-transparent text-[var(--text-dim)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-surface)]"
                  }`}
                >
                  <Icon size={13} />
                  <span>{t(PURCHASE_TAB_LABEL_KEYS[tabId])}</span>
                </button>
              );
            })}
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--bg-primary)] to-transparent rtl:left-0 rtl:right-auto rtl:bg-gradient-to-r" />
        </div>
      )}

      {/* ═══════════ CONTENT ═══════════ */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ActiveModule t={t} lang={lang} />
      </div>
    </div>
  );
}
