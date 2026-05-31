"use client";

/* ---------------------------------------------------------------------------
   SuppliersNav — one consistent navigation bar across the whole Suppliers app.

   A slim sticky sub-header that gives every supplier surface the same wayfinding:
     · breadcrumb   Hub › Suppliers › {supplier}
     · section pills  Directory · Command Center  (always one click away)

   Used on the Supplier 360 page and the Sourcing Command Center so a user can
   move between the directory, a supplier, and the tenant-wide overview without
   ever bouncing back through the list. Monochrome, custom icons.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import LayoutListIcon from "@/components/icons/ui/LayoutListIcon";
import TargetIcon from "@/components/icons/ui/TargetIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";

type Active = "directory" | "sourcing" | "detail";

const SECTIONS: { key: Exclude<Active, "detail">; label: string; href: string; icon: typeof LayoutListIcon }[] = [
  { key: "directory", label: "Directory", href: "/suppliers", icon: LayoutListIcon },
  { key: "sourcing", label: "Command Center", href: "/suppliers/sourcing", icon: TargetIcon },
];

export default function SuppliersNav({ active, supplierName }: { active: Active; supplierName?: string }) {
  return (
    <div className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/85 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-primary)]/70">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 md:px-8">
        {/* Breadcrumb */}
        <nav className="flex min-w-0 items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
          <Link href="/" className="shrink-0 text-[var(--text-faint)] transition-colors hover:text-[var(--text-primary)]">Hub</Link>
          <AngleRightIcon className="h-3 w-3 shrink-0 text-[var(--text-faint)] rtl:rotate-180" />
          <Link href="/suppliers" className={`shrink-0 font-medium transition-colors hover:text-[var(--text-primary)] ${active === "detail" ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}`}>
            Suppliers
          </Link>
          {active === "detail" && supplierName ? (
            <>
              <AngleRightIcon className="h-3 w-3 shrink-0 text-[var(--text-faint)] rtl:rotate-180" />
              <span className="truncate font-semibold text-[var(--text-primary)]" title={supplierName}>{supplierName}</span>
            </>
          ) : null}
        </nav>

        {/* Section pills */}
        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5">
          {SECTIONS.map((s) => {
            const on = s.key === active || (s.key === "directory" && active === "detail");
            const Icon = s.icon;
            return (
              <Link
                key={s.key}
                href={s.href}
                aria-current={on ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  on ? "bg-[var(--text-primary)] text-[var(--bg-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{s.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
