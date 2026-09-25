"use client";

/* ---------------------------------------------------------------------------
   EventChip — one line of an event: the month cells and the all-day strip of
   the week/day grids draw the same chip. Colour on the inline-start edge (so
   it sits on the reading side in Arabic too), 24-hour time, a lock on the
   read-only items (approved leave), and a declined invitation struck out.
   --------------------------------------------------------------------------- */

import { LockIcon } from "@/components/icons/ui";
import type { CalendarFeedEvent } from "@/lib/calendar-types";
import { chipTooltip, colorForEvent, formatTime } from "@/lib/calendar-utils";

export interface ChipLabels {
  allDay: string;
  readOnly: string;
  declined: string;
}

/** Items that open nothing and cannot be changed here. */
export function isReadOnlyItem(e: CalendarFeedEvent): boolean {
  return e.source === "leave";
}

export default function EventChip({
  ev,
  labels,
  onClick,
  showTime = true,
}: {
  ev: CalendarFeedEvent;
  labels: ChipLabels;
  onClick?: (e: CalendarFeedEvent) => void;
  showTime?: boolean;
}) {
  const color = colorForEvent(ev);
  const readOnly = isReadOnlyItem(ev);
  const declined = ev.invite_status === "declined";
  const extra = [readOnly ? labels.readOnly : null, declined ? labels.declined : null].filter(Boolean).join(" · ");
  const tip = chipTooltip(ev, ev.title, labels.allDay) + (extra ? ` · ${extra}` : "");
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(ev); }}
      className={`w-full text-start flex items-center gap-1.5 h-[18px] px-1.5 rounded text-[10px] font-medium hover:brightness-125 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--border-focus)] transition-all ${declined ? "opacity-60" : ""}`}
      style={{
        backgroundColor: color + "22",
        color,
        borderInlineStart: `2px ${readOnly ? "dashed" : "solid"} ${color}`,
      }}
      title={tip}
      aria-label={tip}
    >
      {showTime && !ev.all_day && (
        <span className="shrink-0 text-[9px] opacity-80 tabular-nums">{formatTime(new Date(ev.start_at))}</span>
      )}
      <span className={`truncate ${declined ? "line-through" : ""}`}>{ev.title}</span>
      {readOnly && <LockIcon size={10} className="shrink-0 ms-auto opacity-70" aria-hidden />}
    </button>
  );
}
