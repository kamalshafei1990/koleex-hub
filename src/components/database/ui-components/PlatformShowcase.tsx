"use client";

/* ---------------------------------------------------------------------------
   PlatformShowcase — Tier-2 of the UI Components control room.

   Tier-1 (KdsShowcase) renders the KDS primitives. This tier renders the
   SHARED PLATFORM components that sit above the kit — the pieces every app
   is expected to reuse instead of re-inventing: TabStrip, KpiCard,
   PersonName, FieldHelp, BoundIcon. Each demo is the LIVE component (import
   from its real path), so a style change in the source shows here instantly.
   Usage counts are stamped at generation time by the icon/manifest crawl.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import TabStrip from "@/components/ui/TabStrip";
import KpiCard from "@/components/ui/KpiCard";
import PersonName from "@/components/ui/PersonName";
import { FieldHelp } from "@/components/admin/form-sections/FieldHelp";
import BoundIcon from "@/components/common/BoundIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";

/* Counted 2026-08-07 (import-site crawl). Regenerate alongside manifest.ts. */
const USAGE: Record<string, number> = {
  TabStrip: 8,
  KpiCard: 16,
  PersonName: 2,
  FieldHelp: 2,
  BoundIcon: 7,
};

function Demo({ name, path, note, children }: { name: string; path: string; note: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)]/60 p-4">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h4 className="text-[12.5px] font-bold text-[var(--text-primary)]">{name}</h4>
        <span className="text-[10px] text-[var(--text-ghost)] tabular-nums">used in {USAGE[name] ?? "?"} files</span>
      </div>
      <p className="mt-0.5 text-[10.5px] font-mono text-[var(--text-ghost)] truncate">{path}</p>
      <p className="mt-1 text-[11px] text-[var(--text-dim)]">{note}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function PlatformShowcase() {
  const [tab, setTab] = useState("overview");
  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 mb-8">
      <h3 className="text-[13.5px] font-bold text-[var(--text-primary)]">Platform components — live</h3>
      <p className="text-[11.5px] text-[var(--text-dim)] mt-1 leading-relaxed">
        Shared building blocks above the KDS kit. Reuse these — never re-implement a tab strip, KPI tile, bilingual name, field tooltip or semantic icon by hand.
      </p>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Demo name="TabStrip" path="src/components/ui/TabStrip.tsx" note="The one pill tab bar. Items carry key/label/active/onClick (or href); optional icon + badge.">
          <TabStrip
            ariaLabel="Demo tabs"
            items={[
              { key: "overview", label: "Overview", active: tab === "overview", onClick: () => setTab("overview") },
              { key: "activity", label: "Activity", badge: 3, active: tab === "activity", onClick: () => setTab("activity") },
              { key: "settings", label: "Settings", active: tab === "settings", onClick: () => setTab("settings") },
            ]}
          />
        </Demo>

        <Demo name="KpiCard" path="src/components/ui/KpiCard.tsx" note="Stat tile with label/value/icon/hint/tone; href or onClick makes the whole card interactive.">
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="Active products" value="710" icon={<PackageIcon className="h-4 w-4" />} hint="live count" />
            <KpiCard label="Low stock" value="4" tone="warning" hint="below minimum" />
          </div>
        </Demo>

        <Demo name="PersonName" path="src/components/ui/PersonName.tsx" note="Bilingual person display — native name renders muted under the EN name only when it exists.">
          <div className="space-y-1.5">
            <PersonName name="Li Wei" alt="李伟" className="block" />
            <PersonName name="Sara Ahmed" className="block" />
          </div>
        </Demo>

        <Demo name="FieldHelp" path="src/components/admin/form-sections/FieldHelp.tsx" note="Inline EN/中文 helper tooltip used across the product editor forms. Hover / tap the dot.">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-secondary)]">
            MOQ <FieldHelp en="Minimum order quantity the supplier accepts." zh="供应商接受的最小起订量。" />
          </span>
        </Demo>

        <Demo name="BoundIcon" path="src/components/common/BoundIcon.tsx" note="THE semantic icon resolver — renders whatever the Visual Library binds to a meaning; code icon is only the offline fallback.">
          <div className="flex items-center gap-4">
            {["field.supplier", "field.price", "app.issue-reports", "section.logistics"].map((k) => (
              <span key={k} className="flex flex-col items-center gap-1">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  <BoundIcon semanticKey={k} className="h-4 w-4 text-[var(--text-primary)]" fallback={<PackageIcon className="h-4 w-4" />} />
                </span>
                <span className="text-[9px] font-mono text-[var(--text-ghost)]">{k}</span>
              </span>
            ))}
          </div>
        </Demo>
      </div>
    </section>
  );
}
