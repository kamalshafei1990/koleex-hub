"use client";

/* ---------------------------------------------------------------------------
   ThinkingPanel — what Koleex AI did before it answered, above the answer.

   Owner, 2026-09-26: the words a model said before a lookup "come quickly and
   remove quickly … this can be in the place of thinking, same as any famous
   AI". While the turn works, the panel is open: "Thinking" with the shared
   light sweep, a seconds counter, the notes in small muted text and each
   lookup in plain words. Once the answer begins it folds to one line —
   "Thought for 23s" — which opens again on a tap. A turn that answered
   without looking anything up has no panel at all.

   Rows come from thinking-panel-model.ts; tool names never reach the screen.
   Nothing here is saved: a reloaded thread shows the answer alone.
   --------------------------------------------------------------------------- */

import { useEffect, useId, useMemo, useState } from "react";
import type { Lang } from "@/lib/i18n";
import type { AgentStep, ThinkingRecord } from "@/components/ai/types";
import { COPY } from "@/components/ai/copy";
import { activityLabel } from "@/components/ai/activity-copy";
import { toolActivity } from "@/components/ai-orb/ai-orb-tool-map";
import { thinkingRows, thoughtSeconds } from "@/components/ai/thinking-panel-model";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import ChevronDownIcon from "@/components/icons/ui/ChevronDownIcon";

export default function ThinkingPanel({
  steps,
  thinking,
  live,
  lang = "en",
}: {
  steps: AgentStep[] | undefined;
  thinking: ThinkingRecord | undefined;
  /** This turn is still streaming. */
  live: boolean;
  lang?: Lang;
}) {
  const copy = COPY[lang] ?? COPY.en;
  const bodyId = useId();
  /* Working until the answer began (ms set) or the turn is over. */
  const working = live && thinking?.ms === undefined;
  /* Open while working; folded once the answer begins. A tap overrides. */
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? working;

  /* The live counter — ticks only while working. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [working]);

  const rows = useMemo(() => thinkingRows(steps, thinking, !working), [steps, thinking, working]);

  const elapsed = thinking ? Math.max(0, now - thinking.startedAt) : 0;
  const seconds = thinking?.ms !== undefined ? thoughtSeconds(thinking.ms) : null;
  const title = working || seconds === null ? copy.thinkingTitle : copy.thoughtFor.replace("{s}", String(seconds));

  const verb = (tool: string, done: boolean): string => {
    if (tool === "search_web") return done ? copy.thinkSearched : copy.thinkSearching;
    if (tool === "read_page") return done ? copy.thinkRead : copy.thinkReading;
    return activityLabel(toolActivity(tool), lang);
  };

  return (
    <div className="kx-thinking w-full max-w-[640px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
      <button
        type="button"
        onClick={() => setUserOpen(!open)}
        aria-expanded={open}
        aria-controls={bodyId}
        aria-label={`${title} — ${open ? copy.thinkingHide : copy.thinkingShow}`}
        className="flex w-full min-h-[44px] items-center gap-2 rounded-2xl px-3.5 text-start text-[13px] text-[var(--text-dim)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]"
      >
        {working ? (
          <span role="status" aria-live="polite" className="kx-activity-text font-semibold">{title}</span>
        ) : (
          <span className="font-semibold text-[var(--text-primary)]">{title}</span>
        )}
        {working && (
          <span className="tabular-nums text-[var(--text-dim)] opacity-70" aria-hidden>
            {Math.floor(elapsed / 60000)}:{String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0")}
          </span>
        )}
        <ChevronDownIcon
          size={14}
          aria-hidden
          className={`ms-auto shrink-0 opacity-60 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90 rtl:rotate-90"}`}
        />
      </button>
      {open && rows.length > 0 && (
        <div id={bodyId} className="grid gap-2 border-t border-[var(--border-subtle)] px-3.5 pb-3 pt-2.5">
          {rows.map((row, i) =>
            row.kind === "note" ? (
              <p key={i} dir="auto" className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-dim)]">
                {row.text}
              </p>
            ) : (
              <div key={i} className="flex min-w-0 items-center gap-2 text-[13px] text-[var(--text-dim)]">
                {row.done ? (
                  <CheckIcon size={12} aria-hidden className="shrink-0 text-[var(--kx-ai-success)]" />
                ) : row.tool === "read_page" ? (
                  <GlobeIcon size={12} aria-hidden className="shrink-0 opacity-70" />
                ) : (
                  <SearchIcon size={12} aria-hidden className="shrink-0 opacity-70" />
                )}
                <span className="shrink-0 text-[var(--text-primary)]">{verb(row.tool, row.done)}</span>
                {row.detail && (
                  <span dir="auto" className="min-w-0 truncate opacity-80">
                    {row.detail}
                  </span>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
