"use client";

/* ---------------------------------------------------------------------------
   VoiceCallScreen — the call itself, not a button with a call behind it.

   WHY A SCREEN AND NOT A TOGGLE. A live call is a mode: the microphone is
   open, the far side may speak at any moment, and the composer underneath is
   not what the user is doing. A 36px button in a toolbar communicates none of
   that, which is what "I'm not satisfied with the interface" was about. This
   takes the screen for as long as the call lasts and gives it back on hang-up.

   THE ORB IS NOT NEW. `AIOrb` already had `listening` and `speaking` states
   and already accepted an `audioLevel` — the whole vocabulary existed and
   nothing was driving it. Bringing in an outside orb would have added a
   dependency, a second visual language, and a shape that does not belong to
   Koleex, to replace something already built for it.

   BRAND. Monochrome with one blue accent; spacing on the 8px grid; outline
   icons at a consistent stroke; no decorative colour. The single red is the
   functional danger colour and is used only on the control that ends the call.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import AIOrb from "@/components/ai-orb/AIOrb";
import type { AIOrbState } from "@/components/ai-orb/ai-orb-types";
import VoiceTranscript from "@/components/ai/VoiceTranscript";
import { type TranscriptLine, type VoicePhase } from "@/lib/voice/events";
import { type ProductPhoto } from "@/lib/voice/photos";
import { type Lang } from "@/lib/i18n";

const COPY: Record<Lang, {
  connecting: string;
  reconnecting: string;
  listening: string;
  speaking: string;
  ready: string;
  end: string;
  mute: string;
  unmute: string;
  muted: string;
  searching: string;
  title: string;
  hint: string;
  voice: string;
  /* SHORT FORMS FOR THE LABELS UNDER THE CONTROLS. Not the aria-labels: those
     say what the control DOES ("Unmute microphone") because a screen reader
     user has no icon to read. These name the control the way a phone does —
     one or two words that survive being set at 11px under a 56px circle. */
  micShort: string;
  endShort: string;
  /* THE TYPED LANE INSIDE THE CALL. A placeholder, the send control's name,
     and what the screen says when text was typed before the call was up. */
  typePlaceholder: string;
  sendTyped: string;
  typedNotLive: string;
  /* The group name for the photo strip, and the alt text when a product has
     no name — a screen reader should hear what the pictures are. */
  photos: string;
}> = {
  en: {
    connecting: "Connecting…",
    reconnecting: "Connection unstable — reconnecting…",
    listening: "Listening",
    speaking: "Speaking",
    ready: "Go ahead",
    end: "End call",
    mute: "Mute microphone",
    unmute: "Unmute microphone",
    muted: "Microphone off",
    searching: "Looking it up…",
    title: "Voice call",
    hint: "Speak, then pause. There is no button to hold.",
    voice: "Voice",
    micShort: "Mic",
    endShort: "End",
    typePlaceholder: "Type something into the call…",
    sendTyped: "Send typed message",
    typedNotLive: "The call is still connecting — try again in a moment.",
    photos: "Product photos",
  },
  zh: {
    connecting: "正在连接…",
    reconnecting: "网络不稳定，正在重新连接…",
    listening: "正在聆听",
    speaking: "正在回答",
    ready: "请讲",
    end: "结束通话",
    mute: "关闭麦克风",
    unmute: "打开麦克风",
    muted: "麦克风已关闭",
    searching: "正在查询…",
    title: "语音通话",
    hint: "说完后停顿一下，无需按住任何按键。",
    voice: "音色",
    micShort: "麦克风",
    endShort: "结束",
    typePlaceholder: "在通话中输入文字…",
    sendTyped: "发送文字",
    typedNotLive: "通话仍在连接中，请稍后再试。",
    photos: "产品图片",
  },
  ar: {
    connecting: "جارٍ الاتصال…",
    reconnecting: "الشبكة مش ثابتة — بنحاول نرجّع الاتصال…",
    listening: "بيسمعك",
    speaking: "بيتكلم",
    ready: "اتفضّل",
    end: "إنهاء المكالمة",
    mute: "اكتم الميكروفون",
    unmute: "شغّل الميكروفون",
    muted: "الميكروفون مقفول",
    searching: "بدوّر على المعلومة…",
    title: "مكالمة صوتية",
    hint: "اتكلم وبعدين اسكت شوية. مفيش زرار تفضل ضاغط عليه.",
    voice: "الصوت",
    micShort: "مايك",
    endShort: "إنهاء",
    typePlaceholder: "اكتب حاجة في المكالمة…",
    sendTyped: "ابعت الرسالة المكتوبة",
    typedNotLive: "المكالمة لسه بتتصل — حاول كمان لحظة.",
    photos: "صور المنتج",
  },
};

export type VoiceCallScreenProps = {
  /** False while connecting — the orb wakes rather than pretending to listen. */
  live: boolean;
  /** The call is up but the network dropped underneath it and may come back.
   *  ITS OWN FLAG, not a shade of `live`: the screen must keep standing (the
   *  microphone is still held and the call is not over) while telling the user
   *  the truth, which "Listening" would not. */
  reconnecting?: boolean;
  phase: VoicePhase;
  /** 0..1 from whichever side is currently making sound. */
  audioLevel: number;
  lines: readonly TranscriptLine[];
  lang?: Lang;
  onEnd: () => void;
  /** Nothing you say is transmitted. The microphone stays open — see
   *  VoiceSession.setMuted for why that is the honest arrangement. */
  muted?: boolean;
  onToggleMute?: () => void;
  /** A lookup is running. Two seconds of silence on a call reads as a freeze;
   *  this is the difference between waiting and wondering. */
  searching?: boolean;
  /** What the last lookup showed: product photos, https only, at most a
   *  handful. Empty draws nothing. */
  photos?: readonly ProductPhoto[];
  /** Keys and labels only — the server's catalogue, never the vendor's ids.
   *  Empty means no picker is drawn: a control that cannot be used is noise. */
  voices?: readonly { key: string; label: string }[];
  selectedVoice?: string | null;
  /** Changing a voice restarts the call: the configuration is sent once per
   *  session, so a new one needs a new session. Said plainly in the UI rather
   *  than silently doing nothing until the next call. */
  onSelectVoice?: (key: string) => void;
  /** Type into the call. Returns whether it went — false while the channel is
   *  not up yet, which the screen says rather than swallowing the text. Absent
   *  means no composer is drawn. */
  onSendText?: (text: string) => boolean;
};

export default function VoiceCallScreen({
  live,
  reconnecting = false,
  phase,
  audioLevel,
  lines,
  lang = "en",
  onEnd,
  muted = false,
  onToggleMute,
  searching = false,
  photos = [],
  voices = [],
  selectedVoice = null,
  onSelectVoice,
  onSendText,
}: VoiceCallScreenProps) {
  const copy = COPY[lang];
  const [typed, setTyped] = useState("");
  const [typedNotice, setTypedNotice] = useState<string | null>(null);
  const typedRef = useRef<HTMLInputElement | null>(null);

  /* Escape ends the call. A full-screen mode with no keyboard exit is a trap,
     and this one is holding the microphone open.

     EXCEPT INSIDE THE COMPOSER. Escape while typing means "leave the field",
     on every keyboard on every platform; ending a live call because someone
     backed out of a text box would be the worst surprise on this screen. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (typedRef.current && e.target === typedRef.current) {
        typedRef.current.blur();
        return;
      }
      onEnd();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEnd]);

  const submitTyped = () => {
    const text = typed.trim();
    if (!text || !onSendText) return;
    if (onSendText(text)) {
      setTyped("");
      setTypedNotice(null);
    } else {
      /* Kept in the box. The text is theirs and the call will be up shortly;
         losing it would make them type it again. */
      setTypedNotice(copy.typedNotLive);
    }
  };

  /* The orb's own vocabulary, mapped from the call's. `awakening` while
     connecting is honest: it is starting, not yet hearing anything.

     A LIVE CALL DEFAULTS TO `listening`, and the first version's `idle` was
     the bug behind "the orb didn't move at all". AIOrb only feeds `audioLevel`
     into its motion while the state is listening or speaking — anything else
     pins the level to zero — so an orb parked on `idle` until the far side
     happened to send a speech event was a still orb for the whole call, or
     for ever if that event never came.

     `listening` is also simply true: the microphone is open from the moment
     the call connects. That is what listening means. */
  const orbState: AIOrbState = !live || reconnecting
    ? "awakening"
    : phase === "speaking"
      ? "speaking"
      /* MUTED IS NOT LISTENING. AIOrb feeds audioLevel into its motion only
         while listening or speaking, so leaving it on "listening" would leave
         an orb reacting to a microphone whose audio goes nowhere — the same
         class of lie as the caption above. */
      : muted
        ? "idle"
        : "listening";

  /* The CAPTION keeps the three-way distinction the orb does not need: the orb
     shows that it is live and reacting, while the words can still say whether
     anyone has spoken yet. */
  const status = searching && live && !reconnecting && !muted
    /* Above listening, below muted and reconnecting: those two are about
       whether the call works at all, and this one is only about why it is
       quiet right now. */
    ? copy.searching
    : muted && live && !reconnecting
    /* OUTRANKS listening/speaking. A user who forgot they muted, told
       "Listening", concludes the product is broken — and they are right to,
       because the screen said it was hearing them and it was not. */
    ? copy.muted
    : reconnecting
    ? copy.reconnecting
    : !live
    ? copy.connecting
    : phase === "speaking"
      ? copy.speaking
      : phase === "listening"
        ? copy.listening
        : copy.ready;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      /* ABOVE THE APP CHROME, and it was not.

         z-50 put this UNDER the main header (z-100) and under the floating
         panel's dock button (z-90), so a call ran with the Hub's header bar
         across the top of it and a stray chevron sitting on the transcript.
         The orb was clipped by a header belonging to the page underneath. A
         thing that declares aria-modal="true" and then lets other chrome
         punch through it is not a modal — it is a div that covers most of
         the screen.

         200 is where this codebase's real dialogs live (SignInHelpDialog),
         above the header and the dock. Deliberately BELOW ConfirmDialog's
         300: a confirmation raised during a call has to be readable over it. */
      className="fixed inset-0 z-[200] flex flex-col bg-[#0D0D0D] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Orb — the centre of the screen, because it is the centre of the
          interaction. Sized generously: this is the one moment the orb is the
          interface rather than an ornament beside text. */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 min-h-0">
        {/* A REACTIVE HALO AROUND THE ORB, and why it is not decoration.

            AIOrb's own audio response is a 3% scale — tuned for the 38px
            avatar beside a chat bubble, where 3% is plenty. At 200px on a
            screen a user is staring at for a whole call, the same 3% reads as
            "nothing is happening", which is what was reported. Rather than
            change the shared orb's motion — it is drawn in five other places
            and they are all correctly tuned — the call screen adds its own
            ring, which exists only here.

            It is feedback, not ornament: it is how a user knows the
            microphone is hearing them. Monochrome, so it introduces no
            colour. */}
        <div className="relative shrink-0 flex items-center justify-center">
          <div
            aria-hidden
            className="absolute rounded-full border border-white/20 transition-opacity duration-150"
            style={{
              width: 200,
              height: 200,
              transform: `scale(${(1 + audioLevel * 0.35).toFixed(3)})`,
              opacity: live ? 0.15 + audioLevel * 0.5 : 0,
            }}
          />
          <AIOrb
            state={orbState}
            audioLevel={audioLevel}
            size={200}
            interactive
            className="shrink-0"
          />
        </div>

        {/* Status — one line, quiet. The orb already says most of this; the
            text is for anyone who cannot read motion. */}
        <p
          className="text-sm font-normal tracking-wide text-[#AAAAAA]"
          aria-live="polite"
        >
          {status}
        </p>
      </div>

      {/* THE PRODUCT, SHOWN. A lookup that returned photos puts them here,
          under the orb and above the words: the caller hears "the KX-180"
          and sees it. Thumbnails on the 8px grid, the same hairline border
          as every control on this screen, the name under each in the same
          quiet grey as the labels. No lightbox: a call is not the place to
          study a picture, and the saved message carries it full size. */}
      {photos.length > 0 && (
        <div className="shrink-0 px-6 pb-4" role="group" aria-label={copy.photos}>
          <div className="max-w-[820px] mx-auto flex items-start justify-center gap-4 overflow-x-auto">
            {photos.map((p) => (
              <figure key={p.url} className="shrink-0 w-28 m-0">
                {/* Remote product photos from whatever host the catalogue names — next/image needs a fixed allowlist. Same call as Bubble. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.label || copy.photos}
                  loading="lazy"
                  decoding="async"
                  className="block w-28 h-28 object-cover rounded-2xl border border-white/20 bg-white/[0.04]"
                />
                {p.label && (
                  <figcaption className="mt-2 text-center text-[11px] leading-snug text-[#AAAAAA] truncate" title={p.label}>
                    {p.label}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </div>
      )}

      {/* Voice picker — only when the owner has configured a catalogue. Plain
          text buttons rather than a dropdown: two or three options read faster
          than a control you have to open, and the brand's icon system has no
          chevron worth adding for this. */}
      {voices.length > 0 && (
        <div className="shrink-0 flex flex-wrap items-center justify-center gap-2 px-6 pb-4">
          <span className="text-[11px] uppercase tracking-wide text-[#666666]">{copy.voice}</span>
          {voices.map((v) => {
            const on = v.key === selectedVoice;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => onSelectVoice?.(v.key)}
                aria-pressed={on}
                /* SAME BUTTON FAMILY AS THE CONTROLS BELOW: same border
                   value, same press feedback, same focus ring. It used to be
                   24px tall with a border nobody could see — a control on a
                   touch screen that you had to aim at. 40px is the grid step
                   that is also a thumb. */
                className={`h-10 px-4 rounded-full text-xs inline-flex items-center transition-[background-color,color,border-color,transform] duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D] ${
                  on
                    ? "bg-white text-[#0D0D0D] border border-white"
                    : "text-[#AAAAAA] hover:text-white border border-white/20 hover:border-white/30 bg-white/[0.04] hover:bg-white/[0.08]"
                }`}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Captions, above the control so the eye travels orb → words → button. */}
      <div className="shrink-0 pb-6">
        {lines.length > 0 ? (
          <VoiceTranscript lines={lines} lang={lang} className="pb-6" />
        ) : (
          /* Told once, plainly: server-side turn detection has no push-to-talk,
             and a user waiting for a button to hold will wait forever. */
          <p className="max-w-[820px] mx-auto px-6 pb-6 text-center text-xs text-[#666666]">
            {copy.hint}
          </p>
        )}

        {/* ── TYPE INTO THE CALL ────────────────────────────────────────
            A model code, a quantity, a name in another alphabet: some things
            are easier typed than said. One pill on the 8px grid, the same
            border family as every other control here, the send button
            inverted only once there is something to send — a control that
            cannot be used should not look ready. Not a textarea: this is a
            line into a conversation, not a document. */}
        {onSendText && (
          <form
            className="max-w-[820px] mx-auto px-6 pb-6"
            onSubmit={(e) => {
              e.preventDefault();
              submitTyped();
            }}
          >
            <div className="flex items-center gap-2 h-12 pl-4 pr-1.5 rounded-full border border-white/20 bg-white/[0.04] focus-within:border-white/40 transition-colors">
              <input
                ref={typedRef}
                type="text"
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value);
                  if (typedNotice) setTypedNotice(null);
                }}
                placeholder={copy.typePlaceholder}
                aria-label={copy.typePlaceholder}
                enterKeyHint="send"
                autoComplete="off"
                className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-[#666666] outline-none"
              />
              <button
                type="submit"
                disabled={!typed.trim()}
                aria-label={copy.sendTyped}
                title={copy.sendTyped}
                className="h-9 w-9 rounded-full inline-flex items-center justify-center shrink-0 bg-white text-[#0D0D0D] disabled:bg-white/[0.08] disabled:text-[#666666] transition-[background-color,color,transform] duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D]"
              >
                <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="6 11 12 5 18 11" />
                </svg>
              </button>
            </div>
            {typedNotice && (
              <p role="status" className="mt-2 text-center text-xs text-[#AAAAAA]">
                {typedNotice}
              </p>
            )}
          </form>
        )}

        {/* ── THE CONTROLS ───────────────────────────────────────────────
            WHAT WAS WRONG WITH THEM. Two bare circles with no labels, a mute
            whose border (#2E2E2E on #0D0D0D) was very nearly invisible, and
            two icons that were each a correct glyph with a line ruled across
            the whole 24px box. That line is not a strike-through — it is a
            diagonal over the top of a drawing, and at 20px it reads as
            damage rather than state. On the end-call button it also said the
            wrong thing: a handset with a line through it is the icon for a
            call that FAILED, and this is the button you press when the call
            went fine and you are done.

            Both icons are now the real glyphs. Mic-off is drawn broken around
            its slash, the way the shape is meant to be cut, so the diagonal
            is part of the letterform instead of graffiti on it. End-call is
            the handset turned down — the gesture of hanging up, universal on
            every phone since they had cradles, and unambiguous inside a red
            circle without needing any line at all.

            LABELS, because an unlabelled icon pair is a guess. A caller who
            has never been on this screen should not have to find out what
            the grey circle does by pressing it while someone is listening. */}
        <div className="flex items-end justify-center gap-8">
          {onToggleMute && (
            <div className="flex flex-col items-center gap-2">
              {/* MUTE. Monochrome: it is not destructive, so it does not get
                  the red, and it is not the primary action, so it does not
                  get the size. `aria-pressed` rather than a second label, so
                  a screen reader hears one control with a state. */}
              <button
                type="button"
                onClick={onToggleMute}
                aria-pressed={muted}
                aria-label={muted ? copy.unmute : copy.mute}
                title={muted ? copy.unmute : copy.mute}
                className={`h-14 w-14 rounded-full inline-flex items-center justify-center border transition-[background-color,color,border-color,transform] duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D] ${
                  muted
                    /* FILLED WHEN OFF, and that is the louder of the two
                       states on purpose: muted is the one a caller forgets
                       they are in and then talks into nothing. */
                    ? "bg-white text-[#0D0D0D] border-white"
                    : "text-[#AAAAAA] hover:text-white border-white/20 hover:border-white/30 bg-white/[0.04] hover:bg-white/[0.08]"
                }`}
              >
                {muted ? (
                  /* Cut around the slash — one glyph, not a drawing with a
                     line over it. */
                  <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 9.5V5a3 3 0 0 0-5.86-.88" />
                    <path d="M9 9.9V12a3 3 0 0 0 4.6 2.54" />
                    <path d="M18.4 13.4A7 7 0 0 0 19 10.5" />
                    <path d="M5 10.5V12a7 7 0 0 0 10.9 5.8" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                    <line x1="4" y1="3.5" x2="20" y2="20.5" />
                  </svg>
                ) : (
                  <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10.5V12a7 7 0 0 0 14 0v-1.5" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                )}
              </button>
              {/* aria-hidden: the button above already carries the accessible
                  name, and a screen reader announcing both says it twice. */}
              <span aria-hidden className={`text-[11px] tracking-wide transition-colors ${muted ? "text-white" : "text-[#666666]"}`}>
                {copy.micShort}
              </span>
            </div>
          )}

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onEnd}
              aria-label={copy.end}
              title={copy.end}
              className="h-16 w-16 rounded-full inline-flex items-center justify-center bg-[#FF3333] text-white shadow-[0_4px_20px_-4px_rgba(255,51,51,0.5)] transition-[filter,transform] duration-150 hover:brightness-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D]"
            >
              {/* The handset turned down. Outline, same stroke family as the
                  mic so the pair reads as one icon set. */}
              <svg aria-hidden viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <g transform="rotate(135 12 12)">
                  <path d="M21 15.46v2.71a1.8 1.8 0 0 1-1.96 1.8 17.8 17.8 0 0 1-7.77-2.76 17.55 17.55 0 0 1-5.4-5.4A17.8 17.8 0 0 1 3.1 3.99 1.8 1.8 0 0 1 4.9 2.03h2.71a1.8 1.8 0 0 1 1.8 1.55c.11.86.32 1.71.63 2.52a1.8 1.8 0 0 1-.4 1.9L8.5 9.13a14.4 14.4 0 0 0 5.4 5.4l1.13-1.14a1.8 1.8 0 0 1 1.9-.4c.81.3 1.66.51 2.52.62a1.8 1.8 0 0 1 1.55 1.84z" />
                </g>
              </svg>
            </button>
            <span aria-hidden className="text-[11px] tracking-wide text-[#666666]">
              {copy.endShort}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
