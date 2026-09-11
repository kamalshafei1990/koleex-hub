"use client";

/* ---------------------------------------------------------------------------
   MicButton — Phase 1 voice input for AI chat.

   Flow (Web Speech API):
     1. User taps mic → browser prompts for microphone permission
        (first time only).
     2. SpeechRecognition captures audio AND transcribes on-device
        (or via the browser's built-in cloud, depending on browser).
     3. User taps mic again to stop, or speech pauses → the final
        transcript is handed to onTranscript(text).
     4. The parent routes the text through its normal submit path —
        voice and typed messages share the same backend.

   Why Web Speech instead of MediaRecorder + Whisper:
     · Zero backend dependency for STT — no Groq / OpenAI / any API key.
     · Zero cost per request.
     · Built into every modern browser (Chrome / Edge / Safari 18+).
     · Lower latency (no upload round-trip).
     · Trade-off: accuracy on noisy audio is lower than Whisper. Fine
       for clear speech in a quiet room; less reliable in cafés.

   The component only does STT + state. TTS (text→speech) is a separate
   helper below (speakText) that uses window.speechSynthesis.

   Visible states:
     · idle       — mic outline, tap to start
     · listening  — solid red, pulsing, tap again to stop
     · speaking   — mic+note, TTS is reading the AI reply
                   (caller passes `speaking=true` when speech is live)

   Errors are surfaced via onError(message) — caller shows them inline.
   Feature-detection runs once on first interaction; browsers without
   SpeechRecognition get a clear "not supported" message.
   --------------------------------------------------------------------------- */

import { useCallback } from "react";
import MicIcon from "@/components/icons/ui/MicIcon";
import StopIcon from "@/components/icons/ui/StopIcon";

import { useDictation, DICTATION_COPY, formatDictationDuration } from "./useDictation";

export type MicState = "idle" | "listening" | "speaking";


/* EVERY WORD THIS CONTROL SAYS, in the three UI languages. It was an English
   island: its errors reach the chat's red banner through onError, and its
   labels are what a screen reader announces (audit, 2026-09-11). */
const MIC_COPY = {
  en: { label: "Voice input", stopRecording: "Stop recording", transcribing: "Transcribing…", stopSpeaking: "Stop speaking" },
  zh: { label: "语音输入", stopRecording: "停止录音", transcribing: "正在转写…", stopSpeaking: "停止朗读" },
  ar: { label: "إدخال صوتي", stopRecording: "وقّف التسجيل", transcribing: "بنكتب اللي قلته…", stopSpeaking: "وقّف الكلام" },
} as const;

interface Props {
  /** Called with the transcribed text (trimmed, non-empty). */
  onTranscript: (text: string) => void;
  /** Short user-friendly error string — caller surfaces as toast/inline. */
  onError?: (message: string) => void;
  /** True while TTS playback is active (parent-controlled).
   *  When true the button renders the "stop speaking" state. */
  speaking?: boolean;
  /** Called when the user taps the button during TTS playback. */
  onStopSpeaking?: () => void;
  /** Optional: 2-letter language hint for the recogniser, and the language
   *  of every word this control shows or reports. */
  lang?: "en" | "zh" | "ar";
  /** Disable interaction (e.g. while a text request is in flight). */
  disabled?: boolean;
  /** Optional CSS class for positional overrides. */
  className?: string;
  /** Size in px — defaults to 36 to match the existing send button. */
  size?: number;
  /** Tooltip / aria-label base text. Defaults to the language's own word. */
  label?: string;
}

export default function MicButton({
  onTranscript,
  onError,
  speaking = false,
  onStopSpeaking,
  lang,
  disabled,
  className = "",
  size = 36,
  label,
}: Props) {
  const t = MIC_COPY[lang ?? "en"];
  const baseLabel = label ?? t.label;
  /* THE RECOGNISER IS SHARED (useDictation, audit 2026-09-11): the chat
     composer's single voice control dictates on a long press with the same
     hook, so the two never drift. */
  const dictation = useDictation({ lang, onTranscript, onError });
  const state: MicState = dictation.listening ? "listening" : "idle";
  const elapsed = dictation.elapsed;
  const startRecording = dictation.start;
  const stopRecording = dictation.stop;

  const computedState: MicState = speaking ? "speaking" : state;

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (computedState === "speaking") {
      onStopSpeaking?.();
      return;
    }
    if (state === "listening") {
      stopRecording();
      return;
    }
    if (state === "idle") {
      startRecording();
    }
  }, [
    computedState,
    disabled,
    onStopSpeaking,
    startRecording,
    state,
    stopRecording,
  ]);

  const sizePx = `${size}px`;
  /* Icon-size harmonised with the rest of the AI composer row
     (attach / emoji / web-search all render an 18 px SVG). The
     listening / speaking states keep a slightly smaller stop icon
     so its square geometry doesn't crowd the circle. */
  const icon =
    computedState === "speaking" ? (
      <StopIcon size={14} />
    ) : computedState === "listening" ? (
      <StopIcon size={14} />
    ) : (
      <MicIcon size={18} />
    );

  /* Idle styling matches the other ghost buttons in the composer —
     transparent background, no border, hover surface lifts it. The
     persistent border + bg-surface that used to live here made the
     mic look like a chip while the other buttons read as plain
     icons; the row now scans uniformly. */
  const color =
    computedState === "listening"
      ? "bg-[var(--kx-ai-danger)] text-white"
      : computedState === "speaking"
          ? "bg-[var(--kx-ai-accent)] text-white"
          : "text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]";

  const ariaLabel =
    computedState === "listening"
      ? t.stopRecording
      : computedState === "speaking"
          ? t.stopSpeaking
          : baseLabel;

  const isListening = computedState === "listening";
  const isSpeaking = computedState === "speaking";
  const showRing = isListening || isSpeaking;
  const ringColor = isListening
    ? "rgba(255,51,51,0.55)"   // --kx-ai-danger
    : "rgba(0,102,255,0.55)"; // --kx-ai-accent

  return (
    <span
      className={`relative inline-flex items-center shrink-0 ${className}`}
      style={{ height: sizePx }}
    >
      {/* Pulsing halo — two stacked rings animate at different delays
          so the ripple feels continuous. Pure CSS via Tailwind's
          animate-ping; absolutely positioned behind the button so
          layout never shifts between states. */}
      {showRing && (
        <>
          <span
            aria-hidden
            className="absolute inline-flex rounded-full animate-ping"
            style={{
              inset: 0,
              width: sizePx,
              height: sizePx,
              backgroundColor: ringColor,
              opacity: 0.55,
            }}
          />
          <span
            aria-hidden
            className="absolute inline-flex rounded-full animate-ping"
            style={{
              inset: 0,
              width: sizePx,
              height: sizePx,
              backgroundColor: ringColor,
              opacity: 0.35,
              animationDelay: "0.35s",
            }}
          />
        </>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={ariaLabel}
        title={ariaLabel}
        className={`relative rounded-full flex items-center justify-center shrink-0 transition-all disabled:opacity-40 ${color} ${
          isListening ? "scale-110 shadow-[0_0_0_4px_rgba(244,63,94,0.18)]" : ""
        } ${isSpeaking ? "shadow-[0_0_0_4px_rgba(14,165,233,0.18)]" : ""}`}
        style={{ width: sizePx, height: sizePx }}
      >
        {icon}
      </button>

      {/* Live recording duration. Positioned above the button as a
          floating pill so it never fights for horizontal space in a
          cramped composer. Only rendered while actively listening. */}
      {isListening && (
        <span
          aria-live="polite"
          className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[12px] font-semibold tracking-wider text-[var(--kx-ai-danger-text)] bg-[var(--kx-ai-danger-soft)] border border-[var(--kx-ai-danger-line)] rounded-full px-2 py-0.5 pointer-events-none shadow-md backdrop-blur-md"
        >
          ● {DICTATION_COPY[lang ?? "en"].rec} · {formatDictationDuration(elapsed)}
        </span>
      )}

    </span>
  );
}

/* ─── TTS helper (browser speechSynthesis) ─────────────────────────── */

export interface TtsHandle {
  cancel: () => void;
}

/** Speak a string via the browser's built-in SpeechSynthesis. Returns
 *  a handle the caller uses to stop playback (e.g. if the user hits
 *  the stop button or sends a new message).
 *
 *  Chooses a voice that matches the requested language when possible;
 *  falls back to the platform default otherwise. Does NOT fail if
 *  speechSynthesis is unavailable — onEnd fires immediately and the
 *  caller keeps behaving as if TTS had played. */
export function speakText(
  text: string,
  opts: { lang?: "en" | "zh" | "ar"; onEnd?: () => void; onError?: () => void } = {},
): TtsHandle {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    opts.onEnd?.();
    return { cancel: () => {} };
  }
  const synth = window.speechSynthesis;
  try {
    synth.cancel();
  } catch {
    // ignore
  }
  const u = new SpeechSynthesisUtterance(text);
  const bcp47 =
    opts.lang === "zh" ? "zh-CN" : opts.lang === "ar" ? "ar-SA" : "en-US";
  u.lang = bcp47;
  /* Pick a voice matching the requested lang if one is available.
     Voice lists are sometimes async on first load — if empty here,
     the browser will use its default for u.lang, which is fine. */
  try {
    const voices = synth.getVoices();
    const match = voices.find((v) => v.lang?.toLowerCase().startsWith(bcp47.toLowerCase().slice(0, 2)));
    if (match) u.voice = match;
  } catch {
    // ignore
  }
  u.rate = 1;
  u.pitch = 1;
  /* Audit P0 #14 — guard `onEnd` so it only fires once. The browser
     dispatches `end` after `cancel()` per spec, and the returned
     handle's cancel() also calls onEnd. Without the guard a single
     cancel produces TWO setAiSpeaking(false) calls (and any other
     parent-side effects fire twice). */
  let ended = false;
  const fireEnd = () => {
    if (ended) return;
    ended = true;
    opts.onEnd?.();
  };
  u.onend = fireEnd;
  u.onerror = () => {
    opts.onError?.();
    fireEnd();
  };
  synth.speak(u);
  return {
    cancel: () => {
      try { synth.cancel(); } catch { /* ignore */ }
      fireEnd();
    },
  };
}
