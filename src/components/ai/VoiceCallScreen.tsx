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

import { useEffect } from "react";
import AIOrb from "@/components/ai-orb/AIOrb";
import type { AIOrbState } from "@/components/ai-orb/ai-orb-types";
import VoiceTranscript from "@/components/ai/VoiceTranscript";
import { type TranscriptLine, type VoicePhase } from "@/lib/voice/events";
import { type Lang } from "@/lib/i18n";

const COPY: Record<Lang, {
  connecting: string;
  listening: string;
  speaking: string;
  ready: string;
  end: string;
  title: string;
  hint: string;
  voice: string;
}> = {
  en: {
    connecting: "Connecting…",
    listening: "Listening",
    speaking: "Speaking",
    ready: "Go ahead",
    end: "End call",
    title: "Voice call",
    hint: "Speak, then pause. There is no button to hold.",
    voice: "Voice",
  },
  zh: {
    connecting: "正在连接…",
    listening: "正在聆听",
    speaking: "正在回答",
    ready: "请讲",
    end: "结束通话",
    title: "语音通话",
    hint: "说完后停顿一下，无需按住任何按键。",
    voice: "音色",
  },
  ar: {
    connecting: "جارٍ الاتصال…",
    listening: "بيسمعك",
    speaking: "بيتكلم",
    ready: "اتفضّل",
    end: "إنهاء المكالمة",
    title: "مكالمة صوتية",
    hint: "اتكلم وبعدين اسكت شوية. مفيش زرار تفضل ضاغط عليه.",
    voice: "الصوت",
  },
};

export type VoiceCallScreenProps = {
  /** False while connecting — the orb wakes rather than pretending to listen. */
  live: boolean;
  phase: VoicePhase;
  /** 0..1 from whichever side is currently making sound. */
  audioLevel: number;
  lines: readonly TranscriptLine[];
  lang?: Lang;
  onEnd: () => void;
  /** Keys and labels only — the server's catalogue, never the vendor's ids.
   *  Empty means no picker is drawn: a control that cannot be used is noise. */
  voices?: readonly { key: string; label: string }[];
  selectedVoice?: string | null;
  /** Changing a voice restarts the call: the configuration is sent once per
   *  session, so a new one needs a new session. Said plainly in the UI rather
   *  than silently doing nothing until the next call. */
  onSelectVoice?: (key: string) => void;
};

export default function VoiceCallScreen({
  live,
  phase,
  audioLevel,
  lines,
  lang = "en",
  onEnd,
  voices = [],
  selectedVoice = null,
  onSelectVoice,
}: VoiceCallScreenProps) {
  const copy = COPY[lang];

  /* Escape ends the call. A full-screen mode with no keyboard exit is a trap,
     and this one is holding the microphone open. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEnd();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEnd]);

  /* The orb's own vocabulary, mapped from the call's. `awakening` while
     connecting is honest: it is starting, not yet hearing anything. */
  const orbState: AIOrbState = !live
    ? "awakening"
    : phase === "speaking"
      ? "speaking"
      : phase === "listening"
        ? "listening"
        : "idle";

  const status = !live
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
      className="fixed inset-0 z-50 flex flex-col bg-[#0D0D0D] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Orb — the centre of the screen, because it is the centre of the
          interaction. Sized generously: this is the one moment the orb is the
          interface rather than an ornament beside text. */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 min-h-0">
        <AIOrb
          state={orbState}
          audioLevel={audioLevel}
          size={200}
          interactive
          className="shrink-0"
        />

        {/* Status — one line, quiet. The orb already says most of this; the
            text is for anyone who cannot read motion. */}
        <p
          className="text-sm font-normal tracking-wide text-[#AAAAAA]"
          aria-live="polite"
        >
          {status}
        </p>
      </div>

      {/* Voice picker — only when the owner has configured a catalogue. Plain
          text buttons rather than a dropdown: two or three options read faster
          than a control you have to open, and the brand's icon system has no
          chevron worth adding for this. */}
      {voices.length > 0 && (
        <div className="shrink-0 flex items-center justify-center gap-2 px-6 pb-4">
          <span className="text-[11px] uppercase tracking-wide text-[#666666]">{copy.voice}</span>
          {voices.map((v) => {
            const on = v.key === selectedVoice;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => onSelectVoice?.(v.key)}
                aria-pressed={on}
                className={`px-3 py-1 rounded-full text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] ${
                  on
                    ? "bg-white text-[#0D0D0D]"
                    : "text-[#AAAAAA] hover:text-white border border-[#2E2E2E]"
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

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onEnd}
            aria-label={copy.end}
            className="h-16 w-16 rounded-full inline-flex items-center justify-center bg-[#FF3333] text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D]"
          >
            {/* Outline, consistent stroke, no fill — the icon system. */}
            <svg aria-hidden viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
