"use client";

/* ---------------------------------------------------------------------------
   PurchaseHeader — thin wrapper around the shared PageHeader, analogous
   to InventoryHeader. Owns the procure-to-pay routing knowledge:

     · Which routes are primary tabs (6) vs overflow groups (8)
     · Translation keys for tab labels
     · Accent palette per overflow group (uses shared ACCENT tokens)
     · App icon (purchase)

   All chrome — back arrow, app icon, title row, sticky pill menu, search
   bar, popup — is delegated to the canonical PageHeader so the Purchase
   app feels identical to Inventory / Finance / HR / Sales.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import PageHeader, { type PageTab } from "@/components/ui/PageHeader";
import type { NavGroup } from "@/components/ui/PageNavPopup";
import type { RrIconName } from "@/components/ui/RrIcon";
import { useTranslation, type Translations } from "@/lib/i18n";
import { ACCENT } from "@/lib/accentColors";
import { useSearchPlaceholder } from "@/lib/searchPlaceholders";

const PRIMARY_TABS_RAW: Array<PageTab & { i18nKey: string }> = [
  { key: "/purchase",              label: "Home",         icon: "home",         i18nKey: "pur.nav.home" },
  { key: "/purchase/requisitions", label: "Requisitions", icon: "file",         i18nKey: "pur.nav.requisitions" },
  { key: "/purchase/rfqs",         label: "RFQs",         icon: "badge-check",  i18nKey: "pur.nav.rfqs" },
  { key: "/purchase/orders",       label: "Orders",       icon: "box-open",     i18nKey: "pur.nav.orders" },
  { key: "/purchase/receipts",     label: "Receipts",     icon: "clipboard",    i18nKey: "pur.nav.receipts" },
  { key: "/purchase/bills",        label: "Bills",        icon: "file-invoice", i18nKey: "pur.nav.bills" },
];

const OVERFLOW_GROUPS: NavGroup[] = [
  {
    id: "procure",
    label: "Procure to pay",
    accent: ACCENT.blue,
    items: [
      { key: "/purchase",              label: "Home",            icon: "home",         blurb: "KPIs, alerts, today" },
      { key: "/purchase/requisitions", label: "Requisitions",    icon: "file",         blurb: "Internal purchase requests" },
      { key: "/purchase/rfqs",         label: "RFQs",            icon: "badge-check",  blurb: "Quote requests + bids" },
      { key: "/purchase/orders",       label: "Purchase Orders", icon: "box-open",     blurb: "Confirmed buy commitments" },
      { key: "/purchase/receipts",     label: "Receipts",        icon: "clipboard",    blurb: "Goods received (GRN)" },
    ],
  },
  {
    id: "billpay",
    label: "Bill & pay",
    accent: ACCENT.teal,
    items: [
      { key: "/purchase/bills",    label: "Vendor Bills", icon: "file-invoice", blurb: "AP invoices + 3-way match" },
      { key: "/purchase/payments", label: "Payments",     icon: "wallet",       blurb: "Outgoing payments + runs" },
      { key: "/purchase/returns",  label: "Returns",      icon: "recycle",      blurb: "Vendor returns + credits" },
    ],
  },
  {
    id: "vendors",
    label: "Vendors",
    accent: ACCENT.violet,
    items: [
      { key: "/purchase/suppliers",   label: "Suppliers",   icon: "users",    blurb: "Vendor master + scorecards" },
      { key: "/purchase/contracts",   label: "Contracts",   icon: "contract", blurb: "Term agreements + burn-down" },
      { key: "/purchase/price-lists", label: "Price Lists", icon: "stamp",    blurb: "Vendor catalog pricing" },
    ],
  },
  {
    id: "setup",
    label: "Setup",
    accent: ACCENT.amber,
    items: [
      { key: "/purchase/categories", label: "Categories", icon: "books",        blurb: "Spend categories" },
      { key: "/purchase/approvals",  label: "Approvals",  icon: "shield-check", blurb: "Threshold + routing rules" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    accent: ACCENT.rose,
    items: [
      { key: "/purchase/reports", label: "Spend Analytics", icon: "signal-stream", blurb: "By supplier, category, period" },
    ],
  },
];

const T: Translations = {
  "pur.nav.home":         { en: "Home",         zh: "首页",     ar: "الرئيسية" },
  "pur.nav.requisitions": { en: "Requisitions", zh: "请购单",   ar: "طلبات الشراء" },
  "pur.nav.rfqs":         { en: "RFQs",         zh: "询价单",   ar: "طلبات عروض الأسعار" },
  "pur.nav.orders":       { en: "Orders",       zh: "采购单",   ar: "الأوامر" },
  "pur.nav.receipts":     { en: "Receipts",     zh: "收货单",   ar: "إيصالات الاستلام" },
  "pur.nav.bills":        { en: "Bills",        zh: "供应商账单", ar: "الفواتير" },
};

interface PurchaseHeaderProps {
  title: string;
  subtitle?: string;
  /** Ignored — always shows the purchase icon. Kept for API parity. */
  icon?: RrIconName;
  action?: ReactNode;
  controls?: ReactNode;
  meta?: ReactNode;
  showTabs?: boolean;
}

export default function PurchaseHeader({
  title,
  subtitle,
  icon: _icon,
  action,
  controls,
  meta,
  showTabs = true,
}: PurchaseHeaderProps) {
  const { t } = useTranslation(T);
  const searchPlaceholder = useSearchPlaceholder("purchase");

  const tabs: PageTab[] = PRIMARY_TABS_RAW.map((tab) => ({
    key: tab.key,
    icon: tab.icon,
    label: (() => {
      const translated = t(tab.i18nKey);
      return translated === tab.i18nKey ? tab.label : translated;
    })(),
  }));

  return (
    <PageHeader
      title={title}
      subtitle={subtitle}
      icon="box-open"
      action={action}
      controls={controls}
      meta={meta}
      tabs={tabs}
      overflowTabs={OVERFLOW_GROUPS}
      popupTitle="Purchase"
      popupSubtitle="Pick where to go."
      showTabs={showTabs}
      searchPlaceholder={searchPlaceholder}
      searchHref="/inventory/search"
    />
  );
}

/** Flat list of every purchase route — exported so other components
 *  (e.g. breadcrumbs, mobile nav, deep-link resolvers) can compute
 *  the active key with longest-prefix matching. */
export const PURCHASE_NAV_KEYS: string[] = OVERFLOW_GROUPS.flatMap((g) => g.items.map((i) => i.key));
