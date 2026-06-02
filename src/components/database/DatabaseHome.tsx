"use client";

/* ---------------------------------------------------------------------------
   DatabaseHome — front door of the Database app.

   · KPI strip (total / approved / pending / archived assets)
   · AppHomeMenu pill row
   · A "systems" grid — the Visual Library is the first live system; future
     data systems slot in beside it.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHomeMenu from "@/components/ui/AppHomeMenu";
import KpiCard from "@/components/ui/KpiCard";
import PaletteIcon from "@/components/icons/ui/PaletteIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import ArchiveIcon from "@/components/icons/ui/ArchiveIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";

interface Stats { total: number; approved: number; pending: number; archived: number }

export default function DatabaseHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/visual-library/stats", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j) setStats(j as Stats); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-6">
      <AppHomeMenu
        navItems={[
          { href: "/database/visual-library", icon: <PaletteIcon size={13} />, label: "Visual Library", active: true },
          { href: "/database/visual-library?approval_status=draft", icon: <ShieldCheckIcon size={13} />, label: "Pending approval", count: stats?.pending || undefined },
        ]}
        searchPlaceholder="Search the Visual Library…"
        searchHref="/database/visual-library"
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total assets"    value={stats?.total ?? "—"}    icon={<LayersIcon size={14} />}      loading={loading} href="/database/visual-library" />
        <KpiCard label="Approved"         value={stats?.approved ?? "—"} icon={<BadgeCheckIcon size={14} />}  loading={loading} tone="positive" href="/database/visual-library?approval_status=approved" />
        <KpiCard label="Pending approval" value={stats?.pending ?? "—"}  icon={<ShieldCheckIcon size={14} />} loading={loading} tone="warning" href="/database/visual-library?approval_status=draft" />
        <KpiCard label="Archived"         value={stats?.archived ?? "—"} icon={<ArchiveIcon size={14} />}     loading={loading} />
      </div>

      {/* Systems grid */}
      <div>
        <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Data systems</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/database/visual-library"
            className="group flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 transition-all duration-200 hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)]">
              <PaletteIcon size={20} />
            </span>
            <div className="mt-3.5 text-[15px] font-semibold text-[var(--text-primary)]">Visual Library</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              The single approved source of truth for every icon, image, illustration and visual asset across the Hub.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-dim)] transition-colors group-hover:text-[var(--text-primary)]">
              Open library →
            </span>
          </Link>

          {/* Placeholder for future data systems */}
          <div className="flex flex-col items-start justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-5 text-[var(--text-dim)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)]">
              <LayersIcon size={20} />
            </span>
            <div className="mt-3.5 text-[13.5px] font-medium text-[var(--text-muted)]">More systems coming</div>
            <p className="mt-1 text-[12px] leading-relaxed">Reference data, taxonomies and shared datasets will live here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
