"use client";

/* ---------------------------------------------------------------------------
   InventoryHeader — INV-H7 reorganized grouped navigation.

   The sub-nav row is split into three role-aware groups so operators can
   scan it without thinking:

     DO       — daily operational entry points (Home / Items / Movements /
                Transfers / Returns)
     LOOK UP  — read / track surfaces (Search / Balances / Serials / Batches)
     SETUP    — admin-only configuration (Warehouses)

   Each item is icon + label + active highlight, with longest-prefix match
   for active route so detail pages still light the right tab. Group labels
   are dim micro-eyebrows above each cluster.

   On mobile the nav becomes a single horizontal scroll strip (no labels for
   groups, items render as icon + short label) — operators reach what they
   need by tapping; managers see the SETUP group only when their role allows.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { useInventoryViewMode } from "@/components/inventory/InventoryUx";

interface TabEntry { key: string; label: string; icon: RrIconName }
interface NavGroup { id: "do" | "lookup" | "setup"; label: string; managerOnly?: boolean; items: TabEntry[] }

const NAV_GROUPS: NavGroup[] = [
  {
    id: "do",
    label: "Do",
    items: [
      { key: "/inventory",           label: "Home",       icon: "home" },
      { key: "/inventory/items",     label: "Items",      icon: "box-open" },
      { key: "/inventory/movements", label: "Movements",  icon: "file-invoice" },
      { key: "/inventory/transfers", label: "Transfers",  icon: "truck-side" },
      { key: "/inventory/returns",   label: "Returns",    icon: "recycle" },
    ],
  },
  {
    id: "lookup",
    label: "Look up",
    items: [
      { key: "/inventory/search",   label: "Search",   icon: "search" },
      { key: "/inventory/balances", label: "Balances", icon: "badge-check" },
      { key: "/inventory/serials",  label: "Serials",  icon: "fingerprint" },
      { key: "/inventory/batches",  label: "Batches",  icon: "pallet" },
    ],
  },
  {
    id: "setup",
    label: "Setup",
    managerOnly: true,
    items: [
      { key: "/inventory/warehouses", label: "Warehouses", icon: "building" },
    ],
  },
];

const ALL_TABS: TabEntry[] = NAV_GROUPS.flatMap((g) => g.items);

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
  const { isManager } = useInventoryViewMode();
  const active =
    ALL_TABS.slice()
      .sort((a, b) => b.key.length - a.key.length)
      .find((t) => pathname === t.key || (t.key !== "/inventory" && pathname.startsWith(t.key)))?.key
    ?? "/inventory";

  const visibleGroups = NAV_GROUPS.filter((g) => !g.managerOnly || isManager);

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
          {/* Desktop: grouped clusters with eyebrow labels */}
          <div className="hidden flex-wrap items-start gap-x-5 gap-y-3 sm:flex">
            {visibleGroups.map((group) => (
              <div key={group.id} className="flex min-w-0 flex-col gap-1.5" data-nav-group={group.id}>
                <span className="px-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-dim)]">
                  {group.label}
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {group.items.map((t) => {
                    const isActive = t.key === active;
                    return (
                      <Link
                        key={t.key}
                        href={t.key}
                        title={t.label}
                        aria-current={isActive ? "page" : undefined}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px] transition-colors duration-150 ${
                          isActive
                            ? "border-white/[0.10] bg-white/[0.04] text-[var(--text-primary)]"
                            : "border-transparent text-[var(--text-dim)] hover:border-white/[0.06] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        <span aria-hidden className={isActive ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"}>
                          <RrIcon name={t.icon} size={11} />
                        </span>
                        {t.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Mobile: single horizontal scroll strip, icons + label inline */}
          <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1 sm:hidden">
            {visibleGroups.flatMap((group) => group.items).map((t) => {
              const isActive = t.key === active;
              return (
                <Link
                  key={t.key}
                  href={t.key}
                  title={t.label}
                  aria-label={t.label}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[11.5px] transition-colors duration-150 ${
                    isActive
                      ? "border-white/[0.10] bg-white/[0.04] text-[var(--text-primary)]"
                      : "border-transparent text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span aria-hidden className={isActive ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"}>
                    <RrIcon name={t.icon} size={12} />
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
