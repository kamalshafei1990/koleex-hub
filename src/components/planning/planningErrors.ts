/* ---------------------------------------------------------------------------
   planningErrors — map a failed Planning request to a translation key.

   The routes answer with short error CODES (never database text); this is
   the one place those codes become user-facing copy, so every toast in the
   app says the same thing for the same failure.
   --------------------------------------------------------------------------- */

import { PlanningApiError } from "@/lib/planning";

export function planningErrorKey(e: unknown): string {
  if (!(e instanceof PlanningApiError)) return "err.generic";
  if (e.status === 0) return "err.network";
  if (e.code === "no_resource") return "err.noResource";
  if (e.code === "schedule_conflict") return "err.scheduleConflict";
  if (e.code === "invalid_recurrence") return "err.recurrence";
  if (e.code === "invalid_resource" || e.code === "invalid_role") return "err.invalidRef";
  if (e.code === "end_before_start") return "val.endAfterStart";
  if (e.code === "series_end_before_start") return "err.seriesRange";
  if (e.code === "start_end_required") return "val.required";
  if (e.status === 403) return e.code === "forbidden" ? "err.forbidden" : "err.generic";
  if (e.status === 404) return "err.notFound";
  if (e.status === 409) return "err.conflict";
  if (e.status === 400) return "err.invalid";
  return "err.generic";
}
