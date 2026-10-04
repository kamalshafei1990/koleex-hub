"use client";

/* ---------------------------------------------------------------------------
   FreeBusy — the event editor's guest timeline: for the organizer and each
   selected guest, when they are busy on the event's day, on the CALENDAR's
   clock, with the proposed time drawn over it so a clash shows at a glance.

   Reads GET /api/calendar/freebusy, which answers busy intervals only (a
   title only where the viewer could open that event anyway — never a
   private one). Busy = their events (series with their exceptions),
   invitations they have not declined (unanswered = tentative, dashed) and
   leave (pending = tentative). The day's holidays come from the calendar's
   own holiday list.

   Positions are inline-start percentages, so the axis runs with the reading
   direction in Arabic too.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import { ExclamationIcon } from "@/components/icons/ui";
import { useTranslation } from "@/lib/i18n";
import { calendarT } from "@/lib/translations/calendar";
import { fetchFreeBusy } from "@/lib/calendar-events";
import { toWall, zonedToUtc } from "@/lib/calendar-tz";
import { EVENT_TYPE_COLORS } from "@/lib/calendar-enums";
import { formatTime, isoDateKey } from "@/lib/calendar-utils";
import type { BusyBlock } from "@/lib/calendar-types";

const DAY_MIN = 24 * 60;
const TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];
const LEAVE = EVENT_TYPE_COLORS.out_of_office;

interface Props {
  /** Organizer first, then the guests. */
  accountIds: string[];
  nameFor: (id: string) => string;
  /** The event's day on the calendar's clock (YYYY-MM-DD). */
  dayKey: string;
  timezone: string;
  /** The proposed time in minutes of that day; null for an all-day event. */
  proposal: { startMin: number; endMin: number } | null;
  /** Holidays on that day (names). */
  holidays: string[];
}

type Span = { s: number; e: number; tentative: boolean; leave: boolean; label: string };

export default function FreeBusy({ accountIds, nameFor, dayKey, timezone, proposal, holidays }: Props) {
  const { t } = useTranslation(calendarT);
  const [state, setState] = useState<{ key: string; busy: Record<string, BusyBlock[]> | null } | null>(null);
  const idsKey = accountIds.join(",");
  const reqKey = `${idsKey}|${dayKey}|${timezone}`;

  useEffect(() => {
    if (!idsKey || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      const [y, m, d] = dayKey.split("-").map(Number);
      const from = new Date(zonedToUtc(y, m, d, 0, 0, 0, 0, timezone));
      const to = new Date(zonedToUtc(y, m, d + 1, 0, 0, 0, 0, timezone));
      void fetchFreeBusy(idsKey.split(","), from, to, ctrl.signal).then((busy) => {
        if (!ctrl.signal.aborted) setState({ key: reqKey, busy });
      });
    }, 300);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [idsKey, dayKey, timezone, reqKey]);

  const loading = !state || state.key !== reqKey;
  const failed = !loading && state?.busy === null;

  /* Each person's busy spans, in minutes of the day on the calendar's clock. */
  const rows = useMemo(() => {
    const busy = !loading ? state?.busy ?? {} : {};
    return accountIds.map((id) => {
      const spans: Span[] = [];
      for (const b of busy[id] ?? []) {
        const leave = b.kind === "leave";
        const label = b.title || (leave ? t("fb.leave") : t("fb.busy"));
        if (b.all_day) {
          if (b.start_date && b.end_date && (dayKey < b.start_date || dayKey > b.end_date)) continue;
          spans.push({ s: 0, e: DAY_MIN, tentative: !!b.tentative, leave, label });
          continue;
        }
        const ws = toWall(b.start, timezone);
        const we = toWall(b.end, timezone);
        const s = isoDateKey(ws) < dayKey ? 0 : isoDateKey(ws) > dayKey ? DAY_MIN : ws.getHours() * 60 + ws.getMinutes();
        const e = isoDateKey(we) > dayKey ? DAY_MIN : isoDateKey(we) < dayKey ? 0 : we.getHours() * 60 + we.getMinutes();
        if (e <= s) continue;
        spans.push({ s, e, tentative: !!b.tentative, leave, label: `${label} · ${formatTime(ws)}–${formatTime(we)}` });
      }
      const clash = !!proposal && spans.some((sp) => !sp.tentative && sp.s < proposal.endMin && sp.e > proposal.startMin);
      return { id, spans, clash };
    });
  }, [accountIds, state, loading, dayKey, timezone, proposal, t]);

  const pct = (min: number) => `${(Math.max(0, Math.min(DAY_MIN, min)) / DAY_MIN) * 100}%`;
  const clashes = rows.filter((r) => r.clash).length;

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/60 p-3" aria-busy={loading}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("fb.title")}</span>
        <span className="text-[11px] text-[var(--text-dim)]" aria-live="polite">
          {loading ? t("fb.loading") : failed ? "" : clashes > 0 ? t("fb.clashes").replace("{n}", String(clashes)) : proposal ? t("fb.allFree") : ""}
        </span>
      </div>

      {holidays.length > 0 && (
        <p className="mb-2 text-[11px] font-medium" style={{ color: EVENT_TYPE_COLORS.holiday }}>
          {t("fb.holiday")}: {holidays.join(" · ")}
        </p>
      )}

      {failed ? (
        <p className="text-[12px] text-[var(--state-error)]">{t("fb.error")}</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map(({ id, spans, clash }) => (
            <div key={id} className="flex items-center gap-2">
              <span className="w-24 sm:w-28 shrink-0 truncate text-[11px] text-[var(--text-muted)] flex items-center gap-1" title={nameFor(id)}>
                {clash && <ExclamationIcon className="h-3 w-3 shrink-0 text-[var(--state-error)]" aria-hidden />}
                <span className="truncate">{nameFor(id)}</span>
                {clash && <span className="sr-only">{t("fb.clash")}</span>}
              </span>
              <div className="relative flex-1 h-5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
                {TICKS.slice(1, -1).map((h) => (
                  <span key={h} aria-hidden className="absolute top-0 bottom-0 w-px bg-[var(--border-subtle)]" style={{ insetInlineStart: pct(h * 60) }} />
                ))}
                {spans.map((sp, i) => (
                  <span
                    key={i}
                    title={sp.label}
                    className={`absolute top-0.5 bottom-0.5 rounded-sm ${sp.leave ? "" : "bg-[#567FB2]/45 dark:bg-[#7FA9D6]/45"} ${sp.tentative ? "border border-dashed border-[#567FB2] dark:border-[#7FA9D6] bg-transparent" : ""}`}
                    style={{
                      insetInlineStart: pct(sp.s),
                      width: `calc(${pct(sp.e - sp.s)} - 1px)`,
                      ...(sp.leave ? { backgroundColor: sp.tentative ? "transparent" : LEAVE + "55", borderColor: LEAVE } : {}),
                      ...(sp.tentative ? { backgroundImage: "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 5px)", color: "rgba(86,127,178,0.35)" } : {}),
                    }}
                  />
                ))}
                {proposal && (
                  <span
                    aria-hidden
                    className="absolute top-0 bottom-0 rounded-sm border-2 border-[#567FB2] dark:border-[#7FA9D6]"
                    style={{ insetInlineStart: pct(proposal.startMin), width: pct(Math.max(10, proposal.endMin - proposal.startMin)) }}
                  />
                )}
              </div>
            </div>
          ))}
          {/* Hour axis */}
          <div className="flex items-center gap-2" aria-hidden>
            <span className="w-24 sm:w-28 shrink-0" />
            <div className="relative flex-1 h-3">
              {TICKS.filter((h) => h % 6 === 0).map((h) => (
                <span
                  key={h}
                  className="absolute text-[9px] text-[var(--text-dim)] tabular-nums -translate-x-1/2 rtl:translate-x-1/2"
                  style={{ insetInlineStart: pct(h * 60) }}
                >
                  {String(h).padStart(2, "0")}
                </span>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-[var(--text-dim)]">{t("fb.legend")}</p>
        </div>
      )}
    </div>
  );
}
