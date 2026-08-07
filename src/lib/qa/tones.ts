/* ---------------------------------------------------------------------------
   QA tone maps — the ONE source for every Issue Reports surface.

   These used to be copy-pasted into QaReportsApp, ReporterIssueView and
   MyIssuesView and had already drifted (in_progress was BLUE in My Issues,
   AMBER everywhere else). Unification wave 2026-08-07: one file, two
   deliberate intensities:

   · STATUS_TONE_BOLD — the admin board pills. Saturated bg + light text,
     readable from across the room (owner request, issue f548b45e).
   · STATUS_TONE_SOFT — reporter-facing tints (calm surfaces for employees
     viewing their own reports).
   --------------------------------------------------------------------------- */

export const SEVERITY_TONE: Record<string, string> = {
  low: "bg-[var(--bg-surface)] text-[var(--text-dim)]",
  medium: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
  high: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  critical: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
};

export const STATUS_TONE_BOLD: Record<string, string> = {
  new:             "bg-blue-600 text-white",
  triaged:         "bg-slate-500 text-white",
  in_progress:     "bg-amber-500 text-black",
  fixed:           "bg-emerald-600 text-white",
  verified:        "bg-emerald-700 text-white",
  rejected:        "bg-rose-600 text-white",
  duplicate:       "bg-violet-600 text-white",
  needs_more_info: "bg-yellow-500 text-black",
  closed:          "bg-zinc-500 text-white",
  reopened:        "bg-red-600 text-white",
};

export const STATUS_TONE_SOFT: Record<string, string> = {
  new: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
  triaged: "bg-[var(--bg-surface)] text-[var(--text-secondary)]",
  in_progress: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  fixed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  verified: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200",
  rejected: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  duplicate: "bg-[var(--bg-surface)] text-[var(--text-dim)]",
  needs_more_info: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  closed: "bg-[var(--bg-surface)] text-[var(--text-dim)]",
  reopened: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
};

/* 3px coloured bar on the LEFT edge of every board row — shape+position read
   faster than text. Pairs with STATUS_TONE_BOLD. */
export const STATUS_STRIPE: Record<string, string> = {
  new:             "bg-blue-500",
  triaged:         "bg-slate-400",
  in_progress:     "bg-amber-500",
  fixed:           "bg-emerald-500",
  verified:        "bg-emerald-600",
  rejected:        "bg-rose-500",
  duplicate:       "bg-violet-500",
  needs_more_info: "bg-yellow-500",
  closed:          "bg-zinc-400",
  reopened:        "bg-red-500",
};

// Priority stays monochrome (brand): urgency reads through weight, not colour.
export const PRIORITY_TONE: Record<string, string> = {
  low: "bg-[var(--bg-surface)] text-[var(--text-dim)] border border-transparent",
  normal: "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-transparent",
  high: "bg-transparent text-[var(--text-primary)] border border-[var(--text-muted)]",
  urgent: "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border border-transparent",
};

export const PILL = "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide";
