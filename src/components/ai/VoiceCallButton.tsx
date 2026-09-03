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

   WHAT THIS COMPONENT DOES NOT DO. It does not interpret DataChannel messages
   beyond what the pure modules in lib/voice parse for it. A call can talk,
   listen and look things up; it cannot act — the tools are read-only and the
   server chooses them.

   WHAT IT NOW ALSO DOES. Two things that make a call part of the
   conversation rather than a thing beside it: settled turns are handed to a
   TranscriptPersister, which posts them to a route that writes them into the
   open thread (lib/voice/persist.ts); and the conversation's id travels with
   the handshake so the server can read its recent turns into the session.
   Neither happens in this file — it wires them.

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
import { extractProductPhotos, type ProductPhoto } from "@/lib/voice/photos";
import { useStreamLevel } from "@/lib/voice/useStreamLevel";
import { CallTones } from "@/lib/voice/tones";
import { TranscriptPersister, type SavedTurn, type PersistFailure } from "@/lib/voice/persist";
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
    "service-unreachable": "The voice service is not responding. Please try again shortly.",
    "service-refused": "The voice service refused the call. This usually needs an administrator — please report it.",
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
    "service-unreachable": "语音服务无响应，请稍后再试。",
    "service-refused": "语音服务拒绝了本次通话，通常需要管理员处理，请反馈此问题。",
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
    "service-unreachable": "الخدمة الصوتية مش بتردّ. حاول كمان شوية.",
    "service-refused": "الخدمة الصوتية رفضت المكالمة. ده غالبًا محتاج مسؤول النظام — بلّغ عنه.",
    "config-rejected": "المكالمة اتصلت بس تعذّر إعدادها. حاول تاني.",
    "handshake-failed": "تعذّر بدء المكالمة. حاول مرة أخرى.",
  },
};

/* When the transcript could not be saved. One line, once per call, and the
   call itself is unaffected — the words were still heard and answered. */
const PERSIST_COPY: Record<Lang, Record<PersistFailure, string>> = {
  en: {
    failed: "This call's transcript could not be saved to the conversation.",
    unauthorised: "This call's transcript could not be saved — you are no longer allowed to.",
    "not-found": "This call's transcript could not be saved — the conversation is gone.",
  },
  zh: {
    failed: "本次通话的文字记录无法保存到对话中。",
    unauthorised: "本次通话的文字记录无法保存——您已没有权限。",
    "not-found": "本次通话的文字记录无法保存——该对话已不存在。",
  },
  ar: {
    failed: "ما قدرناش نحفظ كلام المكالمة دي في المحادثة.",
    unauthorised: "ما قدرناش نحفظ كلام المكالمة — ما بقالكش صلاحية.",
    "not-found": "ما قدرناش نحفظ كلام المكالمة — المحادثة اتمسحت.",
  },
};

/* How long a live call may go unacknowledged before it is called ready
   anyway. Long enough for a slow session.update round trip on a mainland
   network; short enough that nobody waits on a vendor that never answers. */
const READY_FALLBACK_MS = 2_500;

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
  /** The conversation this call continues. Sent with the handshake so the
   *  server can read its recent turns into the session, and the thread the
   *  spoken turns are written into. Null on an empty screen. */
  conversationId?: string | null;
  /** Makes a conversation when there is none — called by the persister the
   *  first time a settled turn needs somewhere to go, never at call start, so
   *  a call that fails to connect leaves no empty chat behind. */
  ensureConversation?: () => Promise<string | null>;
  /** The rows the server wrote, so the parent can show them in the thread. */
  onTurnsSaved?: (rows: SavedTurn[], conversation: { id: string; title: string | null }) => void;
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
  conversationId = null,
  ensureConversation,
  onTurnsSaved,
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
  /* Mirrors the session's flag. Kept in state because the screen renders from
     it; the session stays the source of truth for the tracks themselves. */
  const [muted, setMuted] = useState(false);
  /* READY IS NOT LIVE. `live` is the transport standing; `ready` is the far
     side having accepted the session configuration, which is when it listens
     as Koleex AI. The caption says "go ahead" and the tone sounds on READY —
     a caller told to go ahead a beat too early speaks to a session that has
     not yet been told who it is. A vendor that never acknowledges is covered
     by a fallback timer, so the call can never be stuck on "connecting". */
  const [ready, setReady] = useState(false);
  /* One per call, made INSIDE the tap that starts it (browsers unlock audio
     only in a gesture) and closed with it. */
  const tonesRef = useRef<CallTones | null>(null);
  /* The tone plays once per call, and once per recovery — never on a
     re-render. */
  const chimedRef = useRef(false);
  const prevStateRef = useRef<VoiceState>("idle");
  /* A lookup takes a second or two of real silence. The model is told to say
     "let me check" first, but it does not always, and a screen that says
     nothing during it reads as a frozen call. */
  const [searching, setSearching] = useState(false);
  /* WHAT THE LAST LOOKUP SHOWED. A product search on a call used to be heard
     and never seen; these are the photos out of its result, drawn on the
     call screen until the next lookup replaces them or the call ends. */
  const [photos, setPhotos] = useState<readonly ProductPhoto[]>([]);
  /* Held until the assistant's next turn, then attached to THAT line so the
     saved message carries the picture with the words that described it. */
  const pendingPhotosRef = useRef<readonly ProductPhoto[]>([]);
  /* ONE TIMER, NOT ONE PER LOOKUP — and the bug that made this necessary.
     The floor timer was created bare on every tool call, so a call that
     looked two things up had two of them running. The FIRST one then fired
     while the SECOND lookup was still in flight and cleared the indicator,
     so the screen went quiet and the caller was told nothing was happening
     while something was. Holding the handle lets each new lookup replace the
     previous floor instead of racing it — and lets hang-up cancel it, which
     nothing did before. */
  const searchTimerRef = useRef<number | null>(null);
  const clearSearchTimer = useCallback(() => {
    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
  }, []);
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
  const conversationIdRef = useRef(conversationId);
  const ensureConversationRef = useRef(ensureConversation);
  const onTurnsSavedRef = useRef(onTurnsSaved);
  useEffect(() => {
    onErrorRef.current = onError;
    onMessageRef.current = onMessage;
    onTranscriptRef.current = onTranscript;
    onPhaseRef.current = onPhase;
    onLiveChangeRef.current = onLiveChange;
    langRef.current = lang;
    conversationIdRef.current = conversationId;
    ensureConversationRef.current = ensureConversation;
    onTurnsSavedRef.current = onTurnsSaved;
  }, [onError, onMessage, onTranscript, onPhase, onLiveChange, lang, conversationId, ensureConversation, onTurnsSaved]);

  /* One per call, made with the session and finished with it. Holds the
     count of turns already queued, which is why it cannot outlive a call. */
  const persisterRef = useRef<TranscriptPersister | null>(null);

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
      /* The last settled turn is often still queued at the moment the screen
         goes. `finish` posts with keepalive so it outlives the unmount. */
      void persisterRef.current?.finish();
      persisterRef.current = null;
      tonesRef.current?.close();
      tonesRef.current = null;
    };
  }, []);

  const hangUp = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    void persisterRef.current?.finish();
    persisterRef.current = null;
    tonesRef.current?.close();
    tonesRef.current = null;
    chimedRef.current = false;
    setReady(false);
    if (audioRef.current) audioRef.current.srcObject = null;
    /* Dropped so the meters tear their audio contexts down. A retained stream
       here would keep a hardware handle open for the life of the page. */
    setMicStream(null);
    setFarStream(null);
    setPhase(null);
    setState("idle");
    setMuted(false);
    clearSearchTimer();
    setSearching(false);
    setPhotos([]);
    pendingPhotosRef.current = [];
    onLiveChangeRef.current?.(false);
    /* The transcript SURVIVES hang-up on purpose: what was said is what the
       user came for, and clearing it the instant the call ends throws away
       the record at the moment they want to read it. */
    onPhaseRef.current?.(null);
    /* clearSearchTimer is a stable useCallback([]) — naming it here satisfies
       the exhaustive-deps rule without making this callback churn. */
  }, [clearSearchTimer]);

  const startCall = useCallback(async () => {
    if (sessionRef.current) return;
    /* A second call is a new conversation, not a continuation of the last
       one's captions. */
    linesRef.current = [];
    setLines(linesRef.current);
    setPhase(null);
    /* The session resets its own flag on start; this keeps the UI in step so a
       second call never opens showing the last one's mute. */
    setMuted(false);
    setPhotos([]);
    pendingPhotosRef.current = [];
    onTranscriptRef.current?.(linesRef.current);
    setReady(false);
    chimedRef.current = false;
    /* Primed HERE, in the tap: the context a browser will let play later is
       the one created while the gesture is current. */
    tonesRef.current?.close();
    tonesRef.current = new CallTones();
    tonesRef.current.prime();

    /* THE WRITER FOR THIS CALL. `fetch` is wrapped rather than passed: a bare
       reference to window.fetch throws "Illegal invocation" when called off
       the window. A missing ensureConversation means turns wait on an id that
       never comes and are dropped at the failure cap — a parent that does not
       wire persistence gets none, with no error. */
    persisterRef.current = new TranscriptPersister(
      {
        fetchFn: (input, init) => fetch(input, init),
        ensureConversation: () => ensureConversationRef.current?.() ?? Promise.resolve(null),
        onSaved: (rows, conversation) => onTurnsSavedRef.current?.(rows, conversation),
        onError: (reason) => onErrorRef.current?.(PERSIST_COPY[langRef.current][reason]),
      },
      conversationIdRef.current,
    );

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
      onReady: () => setReady(true),
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
      onToolCall: () => {
        setSearching(true);
        /* Cleared on the next thing the far side says, and on a timer as a
           floor: a failed lookup still ends, and an indicator that never
           clears is worse than none. The previous floor is cancelled first,
           so a second lookup extends the indicator rather than inheriting
           the deadline of the first one. */
        clearSearchTimer();
        searchTimerRef.current = window.setTimeout(() => {
          searchTimerRef.current = null;
          setSearching(false);
        }, 12_000);
      },
      onToolResult: (_name, output) => {
        /* DATA, READ FOR PICTURES AND NOTHING ELSE. https URLs only, capped,
           deduplicated — see voice/photos.ts. An empty result leaves the
           screen as it was: a lookup that found no photo should not blank
           the one from the lookup before it. */
        const found = extractProductPhotos(output);
        if (found.length === 0) return;
        setPhotos(found);
        pendingPhotosRef.current = found;
      },
      onToolProtocolMismatch: (eventType) => {
        /* THE ONE PLACE THIS BECOMES VISIBLE. If the vendor names its
           function-call events differently, every lookup silently does
           nothing and the model answers from memory sounding just as certain.
           This is the line that turns that into a minute of work instead of a
           bug report about the assistant being out of date. */
        console.warn(
          `[voice] a tool call arrived in an unrecognised shape: ${eventType}. ` +
            `Search during a call will not work until src/lib/voice/tool-calls.ts handles it.`,
        );
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
          /* The far side is talking again, so whatever it was checking is
             done. Clearing here rather than on the tool result keeps the
             indicator honest: what ends the wait is the answer being spoken. */
          if (parsed.phase === "speaking") setSearching(false);
          setPhase(parsed.phase);
          onPhaseRef.current?.(parsed.phase);
        }
        if (parsed.transcript) {
          /* The photos ride on the assistant turn that follows the lookup —
             the answer that describes them. Attached once; appendTranscript
             keeps them on the line through every later delta. */
          const update =
            parsed.transcript.role === "assistant" && pendingPhotosRef.current.length > 0
              ? { ...parsed.transcript, photos: pendingPhotosRef.current }
              : parsed.transcript;
          if (update !== parsed.transcript) pendingPhotosRef.current = [];
          linesRef.current = appendTranscript(linesRef.current, update);
          setLines(linesRef.current);
          onTranscriptRef.current?.(linesRef.current);
          /* Settled turns leave for the conversation from here. The
             persister reads the same list the screen renders, so what is
             saved is exactly what was shown. */
          persisterRef.current?.observe(linesRef.current);
        }
      },
    }, voiceKeyRef.current, conversationIdRef.current, langRef.current);

    sessionRef.current = session;
    await session.start();
  }, [clearSearchTimer]);
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

  /* THE FALLBACK FOR READY. A vendor that never acknowledges the session
     configuration would otherwise leave a working call saying "connecting"
     for ever. Live for this long with no word from the far side is treated
     as ready — the transport is up and the microphone is open. */
  useEffect(() => {
    if (!live || ready) return;
    const t = window.setTimeout(() => setReady(true), READY_FALLBACK_MS);
    return () => window.clearTimeout(t);
  }, [live, ready]);

  /* THE SOUND. Once when the call becomes ready, once more each time a
     dropped connection comes back — the two moments a caller may start
     talking again and may not be looking at the screen. */
  useEffect(() => {
    if (live && ready && !chimedRef.current) {
      chimedRef.current = true;
      tonesRef.current?.ready();
    }
  }, [live, ready]);
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;
    if (prev === "reconnecting" && state === "live") tonesRef.current?.recovered();
  }, [state]);
  const listening = connected && phase !== "speaking";
  const micLevel = useStreamLevel(micStream, listening);
  const farLevel = useStreamLevel(farStream, connected && phase === "speaking");
  const audioLevel = phase === "speaking" ? farLevel : micLevel;

  /* THE CONFIGURATION IS SENT ONCE PER SESSION, so a new voice needs a new
     session. Restarting is honest about that; silently storing the choice for
     "next time" would look like a control that does nothing. */
  const toggleMute = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    /* READ THE SESSION, NOT THE COMPONENT STATE. The session owns the tracks;
       deriving the next value from a possibly-stale render would let the
       button and the microphone disagree, which is the one thing a mute
       control must never do. */
    const next = !session.isMuted();
    session.setMuted(next);
    setMuted(next);
  }, []);

  /* TYPE INTO THE CALL. The text goes to the session as the user's turn and
     into the transcript as a settled user line marked `via: "text"`, so the
     screen shows it at once and the persister writes it as a TYPED message —
     it was typed, and the thread should say so. */
  const sendTyped = useCallback((text: string): boolean => {
    const session = sessionRef.current;
    if (!session) return false;
    const trimmed = text.trim();
    if (!trimmed || !session.sendText(trimmed)) return false;
    linesRef.current = appendTranscript(linesRef.current, {
      role: "user",
      text: trimmed,
      final: true,
      via: "text",
    });
    setLines(linesRef.current);
    onTranscriptRef.current?.(linesRef.current);
    persisterRef.current?.observe(linesRef.current);
    return true;
  }, []);

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
          ready={ready}
          reconnecting={reconnecting}
          phase={phase}
          audioLevel={audioLevel}
          lines={lines}
          lang={lang}
          onEnd={hangUp}
          muted={muted}
          onToggleMute={toggleMute}
          searching={searching}
          photos={photos}
          voices={voices}
          selectedVoice={voiceKey}
          onSelectVoice={selectVoice}
          onSendText={sendTyped}
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
