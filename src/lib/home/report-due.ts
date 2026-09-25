"use client";

/* ---------------------------------------------------------------------------
   Home — "your report is due" in the greeting (Reports Phase 3C, owner's
   pick 25 Sep 2026): while a report is owed, the line under "Good
   afternoon, Kamal" says so instead of the quote, and opens the report.
   Nothing new appears on the page and nothing moves — it is the same line.

   It costs Home no request of its own: what is owed rides in the viewer's
   work snapshot (/api/me/work, `reportsDue`), which reaches Home inside
   the /api/shell batch every screen opens — the same shared read the app
   badges use. The sentence and its words load only when something IS owed
   (report-due-line.ts, its own small chunk), so the Home bundle every
   session opens carries neither them nor anything of the Reports app.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";

export interface HomeDueItem {
  /** daily / weekly / monthly, or the report an event asked for (Phase 3D). */
  key: string;
  periodKey: string;
  /** A day inside the period — what "write it" creates the report for. */
  date: string;
  dueAt: string;
  state: "due" | "missing";
  draftId?: string;
  /** Asked for by an event: the request, and what it is about. */
  request?: string;
  subject?: string;
}
export interface HomeDueLine { text: string; href: string }
type Build = (items: HomeDueItem[], lang: string) => HomeDueLine | null;

async function readDue(): Promise<HomeDueItem[] | null> {
  try {
    const { cachedGet } = await import("@/lib/client-cache");
    const work = await cachedGet<{ reportsDue?: HomeDueItem[] }>("/api/me/work", 15_000);
    return Array.isArray(work?.reportsDue) ? work.reportsDue : null;
  } catch {
    return null;
  }
}

/** The greeting's line: undefined until known, null when nothing is owed
 *  (or it could not be read — the quote is the safe answer). Read again
 *  when the window comes back into focus, like the app badges. */
export function useReportDue(enabled: boolean, lang: string): HomeDueLine | null | undefined {
  const [state, setState] = useState<{ items: HomeDueItem[]; build: Build | null } | undefined>(undefined);
  /* Only a screen that knew from its first frame that it would ask waits
     for the answer; one that learns later (the app list arriving late)
     keeps the quote it is already typing until there is something to say. */
  const [askedFromStart] = useState(enabled);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const read = () => {
      void readDue()
        .then(async (items) => {
          const owed = items ?? [];
          const build = owed.length ? (await import("./report-due-line")).reportDueLine : null;
          if (alive) setState({ items: owed, build });
        })
        .catch(() => { if (alive) setState({ items: [], build: null }); });
    };
    read();
    window.addEventListener("focus", read);
    return () => { alive = false; window.removeEventListener("focus", read); };
  }, [enabled]);
  if (!enabled) return null;
  if (!state) return askedFromStart ? undefined : null;
  return state.build ? state.build(state.items, lang) : null;
}
