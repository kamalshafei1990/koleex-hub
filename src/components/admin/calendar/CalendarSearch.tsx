"use client";

/* ---------------------------------------------------------------------------
   CalendarSearch — the toolbar's search box. Searches the viewer's own and
   invited events by title, location and description, three months either
   side of today (GET /api/calendar/search). Picking a hit jumps the calendar
   to its date and opens it.

   A combobox: the list opens under the field, ↑/↓ move, Enter picks, Escape
   closes (and clears when the list is already closed). "/" focuses the field
   from anywhere in the Calendar (CalendarApp).
   --------------------------------------------------------------------------- */

import { useEffect, useId, useRef, useState } from "react";
import { SearchIcon, SpinnerIcon } from "@/components/icons/ui";
import { useTranslation } from "@/lib/i18n";
import { calendarT } from "@/lib/translations/calendar";
import { searchEvents } from "@/lib/calendar-events";
import { toWall } from "@/lib/calendar-tz";
import { formatDMY, formatTime } from "@/lib/calendar-utils";
import type { CalendarSearchHit } from "@/lib/calendar-types";

function dmyKey(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

export default function CalendarSearch({
  timezone,
  inputRef,
  onPick,
}: {
  timezone: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (hit: CalendarSearchHit) => void;
}) {
  const { t } = useTranslation(calendarT);
  const listId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ q: string; hits: CalendarSearchHit[] | null } | null>(null);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const term = q.trim();
  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      void searchEvents(term, ctrl.signal).then((hits) => {
        if (!ctrl.signal.aborted) { setResult({ q: term, hits }); setActive(0); }
      });
    }, 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [term]);

  /* Click outside closes the list. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const loading = term.length >= 2 && result?.q !== term;
  const hits = term.length >= 2 && result?.q === term ? result.hits : [];
  const failed = hits === null;
  const list = hits ?? [];
  const showList = open && term.length >= 2;

  function pick(h: CalendarSearchHit) {
    setOpen(false);
    inputRef.current?.blur();
    onPick(h);
  }

  function when(h: CalendarSearchHit): string {
    if (h.all_day) {
      const s = h.start_date ?? h.start_at.slice(0, 10);
      const e = h.end_date ?? s;
      return s === e ? `${dmyKey(s)} · ${t("f.allDay")}` : `${dmyKey(s)} → ${dmyKey(e)}`;
    }
    const s = toWall(h.start_at, timezone);
    const e = toWall(h.end_at, timezone);
    return `${formatDMY(s)} ${formatTime(s)}–${formatTime(e)}`;
  }

  return (
    <div ref={boxRef} className="relative w-full sm:w-64 lg:w-72">
      <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] transition-shadow focus-within:border-[#567FB2]/60 focus-within:shadow-[0_0_0_4px_rgba(86,127,178,0.16)]">
        {loading ? (
          <SpinnerIcon size={14} className="shrink-0 text-[var(--text-dim)]" aria-hidden />
        ) : (
          <SearchIcon size={14} className="shrink-0 text-[var(--text-ghost)]" aria-hidden />
        )}
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && list[active] ? `${listId}-${active}` : undefined}
          aria-label={t("search.label")}
          placeholder={t("search.placeholder")}
          value={q}
          maxLength={100}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(list.length - 1, i + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
            else if (e.key === "Enter" && showList && list[active]) { e.preventDefault(); pick(list[active]); }
            else if (e.key === "Escape") {
              e.preventDefault();
              if (showList) setOpen(false); else { setQ(""); inputRef.current?.blur(); }
            }
          }}
          className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd className="hidden md:inline-flex h-5 min-w-5 items-center justify-center rounded border border-[var(--border-subtle)] px-1 text-[10px] text-[var(--text-dim)]" aria-hidden>/</kbd>
      </div>

      {showList && (
        <div
          className="kx-glass-pop absolute z-30 mt-1.5 w-full sm:w-[22rem] end-0 sm:end-auto sm:start-0 max-h-[60vh] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl"
        >
          <ul id={listId} role="listbox" aria-label={t("search.results")} className="py-1">
            {!loading && failed && (
              <li className="px-3 py-3 text-[12px] text-[var(--state-error)]">{t("search.error")}</li>
            )}
            {!loading && !failed && list.length === 0 && (
              <li className="px-3 py-3 text-[12px] text-[var(--text-dim)]">{t("search.empty")}</li>
            )}
            {list.map((h, i) => (
              <li
                key={`${h.id}-${h.occurrence_start ?? ""}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(h)}
                onMouseEnter={() => setActive(i)}
                className={`mx-1 cursor-pointer rounded-lg px-2.5 py-2 ${i === active ? "bg-[var(--bg-surface-subtle)]" : ""}`}
              >
                <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{h.title}</p>
                <p className="truncate text-[11px] text-[var(--text-dim)] tabular-nums">
                  {[
                    when(h),
                    h.location,
                    h.recurring ? t("search.recurring") : null,
                    h.invited ? t("search.invited") : null,
                  ].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
          <p className="border-t border-[var(--border-subtle)] px-3 py-1.5 text-[10px] text-[var(--text-dim)]">{t("search.scope")}</p>
        </div>
      )}
    </div>
  );
}
