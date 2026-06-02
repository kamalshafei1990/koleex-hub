"use client";

/* ---------------------------------------------------------------------------
   DatabaseHome — front door of the Database app + General Icons Registry.
   KPIs (total / approved / pending / missing) + Recently added + Most used
   strips + the systems grid.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHomeMenu from "@/components/ui/AppHomeMenu";
import KpiCard from "@/components/ui/KpiCard";
import type { VisualAsset } from "@/lib/visual-library/types";
import { displayState } from "@/lib/visual-library/types";
import { STATE_PILL } from "@/components/database/VisualAssetCard";
import PaletteIcon from "@/components/icons/ui/PaletteIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";

interface Stats { total: number; approved: number; pending: number; drafts: number; missing: number; archived: number }

export default function DatabaseHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<VisualAsset[]>([]);
  const [mostUsed, setMostUsed] = useState<VisualAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/visual-library/stats", { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/visual-library?sort=recent&pageSize=12", { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/visual-library?sort=used&pageSize=12", { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : null),
    ]).then(([s, r, u]) => {
      if (!alive) return;
      if (s) setStats(s);
      if (r) setRecent(r.assets ?? []);
      if (u) setMostUsed((u.assets ?? []).filter((a: VisualAsset) => a.usage_count > 0));
    }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-6">
      <AppHomeMenu
        navItems={[
          { href: "/database/visual-library", icon: <PaletteIcon size={13} />, label: "All icons", active: true },
          { href: "/database/visual-library?state=missing", icon: <ImageRawIcon size={13} />, label: "Missing", count: stats?.missing || undefined },
          { href: "/database/visual-library?state=draft", icon: <ShieldCheckIcon size={13} />, label: "Needs review", count: (stats?.drafts ?? 0) + (stats?.pending ?? 0) || undefined },
        ]}
        searchPlaceholder="Search the Visual Library…"
        searchHref="/database/visual-library"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total icons"    value={stats?.total ?? "—"}    icon={<LayersIcon size={14} />}      loading={loading} href="/database/visual-library" />
        <KpiCard label="Approved"        value={stats?.approved ?? "—"} icon={<BadgeCheckIcon size={14} />}  loading={loading} tone="positive" href="/database/visual-library?state=approved" />
        <KpiCard label="Needs review"    value={(stats ? stats.drafts + stats.pending : "—")} icon={<ShieldCheckIcon size={14} />} loading={loading} tone="warning" href="/database/visual-library?state=draft" />
        <KpiCard label="Missing icon"    value={stats?.missing ?? "—"}  icon={<ImageRawIcon size={14} />}    loading={loading} href="/database/visual-library?state=missing" />
      </div>

      {recent.length > 0 && <IconStrip title="Recently added" assets={recent} />}
      {mostUsed.length > 0 && <IconStrip title="Most used" assets={mostUsed} />}

      <div>
        <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Data systems</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/database/visual-library" className="group flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 transition-all duration-200 hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)]"><PaletteIcon size={20} /></span>
            <div className="mt-3.5 text-[15px] font-semibold text-[var(--text-primary)]">Visual Library</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">The structured visual vocabulary — one approved source of truth for every icon across the Hub.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-dim)] transition-colors group-hover:text-[var(--text-primary)]">Open library →</span>
          </Link>
          <div className="flex flex-col items-start justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-5 text-[var(--text-dim)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)]"><LayersIcon size={20} /></span>
            <div className="mt-3.5 text-[13.5px] font-medium text-[var(--text-muted)]">More systems coming</div>
            <p className="mt-1 text-[12px] leading-relaxed">Reference data, taxonomies and shared datasets will live here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconStrip({ title, assets }: { title: string; assets: VisualAsset[] }) {
  return (
    <div>
      <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">{title}</h2>
      <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {assets.map((a) => {
          const st = displayState(a);
          return (
            <Link key={a.id} href={`/database/visual-library?q=${encodeURIComponent(a.title)}`}
              className="group flex w-[92px] shrink-0 flex-col items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 transition-colors hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]">
                {a.public_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.public_url} alt={a.title} className="h-6 w-6 object-contain" loading="lazy" />
                ) : <ImageRawIcon size={16} className="text-[var(--text-dim)]" />}
              </span>
              <span className="w-full truncate text-center text-[10.5px] text-[var(--text-muted)]">{a.title}</span>
              <span className={`rounded-full border px-1 py-0.5 text-[8px] font-semibold uppercase ${STATE_PILL[st] ?? STATE_PILL.draft}`}>{st}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
