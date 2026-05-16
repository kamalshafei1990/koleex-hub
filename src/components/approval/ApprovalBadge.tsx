"use client";

/* ===========================================================================
   ApprovalBadge  —  Phase 2.2

   Small monochrome chip showing an expense's approval status. Designed
   to sit next to the EvidenceBadge in expense rows. Same visual
   vocabulary: a single tinted dot + a short label. No saturation.
   "Approved" and "Rejected" are the loudest because they are the
   states an operator scans for.
   ========================================================================== */

import type { ApprovalStatus } from "@/lib/finance/types";
import GuidanceTip from "@/components/ui/GuidanceTip";

const STYLES: Record<ApprovalStatus, { dot: string; cls: string; label: string }> = {
  draft: {
    dot:   "bg-white/40",
    cls:   "text-gray-300 bg-white/[0.04] border-white/[0.06]",
    label: "Draft",
  },
  submitted: {
    dot:   "bg-sky-300/80",
    cls:   "text-sky-200 bg-sky-500/[0.06] border-sky-500/[0.18]",
    label: "Submitted",
  },
  under_review: {
    dot:   "bg-sky-300/80",
    cls:   "text-sky-200 bg-sky-500/[0.06] border-sky-500/[0.18]",
    label: "Under review",
  },
  approved: {
    dot:   "bg-emerald-400/85",
    cls:   "text-emerald-300 bg-emerald-500/[0.08] border-emerald-500/[0.18]",
    label: "Approved",
  },
  partially_approved: {
    dot:   "bg-emerald-300/75",
    cls:   "text-emerald-300/90 bg-emerald-500/[0.06] border-emerald-500/[0.14]",
    label: "Partially approved",
  },
  rejected: {
    dot:   "bg-rose-400/85",
    cls:   "text-rose-300 bg-rose-500/[0.08] border-rose-500/[0.18]",
    label: "Rejected",
  },
  requires_changes: {
    dot:   "bg-amber-300/85",
    cls:   "text-amber-200 bg-amber-500/[0.06] border-amber-500/[0.16]",
    label: "Changes requested",
  },
};

export function ApprovalBadge({
  status,
  compact = false,
  ageDays,
  withTip = true,
}: {
  status: ApprovalStatus | undefined;
  compact?: boolean;
  /** Approval age in days — shown for awaiting-review states only. */
  ageDays?: number;
  /** Phase 2.5 — render a state-aware help tip next to the chip.
   *  Defaults to true so the badge teaches its state everywhere. */
  withTip?: boolean;
}) {
  const s = STYLES[status ?? "draft"];
  const showAge = (status === "submitted" || status === "under_review") && ageDays != null && ageDays > 0;
  const chip = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${s.cls}`}
      title={s.label + (showAge ? ` · ${ageDays}d waiting` : "")}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <span>{compact ? labelCompact(status ?? "draft") : s.label}</span>
      {showAge && (
        <span className="rounded-full bg-white/[0.06] px-1 text-[9px] tabular-nums text-gray-300">
          {ageDays}d
        </span>
      )}
    </span>
  );
  if (!withTip) return chip;
  return (
    <span className="inline-flex items-center gap-1">
      {chip}
      <GuidanceTip guidanceId="approval.status" state={status ?? "draft"} />
    </span>
  );
}

function labelCompact(s: ApprovalStatus): string {
  switch (s) {
    case "draft":              return "Draft";
    case "submitted":          return "Submitted";
    case "under_review":       return "Review";
    case "approved":           return "Approved";
    case "partially_approved": return "Partial";
    case "rejected":           return "Rejected";
    case "requires_changes":   return "Changes";
  }
}
