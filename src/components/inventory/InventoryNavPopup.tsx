"use client";

/* ---------------------------------------------------------------------------
   InventoryNavPopup — INV-H10 polish pass.

   Centered modal popup listing every inventory route as a card, grouped
   under colored-accented section headers. Opens via the ··· button in
   InventoryHeader tab strip.

   · Backdrop click → close
   · ESC → close
   · Section headers: colored left-border accent (blue / teal / amber)
   · Cards: rounded icon chip + label + blurb; active route highlighted
   · Manager-only routes (Setup) gated by useInventoryViewMode()
   --------------------------------------------------------------------------- */

import { useEffect } from "react";
import Link from "next/link";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { useInventoryViewMode } from "@/components/inventory/InventoryUx";
import { useTranslation, type Translations } from "@/lib/i18n";

interface RouteCard { key: string; label: string; icon: RrIconName; blurb: string }
interface RouteGroup {
  id: "do" | "lookup" | "setup";
  label: string;
  managerOnly?: boolean;
  items: RouteCard[];
  /** Tailwind color tokens for the left-border accent and icon chip bg/text */
  accent: { border: string; chipBg: string; chipText: string; header: string }
}

const ROUTE_GROUPS: RouteGroup[] = [
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
    accent: {
      border:   "border-l-amber-500/70",
      chipBg:   "bg-amber-500/10",
      chipText: "text-amber-400",
      header:   "text-amber-400",
    },
    items: [
      { key: "/inventory/warehouses", label: "Warehouses", icon: "building",     blurb: "Locations + defaults" },
    ],
  },
];

const T: Translations = {
  "inv.nav.title":         { en: "Inventory",        zh: "库存",           ar: "المخزون" },
  "inv.nav.subtitle":      { en: "Pick where to go.", zh: "选择要去的地方。", ar: "اختر إلى أين تذهب." },
  "inv.nav.close":         { en: "Close",             zh: "关闭",           ar: "إغلاق" },
  "inv.nav.group.do":      { en: "Actions",           zh: "操作",           ar: "إجراءات" },
  "inv.nav.group.lookup":  { en: "Look up",           zh: "查找",           ar: "بحث" },
  "inv.nav.group.setup":   { en: "Setup",             zh: "设置",           ar: "إعداد" },
  "inv.nav.r.home":        { en: "Home",              zh: "首页",           ar: "الرئيسية" },
  "inv.nav.r.items":       { en: "Items",             zh: "物品",           ar: "العناصر" },
  "inv.nav.r.movements":   { en: "Movements",         zh: "出入库",         ar: "الحركات" },
  "inv.nav.r.transfers":   { en: "Transfers",         zh: "调拨",           ar: "التحويلات" },
  "inv.nav.r.returns":     { en: "Returns",           zh: "退货",           ar: "المرتجعات" },
  "inv.nav.r.search":      { en: "Search",            zh: "搜索",           ar: "بحث" },
  "inv.nav.r.balances":    { en: "Balances",          zh: "余额",           ar: "الأرصدة" },
  "inv.nav.r.serials":     { en: "Serials",           zh: "序列号",         ar: "الأرقام التسلسلية" },
  "inv.nav.r.batches":     { en: "Batches",           zh: "批次",           ar: "الدفعات" },
  "inv.nav.r.warehouses":  { en: "Warehouses",        zh: "仓库",           ar: "المستودعات" },
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

function routeSlug(routeKey: string): string {
  return routeKey === "/inventory" ? "home" : routeKey.replace("/inventory/", "");
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
      className="fixed inset-0 z-[130] flex items-stretch justify-center bg-black/65 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("inv.nav.title")}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-2xl sm:h-auto sm:max-h-[88vh] sm:w-[min(740px,92vw)] sm:rounded-2xl sm:border sm:border-[var(--border-color)]"
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
            >
              <RrIcon name="box-open" size={15} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold leading-none tracking-tight">
                {t("inv.nav.title")}
              </h2>
              <div className="mt-1 text-[11.5px] text-[var(--text-dim)]">
                {t("inv.nav.subtitle")}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("inv.nav.close")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
          >
            <RrIcon name="cross" size={13} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-6">
            {visibleGroups.map((g) => (
              <section key={g.id}>
                {/* Section header with colored left-border accent */}
                <div className={`mb-3 flex items-center gap-2 border-l-[3px] pl-2.5 ${g.accent.border}`}>
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${g.accent.header}`}>
                    {t(`inv.nav.group.${g.id}`)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {g.items.map((r) => {
                    const slug = routeSlug(r.key);
                    const isActive = r.key === activeKey;
                    const label = t(`inv.nav.r.${slug}`);
                    const blurb = t(`inv.nav.b.${slug}`);
                    const displayLabel = label === `inv.nav.r.${slug}` ? r.label : label;
                    const displayBlurb = blurb === `inv.nav.b.${slug}` ? r.blurb : blurb;
                    return (
                      <Link
                        key={r.key}
                        href={r.key}
                        onClick={onClose}
                        aria-current={isActive ? "page" : undefined}
                        data-testid={`inv-nav-card-${slug}`}
                        className={`group flex min-h-[88px] flex-col gap-2 rounded-xl border p-3.5 transition-colors ${
                          isActive
                            ? "border-[var(--border-color)] bg-[var(--bg-secondary)] ring-1 ring-[var(--border-color)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/60 hover:border-[var(--border-color)] hover:bg-[var(--bg-secondary)]"
                        }`}
                      >
                        {/* Icon chip */}
                        <span
                          aria-hidden
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${g.accent.chipBg} ${g.accent.chipText}`}
                        >
                          <RrIcon name={r.icon} size={14} />
                        </span>

                        {/* Label + blurb */}
                        <div>
                          <div className="text-[13px] font-medium leading-tight tracking-tight text-[var(--text-primary)]">
                            {displayLabel}
                          </div>
                          <div className="mt-0.5 text-[11px] leading-snug text-[var(--text-dim)]">
                            {displayBlurb}
                          </div>
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
