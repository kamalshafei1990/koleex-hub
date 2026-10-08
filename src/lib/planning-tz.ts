"use client";

/* ---------------------------------------------------------------------------
   planning-tz — the planner's clock, ONE place for every Planning view.

   The zone is the user's Calendar timezone preference (Settings → Calendar)
   when set, else the browser's. The week grid, the week boundaries, the
   hour timeline, the item modal, copy-week / publish-week, templates,
   recurrence and the server's leave-day check all read it from here, so a
   shift sits on the same day and at the same hour in every view.

   Days and week starts are WALL dates (lib/calendar-tz): JS Dates whose
   local fields read the wall clock in the planner's zone, so the views keep
   their ordinary date math (addDays, getDate, dateKey). Anything that talks
   to the server converts at the edge — `wallInstant` for a wall date,
   `plannerNow` / `toWall` the other way.
   --------------------------------------------------------------------------- */

import { useSyncExternalStore } from "react";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import { browserTimeZone, fromWall, safeTimeZone, toWall } from "@/lib/calendar-tz";

const noopSubscribe = () => () => {};

/** The planner's IANA zone: the Calendar preference, else the browser's. */
export function usePlannerTimeZone(): string {
  const boot = useMeBootstrap();
  const prefTz = (boot.data?.header as { preferences?: { calendar?: { timezone?: string | null } } } | null | undefined)
    ?.preferences?.calendar?.timezone;
  const deviceTz = useSyncExternalStore(noopSubscribe, browserTimeZone, () => "UTC");
  return prefTz ? safeTimeZone(prefTz) : deviceTz;
}

/** "Now" as a wall date in `tz`. */
export function plannerNow(tz: string): Date {
  return toWall(Date.now(), tz);
}

/** An instant (ISO / ms) as a wall date in `tz`. */
export function plannerWall(msOrIso: number | string, tz: string): Date {
  return toWall(msOrIso, tz);
}

/** A wall date (a day or a week start) → the real instant it stands for. */
export function wallInstant(wall: Date, tz: string): Date {
  return fromWall(wall, tz);
}
