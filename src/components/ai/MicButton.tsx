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
     · processing — spinner, final transcript resolving (brief — usually
                    skipped since recognition returns instantly)
     · speaking   — mic+note, TTS is reading the AI reply
                   (caller passes `speaking=true` when speech is live)

   Errors are surfaced via onError(message) — caller shows them inline.
   Feature-detection runs once on first interaction; browsers without
   SpeechRecognition get a clear "not supported" message.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import MicrophoneIcon from "@/components/icons/ui/MicrophoneIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import StopIcon from "@/components/icons/ui/StopIcon";

/* Minimal typings for the vendor-prefixed Web Speech API. The browser
   ships this under either `SpeechRecognition` or
   `webkitSpeechRecognition`. We avoid pulling in the full DOM
   SpeechRecognition declaration (not present in stock lib.dom.d.ts
   across all TS configs) by using a thin structural type. */
interface SRResult {
  isFinal: boolean;
  0: { transcript: string; confidence: number };
}
interface SREvent {
  results: ArrayLike<SRResult>;
  resultIndex: number;
}
interface SRErrorEvent {
  error: string;
  message?: string;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SREvent) => void) | null;
  onerror: ((ev: SRErrorEvent) => void) | null;
  onend: ((ev: Event) => void) | null;
  onstart: ((ev: Event) => void) | null;
}
type SRConstructor = new () => SpeechRecognitionLike;

function getSRConstructor(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type MicState = "idle" | "listening" | "processing" | "speaking";

function formatDuration(s: number): string {
  if (s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m.toString().padStart(1, "0")}:${ss.toString().padStart(2, "0")}`;
}

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
  /** Optional: 2-letter language hint passed to Whisper for accuracy. */
  lang?: "en" | "zh" | "ar";
  /** Disable interaction (e.g. while a text request is in flight). */
  disabled?: boolean;
  /** Optional CSS class for positional overrides. */
  className?: string;
  /** Size in px — defaults to 36 to match the existing send button. */
  size?: number;
  /** Tooltip / aria-label base text. Defaults to "Voice input". */
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
  label = "Voice input",
}: Props) {
  const [state, setState] = useState<MicState>("idle");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  /* Accumulates final result segments across one recognition session.
     SpeechRecognition fires onresult with partial + final chunks; we
     keep only the finalised ones so short pauses don't drop earlier
     parts of the user's sentence. */
  const finalTextRef = useRef<string>("");
  /* Seconds since recording started. Tracked only while the listening
     state is active; resets to 0 on every new recognition session. */
  const [elapsed, setElapsed] = useState(0);

  const computedState: MicState = speaking ? "speaking" : state;

  useEffect(() => {
    if (state !== "listening") {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [state]);

  /* Cleanup on unmount — abort any live recognition so the mic
     indicator in the browser tab turns off. */
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, []);

  const handleError = useCallback(
    (msg: string) => {
      setState("idle");
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
      onError?.(msg);
    },
    [onError],
  );

  /** BCP-47 language tag for SpeechRecognition. Uses the parent's
   *  lang hint when present; otherwise stays unset so the browser
   *  picks based on system language. */
  const bcp47 =
    lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-SA" : lang === "en" ? "en-US" : "";

  const startRecording = useCallback(() => {
    const SR = getSRConstructor();
    if (!SR) {
      handleError(
        "Your browser doesn't support voice input. Try Chrome or Edge.",
      );
      return;
    }

    try {
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      if (bcp47) recognition.lang = bcp47;
      finalTextRef.current = "";

      recognition.onresult = (ev) => {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) {
            const t = r[0]?.transcript ?? "";
            if (t) finalTextRef.current += (finalTextRef.current ? " " : "") + t.trim();
          }
        }
      };
      recognition.onerror = (ev) => {
        /* Common error codes per the Web Speech API spec:
             · no-speech   — user didn't say anything audible
             · aborted     — programmatic abort (we did this; ignore)
             · audio-capture — no mic available
             · not-allowed — permission denied
             · network     — transcription service unreachable (some
                             browsers route audio to a cloud service) */
        const code = ev.error ?? "";
        if (code === "aborted") return; // our own abort, no error
        if (code === "no-speech") {
          handleError("I didn't hear anything — please try again.");
          return;
        }
        if (code === "not-allowed" || code === "service-not-allowed") {
          handleError("Microphone permission was denied.");
          return;
        }
        if (code === "audio-capture") {
          handleError("Couldn't access your microphone.");
          return;
        }
        if (code === "network") {
          handleError("Voice service is unreachable — please try again.");
          return;
        }
        handleError("Voice input failed. Please try again.");
      };
      recognition.onend = () => {
        const text = finalTextRef.current.trim();
        finalTextRef.current = "";
        recognitionRef.current = null;
        setState("idle");
        if (text) onTranscript(text);
      };
      recognition.onstart = () => {
        setState("listening");
      };
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/denied|not allowed/i.test(msg)) {
        handleError("Microphone permission was denied.");
      } else {
        handleError("Couldn't start voice input.");
      }
    }
  }, [bcp47, handleError, onTranscript]);

  const stopRecording = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.stop(); // triggers onend, which delivers final transcript
    } catch {
      // ignore
    }
    /* Don't flip to "processing" — recognition is on-device and
       instantaneous. Keep the listening halo until onend fires. */
  }, []);

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
  const icon =
    computedState === "processing" ? (
      <SpinnerIcon className="h-4 w-4 animate-spin" />
    ) : computedState === "speaking" ? (
      <StopIcon size={14} />
    ) : computedState === "listening" ? (
      <StopIcon size={14} />
    ) : (
      <MicrophoneIcon size={16} />
    );

  const color =
    computedState === "listening"
      ? "bg-rose-500 text-white"
      : computedState === "processing"
        ? "bg-[var(--bg-surface)] text-[var(--text-dim)]"
        : computedState === "speaking"
          ? "bg-sky-500 text-white"
          : "bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]";

  const ariaLabel =
    computedState === "listening"
      ? "Stop recording"
      : computedState === "processing"
        ? "Transcribing…"
        : computedState === "speaking"
          ? "Stop speaking"
          : label;

  const isListening = computedState === "listening";
  const isSpeaking = computedState === "speaking";
  const showRing = isListening || isSpeaking;
  const ringColor = isListening
    ? "rgba(244,63,94,0.55)"   // rose-500
    : "rgba(14,165,233,0.55)"; // sky-500

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
        disabled={disabled || computedState === "processing"}
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
          className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tracking-wider text-rose-300 bg-rose-500/15 border border-rose-500/30 rounded-full px-2 py-0.5 pointer-events-none shadow-md backdrop-blur-md"
        >
          ● REC · {formatDuration(elapsed)}
        </span>
      )}

      {/* Transcribing indicator — small but visible so the user knows
          their clip is being processed and hasn't been lost. */}
      {computedState === "processing" && (
        <span
          aria-live="polite"
          className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium tracking-wider text-[var(--text-dim)] bg-[var(--bg-surface)]/90 border border-[var(--border-subtle)] rounded-full px-2 py-0.5 pointer-events-none shadow-md backdrop-blur-md"
        >
          Transcribing…
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
  u.onend = () => opts.onEnd?.();
  u.onerror = () => {
    opts.onError?.();
    opts.onEnd?.();
  };
  synth.speak(u);
  return {
    cancel: () => {
      try {
        synth.cancel();
      } catch {
        // ignore
      }
      opts.onEnd?.();
    },
  };
}
