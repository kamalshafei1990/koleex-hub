"use client";

/* ---------------------------------------------------------------------------
   DocumentWorkflowBanner — drop-in workflow context for document
   detail pages (SO / PO / Invoice / Bill).

   Shows the canonical lifecycle, marks the current step, and surfaces
   the next action button. Reuses WorkflowRail primitives.
   --------------------------------------------------------------------------- */

import { WorkflowRail, type WorkflowStep } from "@/components/ui/create/SmartCreate";
import { buildWorkflowSteps as buildSteps, type BuildOpts, type DocKind } from "@/lib/workflow/document-workflow";

export type { DocKind };

export default function DocumentWorkflowBanner(props: BuildOpts) {
  const steps = buildSteps(props) as WorkflowStep[];
  return (
    <div className="mb-4 rounded-xl border border-white/[0.04] bg-white/[0.008] p-3">
      <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-gray-500">Workflow</div>
      <WorkflowRail steps={steps} />
    </div>
  );
}
