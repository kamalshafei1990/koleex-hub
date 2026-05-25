"use client";

/* ---------------------------------------------------------------------------
   PHASE INV-H10 — Centered Inventory navigation popup.

   Replaces the old grouped DO/LOOK-UP/SETUP sub-nav. The operator sees a
   minimal primary tab strip in InventoryHeader (Home · Items · Movements +
   Menu). Tapping "Menu" opens this overlay — a centered modal/full-screen
   sheet listing every inventory route as a small card, grouped under
   section headers.

     · Backdrop click → close
     · ESC → close
     · Cards: icon chip + label + one-liner; active route is highlighted
     · Manager-only routes (Setup) are gated by useInventoryViewMode()
   --------------------------------------------------------------------------- */

import { useEffect } from "react";
import Link from "next/link";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { useInventoryViewMode } from "@/components/inventory/InventoryUx";
import { useTranslation, type Translations } from "@/lib/i18n";

interface RouteCard { key: string; label: string; icon: RrIconName; blurb: string }
interface RouteGroup { id: "do" | "lookup" | "setup"; label: string; managerOnly?: boolean; items: RouteCard[] }

const ROUTE_GROUPS: RouteGroup[] = [
  {
    id: "do",
    label: "Do",
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
    items: [
      { key: "/inventory/search",    label: "Search",     icon: "search",       blurb: "Find anything fast" },
      { key: "/inventory/balances",  label: "Balances",   icon: "badge-check",  blurb: "Live stock on hand" },
      { key: "/inventory/serials",   label: "Serials",    icon: "fingerprint",  blurb: "Trace by serial number" },
      { key: "/inventory/batches",   label: "Batches",    icon: "pallet",       blurb: "Lots, expiry, FEFO" },
    ],
  },
  {
    id: "setup",
    label: "Setup",
    managerOnly: true,
    items: [
      { key: "/inventory/warehouses", label: "Warehouses", icon: "building",     blurb: "Locations + defaults" },
    ],
  },
];

const T: Translations = {
  "inv.nav.title":         { en: "Inventory menu",   zh: "库存菜单",       ar: "قائمة المخزون" },
  "inv.nav.subtitle":      { en: "Pick where to go.", zh: "选择要去的地方。", ar: "اختر إلى أين تذهب." },
  "inv.nav.close":         { en: "Close",            zh: "关闭",           ar: "إغلاق" },
  "inv.nav.group.do":      { en: "Do",               zh: "操作",           ar: "تنفيذ" },
  "inv.nav.group.lookup":  { en: "Look up",          zh: "查找",           ar: "بحث" },
  "inv.nav.group.setup":   { en: "Setup",            zh: "设置",           ar: "إعداد" },
  "inv.nav.r.home":        { en: "Home",             zh: "首页",           ar: "الرئيسية" },
  "inv.nav.r.items":       { en: "Items",            zh: "物品",           ar: "العناصر" },
  "inv.nav.r.movements":   { en: "Movements",        zh: "出入库",         ar: "الحركات" },
  "inv.nav.r.transfers":   { en: "Transfers",        zh: "调拨",           ar: "التحويلات" },
  "inv.nav.r.returns":     { en: "Returns",          zh: "退货",           ar: "المرتجعات" },
  "inv.nav.r.search":      { en: "Search",           zh: "搜索",           ar: "بحث" },
  "inv.nav.r.balances":    { en: "Balances",         zh: "余额",           ar: "الأرصدة" },
  "inv.nav.r.serials":     { en: "Serials",          zh: "序列号",         ar: "الأرقام التسلسلية" },
  "inv.nav.r.batches":     { en: "Batches",          zh: "批次",           ar: "الدفعات" },
  "inv.nav.r.warehouses":  { en: "Warehouses",       zh: "仓库",           ar: "المستودعات" },
  "inv.nav.b.home":        { en: "Today's view + quick actions",  zh: "今日视图与快速操作",   ar: "عرض اليوم + إجراءات سريعة" },
  "inv.nav.b.items":       { en: "Browse + add stocked items",    zh: "浏览并添加库存物品",   ar: "تصفح وإضافة العناصر" },
  "inv.nav.b.movements":   { en: "Receive · ship · adjust",        zh: "收货 · 发货 · 调整",   ar: "استلام · شحن · تعديل" },
  "inv.nav.b.transfers":   { en: "Send stock between sites",       zh: "在站点之间调拨库存",   ar: "نقل المخزون بين المواقع" },
  "inv.nav.b.returns":     { en: "Customer + supplier returns",    zh: "客户与供应商退货",     ar: "مرتجعات العملاء والموردين" },
  "inv.nav.b.search":      { en: "Find anything fast",             zh: "快速查找任何内容",     ar: "ابحث عن أي شيء بسرعة" },
  "inv.nav.b.balances":    { en: "Live stock on hand",             zh: "实时库存",             ar: "المخزون الفوري" },
  "inv.nav.b.serials":     { en: "Trace by serial number",         zh: "按序列号追踪",         ar: "تتبع بالرقم التسلسلي" },
  "inv.nav.b.batches":     { en: "Lots, expiry, FEFO",             zh: "批次、有效期、先进先出", ar: "الدفعات والصلاحية والصرف الأقرب" },
  "inv.nav.b.warehouses":  { en: "Locations + defaults",           zh: "位置与默认值",         ar: "المواقع والافتراضيات" },
};

function routeI18nKey(routeKey: string): string {
  const slug = routeKey === "/inventory" ? "home" : routeKey.replace("/inventory/", "");
  return slug;
}

export default function InventoryNavPopup({
  open, activeKey, onClose,
}: {
  open: boolean;
  activeKey: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(T);
  const { isManager } = useInventoryViewMode();

  /* ESC to close + lock background scroll while open. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const visibleGroups = ROUTE_GROUPS.filter((g) => !g.managerOnly || isManager);

  return (
    <div
      data-testid="inv-nav-popup"
      className="fixed inset-0 z-[130] flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("inv.nav.title")}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col overflow-hidden border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-2xl sm:h-auto sm:max-h-[88vh] sm:w-[min(720px,92vw)] sm:rounded-2xl sm:border"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
            >
              <RrIcon name="box-open" size={13} />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold tracking-tight leading-none">{t("inv.nav.title")}</h2>
              <div className="mt-1 text-[11px] text-[var(--text-dim)]">{t("inv.nav.subtitle")}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("inv.nav.close")}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
          >
            <RrIcon name="cross" size={12} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <div className="space-y-5">
            {visibleGroups.map((g) => (
              <section key={g.id}>
                <div className="mb-2 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-dim)]">
                  {t(`inv.nav.group.${g.id}`)}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {g.items.map((r) => {
                    const slug = routeI18nKey(r.key);
                    const isActive = r.key === activeKey;
                    const label = t(`inv.nav.r.${slug}`);
                    const blurb = t(`inv.nav.b.${slug}`);
                    return (
                      <Link
                        key={r.key}
                        href={r.key}
                        onClick={onClose}
                        aria-current={isActive ? "page" : undefined}
                        data-testid={`inv-nav-card-${slug}`}
                        className={`group flex min-h-[76px] flex-col gap-1.5 rounded-xl border p-3 transition-colors ${
                          isActive
                            ? "border-[var(--border-color)] bg-[var(--bg-secondary)]"
                            : "border-[var(--border-color)] bg-[var(--bg-secondary)]/40 hover:bg-[var(--bg-secondary)]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
                          >
                            <RrIcon name={r.icon} size={12} />
                          </span>
                          <span className="text-[12.5px] font-medium leading-tight tracking-tight text-[var(--text-primary)]">
                            {label === `inv.nav.r.${slug}` ? r.label : label}
                          </span>
                        </div>
                        <div className="text-[10.5px] leading-snug text-[var(--text-dim)]">
                          {blurb === `inv.nav.b.${slug}` ? r.blurb : blurb}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Flat list of every route surfaced in the popup. Exported so
 *  InventoryHeader can compute the active key with longest-prefix match. */
export const INVENTORY_NAV_KEYS: string[] = ROUTE_GROUPS.flatMap((g) => g.items.map((i) => i.key));
