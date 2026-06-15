"use client";

/* ---------------------------------------------------------------------------
   ProductKnowledgePanel — turns the Product Detail page from a "record"
   into a Product Knowledge Object, using ONLY data already loaded by
   LegacyProductView (no new API / schema / migration).

   Two halves:
     1. Knowledge Header  — completeness % ring · maturity level · health ·
                            what's missing.  (internal view only — it's a
                            management tool, not customer-facing.)
     2. Knowledge Sections — Applications · Operations · Fabrics ·
                            Specifications · Documents · Media. A present
                            section shows its summary; an empty section
                            becomes a visible TASK (internal) instead of
                            silently disappearing.

   On the public /products view we render only the FILLED sections (no
   completeness header, no "add" tasks) so customers see a clean overview.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { KnowledgeRing } from "@/components/admin/ProductKnowledgeBadge";
import type { ProductSignal } from "@/lib/product-knowledge-signal";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import CogIcon from "@/components/icons/ui/CogIcon";
import DropletsIcon from "@/components/icons/ui/DropletsIcon";
import RulerIcon from "@/components/icons/ui/RulerIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";

export interface KnowledgeSectionState {
  key: string;
  label: string;
  present: boolean;
  summary?: string;     // shown when present (e.g. "12 specifications")
  task: string;         // shown when empty (e.g. "Add specifications")
}

export interface ProductKnowledge {
  pct: number;
  level: 1 | 2 | 3 | 4 | 5;
  levelLabel: string;   // Record / Structured / Knowledge / Connected / Complete
  tone: ProductSignal["tone"];
  health: string;       // Needs work / Developing / Strong
  missing: string[];
  sections: KnowledgeSectionState[];
}

const TONE: Record<ProductSignal["tone"], string> = {
  low: "var(--text-dim)",
  mid: "#FFB020",
  high: "#00CC66",
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  applications: LayersIcon,
  operations: CogIcon,
  fabrics: DropletsIcon,
  specifications: RulerIcon,
  documents: DocumentIcon,
  media: ImageRawIcon,
};

export default function ProductKnowledgePanel({
  knowledge,
  internal,
  editHref,
}: {
  knowledge: ProductKnowledge;
  internal: boolean;
  editHref: string;
}) {
  const { pct, levelLabel, level, tone, health, missing, sections } = knowledge;
  const color = TONE[tone];
  const visibleSections = internal ? sections : sections.filter((s) => s.present);

  // Public view with nothing authored yet → render nothing (don't show a
  // customer an empty knowledge object).
  if (!internal && visibleSections.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 md:px-6 lg:px-10 xl:px-16 pt-6">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
        {/* ── Knowledge Header (internal only) ── */}
        {internal && (
          <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-8 p-5 md:p-6 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-4">
              <KnowledgeRing pct={pct} tone={tone} size={56} />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
                  Product Knowledge
                </p>
                <p className="text-[22px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">
                  {pct}% complete
                </p>
                <p className="text-[12px] mt-0.5" style={{ color }}>
                  ● L{level} {levelLabel} · {health}
                </p>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {missing.length > 0 ? (
                <>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)] mb-1.5">
                    To raise maturity, add
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {missing.map((m) => (
                      <span
                        key={m}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-amber-400/90 border border-amber-400/25 bg-amber-400/5"
                      >
                        <PlusIcon className="h-2.5 w-2.5" /> {m}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-[var(--text-muted)]">
                  All knowledge groups are present — this product reads as a complete Knowledge Object.
                </p>
              )}
            </div>

            <Link
              href={editHref}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition-opacity"
            >
              Complete knowledge
            </Link>
          </div>
        )}

        {/* ── Knowledge Sections ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[var(--border-subtle)]">
          {visibleSections.map((s) => {
            const Icon = ICONS[s.key] || LayersIcon;
            return (
              <div
                key={s.key}
                className="bg-[var(--bg-secondary)] p-4 flex items-start gap-3"
              >
                <span
                  className={`mt-0.5 h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${
                    s.present
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-[var(--bg-surface)] text-[var(--text-dim)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    {s.label}
                    {s.present && <CheckIcon className="h-3 w-3 text-emerald-400" />}
                  </p>
                  {s.present ? (
                    <p className="text-[12px] text-[var(--text-muted)] mt-0.5 truncate">{s.summary}</p>
                  ) : internal ? (
                    <Link
                      href={editHref}
                      className="text-[12px] text-amber-400/90 mt-0.5 inline-flex items-center gap-1 hover:underline"
                    >
                      <PlusIcon className="h-2.5 w-2.5" /> {s.task}
                    </Link>
                  ) : (
                    <p className="text-[12px] text-[var(--text-ghost)] mt-0.5">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
