"use client";

/* ---------------------------------------------------------------------------
   NotificationMore — the bell's rarely opened parts, in their own chunk:

     · PauseMenu   the header's "Pause notifications" choices
     · MorePanel   the ⋯ under a row: Later (an hour, three hours, tomorrow
                   09:00), Bring back now (the Later view), and Stop
                   notifications about this (a topic that can be muted)
     · CardLater   the pop-up card's Later

   Loaded the first time one of them opens (the bell prefetches it when its
   panel opens), with their words (translations/notif-more) — never with the
   bell itself, which has a size ceiling (validate:budgets §L). What the
   choices DO stays with the bell and the center; this only shows them.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { notifMoreT } from "@/lib/translations/notif-more";
import { notifUiT } from "@/lib/translations/notif-ui";
import { clockText, laterUntil, LATER_CHOICES, nextMorning, type PauseChoice } from "@/lib/notification-pause";

const CHIP_ROW = "h-7 rounded-lg px-2.5 text-[11px]";
const CHIP_CARD = "h-[30px] rounded-[10px] px-3 text-[12px]";
const CHIP = "flex items-center whitespace-nowrap border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-focus)] hover:text-[var(--text-primary)] disabled:opacity-50";

function LaterChips({ onPick, look }: { onPick: (until: string) => void; look: "row" | "card" }) {
  const { t } = useTranslation(notifMoreT);
  return (
    <>
      {LATER_CHOICES.map((c) => (
        <button
          key={c}
          type="button"
          data-kx-keep-hover
          onClick={(e) => { e.stopPropagation(); onPick(laterUntil(c)); }}
          className={`${CHIP} ${look === "card" ? CHIP_CARD : CHIP_ROW}`}
        >
          {t(`later.${c}`)}
        </button>
      ))}
    </>
  );
}

/** The ⋯ panel under a row. Clicks and keys stay inside it. */
export function MorePanel({ later, onSnooze, onUnsnooze, onMute, onDone }: {
  /** The center's Later view: a new time, or back now. */
  later: boolean;
  onSnooze?: (until: string) => void;
  onUnsnooze?: () => void;
  /** Present when the row is about a topic that can be muted. */
  onMute?: () => Promise<boolean>;
  onDone: () => void;
}) {
  const { t } = useTranslation(notifMoreT);
  const { t: tUi } = useTranslation(notifUiT);
  const [mute, setMute] = useState<"idle" | "busy" | "done" | "failed">("idle");
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  async function muteIt() {
    if (!onMute || mute === "busy") return;
    setMute("busy");
    const ok = await onMute();
    setMute(ok ? "done" : "failed");
    if (ok) window.setTimeout(onDone, 1800);
  }
  return (
    <div className="mt-2 space-y-1.5" onClick={stop} onKeyDown={stop}>
      {mute !== "done" && (
        <p className="text-[11px] text-[var(--text-dim)]">{later ? t("later.again") : tUi("later.title")}</p>
      )}
      {mute !== "done" && (
        <div className="flex flex-wrap items-center gap-1.5">
          {onSnooze && <LaterChips look="row" onPick={(until) => { onSnooze(until); onDone(); }} />}
          {later && onUnsnooze && (
            <button
              type="button"
              data-kx-keep-hover
              onClick={() => { onUnsnooze(); onDone(); }}
              className="h-7 whitespace-nowrap rounded-lg bg-[var(--bg-inverted)] px-2.5 text-[11px] font-medium text-[var(--text-inverted)] transition-opacity hover:opacity-90"
            >
              {t("later.now")}
            </button>
          )}
        </div>
      )}
      {onMute && (
        mute === "done" ? (
          <p role="status" className="text-[11px] font-medium text-[var(--text-secondary)]">{t("mute.done")}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-kx-keep-hover
              onClick={() => void muteIt()}
              disabled={mute === "busy"}
              className={`${CHIP} ${CHIP_ROW}`}
            >
              {t("mute.this")}
            </button>
            {mute === "failed" && <span role="alert" className="text-[11px] font-medium text-red-500">{t("mute.failed")}</span>}
          </div>
        )
      )}
    </div>
  );
}

/** The card's Later: the choices; picking one hands back when it returns,
 *  in words, for the card's ✓. */
export function CardLater({ onPick }: { onPick: (until: string, word: string) => void }) {
  const { t } = useTranslation(notifMoreT);
  const { t: tUi } = useTranslation(notifUiT);
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      <LaterChips look="card" onPick={(until) => onPick(until, t("later.done").replace("{time}", clockText(new Date(until), false, tUi("pause.tomorrow"))))} />
    </div>
  );
}

type TFn = (key: string, fallback?: string) => string;

/** The three choices, each with when it would end — from the clock as the
 *  menu opens. */
function pauseChoices(t: TFn, tomorrow: string, twelveHour: boolean): Array<{ key: PauseChoice; label: string; note: string }> {
  return [
    { key: "hour", label: t("pause.hour"), note: clockText(new Date(Date.now() + 3_600_000), twelveHour, tomorrow) },
    { key: "morning", label: t("pause.morning"), note: clockText(nextMorning(), twelveHour, tomorrow) },
    { key: "meeting", label: t("pause.meeting"), note: t("pause.meetingNote") },
  ];
}

/** The header's pause choices, each with when it would end. */
export function PauseMenu({ twelveHour, busy, failed, onPick }: {
  twelveHour: boolean; busy: boolean; failed: boolean; onPick: (c: PauseChoice) => void;
}) {
  const { t } = useTranslation(notifMoreT);
  const { t: tUi } = useTranslation(notifUiT);
  const choices = pauseChoices(t, tUi("pause.tomorrow"), twelveHour);
  return (
    <div role="menu" aria-label={tUi("pause.button")} className="mx-3 mb-2 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <p className="px-3 pb-1 pt-2 text-[10.5px] leading-snug text-[var(--text-dim)]">{t("pause.hint")}</p>
      {choices.map((c) => (
        <button
          key={c.key}
          type="button"
          role="menuitem"
          data-kx-keep-hover
          onClick={() => onPick(c.key)}
          disabled={busy}
          className="flex w-full items-center gap-2 px-3 py-2 text-start text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface-hover)] disabled:opacity-50"
        >
          <span className="min-w-0 flex-1">{c.label}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-dim)]">{c.note}</span>
        </button>
      ))}
      {failed && <p role="alert" className="px-3 pb-2 text-[11px] font-medium text-red-500">{tUi("pause.failed")}</p>}
    </div>
  );
}
