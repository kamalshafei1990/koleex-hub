"use client";

/* ---------------------------------------------------------------------------
   PushToTalkBar — WeChat-style hold-to-talk voice input for Discuss (phones).

   Behaviour (mirrors WeChat):
     · The bar replaces the text field while "voice mode" is on.
     · Press & hold → recording starts; a HUD above the composer shows the
       mic, a live mm:ss timer and the release hint.
     · Release → the clip sends IMMEDIATELY (no preview step — the preview
       recorder stays the desktop flow).
     · Slide up while holding (≥ 64px) → the HUD flips red; release cancels.
     · Shorter than 0.7s → discarded with a "too short" flash on the bar.
     · 60s cap → auto-stops and sends, like WeChat.

   The recording pipeline (MediaRecorder + 32kbps opus/mp4 + 48-bar waveform)
   matches VoiceRecorder exactly so both flows produce identical messages.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import MicrophoneIcon from "@/components/icons/ui/MicrophoneIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import TypeIcon from "@/components/icons/ui/TypeIcon";
import { computeWaveform } from "./VoiceRecorder";

const CANCEL_DY_PX = 64;
const CONVERT_DX_PX = 72;
const MIN_CLIP_MS = 700;
const MAX_CLIP_MS = 60_000;

export interface PushToTalkBarProps {
  /** Fires on release with the finished clip — the parent uploads it the
   *  same way it uploads VoiceRecorder clips. */
  onSend: (input: {
    blob: Blob;
    durationMs: number;
    waveform: number[];
  }) => Promise<void> | void;
  /** WeChat's "slide right → Convert to Text": fires on release-in-convert-
   *  zone with the raw clip (NO waveform — nothing is displayed or stored).
   *  Resolves true when the words landed in the composer, false when the
   *  conversion failed (the bar flashes it). Optional: no prop, no gesture. */
  onConvertToText?: (input: { blob: Blob; durationMs: number }) => Promise<boolean>;
  labels: {
    holdToTalk: string;
    releaseToSend: string;
    releaseToCancel: string;
    releaseToConvert: string;
    tooShort: string;
    permissionDenied: string;
    sending: string;
    converting: string;
    convertFailed: string;
  };
}

type BarState =
  | "idle"
  | "requesting"
  | "recording"
  | "sending"
  | "converting"
  | "denied"
  | "tooShort"
  | "convertFailed";

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function PushToTalkBar({ onSend, onConvertToText, labels }: PushToTalkBarProps) {
  const [state, setState] = useState<BarState>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [willCancel, setWillCancel] = useState(false);
  const [willConvert, setWillConvert] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  /* The gesture lives in refs (not state): pointer handlers fire faster than
     React flushes state, and release-before-permission-granted is a real
     sequence on iOS — refs are the only reliable source of truth here. */
  const gestureActiveRef = useRef(false);
  const willCancelRef = useRef(false);
  const willConvertRef = useRef(false);
  const convertEnabledRef = useRef(!!onConvertToText);
  convertEnabledRef.current = !!onConvertToText;
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  /* Set when the finger lifts while the mic permission/start is still in
     flight; the pending start then aborts instead of recording with nobody
     holding the bar. */
  const abortOnStartRef = useRef(false);

  useEffect(() => {
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      if (maxTimerRef.current) window.clearTimeout(maxTimerRef.current);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const teardown = () => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (maxTimerRef.current) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  };

  const start = async () => {
    abortOnStartRef.current = false;
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (abortOnStartRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        setState("idle");
        return;
      }
      streamRef.current = stream;
      /* Same codec ladder as VoiceRecorder: Chrome/Firefox → webm/opus,
         Safari → mp4/aac. */
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4;codecs=mp4a.40.2",
        "audio/mp4",
        "audio/aac",
      ];
      let preferred: string | undefined;
      try {
        preferred = candidates.find(
          (c) =>
            typeof MediaRecorder !== "undefined" &&
            typeof MediaRecorder.isTypeSupported === "function" &&
            MediaRecorder.isTypeSupported(c),
        );
      } catch {
        preferred = undefined;
      }
      const mr = preferred
        ? new MediaRecorder(stream, {
            mimeType: preferred,
            audioBitsPerSecond: 32_000,
          })
        : new MediaRecorder(stream, { audioBitsPerSecond: 32_000 });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => void finalize(mr, preferred);
      mr.start();
      mediaRecorderRef.current = mr;
      startTimeRef.current = Date.now();
      setDurationMs(0);
      setState("recording");
      tickRef.current = window.setInterval(() => {
        setDurationMs(Date.now() - startTimeRef.current);
      }, 100);
      /* WeChat caps a voice note at 60s and stops when the cap hits. Honor
         the cancel pose: if the finger is already slid up, the capped clip
         is discarded instead of force-sent. */
      maxTimerRef.current = window.setTimeout(() => stop(willCancelRef.current), MAX_CLIP_MS);
    } catch {
      teardown();
      setState("denied");
      flashTimerRef.current = window.setTimeout(() => setState("idle"), 2400);
    }
  };

  const stop = (cancel: boolean) => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    willCancelRef.current = cancel;
    if (mr.state !== "inactive") mr.stop();
    /* Tracks are torn down in finalize (after onstop) so no tail chunks
       are lost. */
  };

  const finalize = async (mr: MediaRecorder, preferred: string | undefined) => {
    const heldMs = Date.now() - startTimeRef.current;
    const tooShort = !willCancelRef.current && heldMs < MIN_CLIP_MS;
    const cancel = willCancelRef.current || tooShort;
    const convert = !cancel && willConvertRef.current;
    const blob = new Blob(chunksRef.current, {
      type: mr.mimeType || preferred || "audio/webm",
    });
    chunksRef.current = [];
    teardown();
    setWillCancel(false);
    setWillConvert(false);
    setDurationMs(0);
    if (cancel) {
      if (tooShort) {
        setState("tooShort");
        flashTimerRef.current = window.setTimeout(() => setState("idle"), 1200);
      } else {
        setState("idle");
      }
      return;
    }
    /* Convert-to-Text (WeChat slide-right): the clip goes to the transcriber
       and is never stored — no waveform needed, so the expensive decode is
       skipped entirely. */
    if (convert) {
      if (!onConvertToText) {
        setState("idle");
        return;
      }
      setState("converting");
      try {
        const ok = await onConvertToText({ blob, durationMs: heldMs });
        if (ok) {
          setState("idle");
        } else {
          setState("convertFailed");
          flashTimerRef.current = window.setTimeout(() => setState("idle"), 1600);
        }
      } catch {
        setState("idle");
      }
      return;
    }
    setState("sending");
    try {
      let waveform = new Array(48).fill(0.25);
      try {
        const arrayBuf = await blob.arrayBuffer();
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (Ctor) {
          const ctx = new Ctor();
          try {
            const audioBuf = await ctx.decodeAudioData(arrayBuf);
            waveform = computeWaveform(audioBuf.getChannelData(0), 48);
          } finally {
            void ctx.close();
          }
        }
      } catch {
        /* Decoding can fail on iOS Safari for very short clips — keep the
           flat placeholder waveform. */
      }
      await onSend({ blob, durationMs: heldMs, waveform });
      setState("idle");
    } catch {
      /* Send failed — the parent's own retry chip on the pending message is
         the recovery path (same as VoiceRecorder uploads), so the bar just
         returns to idle. */
      setState("idle");
    }
  };

  /* ── Pointer gesture ─────────────────────────────────────────────── */
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (state === "sending" || state === "converting") return;
    e.preventDefault();
    /* Capture so move/up keep firing when the finger slides off the bar —
       that's exactly the slide-up-to-cancel path. Guarded: synthetic or
       stale pointer ids throw NotFoundError, and losing capture is only a
       degraded cancel gesture, not a broken recording. */
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* no capture — slide-up tracking just stops at the bar edge */
    }
    gestureActiveRef.current = true;
    willCancelRef.current = false;
    willConvertRef.current = false;
    setWillCancel(false);
    setWillConvert(false);
    startYRef.current = e.clientY;
    startXRef.current = e.clientX;
    void start();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!gestureActiveRef.current) return;
    const dy = startYRef.current - e.clientY;
    const dx = e.clientX - startXRef.current;
    /* Two zones (WeChat): slide UP cancels, slide RIGHT converts. A diagonal
       resolves to the dominant axis; the upward cancel wins ties because
       throwing a recording away must never need precision. */
    const cancel = dy > CANCEL_DY_PX && dy >= dx;
    const convert = !cancel && convertEnabledRef.current && dx > CONVERT_DX_PX && dx > dy;
    if (cancel !== willCancelRef.current) {
      willCancelRef.current = cancel;
      setWillCancel(cancel);
    }
    if (convert !== willConvertRef.current) {
      willConvertRef.current = convert;
      setWillConvert(convert);
    }
  };
  const onPointerUp = () => {
    if (!gestureActiveRef.current) return;
    gestureActiveRef.current = false;
    if (mediaRecorderRef.current) stop(willCancelRef.current);
    else abortOnStartRef.current = true;
  };
  const onPointerCancel = () => {
    if (!gestureActiveRef.current) return;
    gestureActiveRef.current = false;
    if (mediaRecorderRef.current) stop(true);
    else abortOnStartRef.current = true;
  };

  const recording = state === "recording" || state === "requesting";
  const label =
    state === "sending"
      ? labels.sending
      : state === "converting"
        ? labels.converting
        : state === "convertFailed"
          ? labels.convertFailed
          : state === "denied"
            ? labels.permissionDenied
            : state === "tooShort"
              ? labels.tooShort
              : recording
                ? labels.releaseToSend
                : labels.holdToTalk;

  return (
    <>
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        disabled={state === "sending" || state === "converting"}
        aria-label={labels.holdToTalk}
        className={`flex h-11 flex-1 min-w-0 items-center justify-center gap-2 rounded-lg border px-3 text-[14px] font-semibold select-none touch-none transition-colors ${
          state === "denied" || state === "tooShort" || state === "convertFailed"
            ? "border-red-500/40 bg-red-500/10 text-red-500 dark:text-red-300"
            : recording
              ? "border-[var(--border-color)] bg-[var(--bg-surface-active)] text-[var(--text-primary)]"
              : "border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)]"
        }`}
        style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
      >
        {(state === "sending" || state === "converting") && <SpinnerIcon className="h-4 w-4" />}
        {/* WeChat: the bar is plain centered text — no icon on the bar
            itself; the mic lives in the floating HUD while recording. */}
        <span className="truncate">{label}</span>
      </button>

      {/* Recording HUD — floats above the composer, centered, and never
          intercepts the gesture (pointer-events-none). Slide UP flips it red
          (cancel); slide RIGHT flips it green with the text glyph (WeChat's
          Convert to Text). */}
      {recording && (
        <div className="fixed inset-x-0 bottom-28 z-50 flex justify-center pointer-events-none">
          <div
            className={`flex flex-col items-center gap-1.5 rounded-2xl px-6 py-4 shadow-2xl transition-colors ${
              willCancel
                ? "bg-red-500 text-white"
                : willConvert
                  ? "bg-emerald-600 text-white"
                  : "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
            }`}
          >
            <div className="relative">
              {willConvert ? (
                <TypeIcon className="h-8 w-8" />
              ) : (
                <MicrophoneIcon className="h-8 w-8" />
              )}
              {!willCancel && !willConvert && (
                <span className="absolute inset-0 rounded-full border-2 border-current animate-ping opacity-40" />
              )}
            </div>
            <span className="text-[13px] font-semibold tabular-nums">
              {formatClock(durationMs)}
            </span>
            <span className="text-[11px] opacity-80">
              {willCancel
                ? labels.releaseToCancel
                : willConvert
                  ? labels.releaseToConvert
                  : labels.releaseToSend}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
