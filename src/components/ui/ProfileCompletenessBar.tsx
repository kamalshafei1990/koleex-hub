"use client";

import { useTranslation } from "@/lib/i18n";
import { commonT } from "@/lib/translations/common";

interface Props {
  filled: number;
  total: number;
  className?: string;
}

/**
 * Inline profile-completeness indicator shown at the top of every entity
 * add/edit form (employees, customers, suppliers, …). Updates live as the
 * caller's form state changes.
 *
 * Tone:
 *  - red    when < 50%
 *  - amber  when 50% – 79%
 *  - emerald when ≥ 80%
 */
export default function ProfileCompletenessBar({
  filled,
  total,
  className = "",
}: Props) {
  const { t } = useTranslation(commonT);

  const safeTotal = total > 0 ? total : 0;
  const safeFilled = Math.min(Math.max(filled, 0), safeTotal);
  const pct =
    safeTotal > 0 ? Math.round((safeFilled / safeTotal) * 100) : 0;

  const tone =
    pct >= 80
      ? "bg-emerald-400"
      : pct >= 50
      ? "bg-amber-400"
      : "bg-rose-400";

  const detail = t("profile.completeness.fields")
    .replace("{filled}", String(safeFilled))
    .replace("{total}", String(safeTotal))
    .replace("{pct}", String(pct));

  return (
    <div
      className={`rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 ${className}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
          {t("profile.completeness.title")}
        </div>
        <div className="text-[12px] tabular-nums text-[var(--text-secondary)]">
          {detail}
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
        <div
          aria-hidden
          className={`h-full ${tone} transition-[width] duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
