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
   --------------------------------------------------------------------------- */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import CalendarRawIcon from "@/components/icons/ui/CalendarRawIcon";

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
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const autoId = useId();
  const fieldId = id ?? autoId;

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

  /* Close on outside click + Escape. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        id={fieldId}
        onClick={() => setOpen((o) => !o)}
        className={`${trigger} ${open ? "border-[var(--border-focus)]" : "hover:border-[var(--border-strong,var(--border-subtle))]"} ${className}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"}>
          {value ? fmtDisplay(value, lang) : placeholder}
        </span>
        <CalendarRawIcon className="h-4 w-4 text-[var(--text-dim)] shrink-0" />
      </button>

      {open && (
        <div
          role="dialog"
          /* In-flow (not absolute) so it never gets clipped by a scrollable
             modal and always fits the available width on mobile. */
          className="mt-2 w-full max-w-[300px] p-3 rounded-2xl bg-[var(--bg-elevated,var(--bg-surface))] border border-[var(--border-subtle)] shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        >
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
                        ? "bg-[var(--accent)] text-white"
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
        </div>
      )}
    </div>
  );
}
