"use client";

/* ===========================================================================
   EvidenceBadge  —  Phase 2.1

   A monochrome status chip indicating the financial-evidence state of
   an expense (missing / pending / partial / verified). Lives inline in
   expense rows; the receipt count rides alongside it.

   Visual language matches the rest of Hub: a 2px tinted rail concept
   collapsed into a single calm dot + label. No exclamation marks, no
   colour saturation. Verified is the most visible because it's the
   trust signal an auditor scans for.
   ========================================================================== */

import type { EvidenceStatus } from "@/lib/finance/types";
import GuidanceTip from "@/components/ui/GuidanceTip";

const STYLES: Record<EvidenceStatus, { dot: string; cls: string; label: string }> = {
  missing: {
    dot:   "bg-rose-400/80",
    cls:   "text-rose-300 bg-rose-500/[0.08] border-rose-500/[0.18]",
    label: "Missing receipt",
  },
  pending: {
    dot:   "bg-amber-300/85",
    cls:   "text-amber-200 bg-amber-500/[0.06] border-amber-500/[0.16]",
    label: "Pending review",
  },
  partial: {
    dot:   "bg-amber-300/85",
    cls:   "text-amber-200 bg-amber-500/[0.06] border-amber-500/[0.16]",
    label: "Partial evidence",
  },
  verified: {
    dot:   "bg-emerald-400/85",
    cls:   "text-emerald-300 bg-emerald-500/[0.08] border-emerald-500/[0.18]",
    label: "Verified",
  },
};

export function EvidenceBadge({
  status,
  receiptCount,
  compact = false,
  withTip = true,
}: {
  status: EvidenceStatus | undefined;
  receiptCount?: number;
  compact?: boolean;
  /** Phase 2.5 — render a state-aware help tip next to the chip.
   *  Defaults to true so the badge teaches its state everywhere. */
  withTip?: boolean;
}) {
  const s = STYLES[status ?? "missing"];
  const label = compact ? labelCompact(status ?? "missing") : s.label;
  const chip = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${s.cls}`}
      title={`${s.label}${receiptCount != null && receiptCount > 0 ? ` · ${receiptCount} file${receiptCount === 1 ? "" : "s"}` : ""}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <span>{label}</span>
      {receiptCount != null && receiptCount > 0 && (
        <span className="rounded-full bg-white/[0.08] px-1 text-[9px] tabular-nums text-gray-300">
          {receiptCount}
        </span>
      )}
    </span>
  );
  if (!withTip) return chip;
  return (
    <span className="inline-flex items-center gap-1">
      {chip}
      <GuidanceTip guidanceId="evidence.status" state={status ?? "missing"} />
    </span>
  );
}

function labelCompact(s: EvidenceStatus): string {
  switch (s) {
    case "verified": return "Verified";
    case "partial":  return "Partial";
    case "pending":  return "Pending";
    default:         return "Missing";
  }
}
