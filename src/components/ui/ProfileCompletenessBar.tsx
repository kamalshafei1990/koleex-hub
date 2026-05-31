"use client";

import { useTranslation } from "@/lib/i18n";
import { commonT } from "@/lib/translations/common";

interface Tier { filled: number; total: number }
interface Props {
  filled: number;
  total: number;
  className?: string;
  /** When provided, render the multi-tier supplier view (Required + Preferred
   *  bars + an optional count) instead of the single overall bar. */
  tiers?: { required: Tier; preferred: Tier; optionalAdded: number };
}

/**
 * Inline profile-completeness indicator shown at the top of every entity
 * add/edit form. Single-bar by default; multi-tier when `tiers` is passed.
 */
export default function ProfileCompletenessBar({
  filled,
  total,
  className = "",
  tiers,
}: Props) {
  const { t } = useTranslation(commonT);

  /* ── Multi-tier view (suppliers) ── */
  if (tiers) {
    const req = tiers.required;
    const pref = tiers.preferred;
    const reqLeft = Math.max(0, req.total - req.filled);
    const ready = reqLeft === 0 && req.total > 0;
    const pctOf = (x: Tier) => (x.total > 0 ? Math.round((x.filled / x.total) * 100) : 0);

    const Bar = ({ label, tier, tone }: { label: string; tier: Tier; tone: string }) => (
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>
          <span className="text-[11px] tabular-nums text-[var(--text-dim)]">{tier.filled}/{tier.total}</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
          <div aria-hidden className={`h-full ${tone} transition-[width] duration-300`} style={{ width: `${pctOf(tier)}%` }} />
        </div>
      </div>
    );

    return (
      <div className={`rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 ${className}`}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
            {t("profile.completeness.title")}
          </div>
          {ready ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-500/30">✓ Ready</span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">{reqLeft} required left</span>
          )}
        </div>
        <div className="space-y-2.5">
          <Bar label="Required" tier={req} tone={ready ? "bg-emerald-400" : "bg-rose-400"} />
          <Bar label="Preferred" tier={pref} tone="bg-amber-400" />
          <div className="text-[11px] text-[var(--text-dim)]">Optional · {tiers.optionalAdded} added</div>
        </div>
      </div>
    );
  }

  /* ── Single-bar view (customers / employees / generic) ── */
  const safeTotal = total > 0 ? total : 0;
  const safeFilled = Math.min(Math.max(filled, 0), safeTotal);
  const pct = safeTotal > 0 ? Math.round((safeFilled / safeTotal) * 100) : 0;
  const tone = pct >= 80 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-rose-400";
  const detail = t("profile.completeness.fields")
    .replace("{filled}", String(safeFilled))
    .replace("{total}", String(safeTotal))
    .replace("{pct}", String(pct));

  return (
    <div className={`rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
          {t("profile.completeness.title")}
        </div>
        <div className="text-[12px] tabular-nums text-[var(--text-secondary)]">{detail}</div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
        <div aria-hidden className={`h-full ${tone} transition-[width] duration-300`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
