"use client";

/* ---------------------------------------------------------------------------
   InventoryHeader — Inventory page bar + sub-nav.

   Same shape as FinanceHeader: back arrow → module icon → title +
   subtitle → optional controls + primary action. The contextual sub-
   nav row below carries the section tabs (Dashboard / Items / …),
   highlighting the active route via longest-prefix match so deep
   detail pages still light the right tab.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

interface TabEntry { key: string; label: string; icon: RrIconName }

const TABS: TabEntry[] = [
  { key: "/inventory",            label: "Dashboard",       icon: "coins" },
  { key: "/inventory/items",      label: "Items",           icon: "box-open" },
  { key: "/inventory/movements",  label: "Stock Movements", icon: "file-invoice" },
  { key: "/inventory/balances",   label: "Stock Balances",  icon: "badge-check" },
  { key: "/inventory/transfers",  label: "Transfers",       icon: "truck-side" },
  { key: "/inventory/warehouses", label: "Warehouses",      icon: "bank" },
];

export default function InventoryHeader({
  title,
  subtitle,
  action,
  controls,
  showTabs = true,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  controls?: ReactNode;
  showTabs?: boolean;
}) {
  const pathname = usePathname() ?? "/inventory";
  const active =
    TABS.slice()
      .sort((a, b) => b.key.length - a.key.length)
      .find((t) => pathname === t.key || (t.key !== "/inventory" && pathname.startsWith(t.key)))?.key
    ?? "/inventory";

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            aria-label="Back to Hub"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
          >
            <RrIcon name="arrow-left" size={16} />
          </Link>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]">
            <RrIcon name="box-open" size={16} />
          </div>
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight md:text-[22px]">{title}</h1>
            {subtitle && (
              <p className="hidden text-[12px] text-[var(--text-dim)] sm:block">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          {action}
        </div>
      </div>

      {showTabs && (
        <nav aria-label="Inventory navigation" className="mt-5">
          <div className="flex flex-wrap items-center gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const isActive = t.key === active;
              return (
                <Link
                  key={t.key}
                  href={t.key}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px] transition-colors duration-150 ${
                    isActive
                      ? "border-white/[0.10] bg-white/[0.04] text-[var(--text-primary)]"
                      : "border-transparent text-gray-500 hover:border-white/[0.06] hover:text-gray-300"
                  }`}
                >
                  <span aria-hidden className={isActive ? "text-gray-300" : "text-gray-600"}>
                    <RrIcon name={t.icon} size={11} />
                  </span>
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
