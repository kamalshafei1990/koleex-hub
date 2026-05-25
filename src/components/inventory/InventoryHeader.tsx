"use client";

/* ---------------------------------------------------------------------------
   InventoryHeader — INV-H10 Finance-pattern header + full flat tab strip.

   Layout:
     [←] [📦] Inventory · {pageTitle}          {action slot}
     ──────────────────────────────────────────────────────────────────
     [Home] [Items] [Movements] [Transfers] [Returns] [Search] [Balances]  ···

   · Back arrow → /
   · App icon chip (box-open) — always shown for app identity
   · h1 = title prop; inline muted subtitle on same line (hidden mobile)
   · Action slot on the right
   · Tab strip: ALL 7 primary routes always visible (horizontally scrollable)
   · ··· button at end → opens InventoryNavPopup (Serials, Batches, Warehouses)
   · showTabs prop (default true) — hide on detail pages
   --------------------------------------------------------------------------- */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import InventoryNavPopup, { INVENTORY_NAV_KEYS } from "@/components/inventory/InventoryNavPopup";
import { useTranslation, type Translations } from "@/lib/i18n";

interface TabEntry { key: string; label: string; icon: RrIconName; i18nKey: string }

/* All 7 primary routes always visible in the tab strip. */
const PRIMARY_TABS: TabEntry[] = [
  { key: "/inventory",           label: "Home",      icon: "home",         i18nKey: "inv.nav.r.home" },
  { key: "/inventory/items",     label: "Items",     icon: "box-open",     i18nKey: "inv.nav.r.items" },
  { key: "/inventory/movements", label: "Movements", icon: "file-invoice", i18nKey: "inv.nav.r.movements" },
  { key: "/inventory/transfers", label: "Transfers", icon: "truck-side",   i18nKey: "inv.nav.r.transfers" },
  { key: "/inventory/returns",   label: "Returns",   icon: "recycle",      i18nKey: "inv.nav.r.returns" },
  { key: "/inventory/search",    label: "Search",    icon: "search",       i18nKey: "inv.nav.r.search" },
  { key: "/inventory/balances",  label: "Balances",  icon: "badge-check",  i18nKey: "inv.nav.r.balances" },
];

const T: Translations = {
  "inv.nav.r.home":      { en: "Home",      zh: "首页",   ar: "الرئيسية" },
  "inv.nav.r.items":     { en: "Items",     zh: "物品",   ar: "العناصر" },
  "inv.nav.r.movements": { en: "Movements", zh: "出入库", ar: "الحركات" },
  "inv.nav.r.transfers": { en: "Transfers", zh: "调拨",   ar: "التحويلات" },
  "inv.nav.r.returns":   { en: "Returns",   zh: "退货",   ar: "المرتجعات" },
  "inv.nav.r.search":    { en: "Search",    zh: "搜索",   ar: "بحث" },
  "inv.nav.r.balances":  { en: "Balances",  zh: "余额",   ar: "الأرصدة" },
  "inv.nav.more":        { en: "···",       zh: "···",    ar: "···" },
  "inv.nav.backHub":     { en: "Back to Hub", zh: "返回Hub", ar: "عودة إلى Hub" },
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
  /** Ignored — header always shows box-open for app identity. Kept for API compat. */
  icon?: RrIconName;
  action?: ReactNode;
  controls?: ReactNode;
  /** Optional secondary line under the subtitle (e.g. status pills, counts). */
  meta?: ReactNode;
  showTabs?: boolean;
}) {
  const pathname = usePathname() ?? "/inventory";
  const { t } = useTranslation(T);
  const [menuOpen, setMenuOpen] = useState(false);

  /* Longest-prefix match against every known inventory route so detail
     pages still light the right primary tab when one matches. */
  const active =
    INVENTORY_NAV_KEYS.slice()
      .sort((a, b) => b.length - a.length)
      .find((k) => pathname === k || (k !== "/inventory" && pathname.startsWith(k + "/")))
    ?? "/inventory";

  return (
    <div>
      {/* ── Title row — matches Finance header shape exactly ─────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Back arrow */}
          <Link
            href="/"
            aria-label={t("inv.nav.backHub")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
          >
            <RrIcon name="arrow-left" size={16} />
          </Link>

          {/* App icon chip */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]">
            <RrIcon name="box-open" size={16} />
          </div>

          {/* Title + subtitle inline */}
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight md:text-[22px]">{title}</h1>
            {subtitle && (
              <p className="hidden text-[12px] text-[var(--text-dim)] sm:block">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right slot: controls + action */}
        {(controls || action) && (
          <div className="flex flex-wrap items-center gap-2">
            {controls}
            {action}
          </div>
        )}
      </div>

      {/* Optional meta row (status pills, counts, etc.) */}
      {meta && <div className="mt-2">{meta}</div>}

      {/* ── Tab strip ───────────────────────────────────────────── */}
      {showTabs && (
        <nav
          aria-label="Inventory navigation"
          className="mt-5 flex items-end gap-0.5 overflow-x-auto border-b border-[var(--border-subtle)]"
        >
          {PRIMARY_TABS.map((tab) => {
            const isActive = tab.key === active;
            const label = t(tab.i18nKey);
            const displayLabel = label === tab.i18nKey ? tab.label : label;
            return (
              <Link
                key={tab.key}
                href={tab.key}
                aria-current={isActive ? "page" : undefined}
                title={displayLabel}
                className={`inline-flex h-10 shrink-0 items-center gap-1.5 px-3 text-[12px] transition-colors duration-150 ${
                  isActive
                    ? "border-b-2 border-[var(--text-primary)] pb-0 text-[var(--text-primary)]"
                    : "border-b-2 border-transparent text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span aria-hidden>
                  <RrIcon name={tab.icon} size={12} />
                </span>
                {displayLabel}
              </Link>
            );
          })}

          {/* ··· overflow button — opens popup for less-common routes */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            data-testid="inv-nav-menu-trigger"
            aria-label="More inventory routes"
            className="ml-1 inline-flex h-10 shrink-0 items-center gap-1 border-b-2 border-transparent px-2.5 text-[12px] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
          >
            <RrIcon name="books" size={12} />
            <span className="tracking-widest">···</span>
          </button>
        </nav>
      )}

      <InventoryNavPopup
        open={menuOpen}
        activeKey={active}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}
