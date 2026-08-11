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
import { ACCENT } from "@/lib/accentColors";
import { useSearchPlaceholder } from "@/lib/searchPlaceholders";
import AppIcon from "@/components/common/AppIcon";

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
    accent: ACCENT.blue,
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
    accent: ACCENT.teal,
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
    accent: ACCENT.amber,
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
  /* These four reach the tab strip through OVERFLOW_GROUPS, which PageHeader
     flattens into the same bar — so they were the only tabs still reading
     "Search / Serials / Batches / Warehouses" in Arabic and Chinese. */
  "inv.nav.r.search":     { en: "Search",     zh: "搜索",   ar: "بحث" },
  "inv.nav.r.serials":    { en: "Serials",    zh: "序列号", ar: "الأرقام التسلسلية" },
  "inv.nav.r.batches":    { en: "Batches",    zh: "批次",   ar: "الدفعات" },
  "inv.nav.r.warehouses": { en: "Warehouses", zh: "仓库",   ar: "المستودعات" },
  "inv.nav.g.do":        { en: "Actions",   zh: "操作",   ar: "إجراءات" },
  "inv.nav.g.lookup":    { en: "Look up",   zh: "查询",   ar: "بحث واستعلام" },
  "inv.nav.g.setup":     { en: "Setup",     zh: "设置",   ar: "الإعداد" },
  "inv.nav.popupTitle":  { en: "Inventory", zh: "库存",   ar: "المخزون" },
  "inv.nav.popupSub":    { en: "Pick where to go.", zh: "选择要前往的位置。", ar: "اختر الوجهة." },
};

/* route → translation key, for the overflow groups (their labels are written
   in English inside the group config, which the tab bar then renders). */
const ROUTE_LABEL_KEY: Record<string, string> = {
  "/inventory": "inv.nav.r.home",
  "/inventory/items": "inv.nav.r.items",
  "/inventory/movements": "inv.nav.r.movements",
  "/inventory/transfers": "inv.nav.r.transfers",
  "/inventory/returns": "inv.nav.r.returns",
  "/inventory/balances": "inv.nav.r.balances",
  "/inventory/search": "inv.nav.r.search",
  "/inventory/serials": "inv.nav.r.serials",
  "/inventory/batches": "inv.nav.r.batches",
  "/inventory/warehouses": "inv.nav.r.warehouses",
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
  const searchPlaceholder = useSearchPlaceholder("inventory");

  /* One resolver for both sources, so a route added to either list is
     translated the same way. */
  const label = (key: string, fallback: string) => {
    const k = ROUTE_LABEL_KEY[key];
    if (!k) return fallback;
    const translated = t(k);
    return translated === k ? fallback : translated;
  };

  const tabs: PageTab[] = PRIMARY_TABS_RAW.map((tab) => ({
    key: tab.key,
    icon: tab.icon,
    label: label(tab.key, tab.label),
  }));

  const overflowGroups: NavGroup[] = OVERFLOW_GROUPS.map((g) => ({
    ...g,
    label: t(`inv.nav.g.${g.id}`) === `inv.nav.g.${g.id}` ? g.label : t(`inv.nav.g.${g.id}`),
    items: g.items.map((i) => ({ ...i, label: label(i.key, i.label) })),
  }));

  return (
    <PageHeader
      title={title}
      subtitle={subtitle}
      icon={<AppIcon appId="inventory" className="h-4 w-4" size={16} />}
      action={action}
      controls={controls}
      meta={meta}
      tabs={tabs}
      overflowTabs={overflowGroups}
      popupTitle={t("inv.nav.popupTitle")}
      popupSubtitle={t("inv.nav.popupSub")}
      showTabs={showTabs}
      searchPlaceholder={searchPlaceholder}
      searchHref="/inventory/search"
    />
  );
}

/** Flat list of every inventory route — exported so other components
 *  (e.g. mobile nav, breadcrumbs) can compute active key with longest-prefix. */
export const INVENTORY_NAV_KEYS: string[] = OVERFLOW_GROUPS.flatMap((g) => g.items.map((i) => i.key));
