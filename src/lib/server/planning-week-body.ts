import "server-only";

/* Body parser shared by the two week routes. */

import { isPlanningUuid, parsePlanningDate } from "@/lib/planning-validate";
import { parsePlanningTz } from "@/lib/planning-recurrence";
import type { WeekScope } from "@/lib/server/planning-week";

export function parseWeekBody(raw: unknown): { scope: WeekScope; preview: boolean } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const b = raw as Record<string, unknown>;
  const weekStart = parsePlanningDate(b.week_start);
  if (!weekStart) return null;
  let resourceIds: string[] | null = null;
  if (b.resource_ids !== undefined && b.resource_ids !== null) {
    if (!Array.isArray(b.resource_ids) || b.resource_ids.length > 1000 || !b.resource_ids.every(isPlanningUuid)) return null;
    resourceIds = b.resource_ids as string[];
  }
  const tz = b.tz === undefined ? "UTC" : parsePlanningTz(b.tz);
  if (!tz) return null;
  return {
    scope: { weekStart, resourceIds, includeOpen: b.include_open !== false, tz },
    preview: b.preview === true,
  };
}
