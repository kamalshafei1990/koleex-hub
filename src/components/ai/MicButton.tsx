"use client";

/* ---------------------------------------------------------------------------
   MicButton — Phase 1 voice input for AI Chat mode.

   Flow:
     1. User taps mic → browser prompts for microphone permission
        (first time only).
     2. MediaRecorder captures audio into an in-memory Blob.
     3. User taps mic again to stop → the blob is POSTed to
        /api/ai/transcribe (Groq Whisper).
     4. The returned transcript is handed to onTranscript(text), which
        the parent then routes through its normal Chat-mode submit
        path — so voice and typed messages share the same backend.

   The component only does STT + state. It does NOT talk to the chat
   model, does NOT do TTS (speakText is a separate helper below), and
   does NOT know about Agent mode — the parent is responsible for only
   mounting MicButton when mode === "chat".

   Four visible states (all surfaced via the aria-label and an icon):
     · idle       — mic outline, tap to start
     · listening  — solid red, pulsing, tap again to stop
     · processing — spinner, upload + transcribe in flight
     · speaking   — mic+note, TTS is actively reading the AI reply
                   (caller passes `speaking=true` when speech is live)

   Errors are surfaced via onError(message) — caller typically shows
   a toast / inline message. We never throw; hooking into a broken
   browser or denied permission returns a clean user-facing string.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import MicrophoneIcon from "@/components/icons/ui/MicrophoneIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import StopIcon from "@/components/icons/ui/StopIcon";

export type MicState = "idle" | "listening" | "processing" | "speaking";

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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const computedState: MicState = speaking ? "speaking" : state;

  /* Release the mic stream cleanly so Safari/Chrome stop showing the
     recording indicator after we're done. Idempotent. */
  const stopStream = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    for (const track of s.getTracks()) track.stop();
    streamRef.current = null;
  }, []);

  /* Cleanup on unmount — if the component is torn down mid-recording
     (e.g. user switches to Agent mode) we don't want to keep the mic
     hot. */
  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop();
      } catch {
        // ignore
      }
      stopStream();
    };
  }, [stopStream]);

  const handleError = useCallback(
    (msg: string) => {
      setState("idle");
      stopStream();
      onError?.(msg);
    },
    [onError, stopStream],
  );

  const startRecording = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      handleError("Your browser doesn't support voice input.");
      return;
    }
    if (typeof window.MediaRecorder === "undefined") {
      handleError("Your browser doesn't support voice recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      /* Pick the best supported mime: webm/opus on Chrome/Firefox,
         mp4/aac on Safari. Whisper handles both. Leave undefined if
         the browser doesn't support either so we use its default. */
      const mime = pickRecorderMime();
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onerror = () => handleError("Voice recording failed. Please try again.");
      rec.onstop = async () => {
        stopStream();
        const chunks = chunksRef.current;
        chunksRef.current = [];
        if (chunks.length === 0) {
          setState("idle");
          return;
        }
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 300) {
          /* Too short to contain speech — don't bother calling STT. */
          setState("idle");
          onError?.("That was too short — tap the mic and hold while speaking.");
          return;
        }
        setState("processing");
        try {
          const form = new FormData();
          form.set("file", blob, "clip");
          if (lang) form.set("lang", lang);
          const res = await fetch("/api/ai/transcribe", {
            method: "POST",
            credentials: "include",
            body: form,
          });
          const json = (await res.json().catch(() => null)) as
            | { text?: string; error?: string; message?: string }
            | null;
          if (!res.ok || !json) {
            handleError(json?.message || "Couldn't transcribe that clip.");
            return;
          }
          const text = (json.text ?? "").trim();
          if (!text) {
            handleError(json.message || "I couldn't hear anything.");
            return;
          }
          setState("idle");
          onTranscript(text);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Network error";
          handleError(msg);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setState("listening");
    } catch (e) {
      /* Most common path: permission denied. Firefox / Safari throw
         with slightly different messages — normalise to one string. */
      const msg = e instanceof Error ? e.message.toLowerCase() : "";
      if (msg.includes("denied") || msg.includes("not allowed")) {
        handleError("Microphone permission was denied.");
      } else {
        handleError("Couldn't access your microphone.");
      }
    }
  }, [handleError, lang, onError, onTranscript, stopStream]);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    try {
      if (rec.state !== "inactive") rec.stop();
    } catch {
      // ignore — onstop handler takes care of state cleanup
    }
    recorderRef.current = null;
    setState("processing"); // flip UI immediately; onstop resets after fetch
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

  const pulse = computedState === "listening" ? "animate-pulse" : "";
  const ariaLabel =
    computedState === "listening"
      ? "Stop recording"
      : computedState === "processing"
        ? "Transcribing…"
        : computedState === "speaking"
          ? "Stop speaking"
          : label;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || computedState === "processing"}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`rounded-full flex items-center justify-center shrink-0 transition-colors disabled:opacity-40 ${color} ${pulse} ${className}`}
      style={{ width: sizePx, height: sizePx }}
    >
      {icon}
    </button>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

function pickRecorderMime(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/ogg;codecs=opus",
  ];
  for (const mime of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      // ignore probe errors
    }
  }
  return undefined;
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
