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
/* Every icon in this app comes from the Database app's Visual Library
   (General Icons) via <VlIcon>, per the standing rule — no hand-authored SVG
   and no third-party icon packs. */
import VlIcon from "@/components/ui/VlIcon";

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

  /* ── Language selector ──────────────────────────────────────────────
     One button per side (current language + chevron) opening a searchable
     list. Deliberately NOT a row of quick chips: at 18 languages the chip
     row wrapped and cramped the bar at every width below ~1400px. The
     three languages Koleex uses daily are pinned to the top of the list
     instead, so they stay one tap away without eating the bar.          */
  const LangButton = ({ side }: { side: "from" | "to" }) => {
    const open = pickerOpen === side;
    const current = side === "from" ? from : to;
    const pinned = side === "from" ? QUICK_SOURCE : QUICK_TARGET;

    const label =
      current === "auto"
        ? detected
          ? `${t("tr.detect", "Detect language")} · ${langLabel(detected, ui)}`
          : t("tr.detect", "Detect language")
        : langLabel(current, ui);

    const q = pickerQuery.trim().toLowerCase();
    const matches = (l: (typeof LANGUAGES)[number]) =>
      !q ||
      l.label[ui].toLowerCase().includes(q) ||
      l.label.en.toLowerCase().includes(q) ||
      l.native.toLowerCase().includes(q) ||
      l.code.includes(q);

    const pinnedList = LANGUAGES.filter((l) => pinned.includes(l.code) && matches(l));
    const restList = LANGUAGES.filter((l) => !pinned.includes(l.code) && matches(l));

    const Row = ({ l }: { l: (typeof LANGUAGES)[number] }) => (
      <button
        type="button"
        onClick={() => {
          if (side === "from") setFrom(l.code);
          else setTo(l.code);
          setPickerOpen(null);
        }}
        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-[12.5px] transition-colors hover:bg-[var(--bg-surface-hover)] ${
          current === l.code ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)]"
        }`}
      >
        <span className="truncate">{l.label[ui]}</span>
        <span className="shrink-0 text-[11px] text-[var(--text-dim)]">{l.native}</span>
      </button>
    );

    return (
      <div className="relative min-w-0 flex-1">
        <button
          type="button"
          onClick={() => {
            setPickerOpen(open ? null : side);
            setPickerQuery("");
          }}
          className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors ${
            open
              ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
              : "text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
          }`}
        >
          <span className="truncate">{label}</span>
          <VlIcon slug="angle-small-down" size={13} className="text-[var(--text-dim)]" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setPickerOpen(null)} />
            <div className="absolute inset-x-0 z-[61] mt-1 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl">
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
                <VlIcon slug="search" size={13} className="text-[var(--text-dim)]" />
                <input
                  autoFocus
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder={t("tr.searchLanguage", "Search language…")}
                  className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
                />
              </div>
              <div className="max-h-[46vh] overflow-y-auto py-1">
                {side === "from" && !q && (
                  <button
                    type="button"
                    onClick={() => {
                      setFrom("auto");
                      setPickerOpen(null);
                    }}
                    className={`flex w-full items-center px-3 py-2 text-start text-[12.5px] transition-colors hover:bg-[var(--bg-surface-hover)] ${
                      current === "auto" ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {t("tr.detect", "Detect language")}
                  </button>
                )}
                {pinnedList.map((l) => (
                  <Row key={l.code} l={l} />
                ))}
                {pinnedList.length > 0 && restList.length > 0 && (
                  <div className="my-1 border-t border-[var(--border-subtle)]" />
                )}
                {restList.map((l) => (
                  <Row key={l.code} l={l} />
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
          <VlIcon slug="translate" size={28} className="text-[var(--text-dim)]" />
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
              <span className="block truncate text-[13px] text-[var(--text-primary)]" dir={isRtl(e.from) ? "rtl" : "ltr"}>
                {e.source}
              </span>
              <span className="mt-0.5 block truncate text-[12.5px] text-[var(--text-muted)]" dir={isRtl(e.to) ? "rtl" : "ltr"}>
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
              <VlIcon slug="cross-small" size={14} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const iconBtn =
    "rounded-lg p-2 text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    /* Viewport-locked shell — the translator is a workspace, not a document:
       the page itself must never scroll. Each pane scrolls INTERNALLY so the
       language bar stays put at the top and each pane's toolbar stays pinned
       to its own bottom edge. `100dvh` (not vh) so mobile browsers' shrinking
       URL bar and the on-screen keyboard don't push the toolbars off-screen.
       Same lock Discuss uses. */
    <div
      className="flex flex-col overflow-hidden bg-[var(--bg-primary)]"
      style={{ height: "calc(100dvh - var(--kx-header-h, 3.5rem))" }}
    >
      {/* PageHeader carries no horizontal padding of its own (its sticky tab
          rail even uses -mx-4), so it must sit inside the SAME container +
          padding as the workspace below. Without this the hero and tabs ran
          flush against the sidebar while the panes were inset — the rows
          didn't line up. */}
      <div className="mx-auto w-full max-w-[1600px] shrink-0 px-3 sm:px-5">
        <PageHeader
          title={t("tr.title", "Translator")}
          subtitle={t("tr.subtitle", "Translate text between 18 languages")}
          icon={<VlIcon slug="translate" size={20} />}
          backHref="/"
          tabs={[
            { key: "text", label: t("tr.title", "Translator"), active: tab === "text", onClick: () => setTab("text") },
            { key: "history", label: t("tr.history", "History"), active: tab === "history", onClick: () => setTab("history") },
            { key: "saved", label: t("tr.savedTab", "Saved"), active: tab === "saved", onClick: () => setTab("saved") },
          ]}
        />
      </div>

      {tab === "text" ? (
        /* pb-14 on mobile: the Hub's floating chrome (AI orb, Discuss chip, QA
           issues chip) is anchored to the viewport bottom and on a narrow
           screen it lands straight on the result pane's Listen/Copy/Save row.
           Reserving that band is the only way to keep those buttons tappable
           at 390px. Desktop clusters them centre-ward instead, so it only
           needs normal padding. */
        <div className="mx-auto flex w-full min-h-0 max-w-[1600px] flex-1 flex-col gap-3 px-3 pb-14 pt-3 sm:px-5 sm:pb-4">
          {/* Language row — TWO separate cards, one per side, each sitting
              directly above its own pane, with the swap button in the gutter
              between them. Both this row and the pane row below use the same
              [1fr 40px 1fr] track, so each selector lines up exactly with the
              pane it controls. (One merged bar read as a single unrelated
              toolbar and cramped at narrow widths.) */}
          <div className="grid shrink-0 grid-cols-1 gap-2 md:grid-cols-[1fr_40px_1fr] md:gap-3">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5">
              <LangButton side="from" />
            </div>
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={swap}
                title={t("tr.swap", "Swap languages")}
                aria-label={t("tr.swap", "Swap languages")}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] md:border-transparent md:bg-transparent"
              >
                <VlIcon slug="exchange" size={16} />
              </button>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5">
              <LangButton side="to" />
            </div>
          </div>

          {/* Panes — same track as the language row above so the columns align.
              min-h-0 on every level is what lets the inner scroll work
              instead of the panes growing and pushing the page. */}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[1fr_40px_1fr]">
            {/* Source */}
            <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] focus-within:border-[var(--border-focus)]">
              {/* px-4 py-3.5 EXACTLY matches the result pane. The clear button
                  used to float over the text, forcing pr-11 here only — which
                  made the source column ~28px narrower than the translation
                  and read as "the English is compressed". It now lives in the
                  toolbar, so both languages get identical measure. */}
              <div className="min-h-0 flex-1">
                <textarea
                  ref={sourceRef}
                  value={source}
                  onChange={(e) => setSource(e.target.value.slice(0, MAX_CHARS))}
                  placeholder={t("tr.sourcePlaceholder", "Enter text")}
                  dir={isRtl(effectiveFrom) ? "rtl" : "ltr"}
                  className="h-full w-full resize-none bg-transparent px-4 py-3.5 text-[15px] leading-relaxed text-[var(--text-primary)] outline-none [scrollbar-color:var(--border-color)_transparent] [scrollbar-width:thin] placeholder:text-[var(--text-dim)]"
                />
              </div>
              {/* Toolbar content hugs the INNER edge (screen centre). The Hub
                  floats chrome over both bottom corners — the QA issues chip
                  bottom-left, the AI + Discuss chips bottom-right — which sat
                  directly on top of these controls. Clustering inward keeps
                  every corner clear without stealing pane height. */}
              <div className="flex shrink-0 items-center justify-end gap-1.5 border-t border-[var(--border-subtle)] px-2.5 py-1.5">
                <span className="text-[11px] tabular-nums text-[var(--text-dim)]">
                  {listening
                    ? t("tr.listening", "Listening…")
                    : t("tr.charCount", "{n} / {max}")
                        .replace("{n}", String(source.length))
                        .replace("{max}", String(MAX_CHARS))}
                </span>
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
                    className={iconBtn}
                  >
                    <VlIcon slug="cross-small" size={15} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleMic}
                  title={listening ? t("tr.stopSpeak", "Stop recording") : t("tr.speak", "Speak")}
                  aria-label={listening ? t("tr.stopSpeak", "Stop recording") : t("tr.speak", "Speak")}
                  className={`${iconBtn} ${listening ? "bg-[var(--bg-surface)] text-[var(--text-primary)]" : ""}`}
                >
                  <VlIcon slug="microphone" size={15} />
                </button>
              </div>
            </div>

            {/* Gutter — keeps the pane columns on the same track as the
                language selectors above. Empty by design. */}
            <div className="hidden md:block" aria-hidden />

            {/* Translation */}
            <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
              <div
                dir={isRtl(to) ? "rtl" : "ltr"}
                className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap px-4 py-3.5 text-[15px] leading-relaxed text-[var(--text-primary)] [scrollbar-color:var(--border-color)_transparent] [scrollbar-width:thin]"
              >
                {translated || (
                  <span className="text-[var(--text-dim)]">
                    {busy && source.trim() ? t("tr.translating", "Translating…") : t("tr.translation", "Translation")}
                  </span>
                )}
              </div>

              {error && (
                <div className="mx-3 mb-2 flex shrink-0 items-center justify-between gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
                  <span className="min-w-0 flex-1">{error}</span>
                  <button
                    type="button"
                    onClick={() => void translate(source, from, to)}
                    className="shrink-0 font-semibold underline underline-offset-2"
                  >
                    {t("tr.retry", "Retry")}
                  </button>
                </div>
              )}

              <div className="flex shrink-0 items-center gap-2 border-t border-[var(--border-subtle)] px-2.5 py-1.5">
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={speak} disabled={!translated} title={speaking ? t("tr.stopListen", "Stop") : t("tr.listen", "Listen")} aria-label={speaking ? t("tr.stopListen", "Stop") : t("tr.listen", "Listen")} className={`${iconBtn} ${speaking ? "bg-[var(--bg-surface)] text-[var(--text-primary)]" : ""}`}>
                    <VlIcon slug={speaking ? "volume-mute" : "speaker"} size={15} />
                  </button>
                  <button type="button" onClick={copy} disabled={!translated} title={copied ? t("tr.copied", "Copied") : t("tr.copy", "Copy")} aria-label={t("tr.copy", "Copy")} className={iconBtn}>
                    {copied ? <VlIcon slug="check" size={15} /> : <VlIcon slug="copy-alt" size={15} />}
                  </button>
                  <button type="button" onClick={toggleSave} disabled={!translated} title={isSavedNow ? t("tr.saved", "Saved") : t("tr.save", "Save")} aria-label={t("tr.save", "Save")} className={`${iconBtn} ${isSavedNow ? "text-[var(--text-primary)]" : ""}`}>
                    <VlIcon slug="star" size={15} />
                  </button>
                </div>
                {/* Right side stays clear of the floating AI orb on desktop. */}
                <span className="flex items-center gap-1.5 pe-10 text-[11px] text-[var(--text-dim)] md:pe-0">
                  {busy && <VlIcon slug="spinner" size={12} className="animate-spin" />}
                  {!busy && cached && translated && t("tr.fromCache", "instant")}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* History / Saved scroll normally inside the locked shell. */
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl space-y-3 px-4 pb-16 pt-3 sm:px-6">
            {tab === "history" && history.length > 0 && (
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
                  <VlIcon slug="trash-xmark" size={13} /> {t("tr.clearHistory", "Clear history")}
                </button>
              </div>
            )}
            <EntryList items={tab === "history" ? history : saved} kind={tab === "history" ? "history" : "saved"} />
          </div>
        </div>
      )}
    </div>
  );
}
