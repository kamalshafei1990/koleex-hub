"use client";

/* ---------------------------------------------------------------------------
   InventoryHeader — thin wrapper around shared PageHeader.

   Owns only inventory-specific knowledge:
     · Which routes are primary tabs vs. overflow (··· popup)
     · i18n labels for those routes
     · App icon (box-open)

   All chrome (back arrow, identity chip, title row, tab strip, popup) is
   delegated to the shared PageHeader so every app in the Hub looks identical.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import PageHeader from "@/components/ui/PageHeader";
import type { PageTab } from "@/components/ui/PageHeader";
import type { NavGroup } from "@/components/ui/PageNavPopup";
import type { RrIconName } from "@/components/ui/RrIcon";
import { useTranslation, type Translations } from "@/lib/i18n";

const PRIMARY_TABS_RAW: Array<PageTab & { i18nKey: string }> = [
  { key: "/inventory",           label: "Home",      icon: "home",         i18nKey: "inv.nav.r.home" },
  { key: "/inventory/items",     label: "Items",     icon: "box-open",     i18nKey: "inv.nav.r.items" },
  { key: "/inventory/movements", label: "Movements", icon: "file-invoice", i18nKey: "inv.nav.r.movements" },
  { key: "/inventory/transfers", label: "Transfers", icon: "truck-side",   i18nKey: "inv.nav.r.transfers" },
  { key: "/inventory/returns",   label: "Returns",   icon: "recycle",      i18nKey: "inv.nav.r.returns" },
  { key: "/inventory/balances",  label: "Balances",  icon: "badge-check",  i18nKey: "inv.nav.r.balances" },
];

const OVERFLOW_GROUPS: NavGroup[] = [
  {
    id: "do",
    label: "Actions",
    accent: {
      border:   "border-l-blue-500/70",
      chipBg:   "bg-blue-500/10",
      chipText: "text-blue-400",
      header:   "text-blue-400",
    },
    items: [
      { key: "/inventory",           label: "Home",       icon: "home",         blurb: "Today's view + quick actions" },
      { key: "/inventory/items",     label: "Items",      icon: "box-open",     blurb: "Browse + add stocked items" },
      { key: "/inventory/movements", label: "Movements",  icon: "file-invoice", blurb: "Receive · ship · adjust" },
      { key: "/inventory/transfers", label: "Transfers",  icon: "truck-side",   blurb: "Send stock between sites" },
      { key: "/inventory/returns",   label: "Returns",    icon: "recycle",      blurb: "Customer + supplier returns" },
    ],
  },
  {
    id: "lookup",
    label: "Look up",
    accent: {
      border:   "border-l-teal-500/70",
      chipBg:   "bg-teal-500/10",
      chipText: "text-teal-400",
      header:   "text-teal-400",
    },
    items: [
      { key: "/inventory/search",    label: "Search",    icon: "search",      blurb: "Find anything fast" },
      { key: "/inventory/balances",  label: "Balances",  icon: "badge-check", blurb: "Live stock on hand" },
      { key: "/inventory/serials",   label: "Serials",   icon: "fingerprint", blurb: "Trace by serial number" },
      { key: "/inventory/batches",   label: "Batches",   icon: "box-circle-check", blurb: "Lots, expiry, FEFO" },
    ],
  },
  {
    id: "setup",
    label: "Setup",
    accent: {
      border:   "border-l-amber-500/70",
      chipBg:   "bg-amber-500/10",
      chipText: "text-amber-400",
      header:   "text-amber-400",
    },
    items: [
      { key: "/inventory/warehouses", label: "Warehouses", icon: "building", blurb: "Locations + defaults" },
    ],
  },
];

const T: Translations = {
  "inv.nav.r.home":      { en: "Home",      zh: "首页",   ar: "الرئيسية" },
  "inv.nav.r.items":     { en: "Items",     zh: "物品",   ar: "العناصر" },
  "inv.nav.r.movements": { en: "Movements", zh: "出入库", ar: "الحركات" },
  "inv.nav.r.transfers": { en: "Transfers", zh: "调拨",   ar: "التحويلات" },
  "inv.nav.r.returns":   { en: "Returns",   zh: "退货",   ar: "المرتجعات" },
  "inv.nav.r.balances":  { en: "Balances",  zh: "余额",   ar: "الأرصدة" },
};

export default function InventoryHeader({
  title,
  subtitle,
  icon: _icon,
  action,
  controls,
  meta,
  showTabs = true,
}: {
  title: string;
  subtitle?: string;
  /** Ignored — always shows box-open. Kept for API compatibility. */
  icon?: RrIconName;
  action?: ReactNode;
  controls?: ReactNode;
  meta?: ReactNode;
  showTabs?: boolean;
}) {
  const { t } = useTranslation(T);

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
      popupTitle="Inventory"
      popupSubtitle="Pick where to go."
      showTabs={showTabs}
      searchPlaceholder="Search items, serials, batches, movements…"
      searchHref="/inventory/search"
    />
  );
}

/** Flat list of every inventory route — exported so other components
 *  (e.g. mobile nav, breadcrumbs) can compute active key with longest-prefix. */
export const INVENTORY_NAV_KEYS: string[] = OVERFLOW_GROUPS.flatMap((g) => g.items.map((i) => i.key));
