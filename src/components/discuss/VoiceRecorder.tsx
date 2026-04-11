"use client";

/* ---------------------------------------------------------------------------
   VoiceRecorder — MediaRecorder-backed voice-note capture for Discuss.

   What it does:
     · Requests microphone permission the first time the user clicks
       "record" (not on mount — we don't want to prompt until they opt in).
     · Records an audio blob via MediaRecorder, tagged as audio/webm
       (Chrome/Firefox/Edge). Safari on older iOS falls back to
       audio/mp4 when webm isn't supported — the blob is then transcoded
       by the browser on upload, which is fine for our storage bucket.
     · Computes a downsampled waveform (48 bars) from the raw audio
       buffer after recording stops, so the receiving UI can render a
       mini-visualizer next to the play button.
     · Shows a live recording state (red pulsing dot + mm:ss timer) and
       a post-recording preview state (play/pause + waveform + send/
       discard buttons). The preview uses the same <audio> element the
       recipient will see so there are no nasty surprises.

   Why inline compute instead of a server-side job:
     · Waveforms are cheap to compute — an 8 kHz decimation of a 60s clip
       runs in ~10ms. No need to burn a background job.
     · Uploading the waveform alongside the blob keeps the playback
       component stateless — it just reads metadata.voice.waveform.

   The caller provides onSend / onCancel; everything else (file upload,
   message insert) stays in the parent.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Pause, Play, Send, Square, Trash2 } from "lucide-react";

export interface VoiceRecorderProps {
  /** Called when the user clicks "send". Receives the raw Blob,
   *  duration in ms, and the downsampled waveform (48 bars). */
  onSend: (input: {
    blob: Blob;
    durationMs: number;
    waveform: number[];
  }) => Promise<void> | void;
  /** Called when the user clicks "cancel" or dismisses the recorder. */
  onCancel: () => void;
  /** Localized labels — passed in from the parent so this component
   *  stays language-agnostic. */
  labels: {
    start: string;
    stop: string;
    cancel: string;
    send: string;
    preview: string;
    permissionDenied: string;
    recording: string;
  };
}

type RecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "preview"
  | "sending"
  | "error";

/** Downsample a raw Float32 PCM buffer into N bars by averaging
 *  absolute amplitude within each bucket. Returns values in [0, 1]. */
function computeWaveform(pcm: Float32Array, bars: number): number[] {
  if (pcm.length === 0) return new Array(bars).fill(0);
  const bucketSize = Math.floor(pcm.length / bars) || 1;
  const out: number[] = [];
  let peak = 0;
  for (let b = 0; b < bars; b++) {
    const start = b * bucketSize;
    const end = Math.min(pcm.length, start + bucketSize);
    let sum = 0;
    for (let i = start; i < end; i++) sum += Math.abs(pcm[i]);
    const avg = sum / Math.max(1, end - start);
    out.push(avg);
    if (avg > peak) peak = avg;
  }
  /* Normalize to [0, 1] so the renderer doesn't need to know about
     absolute amplitude. Clamp the minimum to a tiny value so silent
     segments still render as faint bars. */
  const norm = peak > 0 ? peak : 1;
  return out.map((v) => Math.max(0.04, Math.min(1, v / norm)));
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(1, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function VoiceRecorder({
  onSend,
  onCancel,
  labels,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  /* Start recording. Triggers the mic permission prompt on first call. */
  const handleStart = async () => {
    setErrorMsg(null);
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      /* Pick the first container/codec this browser is willing to
         record in. Chrome & Firefox → webm/opus, Safari → mp4/aac.
         `isTypeSupported` is a static method but some very old Safari
         builds expose it as undefined — the try/catch guards for that. */
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
        ? new MediaRecorder(stream, { mimeType: preferred })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: mr.mimeType || preferred || "audio/webm",
        });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);

        /* Decode for waveform. Some browsers need an AudioContext just
           to get the raw PCM; we tear it down immediately after. */
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
              const channel = audioBuf.getChannelData(0);
              setWaveform(computeWaveform(channel, 48));
            } finally {
              void ctx.close();
            }
          } else {
            setWaveform(new Array(48).fill(0.25));
          }
        } catch {
          /* Decoding can fail on iOS Safari for very short clips —
             fall back to a flat placeholder waveform. */
          setWaveform(new Array(48).fill(0.25));
        }
        setState("preview");
      };
      mr.start();
      mediaRecorderRef.current = mr;
      startTimeRef.current = Date.now();
      setDurationMs(0);
      setState("recording");

      intervalRef.current = window.setInterval(() => {
        setDurationMs(Date.now() - startTimeRef.current);
      }, 100);
    } catch {
      setErrorMsg(labels.permissionDenied);
      setState("error");
    }
  };

  /* Stop recording and move to preview. */
  const handleStop = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    }
    /* Stop the underlying mic track so the OS removes the red mic icon. */
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    /* Duration snapshotted one more time so it matches the final blob. */
    setDurationMs(Date.now() - startTimeRef.current);
  };

  /* Discard everything and reset to idle. Caller receives onCancel. */
  const handleDiscard = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      try {
        mr.stop();
      } catch {
        /* already stopped */
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    blobRef.current = null;
    setPreviewUrl(null);
    setWaveform([]);
    setDurationMs(0);
    setState("idle");
    onCancel();
  };

  const handleSend = async () => {
    if (!blobRef.current) return;
    setState("sending");
    try {
      await onSend({
        blob: blobRef.current,
        durationMs,
        waveform,
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    } catch {
      /* If the upload fails, drop back into preview so the user can retry. */
      setState("preview");
    }
  };

  /* Clean up any live resources on unmount. */
  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Auto-kick a start on mount — the component only mounts when the
     user taps the mic button, so we may as well prompt immediately. */
  useEffect(() => {
    if (state === "idle") void handleStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Tie the play-button state to the <audio> element's events. */
  useEffect(() => {
    const el = audioElRef.current;
    if (!el) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnd = () => setIsPlaying(false);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnd);
    };
  }, [previewUrl]);

  /* ── Render ───────────────────────────────────────────────────── */

  if (state === "error") {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
        <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center">
          <Mic className="h-4 w-4 text-red-300" />
        </div>
        <div className="flex-1 min-w-0 text-[12px] text-red-300">
          {errorMsg}
        </div>
        <button
          type="button"
          onClick={handleDiscard}
          className="h-7 px-2.5 rounded-md text-[11px] font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface)] transition-colors"
        >
          {labels.cancel}
        </button>
      </div>
    );
  }

  if (state === "requesting" || state === "idle") {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--text-dim)]" />
        <div className="flex-1 text-[12px] text-[var(--text-dim)]">
          {labels.recording}…
        </div>
        <button
          type="button"
          onClick={handleDiscard}
          className="h-7 px-2.5 rounded-md text-[11px] font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-primary)] transition-colors"
        >
          {labels.cancel}
        </button>
      </div>
    );
  }

  if (state === "recording") {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
        <div className="relative h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center">
          <Mic className="h-4 w-4 text-red-300" />
          <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-75" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-red-300">
            {labels.recording}
          </div>
          <div className="text-[10.5px] text-[var(--text-dim)] tabular-nums">
            {formatDuration(durationMs)}
          </div>
        </div>
        <button
          type="button"
          onClick={handleDiscard}
          className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title={labels.cancel}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleStop}
          className="h-8 px-3 rounded-lg bg-red-500 text-white text-[11.5px] font-semibold flex items-center gap-1.5 hover:bg-red-600 transition-colors"
        >
          <Square className="h-3 w-3 fill-current" />
          {labels.stop}
        </button>
      </div>
    );
  }

  /* Preview / sending states */
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
      <button
        type="button"
        onClick={() => {
          const el = audioElRef.current;
          if (!el) return;
          if (el.paused) void el.play();
          else el.pause();
        }}
        className="h-9 w-9 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition-colors"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current ms-0.5" />
        )}
      </button>
      <div className="flex-1 min-w-0 flex items-end gap-0.5 h-8">
        {waveform.map((v, i) => (
          <span
            key={i}
            className="flex-1 bg-blue-300 rounded-full"
            style={{
              height: `${Math.max(8, v * 100)}%`,
              opacity: 0.35 + v * 0.65,
            }}
          />
        ))}
      </div>
      <div className="text-[10.5px] tabular-nums text-[var(--text-dim)] min-w-[36px] text-right">
        {formatDuration(durationMs)}
      </div>
      {previewUrl && (
        <audio ref={audioElRef} src={previewUrl} preload="auto" className="hidden" />
      )}
      <button
        type="button"
        onClick={handleDiscard}
        className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
        title={labels.cancel}
        disabled={state === "sending"}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={handleSend}
        disabled={state === "sending"}
        className="h-8 px-3 rounded-lg bg-blue-500 text-white text-[11.5px] font-semibold flex items-center gap-1.5 hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
      >
        {state === "sending" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        {labels.send}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VOICE PLAYBACK BUBBLE — used to render received voice messages inline in
   the thread. Stateless; takes the upload URL + waveform + duration.
   ═══════════════════════════════════════════════════════════════════════════ */

export function VoicePlaybackBubble({
  url,
  durationMs,
  waveform,
}: {
  url: string;
  durationMs: number;
  waveform: number[];
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setCurrentMs(el.currentTime * 1000);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnd = () => {
      setIsPlaying(false);
      setCurrentMs(0);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnd);
    };
  }, []);

  const progress = durationMs > 0 ? Math.min(1, currentMs / durationMs) : 0;
  const bars =
    waveform && waveform.length > 0 ? waveform : new Array(48).fill(0.25);

  return (
    <div className="mt-1 flex items-center gap-3 px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] max-w-[320px]">
      <button
        type="button"
        onClick={() => {
          const el = audioRef.current;
          if (!el) return;
          if (el.paused) void el.play();
          else el.pause();
        }}
        className="h-9 w-9 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition-colors shrink-0"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current ms-0.5" />
        )}
      </button>
      <div className="flex-1 min-w-0 flex items-end gap-0.5 h-7">
        {bars.map((v, i) => {
          const filled = i / bars.length <= progress;
          return (
            <span
              key={i}
              className={`flex-1 rounded-full transition-colors ${
                filled ? "bg-blue-300" : "bg-[var(--border-subtle)]"
              }`}
              style={{
                height: `${Math.max(10, v * 100)}%`,
                opacity: filled ? 0.9 : 0.5,
              }}
            />
          );
        })}
      </div>
      <div className="text-[10.5px] tabular-nums text-[var(--text-dim)] shrink-0">
        {Math.floor(durationMs / 60000)}:
        {(Math.floor(durationMs / 1000) % 60).toString().padStart(2, "0")}
      </div>
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
    </div>
  );
}
