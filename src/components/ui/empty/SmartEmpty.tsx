"use client";

/* ---------------------------------------------------------------------------
   SmartEmpty — branded empty state with CTA + explanation.

   Three sentences max:
     1. headline    — "No suppliers yet"
     2. body        — why this page exists
     3. nextStep    — explicit next action

   Plus a CTA button that either navigates (href) or fires
   onAction (default: openSmartCreate).
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { openSmartCreate } from "@/components/ui/create/SmartCreateDrawer";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

export interface SmartEmptyProps {
  icon: RrIconName;
  title: string;
  body: string;
  nextStep?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  /** Secondary link, e.g. "Open setup" or "Why this matters". */
  secondaryHref?: string;
  secondaryLabel?: string;
}

export default function SmartEmpty({
  icon, title, body, nextStep,
  actionLabel = "Create",
  actionHref, onAction,
  secondaryHref, secondaryLabel,
}: SmartEmptyProps) {
  const cta = (
    <button
      type="button"
      onClick={() => { if (onAction) onAction(); else openSmartCreate(); }}
      className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/40 bg-emerald-300/[0.08] px-3 py-1.5 text-[12px] text-emerald-100 hover:bg-emerald-300/[0.14]"
    >
      <RrIcon name="plus" size={11} />
      {actionLabel}
    </button>
  );
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.10] bg-white/[0.012] px-6 py-10 text-center">
      <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.02] text-gray-400">
        <RrIcon name={icon} size={18} />
      </span>
      <div className="text-[13px] font-medium">{title}</div>
      <p className="mt-1 max-w-md text-[11px] text-gray-500">{body}</p>
      {nextStep && (
        <p className="mt-2 max-w-md rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[10.5px] text-gray-400">
          <span className="text-emerald-200">Next:</span> {nextStep}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {actionHref ? (
          <Link href={actionHref}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/40 bg-emerald-300/[0.08] px-3 py-1.5 text-[12px] text-emerald-100 hover:bg-emerald-300/[0.14]">
            <RrIcon name="plus" size={11} />
            {actionLabel}
          </Link>
        ) : cta}
        {secondaryHref && secondaryLabel && (
          <Link href={secondaryHref}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[11.5px] hover:bg-white/[0.08]">
            {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
