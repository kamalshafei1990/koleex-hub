/* KpiStrip — 4 KPI tiles with micro-sparklines (Phase 2A · A3).
   Reuses the canonical KpiCard; the sparkline rides in the hint slot.
   Monochrome-first: tone only nudges the value color. RSC-safe. */

import type { KpiView, Tone } from "@/lib/security/view-model";
import KpiCard, { type KpiTone } from "@/components/ui/KpiCard";
import Sparkline from "./Sparkline";

const TONE_TO_KPI: Record<Tone, KpiTone> = {
  calm: "default",
  info: "info",
  attention: "warning",
  critical: "rose",
};

export interface KpiStripProps {
  kpis: KpiView[];
}

export default function KpiStrip({ kpis }: KpiStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {kpis.map((k) => (
        <KpiCard
          key={k.key}
          label={k.label}
          value={k.display}
          tone={TONE_TO_KPI[k.tone]}
          hint={
            <span className="flex items-center gap-2">
              {k.hint && <span className="text-[var(--text-dim)]">{k.hint}</span>}
              {k.spark.length > 1 && (
                <Sparkline values={k.spark} tone={k.tone} width={64} height={20} ariaLabel={`${k.label} trend`} className="ml-auto opacity-80" />
              )}
            </span>
          }
        />
      ))}
    </div>
  );
}
