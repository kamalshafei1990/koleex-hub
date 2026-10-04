"use client";

/* ---------------------------------------------------------------------------
   NotificationCards — a card for each new notification while the Hub is in
   front. Owner, 26/09: a card that "appears for a while then disappears, and
   if the user didn't open it, it can be in the notification bell" — and then
   "he can open the notification card and quick reply or do action on the
   same page he is in", so a Discuss message or an approval never pulls him
   off unsaved work. Design D (people first), chosen from four mockups the
   same day; "take care we have two styles aurora and core".

     · The app line on top: the app's icon and name, "just now", and "Needs
       you" when it waits on the reader; ✕ at the end.
     · Who it is from in a ring of initials — the ring is the countdown. A
       notification with no person shows the app's icon there.
     · Acting happens ON the card:
         Discuss   → reply in the card; "Open chat" opens the floating
                     Discuss panel on that conversation, over the same page.
         Approvals → the bell row's own decision (DecisionBar, card look):
                     approve, or refuse with its reason, both confirmed.
         Others    → "Open" goes to its page — the one action that leaves.
         Later     → the clock on the app line: an hour, three hours or
                     tomorrow 09:00; the notification leaves the bell until
                     then and comes back on top (lib/server/inbox-snooze).
     · It stays 12 s for "Needs you" and 6 s for anything else. It holds
       while pointed at, focused, or while a reply or a decision is under
       way.
     · Not opened in time, or closed with ✕: it flies back INTO the bell,
       still unread. Replied or decided: ✓, then it slides away and the count
       drops.
     · At most three; the rest fold into "+N more", which opens the bell.
     · Motion: a soft spring out of the bell's corner with the parts settling
       in order, the stack gliding (FLIP) when a card arrives or goes, and
       the flight home. Under reduced motion (the OS, or Settings → Display)
       none of it — cards simply appear and go.
     · Both skins wear the bell panel's own material, portalled with their
       own kx-app scope (canon H-5). Hub Blue only under Aurora; Core stays
       black and white.
   The bell decides WHETHER (per-activity switches, the conversation's
   setting, Settings → Notifications → Pop-up cards; quiet hours only silence
   the chime) and owns what the actions do. This file shows them.
   --------------------------------------------------------------------------- */

import { createContext, lazy, Suspense, useContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import BellIcon from "@/components/icons/ui/BellIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import BoundIcon from "@/components/common/BoundIcon";
import { APP_REGISTRY } from "@/lib/navigation";
import { DecisionBar } from "@/components/layout/NotificationList";

/* Later's choices load when the clock is first pressed (NotificationMore). */
const CardLater = lazy(() => import("./NotificationMore").then((m) => ({ default: m.CardLater })));
import { NotificationBody, NotificationSubject } from "@/components/layout/NotificationText";
import { defOf } from "@/lib/notification-view";
import { readTpl } from "@/lib/notification-templates";
import { decisionOf, type Verdict } from "@/lib/notification-decisions";
import { initialsOf } from "@/lib/discuss/initials";
import type { Lang } from "@/lib/i18n";
import type { InboxMessageWithSender } from "@/types/supabase";

export type NoticeCard =
  | { key: string; kind: "inbox"; action: boolean; row: InboxMessageWithSender }
  | { key: string; kind: "discuss"; channelId: string; title: string; body: string; author: string | null }
  /* Back after an absence (lib/notification-view awaySummary): one card for
     what came in meanwhile. */
  | { key: string; kind: "away"; needs: number; messages: number; updates: number; apps: string[] };

type TFn = (key: string, fallback?: string) => string;

/** How long a card stays, unless the reader is on it. */
export const CARD_MS = { action: 12_000, other: 6_000, more: 8_000 } as const;
/** How many cards stand at once; the rest fold into "+N more". */
export const CARD_MAX = 3;

/** Less motion: the OS setting, or the Hub's own (Settings → Display). */
export function lessMotion(): boolean {
  if (typeof window === "undefined") return true;
  return document.documentElement.classList.contains("kx-reduce-motion")
    || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

const GLIDE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const RING = 2 * Math.PI * 18;

export default function NotificationCards({
  cards, more, lang, tHub, tUi, aurora, bellRef,
  onOpen, onOpenChat, onReply, onDecided, onLater, onAway, onGone, onReturned, onMore, onMoreGone,
}: {
  cards: NoticeCard[];
  more: number;
  lang: Lang;
  tHub: TFn;
  tUi: TFn;
  aurora: boolean;
  /** Where an unopened card flies home to. */
  bellRef: RefObject<HTMLElement | null>;
  onOpen: (card: Extract<NoticeCard, { kind: "inbox" }>) => void;
  onOpenChat: (channelId: string) => void;
  onReply: (card: Extract<NoticeCard, { kind: "discuss" }>, text: string) => Promise<boolean>;
  onDecided: (card: Extract<NoticeCard, { kind: "inbox" }>, verdict: Verdict) => void;
  /** Later: put the notification off until `until`. */
  onLater: (card: Extract<NoticeCard, { kind: "inbox" }>, until: string) => void;
  /** The away summary's "Show me": the bell, on what needs the reader. */
  onAway: (card: Extract<NoticeCard, { kind: "away" }>) => void;
  onGone: (key: string) => void;
  onReturned: () => void;
  onMore: () => void;
  onMoreGone: () => void;
}) {
  /* FLIP: when a card arrives or goes, the others glide to their new place
     instead of jumping. Measured after every commit, by LAYOUT position
     (offsetTop), never the painted box: a card still springing in, or
     already gliding, would otherwise be measured mid-flight and the stack
     would chase a wrong offset — seen on the first run, a card sitting over
     the one above it. */
  const els = useRef(new Map<string, HTMLDivElement>());
  const tops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    for (const [k, el] of els.current) {
      if (!el.isConnected) { els.current.delete(k); continue; }
      next.set(k, el.offsetTop);
    }
    if (!lessMotion()) {
      for (const [k, top] of next) {
        const was = tops.current.get(k);
        if (was !== undefined && Math.abs(was - top) > 0.5) {
          els.current.get(k)?.animate([{ transform: `translateY(${was - top}px)` }, { transform: "none" }], { duration: 380, easing: GLIDE });
        }
      }
    }
    tops.current = next;
  });
  const register = (key: string) => (el: HTMLDivElement | null) => {
    if (el) els.current.set(key, el);
    else els.current.delete(key);
  };

  if (typeof document === "undefined") return null;
  const discussApp = APP_REGISTRY.find((a) => a.id === "discuss");
  return createPortal(
    <div
      aria-live="polite"
      aria-label={tHub("notif.title")}
      /* RIGHT, not "end": the header does not mirror in Arabic — the bell
         stays at the top right — and the cards belong under the bell. */
      className="pointer-events-none fixed top-[calc(var(--kx-header-h,56px)+8px)] z-[190] flex flex-col gap-2 max-md:inset-x-2 md:right-3 md:w-[348px]"
    >
      {cards.map((c) =>
        c.kind === "inbox" ? (
          <InboxCard key={c.key} card={c} lang={lang} tHub={tHub} tUi={tUi} aurora={aurora} bellRef={bellRef}
            register={register(c.key)} onOpen={() => onOpen(c)} onDecided={(v) => onDecided(c, v)}
            onLater={(until) => onLater(c, until)} onGone={() => onGone(c.key)} onReturned={onReturned} />
        ) : c.kind === "away" ? (
          <Card key={c.key} ms={CARD_MS.action} aurora={aurora} tUi={tUi} bellRef={bellRef} register={register(c.key)}
            onGone={() => onGone(c.key)} onReturned={onReturned}
            app={{ name: tHub("notif.title"), icon: <BellIcon size={12} /> }} now={null} chip={null}
            face={<BellIcon size={14} />}
            head={<span className="font-medium">{tUi("away.title")}</span>}
            body={
              <>
                <p className="mt-0.5 text-[12.5px] font-medium tabular-nums leading-snug text-[var(--text-primary)]">
                  {[
                    c.needs ? tUi("away.needs").replace("{n}", String(c.needs)) : null,
                    c.messages ? tUi("away.messages").replace("{n}", String(c.messages)) : null,
                    c.updates ? tUi("away.updates").replace("{n}", String(c.updates)) : null,
                  ].filter(Boolean).join(" · ")}
                </p>
                {c.apps.length > 0 && (
                  <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
                    {c.apps.map((id) => { const a = APP_REGISTRY.find((x) => x.id === id); return a ? tHub(a.tKey, a.name) : id; }).join(" · ")}
                  </p>
                )}
              </>
            }
            actions={<OpenAction label={tUi("away.show")} onOpen={() => onAway(c)} />}
          />
        ) : (
          <Card key={c.key} ms={CARD_MS.other} aurora={aurora} tUi={tUi} bellRef={bellRef} register={register(c.key)}
            onGone={() => onGone(c.key)} onReturned={onReturned}
            app={{ name: discussApp ? tHub(discussApp.tKey, discussApp.name) : "Discuss", icon: <AppIcon appId="discuss" /> }}
            now={tHub("notif.justNow")} chip={null}
            face={initialsOf(c.author || c.title)}
            head={<><span className="font-medium">{c.author || c.title}</span>{c.author && <span className="text-[var(--text-muted)]"> · {c.title}</span>}</>}
            /* A person's words keep their own direction: an English message
               in the Arabic Hub must not throw its "?" to the start. */
            body={<p dir="auto" className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-[var(--text-primary)]">{c.body}</p>}
            actions={<ReplyBox tUi={tUi} onSend={(text) => onReply(c, text)} onOpenChat={() => onOpenChat(c.channelId)} />}
          />
        ),
      )}
      {more > 0 && (
        <Card key="more" ms={CARD_MS.more} aurora={aurora} tUi={tUi} bellRef={bellRef} register={register("more")}
          onGone={onMoreGone} onReturned={onReturned}
          app={{ name: tHub("notif.title"), icon: <BellIcon size={12} /> }} now={null} chip={null}
          face={<BellIcon size={14} />}
          head={<span className="font-medium">{tUi("card.more").replace("{n}", String(more))}</span>}
          body={null}
          actions={<OpenAction label={tUi("card.moreSub")} onOpen={onMore} />}
        />
      )}
    </div>,
    document.body,
  );
}

/* A work notification: its words through the bell's own renderer, its
   decision through the bell's own DecisionBar. */
function InboxCard({ card, lang, tHub, tUi, aurora, bellRef, register, onOpen, onDecided, onLater, onGone, onReturned }: {
  card: Extract<NoticeCard, { kind: "inbox" }>;
  lang: Lang; tHub: TFn; tUi: TFn; aurora: boolean;
  bellRef: RefObject<HTMLElement | null>;
  register: (el: HTMLDivElement | null) => void;
  onOpen: () => void; onDecided: (v: Verdict) => void; onLater: (until: string) => void; onGone: () => void; onReturned: () => void;
}) {
  const meta = card.row.metadata;
  const appId = defOf(meta)?.app;
  const app = appId ? APP_REGISTRY.find((a) => a.id === appId) : undefined;
  const p = readTpl(meta)?.p ?? {};
  const person = [p.actor, p.who, p.author, p.from, p.by].find((v): v is string => typeof v === "string" && !!v.trim());
  const spec = decisionOf(meta);
  return (
    <Card ms={card.action ? CARD_MS.action : CARD_MS.other} aurora={aurora} tUi={tUi} bellRef={bellRef} register={register}
      onGone={onGone} onReturned={onReturned} onLater={onLater}
      app={{ name: app ? tHub(app.tKey, app.name) : tHub("notif.title"), icon: appId ? <AppIcon appId={appId} /> : <BellIcon size={12} /> }}
      now={tHub("notif.justNow")}
      chip={card.action ? tUi("tab.action") : null}
      face={person ? initialsOf(person) : appId ? <AppIcon appId={appId} size={15} /> : <BellIcon size={14} />}
      head={<span className="font-medium"><NotificationSubject meta={meta} subject={card.row.subject} lang={lang} plain /></span>}
      body={<NotificationBody meta={meta} body={card.row.body} lang={lang} plain className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[var(--text-muted)]" />}
      actions={spec
        ? <DecideAction meta={meta} tUi={tUi} onDecided={onDecided}
            word={(v) => v === "approve" ? (spec.single === "handled" ? tUi("dec.handled") : tUi("dec.approved")) : v === "reject" ? tUi("dec.rejected") : tUi("dec.returned")} />
        : <OpenAction label={tUi("detail.openLink")} onOpen={onOpen} />}
    />
  );
}

/* What the card lends its actions: hold the timer, finish, or leave. Handed
   down through context so an action stays a plain component (its own state
   — a half-typed reply — survives the card re-rendering). */
const CtlCtx = createContext<Ctl | null>(null);
function useCtl(): Ctl {
  const c = useContext(CtlCtx);
  if (!c) throw new Error("card action outside a card");
  return c;
}

function DecideAction({ meta, tUi, onDecided, word }: {
  meta: unknown; tUi: TFn; onDecided: (v: Verdict) => void; word: (v: Verdict) => string;
}) {
  const ctl = useCtl();
  return <DecisionBar look="card" meta={meta} tUi={tUi} onModeChange={ctl.setBusy} onDecided={(v) => { onDecided(v); ctl.done(word(v)); }} />;
}

function OpenAction({ label, onOpen }: { label: string; onOpen: () => void }) {
  const ctl = useCtl();
  return (
    <div className="mt-2.5 flex">
      <Btn kind="sec" onClick={() => { onOpen(); ctl.leave(); }}>{label}</Btn>
    </div>
  );
}

type Ctl = {
  /** Hold the timer while a reply or a decision is under way. */
  setBusy: (busy: boolean) => void;
  /** Done here: show ✓ with the word, then slide away. */
  done: (word: string) => void;
  /** Leaving for something else (a page, the chat panel): slide away now. */
  leave: () => void;
};

function Card({ ms, aurora, tUi, bellRef, register, onGone, onReturned, onLater, app, now, chip, face, head, body, actions }: {
  ms: number; aurora: boolean; tUi: TFn;
  /** Offers "Later" (the clock on the app line). */
  onLater?: (until: string) => void;
  bellRef: RefObject<HTMLElement | null>;
  register: (el: HTMLDivElement | null) => void;
  onGone: () => void; onReturned: () => void;
  app: { name: string; icon: React.ReactNode };
  now: string | null; chip: string | null;
  face: React.ReactNode; head: React.ReactNode; body: React.ReactNode;
  actions: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const ring = useRef<SVGCircleElement | null>(null);
  const [held, setHeld] = useState(false);
  const [busy, setBusy] = useState(false);
  const [doneWord, setDoneWord] = useState<string | null>(null);
  const [laterOpen, setLaterOpen] = useState(false);
  const gone = useRef(false);
  /* Time left, spent only while nothing holds the card; the cleanup books
     what ran, so a hover pauses exactly where the ring stopped. */
  const left = useRef(ms);
  const running = !held && !busy && !laterOpen && doneWord === null;

  const cb = useRef({ onGone, onReturned });
  useEffect(() => { cb.current = { onGone, onReturned }; });

  /* Not opened in time, or closed: it flies home into the bell, unread. */
  const toBell = () => {
    if (gone.current) return;
    gone.current = true;
    const finish = () => { cb.current.onGone(); cb.current.onReturned(); };
    const el = root.current, bell = bellRef.current;
    if (!el || !bell || lessMotion()) { finish(); return; }
    const b = bell.getBoundingClientRect(), r = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (r.left + r.width / 2), dy = b.top + b.height / 2 - (r.top + r.height / 2);
    el.style.transformOrigin = "50% 50%";
    el.animate([
      { opacity: 1, transform: "none" },
      { opacity: 0.9, transform: `translate(${dx * 0.35}px, ${dy * 0.35}px) scale(0.7)`, offset: 0.45 },
      { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(0.08)` },
    ], { duration: 520, easing: "cubic-bezier(0.5, 0, 0.75, 0.2)", fill: "forwards" }).onfinish = finish;
  };
  /* Done with (replied, decided, opened elsewhere): it slides away. */
  const slideAway = () => {
    if (gone.current) return;
    gone.current = true;
    const el = root.current;
    if (!el || lessMotion()) { cb.current.onGone(); return; }
    el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(36px) scale(0.98)" }],
      { duration: 280, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" }).onfinish = () => cb.current.onGone();
  };
  const toBellRef = useRef(toBell);
  useEffect(() => { toBellRef.current = toBell; });

  useEffect(() => {
    const c = ring.current;
    const paint = (spent: number, dur: number) => {
      if (!c) return;
      c.style.transition = dur ? `stroke-dashoffset ${dur}ms linear` : "none";
      c.style.strokeDashoffset = String(RING * spent);
    };
    if (!running) { paint(1 - left.current / ms, 0); return; }
    const started = Date.now();
    /* Under reduced motion the ring stays full; the card still waits. */
    if (!lessMotion()) { paint(1 - left.current / ms, 0); void c?.getBoundingClientRect(); paint(1, left.current); }
    const t = window.setTimeout(() => toBellRef.current(), left.current);
    return () => { window.clearTimeout(t); left.current = Math.max(0, left.current - (Date.now() - started)); };
  }, [running, ms]);

  const ctl: Ctl = {
    setBusy,
    done: (word) => { setDoneWord(word); window.setTimeout(slideAway, 1100); },
    leave: slideAway,
  };
  const stroke = aurora ? "#567FB2" : "var(--text-primary)";

  return (
    <div
      ref={(el) => { root.current = el; register(el); }}
      data-kx-keep-hover
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); toBell(); } }}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false); }}
      style={{ ["--kx-pop-radius" as string]: "16px" }}
      className="kx-app kx-glass-pop kx-pop-panel kx-pop-clear kx-ncard-in pointer-events-auto relative px-3 pb-3 pt-2.5 outline-none"
    >
      {/* The app line: which app, when, and whether it waits on you. */}
      <div className="kx-ncard-part flex h-[22px] items-center gap-1.5 text-[11px] text-[var(--text-dim)]" style={{ animationDelay: "40ms" }}>
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ${aurora ? "bg-[#567FB2]/15 text-[#567FB2]" : "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]"}`}>
          {app.icon}
        </span>
        <span className="truncate font-medium text-[var(--text-muted)]">{app.name}</span>
        {now && <><span aria-hidden>·</span><span className="shrink-0">{now}</span></>}
        {chip && (
          <span className={`ms-1 inline-flex h-[18px] shrink-0 items-center rounded-full px-2 text-[10.5px] font-semibold ${aurora ? "bg-[#567FB2]/15 text-[#567FB2]" : "bg-[var(--bg-surface-strong)] text-[var(--text-secondary)]"}`}>
            {chip}
          </span>
        )}
        <span className="flex-1" />
        {onLater && doneWord === null && (
          <button
            type="button"
            data-kx-keep-hover
            aria-label={tUi("later.title")}
            aria-expanded={laterOpen}
            title={tUi("later.title")}
            onClick={() => setLaterOpen((v) => !v)}
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-md transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] ${laterOpen ? "bg-[var(--bg-surface-hover)] text-[var(--text-primary)]" : "text-[var(--text-faint)]"}`}
          >
            <ClockIcon size={11} />
          </button>
        )}
        <button
          type="button"
          data-kx-keep-hover
          aria-label={tUi("card.close")}
          title={tUi("card.close")}
          onClick={toBell}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--text-faint)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
        >
          <CrossIcon size={9} />
        </button>
      </div>
      <div className="mt-2 flex items-start gap-3">
        {/* Who it is from; the ring around them is the time left. */}
        <span className="kx-ncard-pop relative grid h-10 w-10 shrink-0 place-items-center" style={{ animationDelay: "110ms" }}>
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden className="absolute inset-0 -rotate-90">
            <circle cx="20" cy="20" r="18" fill="none" stroke="var(--border-subtle)" strokeWidth="2" />
            <circle ref={ring} cx="20" cy="20" r="18" fill="none" stroke={stroke} strokeOpacity={aurora ? 1 : 0.85} strokeWidth="2" strokeLinecap="round" strokeDasharray={RING} />
          </svg>
          <span className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] font-semibold text-[var(--text-primary)]">
            {face}
          </span>
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="kx-ncard-part truncate text-[13px] leading-snug text-[var(--text-primary)]" style={{ animationDelay: "150ms" }}>{head}</div>
          {body && <div className="kx-ncard-part" style={{ animationDelay: "190ms" }}>{body}</div>}
          <div className="kx-ncard-part" style={{ animationDelay: "240ms" }}>
            {doneWord !== null ? (
              <p role="status" className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)]">
                <CheckCircleIcon className={`h-3.5 w-3.5 ${aurora ? "text-[#567FB2]" : "text-[var(--text-primary)]"}`} />
                {doneWord}
              </p>
            ) : laterOpen && onLater ? (
              /* Later: the choices stand in for the card's actions. */
              <Suspense fallback={null}>
                <CardLater onPick={(until, word) => { onLater(until); setLaterOpen(false); ctl.done(word); }} />
              </Suspense>
            ) : <CtlCtx.Provider value={ctl}>{actions}</CtlCtx.Provider>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Discuss: answer without leaving the page. */
function ReplyBox({ tUi, onSend, onOpenChat }: {
  tUi: TFn; onSend: (text: string) => Promise<boolean>; onOpenChat: () => void;
}) {
  const ctl = useCtl();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setFailed(false);
    const ok = await onSend(body);
    setSending(false);
    if (ok) ctl.done(tUi("card.sent"));
    else setFailed(true);
  }
  return (
    <div className="mt-2.5">
      <div className="flex items-center gap-1.5">
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); ctl.setBusy(e.target.value.trim().length > 0); if (failed) setFailed(false); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          dir="auto"
          placeholder={tUi("card.replyPh")}
          aria-label={tUi("card.replyPh")}
          className="h-[30px] min-w-0 flex-1 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)] focus:border-[var(--border-focus)]"
        />
        <Btn kind="pri" icon onClick={() => void send()} label={tUi("card.send")} disabled={sending}>
          <PaperPlaneIcon size={14} className="rtl:-scale-x-100" />
        </Btn>
      </div>
      {failed && <p role="alert" className="mt-1 text-[11px] font-medium text-red-500">{tUi("card.sendFailed")}</p>}
      <div className="-ms-2 mt-1">
        <Btn kind="gho" onClick={() => { onOpenChat(); ctl.leave(); }}>{tUi("card.openChat")}</Btn>
      </div>
    </div>
  );
}

/* The Hub's button language (kds Button), at the card's size. */
function Btn({ kind, icon, label, disabled, onClick, children }: {
  kind: "pri" | "sec" | "gho"; icon?: boolean; label?: string; disabled?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  const look = {
    pri: "bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90",
    sec: "border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text-primary)]",
    gho: "text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]",
  }[kind];
  return (
    <button
      type="button"
      data-kx-keep-hover
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-[30px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] text-[12px] font-medium transition-colors disabled:opacity-50 ${icon ? "w-[30px]" : kind === "gho" ? "px-2" : "px-3"} ${look}`}
    >
      {children}
    </button>
  );
}

function AppIcon({ appId, size = 12 }: { appId: string; size?: number }) {
  const app = APP_REGISTRY.find((a) => a.id === appId);
  const Icon = app?.icon;
  if (!Icon) return <BellIcon size={size} />;
  return <BoundIcon semanticKey={`app.${appId}`} className={size > 12 ? "h-4 w-4" : "h-3 w-3"} fallback={<Icon size={size} />} />;
}
