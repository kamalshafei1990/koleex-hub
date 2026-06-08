/* ReadinessPanel — the L2 enforcement-readiness decision card (Phase 2A · A3).
   Advisory only: lists the verdict, score, and blockers. No enable control.
   RSC-safe. */

import type { ReadinessHeroView } from "@/lib/security/view-model";
import SectionCard from "./SectionCard";
import { TONE_TEXT } from "./tokens";

export interface ReadinessPanelProps {
  readiness: ReadinessHeroView;
  reasons: string[];
}

export default function ReadinessPanel({ readiness, reasons }: ReadinessPanelProps) {
  return (
    <SectionCard title="Enforcement readiness">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div className={`text-xl font-semibold ${TONE_TEXT[readiness.tone]}`}>{readiness.label}</div>
        <div className="text-sm text-[var(--text-dim)]">score {readiness.score}/100</div>
      </div>
      <p className="mt-1 text-sm text-[var(--text-dim)]">{readiness.oneLineReason}</p>
      {reasons.length > 1 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-dim)]">
        Advisory only. Enabling enforcement is a deliberate, separate change — this view cannot do it.
      </p>
    </SectionCard>
  );
}
