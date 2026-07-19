"use client";

/* ---------------------------------------------------------------------------
   useAppBadges — attention counts for app icons (home tiles + sidebar).

   One shared fetch of /api/me/work (module-level single-flight + cache) feeds
   every subscribed icon:
     todo     → my open to-dos
     projects → my open project tasks
     planning → my published shifts in the next 7 days

   Refreshes on window focus and on "inbox:force-recount" (fired by code that
   just created work for someone). Renders 0s until the first response — no
   layout shift, badges simply appear.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";

export type AppBadgeCounts = Record<string, number>;

let cache: AppBadgeCounts = {};
let inflight: Promise<AppBadgeCounts> | null = null;
const listeners = new Set<(b: AppBadgeCounts) => void>();

async function load(): Promise<AppBadgeCounts> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/me/work", { credentials: "include" });
      if (!res.ok) return cache;
      const j = (await res.json()) as {
        todoCount?: number;
        tasksCount?: number;
        planningCount?: number;
      };
      cache = {
        todo: j.todoCount ?? 0,
        projects: j.tasksCount ?? 0,
        planning: j.planningCount ?? 0,
      };
      listeners.forEach((fn) => fn(cache));
      return cache;
    } catch {
      return cache;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useAppBadges(): AppBadgeCounts {
  const [badges, setBadges] = useState<AppBadgeCounts>(cache);
  useEffect(() => {
    listeners.add(setBadges);
    void load();
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    window.addEventListener("inbox:force-recount", refresh);
    return () => {
      listeners.delete(setBadges);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("inbox:force-recount", refresh);
    };
  }, []);
  return badges;
}
