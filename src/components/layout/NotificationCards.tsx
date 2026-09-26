"use client";

/* ---------------------------------------------------------------------------
   NotificationCards — a card for each new notification while the Hub is in
   front. Owner, 26/09: "popup notification cards … appear for a while then
   disappear, and if the user didn't open it, it can be in the notification
   bell". Mockup approved the same day; "take care we have two styles".

     · Only while the window is in front. Out of view, the desktop app's
       system notification (lib/desktop-toast) or the phone's push speaks —
       one voice per notification, never two.
     · It drops out of the bell like the bell's own panel (kx-pop-arrive):
       under the bell on a computer — top right in every language, since
       the header keeps the bell there in Arabic too — and full width under
       the header on a phone.
     · It stays 12 s for "Needs you" and 6 s for anything else. It holds
       while the pointer or the keyboard is on it, and a thin Hub-Blue line
       shows what is left.
     · Click opens it and marks it read (the bell row's own handler). ✕, or
       the time running out, only takes it off the screen: it stays unread
       in the bell.
     · At most three. The rest fold into "+N more", which opens the bell.
     · Both skins wear the bell panel's own material. Aurora gets the frost
       (kx-glass-pop + kx-pop-clear); Core gets the pop-panel shell.
       Portalled to <body>, so it carries its own kx-app scope (canon H-5).
   The bell decides WHETHER: the per-activity switches, the conversation's
   setting, and Settings → Notifications → Pop-up cards. Quiet hours only
   silence the chime; the card still appears. This file only shows them.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import BellIcon from "@/components/icons/ui/BellIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import { AppGlyph } from "@/components/layout/NotificationList";
import { NotificationBody, NotificationSubject } from "@/components/layout/NotificationText";
import type { Lang } from "@/lib/i18n";
import type { InboxMessageWithSender } from "@/types/supabase";

export type NoticeCard =
  | { key: string; kind: "inbox"; action: boolean; row: InboxMessageWithSender }
  | { key: string; kind: "discuss"; channelId: string; title: string; body: string };

type TFn = (key: string, fallback?: string) => string;

/** How long a card stays, unless the reader is on it. */
export const CARD_MS = { action: 12_000, other: 6_000, more: 8_000 } as const;
/** How many cards stand at once; the rest fold into "+N more". */
export const CARD_MAX = 3;
const EXIT_MS = 150;

export default function NotificationCards({
  cards, more, lang, tHub, tUi, onOpen, onDismiss, onMore, onMoreDismiss,
}: {
  cards: NoticeCard[];
  more: number;
  lang: Lang;
  tHub: TFn;
  tUi: TFn;
  onOpen: (card: NoticeCard) => void;
  onDismiss: (key: string) => void;
  onMore: () => void;
  onMoreDismiss: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      aria-live="polite"
      aria-label={tHub("notif.title")}
      /* RIGHT, not "end": the header does not mirror in Arabic — the bell
         stays at the top right — and the cards belong under the bell. */
      className="pointer-events-none fixed top-[calc(var(--kx-header-h,56px)+8px)] z-[190] flex flex-col gap-2 max-md:inset-x-2 md:right-3 md:w-[340px]"
    >
      {cards.map((c) => (
        <Card
          key={c.key}
          ms={c.kind === "inbox" && c.action ? CARD_MS.action : CARD_MS.other}
          tUi={tUi}
          onOpen={() => onOpen(c)}
          onGone={() => onDismiss(c.key)}
          glyph={c.kind === "inbox" ? <AppGlyph meta={c.row.metadata} tHub={tHub} /> : <Glyph><MessageSquareIcon size={15} /></Glyph>}
          title={c.kind === "inbox" ? <NotificationSubject meta={c.row.metadata} subject={c.row.subject} lang={lang} plain /> : c.title}
          body={c.kind === "inbox"
            ? <NotificationBody meta={c.row.metadata} body={c.row.body} lang={lang} plain className="line-clamp-1" />
            : c.body}
          chip={c.kind === "inbox" && c.action ? tUi("tab.action") : null}
          now={tHub("notif.justNow")}
        />
      ))}
      {more > 0 && (
        <Card
          key="more"
          ms={CARD_MS.more}
          tUi={tUi}
          onOpen={onMore}
          onGone={onMoreDismiss}
          glyph={<Glyph><BellIcon size={15} /></Glyph>}
          title={tUi("card.more").replace("{n}", String(more))}
          body={tUi("card.moreSub")}
          chip={null}
          now={null}
        />
      )}
    </div>,
    document.body,
  );
}

function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]">
      {children}
    </span>
  );
}

function Card({ ms, tUi, onOpen, onGone, glyph, title, body, chip, now }: {
  ms: number;
  tUi: TFn;
  onOpen: () => void;
  onGone: () => void;
  glyph: React.ReactNode;
  title: React.ReactNode;
  body: React.ReactNode;
  chip: string | null;
  now: string | null;
}) {
  const [held, setHeld] = useState(false);
  const [closing, setClosing] = useState(false);
  /* Time left, spent only while the card is not held. The effect's cleanup
     books what ran, so a hover pauses exactly where the line stopped. */
  const left = useRef(ms);
  const goneRef = useRef(onGone);
  useEffect(() => { goneRef.current = onGone; });

  function leave(then?: () => void) {
    if (closing) return;
    setClosing(true);
    then?.();
    window.setTimeout(() => goneRef.current(), EXIT_MS);
  }

  useEffect(() => {
    if (held || closing) return;
    const started = Date.now();
    const t = window.setTimeout(() => { setClosing(true); window.setTimeout(() => goneRef.current(), EXIT_MS); }, left.current);
    return () => { window.clearTimeout(t); left.current = Math.max(0, left.current - (Date.now() - started)); };
  }, [held, closing]);

  return (
    <div
      role="button"
      tabIndex={0}
      data-kx-keep-hover
      onClick={() => leave(onOpen)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); leave(onOpen); }
        if (e.key === "Escape") { e.preventDefault(); leave(); }
      }}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      /* Out of the bell's corner in both directions (kx-pop-arrive flips
         its origin under rtl; the bell does not move). */
      style={{ ["--kx-pop-radius" as string]: "14px", transformOrigin: "calc(100% - 24px) 0%" }}
      className={`kx-app kx-glass-pop kx-pop-panel kx-pop-clear pointer-events-auto relative flex cursor-pointer gap-3 px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[#567FB2]/60 ${closing ? "kx-pop-closing" : "kx-pop-arrive"}`}
    >
      {glyph}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--text-primary)]">{title}</span>
          {now && <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--text-dim)]">{now}</span>}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-[var(--text-dim)]">{body}</div>
        {chip && (
          <span className="mt-1.5 inline-block rounded-full bg-[#567FB2]/15 px-2 py-px text-[10.5px] font-semibold text-[#567FB2]">{chip}</span>
        )}
      </div>
      <button
        type="button"
        data-kx-keep-hover
        aria-label={tUi("card.close")}
        title={tUi("card.close")}
        onClick={(e) => { e.stopPropagation(); leave(); }}
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--text-faint)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
      >
        <CrossIcon size={9} />
      </button>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-[#567FB2] rtl:origin-right"
        style={{ animation: `kx-card-time ${ms}ms linear forwards`, animationPlayState: held || closing ? "paused" : "running" }}
      />
    </div>
  );
}
