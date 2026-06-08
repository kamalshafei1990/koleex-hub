/* StatusHero — verdict-first hero (Phase 2A · A3).
   Posture headline stays neutral (calm/premium); tone is carried by the badges,
   never a giant colored headline. Readiness verdict promoted to hero level.
   Read-only, RSC-safe. */

import type { PostureView, ThreatView, ReadinessHeroView } from "@/lib/security/view-model";
import ThreatLevelBadge from "./ThreatLevelBadge";
import { TONE_TEXT } from "./tokens";

export interface StatusHeroProps {
  posture: PostureView;
  threat: ThreatView;
  readiness: ReadinessHeroView;
}

export default function StatusHero({ posture, threat, readiness }: StatusHeroProps) {
  return (
    <section
      aria-label="Security posture"
      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]/60 p-5 md:p-7"
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Security posture</p>
          <h1 className="mt-1.5 text-2xl font-light text-[var(--text-primary)] md:text-3xl">{posture.headline}</h1>
          <p className="mt-1.5 max-w-xl text-sm text-[var(--text-dim)]">{posture.subline}</p>
        </div>
        <div className="flex shrink-0 flex-row items-center gap-6 md:flex-col md:items-end md:gap-3">
          <div className="flex flex-col gap-1.5 md:items-end">
            <span className="text-[11px] uppercase tracking-wide text-[var(--text-dim)]">Threat level</span>
            <ThreatLevelBadge level={threat.level} />
          </div>
          <div className="flex flex-col gap-1 md:items-end">
            <span className="text-[11px] uppercase tracking-wide text-[var(--text-dim)]">Enforcement readiness</span>
            <span className={`text-sm font-medium ${TONE_TEXT[readiness.tone]}`}>
              {readiness.label}
              <span className="ml-1.5 text-[var(--text-dim)]">· {readiness.score}/100</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
