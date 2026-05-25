"use client";

/* ---------------------------------------------------------------------------
   InventoryHeader — INV-H10 minimal primary nav + centered popup menu.

   The old grouped DO/LOOK-UP/SETUP sub-nav (a side-menu-like wall of chips)
   is replaced by:

     · A minimal primary tab strip with the 3 most-used routes
       (Home · Items · Movements) — always one tap away.
     · A single "Menu" button that opens InventoryNavPopup — a centered
       modal listing every inventory route as a small card.

   This mirrors how Finance / Products surface their navigation: a calm
   header with a clear escape hatch when the operator needs more.
   --------------------------------------------------------------------------- */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import InventoryNavPopup, { INVENTORY_NAV_KEYS } from "@/components/inventory/InventoryNavPopup";
import { useTranslation, type Translations } from "@/lib/i18n";

interface TabEntry { key: string; label: string; icon: RrIconName; i18nKey: string }

const PRIMARY_TABS: TabEntry[] = [
  { key: "/inventory",           label: "Home",      icon: "home",         i18nKey: "inv.nav.r.home" },
  { key: "/inventory/items",     label: "Items",     icon: "box-open",     i18nKey: "inv.nav.r.items" },
  { key: "/inventory/movements", label: "Movements", icon: "file-invoice", i18nKey: "inv.nav.r.movements" },
];

const T: Translations = {
  "inv.nav.menu": { en: "Menu", zh: "菜单", ar: "القائمة" },
};

export default function InventoryHeader({
  title,
  subtitle,
  icon,
  action,
  controls,
  meta,
  showTabs = true,
}: {
  title: string;
  subtitle?: string;
  /** Per-page icon for the hero chip. Defaults to box-open. */
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
      .find((k) => pathname === k || (k !== "/inventory" && pathname.startsWith(k)))
    ?? "/inventory";

  const heroIcon: RrIconName = icon ?? "box-open";

  return (
    <div>
      {/* Top chrome strip: back · tiny app badge. */}
      <div className="flex items-center gap-2 text-[var(--text-dim)]">
        <Link
          href="/"
          aria-label="Back to Hub"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-colors hover:text-[var(--text-primary)]"
        >
          <RrIcon name="arrow-left" size={13} />
        </Link>
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] transition-colors hover:text-[var(--text-primary)]"
        >
          <RrIcon name="box-open" size={10} />
          <span>Inventory</span>
        </Link>
      </div>

      {/* Hero. */}
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] sm:h-12 sm:w-12"
          >
            <RrIcon name={heroIcon} size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-[var(--text-dim)] sm:text-sm">
                {subtitle}
              </p>
            )}
            {meta && <div className="mt-2">{meta}</div>}
          </div>
        </div>
        {(controls || action) && (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {controls}
            {action}
          </div>
        )}
      </div>

      {showTabs && (
        <nav aria-label="Inventory navigation" className="mt-6 flex items-center gap-1 overflow-x-auto pb-1">
          {PRIMARY_TABS.map((tab) => {
            const isActive = tab.key === active;
            const label = t(tab.i18nKey);
            return (
              <Link
                key={tab.key}
                href={tab.key}
                title={label === tab.i18nKey ? tab.label : label}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[12px] transition-colors duration-150 ${
                  isActive
                    ? "border-white/[0.10] bg-white/[0.04] text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span aria-hidden className={isActive ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"}>
                  <RrIcon name={tab.icon} size={12} />
                </span>
                {label === tab.i18nKey ? tab.label : label}
              </Link>
            );
          })}
          <div className="ms-auto" />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            data-testid="inv-nav-menu-trigger"
            className="ms-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
          >
            <RrIcon name="books" size={12} />
            {t("inv.nav.menu")}
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
