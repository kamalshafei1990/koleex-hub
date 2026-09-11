"use client";

/* ---------------------------------------------------------------------------
   useDictation — the browser's own speech-to-text, as a hook.

   Lifted out of MicButton (audit, 2026-09-11) so the SAME recogniser can sit
   behind two controls: the standalone mic that Discuss and the floating
   panel still draw, and the chat composer's single voice control, where a
   long press dictates and a tap starts a call. One implementation, one set
   of error sentences, one place the "aborted after unmount" guard lives.

   Web Speech (SpeechRecognition / webkitSpeechRecognition) runs on the
   device or the browser vendor's service — no key, no backend, no cost, and
   no vendor of ours. Browsers without it get one clear sentence.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";

type Lang = "en" | "zh" | "ar";

/* Minimal typings for the vendor-prefixed Web Speech API — the full DOM
   declaration is not present in every TS config, and a thin structural
   type is all this needs. */
interface SRResult {
  isFinal: boolean;
  [index: number]: { transcript: string } | undefined;
}
interface SREvent {
  resultIndex: number;
  results: ArrayLike<SRResult>;
}
interface SRErrorEvent {
  error?: string;
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

/** True where the browser offers speech recognition at all. */
export function dictationSupported(): boolean {
  return getSRConstructor() !== null;
}

/* EVERY SENTENCE DICTATION CAN SAY, in the three UI languages. They reach
   the chat's red banner through onError. */
export const DICTATION_COPY: Record<Lang, {
  rec: string;
  unsupported: string;
  noSpeech: string;
  denied: string;
  noMic: string;
  network: string;
  failed: string;
  cantStart: string;
}> = {
  en: {
    rec: "REC",
    unsupported: "Your browser doesn't support voice input. Try Chrome or Edge.",
    noSpeech: "I didn't hear anything — please try again.",
    denied: "Microphone permission was denied.",
    noMic: "Couldn't access your microphone.",
    network: "Voice service is unreachable — please try again.",
    failed: "Voice input failed. Please try again.",
    cantStart: "Couldn't start voice input.",
  },
  zh: {
    rec: "录音",
    unsupported: "你的浏览器不支持语音输入，请试试 Chrome 或 Edge。",
    noSpeech: "没有听到声音，请再试一次。",
    denied: "麦克风权限被拒绝。",
    noMic: "无法访问麦克风。",
    network: "语音服务暂时无法连接，请再试一次。",
    failed: "语音输入失败，请再试一次。",
    cantStart: "无法启动语音输入。",
  },
  ar: {
    rec: "تسجيل",
    unsupported: "المتصفح ده مش بيدعم الإدخال الصوتي — جرّب Chrome أو Edge.",
    noSpeech: "مسمعتش حاجة — جرّب تاني.",
    denied: "إذن الميكروفون مرفوض.",
    noMic: "مقدرناش نوصل للميكروفون.",
    network: "خدمة الصوت مش متاحة دلوقتي — جرّب تاني.",
    failed: "الإدخال الصوتي فشل. جرّب تاني.",
    cantStart: "مقدرناش نبدأ الإدخال الصوتي.",
  },
};

/** m:ss for the live recording pill. */
export function formatDictationDuration(s: number): string {
  if (s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

export interface DictationHandle {
  /** True from the recogniser's onstart until it ends. */
  listening: boolean;
  /** Seconds since recording started; zeroed on each start. */
  elapsed: number;
  /** Begin listening. Reports "not supported" through onError where the
   *  browser has no recogniser. A call while already listening is ignored. */
  start: () => void;
  /** Stop listening; the finalised words arrive through onTranscript once
   *  the recogniser ends. A call while idle is ignored. */
  stop: () => void;
}

export function useDictation(opts: {
  lang?: Lang;
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}): DictationHandle {
  const { lang } = opts;
  /* Callbacks through refs: the recogniser's handlers are wired once per
     session and must call the caller's LATEST functions. */
  const onTranscriptRef = useRef(opts.onTranscript);
  const onErrorRef = useRef(opts.onError);
  useEffect(() => {
    onTranscriptRef.current = opts.onTranscript;
    onErrorRef.current = opts.onError;
  });

  const copy = DICTATION_COPY[lang ?? "en"];
  const [listening, setListening] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  /* Finalised segments of one session. onresult fires with partial and
     final chunks; only the final ones are kept, so a short pause does not
     drop the earlier part of the sentence. */
  const finalTextRef = useRef("");

  useEffect(() => {
    if (!listening) return;
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [listening]);

  /* The recogniser's onend / onresult / onerror can fire AFTER the owner
     unmounts (the engine does not always cancel synchronously); the alive
     flag keeps them from touching a dead component (audit P0 #12). */
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      try { recognitionRef.current?.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    };
  }, []);

  const fail = useCallback((message: string) => {
    setListening(false);
    try { recognitionRef.current?.abort(); } catch { /* ignore */ }
    recognitionRef.current = null;
    onErrorRef.current?.(message);
  }, []);

  /** BCP-47 tag for the recogniser; unset lets the browser pick. */
  const bcp47 = lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-SA" : lang === "en" ? "en-US" : "";

  const start = useCallback(() => {
    if (recognitionRef.current) return;
    const SR = getSRConstructor();
    if (!SR) {
      fail(copy.unsupported);
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
        /* Web Speech error codes: no-speech, aborted (ours — ignore),
           audio-capture, not-allowed, network. */
        const code = ev.error ?? "";
        if (code === "aborted") return;
        if (code === "no-speech") return fail(copy.noSpeech);
        if (code === "not-allowed" || code === "service-not-allowed") return fail(copy.denied);
        if (code === "audio-capture") return fail(copy.noMic);
        if (code === "network") return fail(copy.network);
        fail(copy.failed);
      };
      recognition.onend = () => {
        const text = finalTextRef.current.trim();
        finalTextRef.current = "";
        recognitionRef.current = null;
        if (!aliveRef.current) return;
        setListening(false);
        if (text) onTranscriptRef.current(text);
      };
      recognition.onstart = () => {
        if (!aliveRef.current) return;
        setElapsed(0);
        setListening(true);
      };
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      fail(/denied|not allowed/i.test(msg) ? copy.denied : copy.cantStart);
    }
  }, [bcp47, copy, fail]);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    /* stop(), not abort(): onend delivers the finalised words. */
    try { rec.stop(); } catch { /* ignore */ }
  }, []);

  return { listening, elapsed, start, stop };
}
