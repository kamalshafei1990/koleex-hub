"use client";

/* ---------------------------------------------------------------------------
   SmartEmpty — branded empty state with CTA + explanation.

   Three sentences max:
     1. headline    — "No suppliers yet"
     2. body        — why this page exists
     3. nextStep    — explicit next action

   Plus a CTA button that either navigates (href) or fires
   onAction (default: openSmartCreate).

   All surfaces use CSS-var design tokens so the component renders correctly
   in both light and dark mode. The CTA keeps the canonical Koleex emerald
   accent (one of the few intentional brand tints — same hue as the rest of
   the Hub's create-affordances).
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

const CTA_CLS =
  "inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/[0.10] px-3 py-1.5 text-[12px] text-emerald-600 hover:bg-emerald-500/[0.16] dark:text-emerald-300";

const SECONDARY_CLS =
  "inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11.5px] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]";

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
      className={CTA_CLS}
    >
      <RrIcon name="plus" size={11} />
      {actionLabel}
    </button>
  );
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-6 py-10 text-center">
      <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]">
        <RrIcon name={icon} size={18} />
      </span>
      <div className="text-[13px] font-medium text-[var(--text-primary)]">{title}</div>
      <p className="mt-1 max-w-md text-[11px] text-[var(--text-dim)]">{body}</p>
      {nextStep && (
        <p className="mt-2 max-w-md rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[10.5px] text-[var(--text-muted)]">
          <span className="text-emerald-600 dark:text-emerald-300">Next:</span> {nextStep}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {actionHref ? (
          <Link href={actionHref} className={CTA_CLS}>
            <RrIcon name="plus" size={11} />
            {actionLabel}
          </Link>
        ) : cta}
        {secondaryHref && secondaryLabel && (
          <Link href={secondaryHref} className={SECONDARY_CLS}>
            {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
