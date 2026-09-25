/* ---------------------------------------------------------------------------
   project-progress — ONE definition of "how far along is this project",
   shared by the server recompute (projects.progress_pct), the project card
   and Reporting. Before this there were three: the server ignored subtasks
   but counted nothing else, the card divided done by EVERY task including
   cancelled ones, and Reporting did the same — so the same project could
   show three different percentages on three screens.

   The rule:
     · Only top-level tasks count (subtasks roll up into their parent).
     · Cancelled tasks are out of scope — they neither help nor hurt.
     · pct = done / counted, rounded; 0 when nothing counts.

   Pure data, no React, no server imports — safe on both sides.
   --------------------------------------------------------------------------- */

export interface ProgressTaskLike {
  status: string;
  parent_task_id?: string | null;
}

export function progressPct(done: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

/** Counts that feed the progress bar: top-level, non-cancelled tasks. */
export function summarizeProgress(tasks: ProgressTaskLike[]): { done: number; total: number; pct: number } {
  let done = 0;
  let total = 0;
  for (const t of tasks) {
    if (t.parent_task_id) continue;
    if (t.status === "cancelled") continue;
    total += 1;
    if (t.status === "done") done += 1;
  }
  return { done, total, pct: progressPct(done, total) };
}
