"use client";

/* ---------------------------------------------------------------------------
   EventChip — one line of an event: the month cells and the all-day strip of
   the week/day grids draw the same chip. Colour on the inline-start edge (so
   it sits on the reading side in Arabic too), 24-hour time, a lock on the
   read-only items (leave), a flag on project milestones, a declined
   invitation struck out, and pending leave drawn dashed (tentative).

   An event with a meeting link that is on today carries a small Join button
   BESIDE the chip (a link cannot sit inside a button). In the month view the
   chip can be dragged to another day (`dragData`) — HTML5 drag, which touch
   screens do not start, so phones keep tapping.
   --------------------------------------------------------------------------- */

import { FlagIcon, LockIcon, VideoIcon } from "@/components/icons/ui";
import type { CalendarFeedEvent } from "@/lib/calendar-types";
import { chipTooltip, colorForEvent, formatTime, isTentative, joinableNow } from "@/lib/calendar-utils";

export interface ChipLabels {
  allDay: string;
  readOnly: string;
  declined: string;
  join: string;
  pending: string;
  milestone: string;
  dragHint: string;
}

/** The drag payload type a month cell accepts. */
export const EVENT_DRAG_MIME = "application/x-koleex-calendar-event";

/** Items that open nothing and cannot be changed here. */
export function isReadOnlyItem(e: CalendarFeedEvent): boolean {
  return e.source === "leave";
}

export function isMilestone(e: CalendarFeedEvent): boolean {
  return e.source === "project" && !!e.milestone_id;
}

/** The small Join link — beside a chip, in a time-grid block, in the agenda. */
export function JoinLink({ url, label, title, compact = false }: { url: string; label: string; title: string; compact?: boolean }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      draggable={false}
      aria-label={`${label} · ${title}`}
      title={`${label} · ${url}`}
      className={`shrink-0 inline-flex items-center justify-center gap-1 rounded font-bold text-white bg-[#567FB2] hover:bg-[#4A6F9E] dark:bg-[#7FA9D6] dark:text-[#0B1320] dark:hover:bg-[#BCD8F0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#567FB2] transition-colors ${
        compact ? "h-[18px] w-[18px]" : "h-6 px-2 text-[11px]"
      }`}
    >
      <VideoIcon size={compact ? 10 : 12} aria-hidden />
      {!compact && <span>{label}</span>}
    </a>
  );
}

export default function EventChip({
  ev,
  labels,
  onClick,
  showTime = true,
  now,
  dragData,
}: {
  ev: CalendarFeedEvent;
  labels: ChipLabels;
  onClick?: (e: CalendarFeedEvent) => void;
  showTime?: boolean;
  /** The calendar's wall "now" — enables the Join button on today. */
  now?: Date;
  /** Set when the chip may be dragged to another day: what the drop reads. */
  dragData?: string;
}) {
  const color = colorForEvent(ev);
  const readOnly = isReadOnlyItem(ev);
  const tentative = isTentative(ev);
  const milestone = isMilestone(ev);
  const declined = ev.invite_status === "declined";
  const extra = [
    readOnly ? labels.readOnly : null,
    tentative ? labels.pending : null,
    milestone ? labels.milestone : null,
    declined ? labels.declined : null,
    dragData ? labels.dragHint : null,
  ].filter(Boolean).join(" · ");
  const tip = chipTooltip(ev, ev.title, labels.allDay) + (extra ? ` · ${extra}` : "");
  const join = now && ev.meeting_url && joinableNow(ev, now) ? ev.meeting_url : null;
  /* The draggable element is the chip itself, a div with the button role:
     Firefox never starts a drag from inside a <button>. */
  return (
    <div className="flex items-center gap-1 min-w-0">
      <div
        role="button"
        tabIndex={0}
        draggable={!!dragData}
        onDragStart={dragData ? (e) => {
          e.dataTransfer.setData(EVENT_DRAG_MIME, dragData);
          e.dataTransfer.effectAllowed = "move";
        } : undefined}
        onClick={(e) => { e.stopPropagation(); onClick?.(ev); }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          onClick?.(ev);
        }}
        className={`flex-1 min-w-0 text-start flex items-center gap-1.5 h-[18px] px-1.5 rounded text-[10px] font-medium cursor-pointer select-none hover:brightness-125 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--border-focus)] transition-all ${declined ? "opacity-60" : ""} ${tentative ? "opacity-80 italic" : ""} ${dragData ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{
          backgroundColor: tentative ? "transparent" : color + "22",
          color,
          ...(tentative
            ? { border: `1px dashed ${color}` }
            : { borderInlineStart: `2px ${readOnly ? "dashed" : "solid"} ${color}` }),
        }}
        title={tip}
        aria-label={tip}
      >
        {milestone && <FlagIcon size={9} className="shrink-0" aria-hidden />}
        {showTime && !ev.all_day && (
          <span className="shrink-0 text-[9px] opacity-80 tabular-nums">{formatTime(new Date(ev.start_at))}</span>
        )}
        <span className={`truncate ${declined ? "line-through" : ""}`}>{ev.title}</span>
        {readOnly && <LockIcon size={10} className="shrink-0 ms-auto opacity-70" aria-hidden />}
      </div>
      {join && <JoinLink url={join} label={labels.join} title={ev.title} compact />}
    </div>
  );
}
