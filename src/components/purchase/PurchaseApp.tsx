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
import PageHeader from "@/components/ui/PageHeader";

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
      {/* ═══════════ TOP BAR — canonical Hub PageHeader + state tab strips ═══════════ */}
      <div className="shrink-0 border-b border-[var(--border-color)] px-5 pt-4">
        <PageHeader
          title={t("purchase.title")}
          subtitle={t("purchase.subtitle")}
          icon={<PurchaseIcon size={16} />}
          showTabs={false}
        />
        {/* Primary group strip — flat border-b like all other Hub apps */}
        <nav
          aria-label="Purchase navigation"
          className="mt-5 flex items-end gap-0.5 overflow-x-auto border-b border-[var(--border-subtle)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {PURCHASE_GROUPS.map((g) => {
            const isActive = activeGroup === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => handleGroupClick(g.id)}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex h-10 shrink-0 items-center gap-1.5 px-3 text-[12px] transition-colors duration-150 ${
                  isActive
                    ? "border-b-2 border-[var(--text-primary)] pb-0 text-[var(--text-primary)]"
                    : "border-b-2 border-transparent text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t(PURCHASE_GROUP_LABEL_KEYS[g.id])}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Secondary sub-tab bar */}
      {showSubBar && (
        <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] px-5">
          <nav
            aria-label="Purchase sub-navigation"
            className="flex items-center gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {activeGroupConfig.tabs.map((tabId) => {
              const Icon = TAB_ICONS[tabId];
              const isActive = activeTab === tabId;
              return (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setActiveTab(tabId)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-[11.5px] transition-colors ${
                    isActive
                      ? "border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      : "border-transparent text-[var(--text-dim)] hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon size={11} />
                  {t(PURCHASE_TAB_LABEL_KEYS[tabId])}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* ═══════════ CONTENT ═══════════ */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ActiveModule t={t} lang={lang} />
      </div>
    </div>
  );
}
