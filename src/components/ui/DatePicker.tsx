"use client";

/* ---------------------------------------------------------------------------
   DatePicker — a brand-styled replacement for <input type="date">.

   The native date input opens an OS/browser calendar popup that can't be
   themed, so it clashes with the Koleex monochrome UI. This renders a custom
   trigger (matching the form-input look) + a calendar popover built from
   design tokens: dark/light aware, accent (#0066FF) for the selected day,
   rounded, with month nav, Today and Clear.

   Controlled. value/onChange use the ISO "YYYY-MM-DD" string (same shape the
   native input emitted) so it's a drop-in swap.

   `floating` is for a field too narrow to hold a month (a table cell): the
   calendar opens as the Hub's dropdown panel on <body> instead of in flow.
   --------------------------------------------------------------------------- */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import CalendarRawIcon from "@/components/icons/ui/CalendarRawIcon";
import PopoverPanel from "@/components/kds/PopoverPanel";

/* A floating calendar: as wide as the in-flow one reads well, never narrower
   than a month can be tapped, and this far from the screen's edge. */
const FLOAT_W = 280;
const FLOAT_MIN_W = 224;
const FLOAT_EDGE = 12;

/* Labels per language. Hardcoded rather than Intl so the English output stays
   byte-identical to what shipped (Intl's en-GB gives 3-letter weekdays), and
   so Arabic keeps Latin digits — an Arabic-Indic numbered date field reads
   wrong next to the rest of the Hub's numbers. */
const WEEKDAYS_BY_LANG: Record<string, string[]> = {
  en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  zh: ["日", "一", "二", "三", "四", "五", "六"],
  ar: ["ح", "ن", "ث", "ر", "خ", "ج", "س"],
};
const MONTHS_BY_LANG: Record<string, string[]> = {
  en: ["January", "February", "March", "April", "May", "June",
       "July", "August", "September", "October", "November", "December"],
  zh: ["1月", "2月", "3月", "4月", "5月", "6月",
       "7月", "8月", "9月", "10月", "11月", "12月"],
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
       "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
};
const TODAY_BY_LANG: Record<string, string> = { en: "Today", zh: "今天", ar: "اليوم" };
const CLEAR_BY_LANG: Record<string, string> = { en: "Clear", zh: "清除", ar: "مسح" };

const WEEKDAYS = WEEKDAYS_BY_LANG.en;
const MONTHS = MONTHS_BY_LANG.en;

/* Parse / format "YYYY-MM-DD" in LOCAL time (no UTC shift — new Date("YYYY-MM-DD")
   is parsed as UTC midnight which can roll back a day in negative offsets). */
function parseISO(v: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return null;
  return { y: +m[1], m: +m[2] - 1, d: +m[3] };
}
function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function fmtDisplay(v: string, lang = "en"): string {
  const p = parseISO(v);
  if (!p) return "";
  if (lang === "zh") return `${p.y}年${p.m + 1}月${p.d}日`;
  const months = MONTHS_BY_LANG[lang] ?? MONTHS;
  const month = lang === "en" ? months[p.m].slice(0, 3) : months[p.m];
  return `${String(p.d).padStart(2, "0")} ${month} ${p.y}`;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  className = "",
  id,
  lang = "en",
  min,
  max,
  heightCls = "h-11",
  floating = false,
  format,
}: {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  /** "en" | "zh" | "ar" — month, weekday and action labels. */
  lang?: string;
  /** Inclusive ISO bound. Days outside it are shown but not selectable. */
  min?: string;
  max?: string;
  /** Trigger height, so the field can line up with the form around it. */
  heightCls?: string;
  /** Open the calendar as the Hub's dropdown panel (kds PopoverPanel, on
      <body>) rather than in flow under the field — for a field narrower than
      a month, where the in-flow calendar would be squeezed to its width. */
  floating?: boolean;
  /** How the chosen day reads on the field. Default "26 Sep 2026" in the
      field's language; a narrow field can pass a shorter day-first form. The
      calendar keeps the language's month names either way. */
  format?: (iso: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const autoId = useId();
  const fieldId = id ?? autoId;
  /* Where a floating calendar hangs — measured as it opens (toggle below). */
  const [placement, setPlacement] = useState<{ align: "start" | "end"; width: number; dir: "ltr" | "rtl" }>(
    { align: "start", width: FLOAT_W, dir: "ltr" },
  );

  const selected = parseISO(value);
  const today = useMemo(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
  }, []);

  /* The month currently shown in the grid. Starts on the selected date's
     month (or today's). Reset to that whenever the popover opens. */
  const [view, setView] = useState(() => ({
    y: selected?.y ?? today.y,
    m: selected?.m ?? today.m,
  }));
  useEffect(() => {
    if (open) setView({ y: selected?.y ?? today.y, m: selected?.m ?? today.m });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Close on outside click + Escape. A floating calendar is on <body>, outside
     wrapRef, so a press on one of its days would count as "outside" and close
     it before the click landed — PopoverPanel closes it instead, testing both
     the field and the panel. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (!floating) document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, floating]);

  /* A floating calendar hangs under the field from the edge the page reads
     from (left in English, right in Arabic), switches to the field's other
     edge when that would run off the screen, and narrows only when neither
     side has the room — a date in the last column of a phone-width table. */
  const toggle = () => {
    if (!open && floating && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      const rtl = getComputedStyle(wrapRef.current).direction === "rtl";
      const leftAligned = document.documentElement.clientWidth - FLOAT_EDGE - r.left;
      const rightAligned = r.right - FLOAT_EDGE;
      const [own, other] = rtl ? [rightAligned, leftAligned] : [leftAligned, rightAligned];
      const useOwn = own >= FLOAT_W || own >= other;
      setPlacement({
        align: useOwn !== rtl ? "start" : "end",
        width: Math.floor(Math.max(FLOAT_MIN_W, Math.min(FLOAT_W, useOwn ? own : other))),
        dir: rtl ? "rtl" : "ltr",
      });
    }
    setOpen((o) => !o);
  };

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const stepMonth = (delta: number) => {
    setView((v) => {
      const m = v.m + delta;
      if (m < 0) return { y: v.y - 1, m: 11 };
      if (m > 11) return { y: v.y + 1, m: 0 };
      return { y: v.y, m };
    });
  };

  /* Out-of-range days stay visible (so the month keeps its shape) but are not
     selectable — that is what stops an end date landing before its start. */
  const outOfRange = (d: number): boolean => {
    const iso = toISO(view.y, view.m, d);
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  };

  const pick = (d: number) => {
    if (outOfRange(d)) return;
    onChange(toISO(view.y, view.m, d));
    setOpen(false);
  };

  const months = MONTHS_BY_LANG[lang] ?? MONTHS;
  const weekdays = WEEKDAYS_BY_LANG[lang] ?? WEEKDAYS;

  const trigger =
    `w-full ${heightCls} px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] outline-none transition-all flex items-center justify-between gap-2 text-start`;

  /* The month, its days and Today / Clear — the same in both placements. */
  const calendar = (
    <>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => stepMonth(-1)}
          className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:bg-[var(--bg-inverted)]/[0.06] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Previous month"
        >
          <AngleLeftIcon className="h-4 w-4" />
        </button>
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
          {lang === "zh" ? `${view.y}年${months[view.m]}` : `${months[view.m]} ${view.y}`}
        </span>
        <button
          type="button"
          onClick={() => stepMonth(1)}
          className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:bg-[var(--bg-inverted)]/[0.06] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Next month"
        >
          <AngleRightIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {weekdays.map((w) => (
          <div key={w} className="h-7 flex items-center justify-center text-[10px] font-semibold text-[var(--text-ghost)] uppercase">
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} className="h-8" />;
          const isSelected =
            !!selected && selected.y === view.y && selected.m === view.m && selected.d === d;
          const isToday = today.y === view.y && today.m === view.m && today.d === d;
          const disabled = outOfRange(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => pick(d)}
              disabled={disabled}
              className={`h-8 rounded-lg text-[12px] font-medium transition-colors ${
                disabled
                  ? "text-[var(--text-ghost)] cursor-not-allowed"
                  : isSelected
                    /* ELECTED DPS-4 (owner, 2026-08-02): Hub Blue
                       gradient square + soft ring. */
                    ? "bg-gradient-to-br from-[#567FB2] to-[#7FA9D6] text-white shadow-[0_0_0_3px_rgba(86,127,178,0.2)]"
                    : isToday
                      ? "text-[var(--accent)] ring-1 ring-inset ring-[var(--accent)]/40 hover:bg-[var(--bg-inverted)]/[0.06]"
                      : "text-[var(--text-primary)] hover:bg-[var(--bg-inverted)]/[0.06]"
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-subtle)]">
        {/* Hidden when today itself is outside the allowed range — a
            shortcut that produces an invalid value is worse than none. */}
        {(() => {
          const iso = toISO(today.y, today.m, today.d);
          if ((min && iso < min) || (max && iso > max)) return <span />;
          return (
            <button
              type="button"
              onClick={() => { onChange(iso); setOpen(false); }}
              className="text-[11px] font-semibold text-[var(--accent)] hover:underline"
            >
              {TODAY_BY_LANG[lang] ?? TODAY_BY_LANG.en}
            </button>
          );
        })()}
        {value && (
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            className="text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]"
          >
            {CLEAR_BY_LANG[lang] ?? CLEAR_BY_LANG.en}
          </button>
        )}
      </div>
    </>
  );

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        id={fieldId}
        onClick={toggle}
        className={`${trigger} ${open ? "border-[var(--border-focus)]" : "hover:border-[var(--border-strong,var(--border-subtle))]"} ${className}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"}>
          {value ? (format ? format(value) : fmtDisplay(value, lang)) : placeholder}
        </span>
        <CalendarRawIcon className="h-4 w-4 text-[var(--text-dim)] shrink-0" />
      </button>

      {floating ? (
        /* The panel is the shell (MN-5 glass, scrim, placement that follows
           scrolling); the width is ours, set as it opened. `dir` keeps the
           month reading the field's way now that it lives on <body>. */
        <PopoverPanel anchorRef={wrapRef} open={open} onClose={() => setOpen(false)} matchAnchorWidth={false} align={placement.align}>
          <div role="dialog" dir={placement.dir} className="p-3" style={{ width: placement.width }}>
            {calendar}
          </div>
        </PopoverPanel>
      ) : open && (
        <div
          role="dialog"
          /* In-flow (not absolute) so it never gets clipped by a scrollable
             modal and always fits the available width on mobile. */
          className="mt-2 w-full max-w-[300px] p-3 rounded-2xl bg-[var(--bg-elevated,var(--bg-surface))] border border-[var(--border-subtle)] shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        >
          {calendar}
        </div>
      )}
    </div>
  );
}
