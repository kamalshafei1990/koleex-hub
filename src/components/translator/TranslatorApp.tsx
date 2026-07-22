"use client";

/* ---------------------------------------------------------------------------
   Translator — the Hub's own translation app.

   Layout follows the canonical Koleex app shell: PageHeader (hero + tabs)
   over a two-pane workspace. Source pane left, translation pane right on
   desktop; stacked on mobile with the language bar between them.

   Speed model — three layers, so the result feels instant:
     1. Tenant cache hit  → whole translation arrives in one chunk (~100ms).
     2. Streaming miss    → text paints token-by-token as the model writes it,
                            so the first words show in ~300–600ms.
     3. Debounce (450ms)  → typing doesn't fire a request per keystroke; the
                            in-flight request is aborted when a newer one starts.

   A monotonic request id guards against out-of-order responses (an older,
   slower stream must never overwrite a newer one) — the same stale-response
   discipline used in Discuss.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import TranslatorIcon from "@/components/icons/TranslatorIcon";
import { useTranslation } from "@/lib/i18n";
import type { Lang as UiLang } from "@/lib/i18n";
import { translatorT } from "@/lib/translations/translator";
import {
  LANGUAGES,
  LANG_BY_CODE,
  QUICK_SOURCE,
  QUICK_TARGET,
  guessLanguage,
  isRtl,
  langLabel,
} from "@/lib/translator-langs";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import MicIcon from "@/components/icons/ui/MicIcon";
import Volume2Icon from "@/components/icons/ui/Volume2Icon";
import StarIcon from "@/components/icons/ui/StarIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";

const MAX_CHARS = 5_000;
const DEBOUNCE_MS = 450;
const HISTORY_KEY = "kx_translator_history_v1";
const SAVED_KEY = "kx_translator_saved_v1";
const PREFS_KEY = "kx_translator_prefs_v1";
const MAX_HISTORY = 60;

interface Entry {
  id: string;
  source: string;
  translated: string;
  from: string;
  to: string;
  at: number;
}

type Tab = "text" | "history" | "saved";

/* ── Speech helpers (browser-native — no backend, works offline) ── */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — history is a convenience, never block on it */
  }
}

export default function TranslatorApp() {
  const { t, lang: uiLang } = useTranslation(translatorT);
  const ui = (uiLang ?? "en") as UiLang;

  const [tab, setTab] = useState<Tab>("text");
  const [source, setSource] = useState("");
  const [translated, setTranslated] = useState("");
  const [from, setFrom] = useState("auto");
  const [to, setTo] = useState("zh");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [copied, setCopied] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [history, setHistory] = useState<Entry[]>([]);
  const [saved, setSaved] = useState<Entry[]>([]);
  const [pickerOpen, setPickerOpen] = useState<"from" | "to" | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");

  const reqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sourceRef = useRef<HTMLTextAreaElement | null>(null);

  /* Restore prefs + local lists once on mount. */
  useEffect(() => {
    const prefs = readLocal<{ from?: string; to?: string }>(PREFS_KEY, {});
    if (prefs.from) setFrom(prefs.from);
    if (prefs.to) setTo(prefs.to);
    setHistory(readLocal<Entry[]>(HISTORY_KEY, []));
    setSaved(readLocal<Entry[]>(SAVED_KEY, []));
  }, []);

  useEffect(() => {
    writeLocal(PREFS_KEY, { from, to });
  }, [from, to]);

  const detected = useMemo(
    () => (from === "auto" ? guessLanguage(source) : null),
    [from, source],
  );
  const effectiveFrom = from === "auto" ? (detected ?? "auto") : from;

  /* ── The translation call ── */
  const translate = useCallback(
    async (text: string, srcLang: string, tgtLang: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setTranslated("");
        setBusy(false);
        setError(null);
        return;
      }
      if (text.length > MAX_CHARS) {
        setError(t("tr.tooLong", "Text is too long — max {max} characters.").replace("{max}", String(MAX_CHARS)));
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const myReq = ++reqRef.current;

      setBusy(true);
      setError(null);
      setCached(false);

      try {
        const res = await fetch("/api/translator", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ text, target_lang: tgtLang, source_lang: srcLang }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          if (myReq === reqRef.current) {
            setError(res.status === 503 ? t("tr.unavailable", "Translation service is unavailable right now.") : t("tr.error", "Translation failed. Try again."));
            setBusy(false);
          }
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";
        let sawCache = false;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const payload = line.startsWith("data: ") ? line.slice(6) : null;
            if (!payload) continue;
            let evt: { type?: string; text?: string; translated?: string; cached?: boolean; error?: string };
            try {
              evt = JSON.parse(payload);
            } catch {
              continue;
            }
            // Stale guard: an older stream must never paint over a newer one.
            if (myReq !== reqRef.current) return;
            if (evt.type === "delta" && evt.text) {
              acc += evt.text;
              setTranslated(acc);
            } else if (evt.type === "end") {
              acc = evt.translated ?? acc;
              sawCache = evt.cached === true;
              setTranslated(acc);
            } else if (evt.type === "error") {
              setError(
                evt.error === "translation_unavailable"
                  ? t("tr.unavailable", "Translation service is unavailable right now.")
                  : t("tr.error", "Translation failed. Try again."),
              );
            }
          }
        }

        if (myReq !== reqRef.current) return;
        setCached(sawCache);
        setBusy(false);

        if (acc.trim()) {
          const entry: Entry = {
            id: `${Date.now()}-${Math.round(performance.now())}`,
            source: text,
            translated: acc,
            from: srcLang,
            to: tgtLang,
            at: Date.now(),
          };
          setHistory((prev) => {
            // Collapse consecutive edits of the same phrase into one row.
            const deduped = prev.filter((h) => !(h.source === text && h.to === tgtLang));
            const next = [entry, ...deduped].slice(0, MAX_HISTORY);
            writeLocal(HISTORY_KEY, next);
            return next;
          });
        }
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return; // superseded — expected
        if (myReq === reqRef.current) {
          setError(t("tr.error", "Translation failed. Try again."));
          setBusy(false);
        }
      }
    },
    [t],
  );

  /* Debounced auto-translate as the user types. */
  useEffect(() => {
    const text = source;
    if (!text.trim()) {
      setTranslated("");
      setBusy(false);
      return;
    }
    setBusy(true); // show activity immediately, before the debounce fires
    const timer = setTimeout(() => {
      void translate(text, from, to);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [source, from, to, translate]);

  /* Stop any in-flight work when the app unmounts. */
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      recognitionRef.current?.stop();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const swap = () => {
    const nextFrom = from === "auto" ? (detected ?? "en") : from;
    setFrom(to);
    setTo(nextFrom);
    setSource(translated);
    setTranslated(source);
  };

  const copy = async () => {
    if (!translated) return;
    try {
      await navigator.clipboard.writeText(translated);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — nothing to recover, the text is selectable */
    }
  };

  const speak = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    if (!translated) return;
    const utter = new SpeechSynthesisUtterance(translated);
    utter.lang = LANG_BY_CODE[to]?.speech ?? to;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  };

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = getRecognition();
    if (!rec) {
      setError(t("tr.voiceUnsupported", "Voice input isn't supported in this browser."));
      return;
    }
    rec.lang = LANG_BY_CODE[effectiveFrom]?.speech ?? "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0]?.transcript ?? "";
      setSource(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    setError(null);
    rec.start();
  };

  const isSavedNow = useMemo(
    () => saved.some((s) => s.source === source && s.to === to),
    [saved, source, to],
  );

  const toggleSave = () => {
    if (!source.trim() || !translated.trim()) return;
    setSaved((prev) => {
      const exists = prev.some((s) => s.source === source && s.to === to);
      const next = exists
        ? prev.filter((s) => !(s.source === source && s.to === to))
        : [
            { id: `${Date.now()}`, source, translated, from: effectiveFrom, to, at: Date.now() },
            ...prev,
          ].slice(0, MAX_HISTORY);
      writeLocal(SAVED_KEY, next);
      return next;
    });
  };

  const reuse = (e: Entry) => {
    setFrom(e.from === "auto" ? "auto" : e.from);
    setTo(e.to);
    setSource(e.source);
    setTranslated(e.translated);
    setTab("text");
    requestAnimationFrame(() => sourceRef.current?.focus());
  };

  /* ── Small presentational pieces ── */
  const LangTab = ({
    code,
    active,
    onClick,
  }: {
    code: string;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
        active
          ? "bg-[var(--bg-surface)] font-semibold text-[var(--text-primary)]"
          : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
      }`}
    >
      {code === "auto"
        ? detected
          ? `${t("tr.detect", "Detect language")} · ${langLabel(detected, ui)}`
          : t("tr.detect", "Detect language")
        : langLabel(code, ui)}
    </button>
  );

  const LangPicker = ({ side }: { side: "from" | "to" }) => {
    const open = pickerOpen === side;
    const current = side === "from" ? from : to;
    const list = LANGUAGES.filter((l) => {
      if (!pickerQuery.trim()) return true;
      const q = pickerQuery.toLowerCase();
      return (
        l.label[ui].toLowerCase().includes(q) ||
        l.label.en.toLowerCase().includes(q) ||
        l.native.toLowerCase().includes(q) ||
        l.code.includes(q)
      );
    });
    return (
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => {
            setPickerOpen(open ? null : side);
            setPickerQuery("");
          }}
          title={t("tr.moreLanguages", "More languages")}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
        >
          <AngleDownIcon size={14} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setPickerOpen(null)} />
            <div className="absolute z-[61] mt-1 max-h-[320px] w-64 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl ltr:left-0 rtl:right-0">
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
                <SearchIcon size={13} className="shrink-0 text-[var(--text-dim)]" />
                <input
                  autoFocus
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder={t("tr.searchLanguage", "Search language…")}
                  className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
                />
              </div>
              <div className="max-h-[268px] overflow-y-auto py-1">
                {side === "from" && (
                  <button
                    type="button"
                    onClick={() => {
                      setFrom("auto");
                      setPickerOpen(null);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-[12.5px] transition-colors hover:bg-[var(--bg-surface-hover)] ${
                      current === "auto" ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {t("tr.detect", "Detect language")}
                  </button>
                )}
                {list.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => {
                      if (side === "from") setFrom(l.code);
                      else setTo(l.code);
                      setPickerOpen(null);
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-start text-[12.5px] transition-colors hover:bg-[var(--bg-surface-hover)] ${
                      current === l.code ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)]"
                    }`}
                  >
                    <span className="truncate">{l.label[ui]}</span>
                    <span className="shrink-0 text-[11px] text-[var(--text-dim)]">{l.native}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const EntryList = ({ items, kind }: { items: Entry[]; kind: "history" | "saved" }) => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-16 text-center">
          <TranslatorIcon size={28} className="text-[var(--text-dim)]" />
          <p className="mt-3 text-[13px] text-[var(--text-muted)]">
            {kind === "history"
              ? t("tr.historyEmpty", "Your recent translations appear here.")
              : t("tr.savedEmpty", "Star a translation to keep it here.")}
          </p>
          <p className="mt-1 text-[11.5px] text-[var(--text-dim)]">{t("tr.localOnly", "Stored on this device only")}</p>
        </div>
      );
    }
    return (
      <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
        {items.map((e, i) => (
          <div
            key={e.id}
            className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? "border-t border-[var(--border-subtle)]" : ""}`}
          >
            <button type="button" onClick={() => reuse(e)} className="min-w-0 flex-1 text-start">
              <span
                className="block truncate text-[13px] text-[var(--text-primary)]"
                dir={isRtl(e.from) ? "rtl" : "ltr"}
              >
                {e.source}
              </span>
              <span
                className="mt-0.5 block truncate text-[12.5px] text-[var(--text-muted)]"
                dir={isRtl(e.to) ? "rtl" : "ltr"}
              >
                {e.translated}
              </span>
              <span className="mt-1 block text-[10.5px] uppercase tracking-wide text-[var(--text-dim)]">
                {e.from === "auto" ? t("tr.detect", "Detect language") : langLabel(e.from, ui)} → {langLabel(e.to, ui)}
              </span>
            </button>
            <button
              type="button"
              title={t("tr.remove", "Remove")}
              onClick={() => {
                const next = items.filter((x) => x.id !== e.id);
                if (kind === "history") {
                  setHistory(next);
                  writeLocal(HISTORY_KEY, next);
                } else {
                  setSaved(next);
                  writeLocal(SAVED_KEY, next);
                }
              }}
              className="shrink-0 rounded-lg p-1.5 text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
            >
              <CrossIcon size={13} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const iconBtn =
    "rounded-lg p-2 text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <PageHeader
        title={t("tr.title", "Translator")}
        subtitle={t("tr.subtitle", "Translate text between 18 languages")}
        icon={<TranslatorIcon size={20} />}
        backHref="/"
        tabs={[
          { key: "text", label: t("tr.title", "Translator"), active: tab === "text", onClick: () => setTab("text") },
          { key: "history", label: t("tr.history", "History"), active: tab === "history", onClick: () => setTab("history") },
          { key: "saved", label: t("tr.savedTab", "Saved"), active: tab === "saved", onClick: () => setTab("saved") },
        ]}
      />

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6">
        {tab === "text" && (
          <>
            {/* Language bar */}
            <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                <LangTab code="auto" active={from === "auto"} onClick={() => setFrom("auto")} />
                {QUICK_SOURCE.map((c) => (
                  <LangTab key={c} code={c} active={from === c} onClick={() => setFrom(c)} />
                ))}
                {from !== "auto" && !QUICK_SOURCE.includes(from) && (
                  <LangTab code={from} active onClick={() => setFrom(from)} />
                )}
                <LangPicker side="from" />
              </div>

              <button
                type="button"
                onClick={swap}
                title={t("tr.swap", "Swap languages")}
                aria-label={t("tr.swap", "Swap languages")}
                className="mx-auto shrink-0 rounded-xl border border-[var(--border-subtle)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] md:mx-1"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 4 3.5 7.5 7 11" />
                  <path d="M3.5 7.5H16a4.5 4.5 0 0 1 0 9h-1" />
                  <path d="m17 20 3.5-3.5L17 13" />
                </svg>
              </button>

              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                {QUICK_TARGET.map((c) => (
                  <LangTab key={c} code={c} active={to === c} onClick={() => setTo(c)} />
                ))}
                {!QUICK_TARGET.includes(to) && <LangTab code={to} active onClick={() => setTo(to)} />}
                <LangPicker side="to" />
              </div>
            </div>

            {/* Two panes */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {/* Source */}
              <div className="relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] focus-within:border-[var(--border-focus)]">
                <textarea
                  ref={sourceRef}
                  value={source}
                  onChange={(e) => setSource(e.target.value.slice(0, MAX_CHARS))}
                  placeholder={t("tr.sourcePlaceholder", "Enter text")}
                  dir={isRtl(effectiveFrom) ? "rtl" : "ltr"}
                  rows={8}
                  className="min-h-[220px] w-full resize-none bg-transparent px-4 pb-12 pt-4 text-[16px] leading-relaxed text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
                />
                {source && (
                  <button
                    type="button"
                    onClick={() => {
                      setSource("");
                      setTranslated("");
                      setError(null);
                      sourceRef.current?.focus();
                    }}
                    title={t("tr.clear", "Clear text")}
                    aria-label={t("tr.clear", "Clear text")}
                    className={`absolute top-3 ${isRtl(effectiveFrom) ? "left-3" : "right-3"} ${iconBtn}`}
                  >
                    <CrossIcon size={14} />
                  </button>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={toggleMic}
                    title={listening ? t("tr.stopSpeak", "Stop recording") : t("tr.speak", "Speak")}
                    aria-label={listening ? t("tr.stopSpeak", "Stop recording") : t("tr.speak", "Speak")}
                    className={`${iconBtn} ${listening ? "bg-[var(--bg-surface)] text-[var(--text-primary)]" : ""}`}
                  >
                    <MicIcon size={15} />
                  </button>
                  <span className="text-[11px] tabular-nums text-[var(--text-dim)]">
                    {listening
                      ? t("tr.listening", "Listening…")
                      : t("tr.charCount", "{n} / {max}")
                          .replace("{n}", String(source.length))
                          .replace("{max}", String(MAX_CHARS))}
                  </span>
                </div>
              </div>

              {/* Translation */}
              <div className="relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
                <div
                  dir={isRtl(to) ? "rtl" : "ltr"}
                  className="min-h-[220px] whitespace-pre-wrap px-4 pb-12 pt-4 text-[16px] leading-relaxed text-[var(--text-primary)]"
                >
                  {translated || (
                    <span className="text-[var(--text-dim)]">
                      {busy && source.trim() ? t("tr.translating", "Translating…") : t("tr.translation", "Translation")}
                    </span>
                  )}
                </div>

                {error && (
                  <div className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
                    <span>{error}</span>
                    <button
                      type="button"
                      onClick={() => void translate(source, from, to)}
                      className="shrink-0 font-semibold underline underline-offset-2"
                    >
                      {t("tr.retry", "Retry")}
                    </button>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-3 py-2">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={speak} disabled={!translated} title={speaking ? t("tr.stopListen", "Stop") : t("tr.listen", "Listen")} aria-label={speaking ? t("tr.stopListen", "Stop") : t("tr.listen", "Listen")} className={`${iconBtn} ${speaking ? "bg-[var(--bg-surface)] text-[var(--text-primary)]" : ""}`}>
                      <Volume2Icon size={15} />
                    </button>
                    <button type="button" onClick={copy} disabled={!translated} title={copied ? t("tr.copied", "Copied") : t("tr.copy", "Copy")} aria-label={t("tr.copy", "Copy")} className={iconBtn}>
                      {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
                    </button>
                    <button type="button" onClick={toggleSave} disabled={!translated} title={isSavedNow ? t("tr.saved", "Saved") : t("tr.save", "Save")} aria-label={t("tr.save", "Save")} className={`${iconBtn} ${isSavedNow ? "text-[var(--text-primary)]" : ""}`}>
                      <StarIcon size={15} />
                    </button>
                  </div>
                  <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
                    {busy && <SpinnerIcon size={12} className="animate-spin" />}
                    {!busy && cached && translated && t("tr.fromCache", "instant")}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === "history" && (
          <div className="space-y-3">
            {history.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(t("tr.clearHistoryConfirm", "Clear all translation history on this device?"))) return;
                    setHistory([]);
                    writeLocal(HISTORY_KEY, []);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                >
                  <TrashIcon size={12} /> {t("tr.clearHistory", "Clear history")}
                </button>
              </div>
            )}
            <EntryList items={history} kind="history" />
          </div>
        )}

        {tab === "saved" && <EntryList items={saved} kind="saved" />}
      </div>
    </div>
  );
}
