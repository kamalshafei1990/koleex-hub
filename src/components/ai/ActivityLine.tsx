"use client";

/* ---------------------------------------------------------------------------
   ActivityLine — one small line that says what Koleex AI is doing right now.

   "Thinking", "Searching the web", "Checking the records" — set in the muted
   text colour with a slow light sweeping through the letters and three dots
   that breathe after it. The pattern every current assistant uses (the
   owner pointed at Grok's) for the seconds between a question and its
   answer: the text says WHAT is happening, the motion says it is STILL
   happening. It replaces the anonymous three-dot typing indicator in the
   assistant bubble, and sits above the answer while a lookup runs mid-reply.

   The words come from activity-copy.ts, so this line and the voice caption
   never disagree. Under reduced motion the sweep and the dots stand still;
   the words are the information, the motion is the courtesy.
   --------------------------------------------------------------------------- */

import type { AIOrbActivity } from "@/components/ai-orb/ai-orb-types";
import type { Lang } from "@/lib/i18n";
import { activityLabel } from "@/components/ai/activity-copy";

export default function ActivityLine({
  activity = "none",
  lang = "en",
  className = "",
}: {
  activity?: AIOrbActivity;
  lang?: Lang;
  className?: string;
}) {
  const label = activityLabel(activity, lang);
  return (
    <div
      role="status"
      aria-live="polite"
      className={`kx-activity inline-flex items-center gap-1.5 text-[13px] text-[var(--text-dim)] select-none ${className}`}
      data-activity={activity}
    >
      <span className="kx-activity-text">{label}</span>
      <span className="kx-activity-dots" aria-hidden>
        <i /><i /><i />
      </span>
    </div>
  );
}
