"use client";

/* ---------------------------------------------------------------------------
   VoiceCallButton — a real-time voice call, beside the existing mic.

   WHY IT IS A SECOND BUTTON RATHER THAN A CHANGE TO MicButton. The mic is a
   working tool and the standing rule is not to remove one. It is also a
   genuinely different thing: MicButton transcribes in the browser, sends TEXT
   through the normal chat path, and reads the reply back with speech
   synthesis. It is turn-based, and its transcription depends on the browser's
   own service — which in Chrome means a Google endpoint, so it is the part of
   the product most likely to be unavailable in mainland China.

   This opens a continuous audio connection to a region that is reachable
   there, with no transcription round trip. Two different tools, both offered.

   WHAT THIS COMPONENT DOES NOT DO. It does not interpret DataChannel messages.
   Tool calls arrive on that channel and go to `onMessage` untouched; routing
   them through the permission engine and the confirmation ledger is the next
   step and deliberately not smuggled in here. A call today can talk and
   listen; it cannot act.

   WHY THE AUDIO ELEMENT LIVES HERE. VoiceSession touches no DOM on purpose —
   it hands over a MediaStream and playback is the caller's business. That
   keeps the session testable in Node, which is why its 40 assertions can run
   at all.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  VoiceSession,
  browserVoiceDeps,
  HANDSHAKE_PATH,
  type VoiceState,
  type VoiceFailure,
} from "@/lib/voice/session";
import { type Lang } from "@/lib/i18n";
import {
  parseVoiceEvent,
  appendTranscript,
  type TranscriptLine,
  type VoicePhase,
} from "@/lib/voice/events";
import { useStreamLevel } from "@/lib/voice/useStreamLevel";
import VoiceCallScreen from "@/components/ai/VoiceCallScreen";

/* Every failure the session can report, in every language the app speaks.
   `Record<Lang, Record<VoiceFailure, string>>` makes a missing translation a
   compile error rather than a blank message a user has to interpret. */
const FAILURE_COPY: Record<Lang, Record<VoiceFailure, string>> = {
  en: {
    "no-microphone": "No microphone available, or permission was declined.",
    "not-allowed": "You do not have access to voice calls.",
    "too-many-calls": "Too many calls started just now. Wait about a minute and try again.",
    "signed-out": "Your session has expired. Please sign in again.",
    unavailable: "Voice is unavailable right now. Please try again later.",
    "connection-lost": "The connection dropped and did not come back. Please try again.",
    "config-rejected": "The call connected but could not be set up. Please try again.",
    "handshake-failed": "Could not start the call. Please try again.",
  },
  zh: {
    "no-microphone": "没有可用的麦克风，或者权限被拒绝。",
    "not-allowed": "您没有语音通话的权限。",
    "too-many-calls": "刚刚发起的通话过多，请等待约一分钟后再试。",
    "signed-out": "登录已过期，请重新登录。",
    unavailable: "语音服务当前不可用，请稍后再试。",
    "connection-lost": "连接中断且没有恢复，请重试。",
    "config-rejected": "通话已连接，但会话配置失败，请重试。",
    "handshake-failed": "无法开始通话，请重试。",
  },
  ar: {
    "no-microphone": "لا يوجد ميكروفون متاح، أو تم رفض الإذن.",
    "not-allowed": "ليس لديك صلاحية استخدام المكالمات الصوتية.",
    "too-many-calls": "بدأت مكالمات كتير في وقت قصير. استنى دقيقة وحاول تاني.",
    "signed-out": "الجلسة انتهت. سجّل دخول تاني.",
    unavailable: "الخدمة الصوتية غير متاحة حاليًا. حاول مرة أخرى لاحقًا.",
    "connection-lost": "الاتصال اتقطع وما رجعش تاني. حاول مرة أخرى.",
    "config-rejected": "المكالمة اتصلت بس تعذّر إعدادها. حاول تاني.",
    "handshake-failed": "تعذّر بدء المكالمة. حاول مرة أخرى.",
  },
};

const LABEL_COPY: Record<Lang, { start: string; end: string; connecting: string }> = {
  en: { start: "Start voice call", end: "End call", connecting: "Connecting…" },
  zh: { start: "开始语音通话", end: "结束通话", connecting: "正在连接…" },
  ar: { start: "ابدأ مكالمة صوتية", end: "إنهاء المكالمة", connecting: "جارٍ الاتصال…" },
};

export type VoiceCallButtonProps = {
  size?: number;
  lang?: Lang;
  disabled?: boolean;
  onError?: (message: string) => void;
  /** One decoded DataChannel message, passed through untouched. Still offered
   *  because the tool bridge will need the raw stream, not the captions. */
  onMessage?: (data: string) => void;
  /** The running conversation, rebuilt on every event. The parent renders it —
   *  this component owns the call, not the layout. */
  onTranscript?: (lines: readonly TranscriptLine[]) => void;
  /** What the far side is doing: drives the orb's listening/speaking states. */
  onPhase?: (phase: VoicePhase) => void;
  /** So the parent can mute its own speech synthesis while a call is live —
   *  two voices talking over each other is the obvious failure here. */
  onLiveChange?: (live: boolean) => void;
};

export default function VoiceCallButton({
  size = 36,
  lang = "en",
  disabled = false,
  onError,
  onMessage,
  onTranscript,
  onPhase,
  onLiveChange,
}: VoiceCallButtonProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [phase, setPhase] = useState<VoicePhase>(null);
  const [lines, setLines] = useState<readonly TranscriptLine[]>([]);
  /* Kept in state rather than a ref: the meter hook takes the stream as a
     dependency, so it must re-run when one arrives. */
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [farStream, setFarStream] = useState<MediaStream | null>(null);
  /* The catalogue, as the server describes it: keys and labels, never vendor
     ids. Empty until fetched, and empty forever if the owner configured none —
     in which case no picker is drawn and the vendor's default voice is used. */
  const [voices, setVoices] = useState<readonly { key: string; label: string }[]>([]);
  const [voiceKey, setVoiceKey] = useState<string | null>(null);
  /* Read inside the session callbacks, which outlive any single render. */
  const voiceKeyRef = useRef<string | null>(null);
  useEffect(() => { voiceKeyRef.current = voiceKey; }, [voiceKey]);

  /* Fetched once on mount rather than per call: it is small, it rarely
     changes, and asking for it while the user is waiting to talk would add a
     round trip to the one moment that should feel immediate. A failure is
     silent — no catalogue means no picker, which is the same as not having
     configured one, and is not worth an error a user cannot act on. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(HANDSHAKE_PATH, { credentials: "include" });
        if (!res.ok) return;
        const body = (await res.json()) as { voices?: { key: string; label: string }[] };
        if (cancelled || !Array.isArray(body.voices)) return;
        setVoices(body.voices);
        setVoiceKey((cur) => cur ?? body.voices?.[0]?.key ?? null);
      } catch {
        /* No picker. The call still works on the default voice. */
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const sessionRef = useRef<VoiceSession | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* Held in refs so the session's callbacks never close over a stale render.
     The session outlives any single render and fires from network events. */
  const onErrorRef = useRef(onError);
  const onMessageRef = useRef(onMessage);
  const onTranscriptRef = useRef(onTranscript);
  const onPhaseRef = useRef(onPhase);
  const onLiveChangeRef = useRef(onLiveChange);
  const langRef = useRef(lang);
  useEffect(() => {
    onErrorRef.current = onError;
    onMessageRef.current = onMessage;
    onTranscriptRef.current = onTranscript;
    onPhaseRef.current = onPhase;
    onLiveChangeRef.current = onLiveChange;
    langRef.current = lang;
  }, [onError, onMessage, onTranscript, onPhase, onLiveChange, lang]);

  /* The transcript accumulates across events and must not be React state HERE:
     this component re-renders on every phase change, and rebuilding the fold
     from a stale closure is how captions double or vanish. The parent owns
     the rendering; this owns the running total. */
  const linesRef = useRef<readonly TranscriptLine[]>([]);
  /* startCall is declared below and selectVoice needs it. A ref rather than a
     reorder: the declaration order here follows the call's lifecycle, and
     shuffling it to satisfy a closure would make it harder to read. */
  const startCallRef = useRef<(() => Promise<void>) | null>(null);

  /* A call must not survive the component. Without this, navigating away
     leaves the microphone captured and the recording indicator lit — the one
     failure here a user would rightly call a betrayal. */
  useEffect(() => {
    return () => {
      sessionRef.current?.stop();
      sessionRef.current = null;
    };
  }, []);

  const hangUp = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    /* Dropped so the meters tear their audio contexts down. A retained stream
       here would keep a hardware handle open for the life of the page. */
    setMicStream(null);
    setFarStream(null);
    setPhase(null);
    setState("idle");
    onLiveChangeRef.current?.(false);
    /* The transcript SURVIVES hang-up on purpose: what was said is what the
       user came for, and clearing it the instant the call ends throws away
       the record at the moment they want to read it. */
    onPhaseRef.current?.(null);
  }, []);

  const startCall = useCallback(async () => {
    if (sessionRef.current) return;
    /* A second call is a new conversation, not a continuation of the last
       one's captions. */
    linesRef.current = [];
    setLines(linesRef.current);
    setPhase(null);
    onTranscriptRef.current?.(linesRef.current);

    const session = new VoiceSession(browserVoiceDeps(), {
      onState: (next, failure) => {
        setState(next);
        /* RECONNECTING COUNTS AS LIVE TO THE PARENT. The microphone is still
           held and the far side may resume speaking at any moment, so a parent
           that unmutes its own speech synthesis here would talk over the call
           the instant it recovers. */
        onLiveChangeRef.current?.(next === "live" || next === "reconnecting");
        if (next === "failed" && failure) {
          onErrorRef.current?.(FAILURE_COPY[langRef.current][failure]);
          /* The session has already torn itself down; drop our handle so the
             next tap starts a fresh one rather than reusing a dead session. */
          sessionRef.current = null;
        }
      },
      onLocalStream: (stream) => setMicStream(stream),
      onRemoteStream: (stream) => {
        setFarStream(stream);
        if (audioRef.current) {
          audioRef.current.srcObject = stream;
          /* Autoplay can still be refused even after a user gesture on some
             browsers. Failing silently would look like a dead call, so it is
             reported as one. */
          void audioRef.current.play().catch(() => {
            onErrorRef.current?.(FAILURE_COPY[langRef.current]["handshake-failed"]);
          });
        }
      },
      onMessage: (data) => {
        /* Raw first, and unconditionally: the tool bridge will read this
           stream and must not depend on whether a caption was produced. */
        onMessageRef.current?.(data);

        /* UNTRUSTED TEXT. This came off a network socket and is about to be
           rendered. It is data, never instruction — nothing here dispatches
           on it, and the parser only ever returns strings. */
        const parsed = parseVoiceEvent(data);
        if (parsed.phase) {
          setPhase(parsed.phase);
          onPhaseRef.current?.(parsed.phase);
        }
        if (parsed.transcript) {
          linesRef.current = appendTranscript(linesRef.current, parsed.transcript);
          setLines(linesRef.current);
          onTranscriptRef.current?.(linesRef.current);
        }
      },
    }, voiceKeyRef.current);

    sessionRef.current = session;
    await session.start();
  }, []);
  useEffect(() => { startCallRef.current = startCall; }, [startCall]);

  /* ONE METER PER SIDE, AND ONLY THE ACTIVE ONE RUNS. Measuring both at once
     would burn a frame loop and an audio context on silence, which on a phone
     is battery for nothing. */
  /* A DROPPED CONNECTION IS STILL AN OPEN CALL. `reconnecting` is not `live`
     and it is not `idle`: the session is holding the microphone and is waiting
     to recover, so every place that asks "is there a call on screen" must say
     yes. Treating it as neither is how the call screen would have vanished
     mid-sentence on the unstable network this was built for. */
  const live = state === "live";
  const reconnecting = state === "reconnecting";
  const connected = live || reconnecting;
  const listening = connected && phase !== "speaking";
  const micLevel = useStreamLevel(micStream, listening);
  const farLevel = useStreamLevel(farStream, connected && phase === "speaking");
  const audioLevel = phase === "speaking" ? farLevel : micLevel;

  /* THE CONFIGURATION IS SENT ONCE PER SESSION, so a new voice needs a new
     session. Restarting is honest about that; silently storing the choice for
     "next time" would look like a control that does nothing. */
  const selectVoice = useCallback((key: string) => {
    setVoiceKey(key);
    voiceKeyRef.current = key;
    if (sessionRef.current) {
      hangUp();
      /* After the teardown, not during it: start() refuses while a session
         handle is still held. */
      queueMicrotask(() => void startCallRef.current?.());
    }
  }, [hangUp]);

  const busy = state === "requesting-mic" || state === "connecting";
  const labels = LABEL_COPY[lang];
  const label = connected ? labels.end : busy ? labels.connecting : labels.start;

  return (
    <>
      {/* Playback only. Never rendered visibly — the button is the control. */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      {/* A live call takes the screen. Mounted for `busy` too, so connecting
          is visible rather than a button that looks stuck. */}
      {(connected || busy) && (
        <VoiceCallScreen
          live={connected}
          reconnecting={reconnecting}
          phase={phase}
          audioLevel={audioLevel}
          lines={lines}
          lang={lang}
          onEnd={hangUp}
          voices={voices}
          selectedVoice={voiceKey}
          onSelectVoice={selectVoice}
        />
      )}
      <button
        type="button"
        onClick={connected || busy ? hangUp : () => void startCall()}
        disabled={disabled && !connected && !busy}
        aria-label={label}
        title={label}
        aria-pressed={connected}
        style={{ height: size, width: size }}
        className={`rounded-full inline-flex items-center justify-center shrink-0 transition-colors ${
          connected
            ? "bg-[#FF3333]/[0.16] text-[#FF3333] ring-1 ring-[#FF3333]/50"
            : busy
              ? "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)]"
              : "text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
        } ${disabled && !connected && !busy ? "opacity-40 cursor-not-allowed" : ""}`}
      >
        {connected ? (
          /* Hang up — a struck-through handset reads as "end" across locales
             more reliably than a rotated one. */
          <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        ) : busy ? (
          <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.22-8.56" />
          </svg>
        ) : (
          /* Waveform — a call you speak into, distinct from the mic beside it. */
          <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="10" x2="4" y2="14" />
            <line x1="8" y1="7" x2="8" y2="17" />
            <line x1="12" y1="4" x2="12" y2="20" />
            <line x1="16" y1="7" x2="16" y2="17" />
            <line x1="20" y1="10" x2="20" y2="14" />
          </svg>
        )}
      </button>
    </>
  );
}
