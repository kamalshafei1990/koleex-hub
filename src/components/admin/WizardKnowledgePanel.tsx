"use client";

/* ---------------------------------------------------------------------------
   WizardKnowledgePanel — the persistent "Raise Product Maturity" header that
   sits above every wizard step. It reframes the workspace from Create/Fill/
   Save into a knowledge-authoring loop: completeness %, maturity level, and
   what's missing are ALWAYS on screen and update on every keystroke (it's
   driven by the live form state, recomputed each render).

   Uses only existing data — no API, schema, or migration.
   --------------------------------------------------------------------------- */

import { KnowledgeRing } from "@/components/admin/ProductKnowledgeBadge";
import type { ProductSignal } from "@/lib/product-knowledge-signal";
import CheckIcon from "@/components/icons/ui/CheckIcon";

export interface WizardKnowledge {
  pct: number;
  level: 1 | 2 | 3 | 4 | 5;
  levelLabel: string;
  tone: ProductSignal["tone"];
  connected: boolean;
  missing: string[];
  sections: { key: string; label: string; present: boolean }[];
}

const TONE: Record<ProductSignal["tone"], string> = {
  low: "var(--text-dim)",
  mid: "#FFB020",
  high: "#00CC66",
};

export default function WizardKnowledgePanel({ knowledge }: { knowledge: WizardKnowledge }) {
  const { pct, level, levelLabel, tone, connected, missing, sections } = knowledge;
  const color = TONE[tone];
  return (
    <div className="sticky top-0 z-20 -mx-1 mb-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/95 backdrop-blur-md shadow-[0_4px_20px_-8px_rgba(0,0,0,0.35)]">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-5 px-4 py-3">
        {/* Ring + maturity framing */}
        <div className="flex items-center gap-3 shrink-0">
          <KnowledgeRing pct={pct} tone={tone} size={44} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] leading-none">
              Raise Product Maturity
            </p>
            <p className="text-[15px] font-bold tracking-tight text-[var(--text-primary)] leading-tight mt-0.5">
              {pct}% · <span style={{ color }}>L{level} {levelLabel}</span>
            </p>
            {/* Connect status — Connected (linked to other products) vs Isolated */}
            <span
              className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                connected
                  ? "text-emerald-400 border border-emerald-400/30 bg-emerald-400/5"
                  : "text-[var(--text-dim)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
              }`}
              title={connected ? "Connected — linked to related products (L4)" : "Isolated — no related products linked yet"}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-[var(--text-faint)]"}`} />
              {connected ? "Connected" : "Isolated"}
            </span>
          </div>
        </div>

        {/* Live section dots */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0 lg:border-l lg:border-[var(--border-subtle)] lg:pl-5">
          {sections.map((s) => (
            <span
              key={s.key}
              className="inline-flex items-center gap-1 text-[11px]"
              style={{ color: s.present ? "var(--text-muted)" : "var(--text-ghost)" }}
              title={s.present ? `${s.label} — present` : `${s.label} — missing`}
            >
              {s.present ? (
                <CheckIcon className="h-3 w-3 text-emerald-400" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-faint)]" />
              )}
              {s.label}
            </span>
          ))}
        </div>

        {/* What to add next */}
        {missing.length > 0 && (
          <div className="shrink-0 text-[11px] text-amber-400/90 lg:max-w-[40%] truncate" title={`Add: ${missing.join(", ")}`}>
            <span className="font-semibold">Next:</span> {missing.slice(0, 3).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}
