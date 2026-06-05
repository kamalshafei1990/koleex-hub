"use client";

/* ---------------------------------------------------------------------------
   DatabaseHome — front door of the Database app.

   The Database is the Hub's centralized data layer: a CONTAINER for many data
   systems. The Visual Library is just one of those systems (it happens to
   store icons + visual assets). This page presents the systems — it is NOT a
   visual-library / icons screen. More datasets (reference data, taxonomies,
   shared tables) will live here over time.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import PaletteIcon from "@/components/icons/ui/PaletteIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import MegaphoneIcon from "@/components/icons/ui/MegaphoneIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";

interface Stats { total: number }

export default function DatabaseHome() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/visual-library/stats", { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((s: Stats | null) => { if (alive && s) setCount(s.total); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)]"><BoxesIcon size={20} /></span>
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Centralized data systems</h2>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              The Database is the Hub’s shared data layer. Each system below is an independent dataset with its own
              structure and governance. The Visual Library is the first — more reference data and taxonomies will live here.
            </p>
          </div>
        </div>
      </div>

      {/* Systems grid */}
      <div>
        <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Data systems</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/database/visual-library"
            className="group flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 transition-all duration-200 hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)]"><PaletteIcon size={20} /></span>
              {count !== null && <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--text-muted)]">{count.toLocaleString()}</span>}
            </div>
            <div className="mt-3.5 text-[15px] font-semibold text-[var(--text-primary)]">Visual Library</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">Icons & visual assets — one approved source of truth, with collections, classification and review.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-dim)] transition-colors group-hover:text-[var(--text-primary)]">Open system →</span>
          </Link>

          <Link href="/database/issues"
            className="group flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 transition-all duration-200 hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)]"><MegaphoneIcon size={20} /></span>
            <div className="mt-3.5 text-[15px] font-semibold text-[var(--text-primary)]">Issue Reports</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">Bugs, UI issues and suggestions reported from across the Hub — triage, track and resolve.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-dim)] transition-colors group-hover:text-[var(--text-primary)]">Open system →</span>
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
