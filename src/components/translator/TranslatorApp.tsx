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
import {
  DOC_ACCEPT,
  chunkText,
  extractDocumentText,
} from "@/lib/translator-document";
import { IMG_ACCEPT, recognizeImage } from "@/lib/translator-image";

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

/* Only the four TRANSLATION MODES live in the tab rail. History and Saved are
   not modes — they're places you look things up — so they sit apart in the
   header and open over the workspace, the way Google keeps them off its
   Text/Images/Documents/Websites bar. */
type Tab = "text" | "document" | "image" | "website";
type Panel = "history" | "saved" | null;

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
  const [panel, setPanel] = useState<Panel>(null);

  /* Document translation state. Kept separate from the text panes so switching
     tabs never destroys either piece of work. */
  const [docName, setDocName] = useState<string | null>(null);
  const [docMeta, setDocMeta] = useState<{ pages: number | null; chars: number; truncated: boolean } | null>(null);
  const [docOut, setDocOut] = useState("");
  const [docBusy, setDocBusy] = useState(false);
  const [docStep, setDocStep] = useState<{ done: number; total: number } | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  /* Image (OCR) state. The recognised text is editable before translating —
     OCR is never perfect and a one-character fix beats re-shooting the photo. */
  const [imgName, setImgName] = useState<string | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [imgText, setImgText] = useState("");
  const [imgOut, setImgOut] = useState("");
  const [imgConfidence, setImgConfidence] = useState<number | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgPct, setImgPct] = useState(0);
  const [imgError, setImgError] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement | null>(null);

  /* Website state. */
  const [url, setUrl] = useState("");
  const [page, setPage] = useState<{ url: string; title: string | null; truncated: boolean } | null>(null);
  const [pageRows, setPageRows] = useState<Array<{ source: string; translated: string }>>([]);
  const [pageBusy, setPageBusy] = useState(false);
  const [pageStep, setPageStep] = useState<{ done: number; total: number } | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);

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

  /* ── Document translation ────────────────────────────────────────────
     Extraction runs in the BROWSER, so the file itself never leaves the
     device — only its plain text does, and only in chunks. Chunks go through
     the SAME endpoint as the text pane, so paragraphs already translated
     anywhere in the Hub come back from cache instantly.

     Sequential, not parallel: parallel chunks race the provider's rate limit
     and a failure mid-flight would leave holes in the middle of the document.
     A run counter guards against a second file being dropped mid-translation
     (the old run must not keep appending to the new one's output). */
  const docRunRef = useRef(0);

  const handleFile = useCallback(
    async (file: File) => {
      const run = ++docRunRef.current;
      setDocName(file.name);
      setDocOut("");
      setDocMeta(null);
      setDocError(null);
      setDocStep(null);
      setDocBusy(true);

      let doc: Awaited<ReturnType<typeof extractDocumentText>>;
      try {
        doc = await extractDocumentText(file);
      } catch (e) {
        if (run !== docRunRef.current) return;
        const code = e instanceof Error ? e.message : "";
        setDocError(
          code === "no_text_layer"
            ? t("tr.docNoText", "This PDF has no text layer — it's a scan. Photo translation isn't supported yet.")
            : code === "unsupported_type"
              ? t("tr.docUnsupported", "Unsupported file type. Use PDF, TXT, MD or CSV.")
              : code === "empty_file"
                ? t("tr.docEmpty", "That file is empty.")
                : t("tr.docFailed", "Couldn't read that file."),
        );
        setDocBusy(false);
        return;
      }
      if (run !== docRunRef.current) return;
      setDocMeta({ pages: doc.pages, chars: doc.text.length, truncated: doc.truncated });

      const chunks = chunkText(doc.text);
      setDocStep({ done: 0, total: chunks.length });

      const out: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        try {
          const res = await fetch("/api/translator", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: chunks[i], target_lang: to, source_lang: from }),
          });
          const json = (await res.json()) as { translated?: string };
          if (run !== docRunRef.current) return;
          // A chunk that fails keeps its ORIGINAL text rather than vanishing —
          // a document with one untranslated paragraph is still usable.
          out.push(json.translated?.trim() ? json.translated : chunks[i]);
        } catch {
          if (run !== docRunRef.current) return;
          out.push(chunks[i]);
        }
        setDocOut(out.join("\n\n"));
        setDocStep({ done: i + 1, total: chunks.length });
      }
      if (run !== docRunRef.current) return;
      setDocBusy(false);
    },
    [from, to, t],
  );

  const resetDoc = () => {
    docRunRef.current++;          // abandons any run still in flight
    setDocName(null);
    setDocMeta(null);
    setDocOut("");
    setDocError(null);
    setDocStep(null);
    setDocBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const downloadDoc = () => {
    const blob = new Blob([docOut], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${(docName ?? "document").replace(/\.[^.]+$/, "")}.${to}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyDoc = async () => {
    if (!docOut) return;
    try {
      await navigator.clipboard.writeText(docOut);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — the text is on screen and selectable anyway */
    }
  };

  /* One non-streaming translation. Shared by the Image and Website tabs —
     both translate a known block of text rather than something being typed,
     so they want the plain JSON path (and its cache hit) not a token stream. */
  const translateOnce = useCallback(
    async (text: string): Promise<string> => {
      const res = await fetch("/api/translator", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target_lang: to, source_lang: from }),
      });
      const json = (await res.json()) as { translated?: string };
      return json.translated?.trim() ? json.translated : text;
    },
    [from, to],
  );

  /* ── Image (OCR) ─────────────────────────────────────────────────────
     Recognition runs in the browser, so the photo itself never leaves the
     device. The recognised text lands in an editable box first: OCR of a
     worn spec plate is never perfect, and letting someone fix one character
     is far better than translating a typo confidently. */
  const imgRunRef = useRef(0);

  const handleImage = useCallback(
    async (file: File) => {
      const run = ++imgRunRef.current;
      setImgName(file.name);
      setImgText("");
      setImgOut("");
      setImgConfidence(null);
      setImgError(null);
      setImgPct(0);
      setImgBusy(true);

      setImgPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);   // don't leak the last preview
        return URL.createObjectURL(file);
      });

      try {
        const { text, confidence } = await recognizeImage(file, effectiveFrom, (pct) => {
          if (run === imgRunRef.current) setImgPct(pct);
        });
        if (run !== imgRunRef.current) return;
        setImgText(text);
        setImgConfidence(confidence);
        setImgBusy(false);
        setImgOut(await translateOnce(text));
      } catch (e) {
        if (run !== imgRunRef.current) return;
        const code = e instanceof Error ? e.message : "";
        setImgError(
          code === "no_text"
            ? t("tr.imgNoText", "No text found in that image.")
            : code === "too_large"
              ? t("tr.imgTooLarge", "That image is too large — max 12 MB.")
              : code === "unsupported_type"
                ? t("tr.imgUnsupported", "That file isn't an image.")
                : t("tr.imgFailed", "Couldn't read that image."),
        );
        setImgBusy(false);
      }
    },
    [effectiveFrom, translateOnce, t],
  );

  const resetImage = () => {
    imgRunRef.current++;
    if (imgPreview) URL.revokeObjectURL(imgPreview);
    setImgPreview(null);
    setImgName(null);
    setImgText("");
    setImgOut("");
    setImgConfidence(null);
    setImgError(null);
    setImgBusy(false);
    if (imageRef.current) imageRef.current.value = "";
  };

  // Release the last object URL when the app unmounts.
  useEffect(() => () => { if (imgPreview) URL.revokeObjectURL(imgPreview); }, [imgPreview]);

  /* ── Website ─────────────────────────────────────────────────────────
     The server only EXTRACTS text (see /api/translator/website — it never
     re-serves the remote page, so nothing third-party runs in our origin).
     Translation then goes block-by-block through the normal endpoint, so a
     supplier page whose paragraphs were translated before is nearly free. */
  const pageRunRef = useRef(0);

  const loadPage = useCallback(async () => {
    const target = url.trim();
    if (!target) return;
    const run = ++pageRunRef.current;

    setPageBusy(true);
    setPageError(null);
    setPageRows([]);
    setPage(null);
    setPageStep(null);

    let data: { url: string; title: string | null; blocks: string[]; truncated: boolean };
    try {
      const res = await fetch("/api/translator/website", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const json = (await res.json()) as typeof data & { error?: string };
      if (!res.ok || json.error) {
        if (run !== pageRunRef.current) return;
        const code = json.error ?? "fetch_failed";
        setPageError(
          code === "bad_url"      ? t("tr.urlBad", "That doesn't look like a valid web address.")
          : code === "blocked_host" ? t("tr.urlBlocked", "That address can't be opened from the Hub.")
          : code === "not_html"     ? t("tr.urlNotHtml", "That link isn't a web page. For files, use the Document tab.")
          : code === "empty_page"   ? t("tr.urlEmpty", "No readable text on that page.")
          : t("tr.urlFailed", "Couldn't reach that page."),
        );
        setPageBusy(false);
        return;
      }
      data = json;
    } catch {
      if (run !== pageRunRef.current) return;
      setPageError(t("tr.urlFailed", "Couldn't reach that page."));
      setPageBusy(false);
      return;
    }
    if (run !== pageRunRef.current) return;

    setPage({ url: data.url, title: data.title, truncated: data.truncated });

    /* Title first so the page identifies itself immediately, then blocks in
       document order — the reader watches it fill top-down. */
    const blocks = data.title ? [data.title, ...data.blocks] : data.blocks;
    setPageStep({ done: 0, total: blocks.length });

    const rows: Array<{ source: string; translated: string }> = [];
    for (let i = 0; i < blocks.length; i++) {
      let out = blocks[i];
      try {
        out = await translateOnce(blocks[i]);
      } catch {
        /* keep the original block rather than dropping it */
      }
      if (run !== pageRunRef.current) return;
      rows.push({ source: blocks[i], translated: out });
      setPageRows([...rows]);
      setPageStep({ done: i + 1, total: blocks.length });
    }
    if (run !== pageRunRef.current) return;
    setPageBusy(false);
  }, [url, translateOnce, t]);

  const resetPage = () => {
    pageRunRef.current++;
    setPage(null);
    setPageRows([]);
    setPageError(null);
    setPageBusy(false);
    setPageStep(null);
    setUrl("");
  };

  const reuse = (e: Entry) => {
    setFrom(e.from === "auto" ? "auto" : e.from);
    setTo(e.to);
    setSource(e.source);
    setTranslated(e.translated);
    setTab("text");
    setPanel(null);
    requestAnimationFrame(() => sourceRef.current?.focus());
  };

  /* ── Language selector ──────────────────────────────────────────────
     One button per side (current language + chevron) opening a searchable
     list. Deliberately NOT a row of quick chips: at 18 languages the chip
     row wrapped and cramped the bar at every width below ~1400px. The
     three languages Koleex uses daily are pinned to the top of the list
     instead, so they stay one tap away without eating the bar.          */
  /* `pill` is the in-pane selector on mobile: a bordered, fully-rounded
     control that spans the card so it lines up with the text below it and
     gives the chevron a fixed home at the far edge. (It hugged its label
     first — that left a ragged right edge inside a full-width card.) The
     desktop row keeps the plain button: it already sits in its own bordered
     card, where a pill would be a border on a border. */
  const LangButton = ({ side, pill = false }: { side: "from" | "to"; pill?: boolean }) => {
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
          className={`flex items-center gap-2 font-medium transition-colors ${
            pill
              ? "w-full justify-between rounded-full border border-[var(--border-subtle)] px-3.5 py-1.5 text-[12.5px]"
              : "w-full justify-between rounded-xl px-3 py-2 text-[13px]"
          } ${
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

  /* The two language cards + swap button. Shared by the Text and Document
     tabs so both read as the same app and the columns line up with whatever
     sits under them. */
  /* `inPane` = the Text tab, where mobile shows the selectors INSIDE each
     pane (Apple's arrangement) so this row hides below md — a separate
     two-card bar plus a swap button cost ~200px of vertical space before you
     reached the text. Document / Image / Website have no pane to host a chip,
     so they keep this row at every width; hiding it there would leave them
     with no way to choose a language on a phone at all. */
  const LanguageRow = ({ inPane = false }: { inPane?: boolean }) => (
    <div
      className={`shrink-0 grid-cols-1 gap-2 md:grid md:grid-cols-[1fr_40px_1fr] md:gap-3 ${
        inPane ? "hidden" : "grid"
      }`}
    >
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5">
        <LangButton side="from" />
      </div>
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={swap}
          title={t("tr.swap", "Swap languages")}
          aria-label={t("tr.swap", "Swap languages")}
          /* Fixed 40px box: exactly the width of the grid gutter it sits in,
             and a proper touch target. */
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] md:border-transparent md:bg-transparent"
        >
          <VlIcon slug="exchange" size={16} />
        </button>
      </div>
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5">
        <LangButton side="to" />
      </div>
    </div>
  );

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
      {/* Same container the other apps use for their header block
          (Inventory/Database layouts: `mx-auto max-w-… px-4 py-6 sm:px-6`), so
          the hero starts at the same inset and the same distance below the
          main header instead of butting straight against it. */}
      <div className="mx-auto w-full max-w-[1600px] shrink-0 px-4 pt-6 sm:px-6">
        <PageHeader
          title={t("tr.title", "Translator")}
          subtitle={t("tr.subtitle", "Translate text between 18 languages")}
          icon={<VlIcon slug="translate" size={20} />}
          backHref="/"
          /* History and Saved live HERE, not in the tab rail below — they
             open over the workspace instead of replacing it. Labels are
             hidden on narrow screens so the hero row never wraps. */
          action={
            <div className="flex items-center gap-1.5">
              {([
                { key: "history" as const, label: t("tr.history", "History"), slug: "history" as const },
                { key: "saved" as const, label: t("tr.savedTab", "Saved"), slug: "star" as const },
              ]).map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setPanel((p) => (p === b.key ? null : b.key))}
                  title={b.label}
                  aria-label={b.label}
                  aria-pressed={panel === b.key}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[12.5px] font-medium transition-colors ${
                    panel === b.key
                      ? "border-transparent bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                      : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <VlIcon slug={b.slug} size={14} />
                  <span className="hidden sm:inline">{b.label}</span>
                </button>
              ))}
            </div>
          }
          tabs={[
            /* Tab icons, like every other icon here, are Visual Library
               assets. `language` (not `translate`) on the text tab so it
               doesn't duplicate the app icon sitting right above it. */
            { key: "text", label: t("tr.tabText", "Text"), icon: <VlIcon slug="language" size={14} />, active: tab === "text", onClick: () => setTab("text") },
            { key: "document", label: t("tr.document", "Document"), icon: <VlIcon slug="document" size={14} />, active: tab === "document", onClick: () => setTab("document") },
            { key: "image", label: t("tr.image", "Image"), icon: <VlIcon slug="image" size={14} />, active: tab === "image", onClick: () => setTab("image") },
            { key: "website", label: t("tr.website", "Website"), icon: <VlIcon slug="globe" size={14} />, active: tab === "website", onClick: () => setTab("website") },
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
        <div className="mx-auto flex w-full min-h-0 max-w-[1600px] flex-1 flex-col gap-3 px-4 pb-14 pt-3 sm:px-6 sm:pb-6">
          {/* Language row — TWO separate cards, one per side, each sitting
              directly above its own pane, with the swap button in the gutter
              between them. Both this row and the pane row below use the same
              [1fr 40px 1fr] track, so each selector lines up exactly with the
              pane it controls. (One merged bar read as a single unrelated
              toolbar and cramped at narrow widths.) */}
          <LanguageRow inPane />

          {/* Panes — same track as the language row above so the columns align.
              min-h-0 on every level is what lets the inner scroll work
              instead of the panes growing and pushing the page. */}
          {/* grid-rows-[1fr_auto_1fr] is load-bearing on mobile: with three
              AUTO rows, grid's default stretch alignment splits the leftover
              height equally between them, which handed the 1px divider row an
              ~82px empty band between the two halves. Pinning the middle row
              to auto keeps the hairline a hairline and lets the two panes
              share the space. */}
          <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[1fr_auto_1fr] gap-2 md:grid-cols-[1fr_40px_1fr] md:grid-rows-none md:gap-3">
            {/* Source. On mobile this is the TOP HALF of one shared card, so
                it drops its own border/rounding; on desktop it becomes its
                own card again. */}
            <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] focus-within:border-[var(--border-focus)]">
              {/* Mobile-only language chip, sitting directly above the text it
                  applies to — you read "English → this box" in one glance. */}
              <div className="shrink-0 px-1.5 pt-1.5 md:hidden">
                <LangButton side="from" pill />
              </div>
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

            {/* Gutter — desktop keeps the pane columns on the same track as
                the language selectors above (empty by design). On mobile it
                becomes the hairline BETWEEN the two halves with the swap
                button centred on it, the way Apple splits its single card. */}
            <div className="flex items-center justify-center md:block">
              <button
                type="button"
                onClick={swap}
                title={t("tr.swap", "Swap languages")}
                aria-label={t("tr.swap", "Swap languages")}
                className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-muted)] transition-colors active:bg-[var(--bg-surface-hover)] md:hidden"
              >
                <VlIcon slug="exchange" size={15} />
              </button>
            </div>

            {/* Translation */}
            <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
              <div className="shrink-0 px-1.5 pt-1.5 md:hidden">
                <LangButton side="to" pill />
              </div>
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
      ) : tab === "document" ? (
        /* ── Document tab ──────────────────────────────────────────────
           Same shell and same language row as the text tab, with one pane
           that swaps between drop-zone and result. Extraction happens in the
           browser; only plain text is ever sent. */
        <div className="mx-auto flex w-full min-h-0 max-w-[1600px] flex-1 flex-col gap-3 px-4 pb-14 pt-3 sm:px-6 sm:pb-6">
          <LanguageRow />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
            <input
              ref={fileRef}
              type="file"
              accept={DOC_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />

            {!docName ? (
              /* Drop zone — the whole pane is the target, not a small box, so
                 a dragged file can be released anywhere in the workspace. */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void handleFile(f);
                }}
                className={`m-3 flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 text-center transition-colors ${
                  dragging
                    ? "border-[var(--border-focus)] bg-[var(--bg-surface)]"
                    : "border-[var(--border-subtle)]"
                }`}
              >
                <VlIcon slug="cloud-upload" size={28} className="text-[var(--text-dim)]" />
                <div className="text-[14px] font-medium text-[var(--text-primary)]">
                  {t("tr.docDrop", "Drop a PDF or text file here")}
                </div>
                <div className="text-[12px] text-[var(--text-dim)]">
                  {t("tr.docTypes", "PDF, TXT, MD or CSV — up to 60 pages")}
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface-hover)]"
                >
                  <VlIcon slug="document" size={14} /> {t("tr.docBrowse", "Choose file")}
                </button>
                {docError && (
                  <div className="mt-1 max-w-md rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
                    {docError}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* File strip */}
                <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
                  <VlIcon slug="document" size={15} className="shrink-0 text-[var(--text-dim)]" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text-primary)]">
                    {docName}
                  </span>
                  <span className="hidden shrink-0 text-[11px] tabular-nums text-[var(--text-dim)] sm:block">
                    {docMeta?.pages
                      ? t("tr.docPages", "{n} pages").replace("{n}", String(docMeta.pages))
                      : docMeta
                        ? t("tr.docChars", "{n} characters").replace("{n}", String(docMeta.chars))
                        : t("tr.docReading", "Reading document…")}
                  </span>
                  <button
                    type="button"
                    onClick={resetDoc}
                    title={t("tr.docAnother", "New document")}
                    aria-label={t("tr.docAnother", "New document")}
                    className={iconBtn}
                  >
                    <VlIcon slug="cross-small" size={15} />
                  </button>
                </div>

                {docError ? (
                  <div className="m-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
                    {docError}
                  </div>
                ) : (
                  <>
                    {docMeta?.truncated && (
                      <div className="mx-3 mt-2 shrink-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[11.5px] text-[var(--text-muted)]">
                        {t("tr.docTruncated", "Very long document — only the first part was read.")}
                      </div>
                    )}

                    <div
                      dir={isRtl(to) ? "rtl" : "ltr"}
                      className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap px-4 py-3.5 text-[14px] leading-relaxed text-[var(--text-primary)] [scrollbar-color:var(--border-color)_transparent] [scrollbar-width:thin]"
                    >
                      {docOut || (
                        <span className="text-[var(--text-dim)]">
                          {/* Extraction and translation are different waits —
                              saying "Reading…" once chunks are in flight reads
                              as if nothing had progressed. */}
                          {docStep
                            ? t("tr.translating", "Translating…")
                            : docBusy
                              ? t("tr.docReading", "Reading document…")
                              : t("tr.translation", "Translation")}
                        </span>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2 border-t border-[var(--border-subtle)] px-2.5 py-1.5">
                      <div className="flex items-center gap-0.5">
                        <button type="button" onClick={() => void copyDoc()} disabled={!docOut} title={copied ? t("tr.copied", "Copied") : t("tr.copy", "Copy")} aria-label={t("tr.copy", "Copy")} className={iconBtn}>
                          {copied ? <VlIcon slug="check" size={15} /> : <VlIcon slug="copy-alt" size={15} />}
                        </button>
                        <button type="button" onClick={downloadDoc} disabled={!docOut} title={t("tr.docDownload", "Download")} aria-label={t("tr.docDownload", "Download")} className={iconBtn}>
                          <VlIcon slug="download" size={15} />
                        </button>
                      </div>
                      <span className="flex items-center gap-1.5 pe-10 text-[11px] tabular-nums text-[var(--text-dim)] md:pe-0">
                        {docBusy && <VlIcon slug="spinner" size={12} className="animate-spin" />}
                        {docStep && docStep.done < docStep.total
                          ? t("tr.docProgress", "Translating {done} of {total}")
                              .replace("{done}", String(docStep.done + 1))
                              .replace("{total}", String(docStep.total))
                          : null}
                      </span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      ) : tab === "image" ? (
        /* ── Image tab ─────────────────────────────────────────────────
           Photo left, recognised text + translation right. The recognised
           text stays editable — OCR of a worn spec plate is never perfect,
           and one corrected character beats re-shooting the photo. */
        <div className="mx-auto flex w-full min-h-0 max-w-[1600px] flex-1 flex-col gap-3 px-4 pb-14 pt-3 sm:px-6 sm:pb-6">
          <LanguageRow />

          <input
            ref={imageRef}
            type="file"
            accept={IMG_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImage(f);
            }}
          />

          {!imgName ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void handleImage(f);
              }}
              className={`flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 text-center transition-colors ${
                dragging ? "border-[var(--border-focus)] bg-[var(--bg-surface)]" : "border-[var(--border-subtle)] bg-[var(--bg-card)]"
              }`}
            >
              <VlIcon slug="image" size={28} className="text-[var(--text-dim)]" />
              <div className="text-[14px] font-medium text-[var(--text-primary)]">
                {t("tr.imgDrop", "Drop a photo or screenshot here")}
              </div>
              <div className="max-w-sm text-[12px] text-[var(--text-dim)]">
                {t("tr.imgTypes", "PNG, JPG or WEBP — a spec plate, a label, a screenshot")}
              </div>
              <button
                type="button"
                onClick={() => imageRef.current?.click()}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface-hover)]"
              >
                <VlIcon slug="image" size={14} /> {t("tr.docBrowse", "Choose file")}
              </button>
              {imgError && (
                <div className="mt-1 max-w-md rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
                  {imgError}
                </div>
              )}
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto md:overflow-hidden md:grid-cols-[1fr_40px_1fr] [scrollbar-color:var(--border-color)_transparent] [scrollbar-width:thin]">
              {/* On MOBILE this column SCROLLS instead of being squeezed into
                  the locked viewport. Three stacked cards (photo + recognised
                  text + translation) inside a fixed height left the two text
                  panes about one line tall each, with the toolbar overlapping
                  them — the photo ate everything. Desktop keeps the locked
                  two-column layout. */}
              {/* The photo — capped on mobile so it can't crowd out the text. */}
              <div className="flex max-h-[40vh] shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] md:max-h-none md:min-h-0 md:shrink">
                <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
                  <VlIcon slug="image" size={15} className="shrink-0 text-[var(--text-dim)]" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text-primary)]">{imgName}</span>
                  <button type="button" onClick={resetImage} title={t("tr.imgAnother", "New image")} aria-label={t("tr.imgAnother", "New image")} className={iconBtn}>
                    <VlIcon slug="cross-small" size={15} />
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
                  {imgPreview && (
                    /* eslint-disable-next-line @next/next/no-img-element -- local object URL, never a remote asset */
                    <img src={imgPreview} alt={imgName ?? ""} className="max-h-full max-w-full rounded-lg object-contain" />
                  )}
                </div>
              </div>

              <div className="hidden md:block" aria-hidden />

              {/* Recognised text + translation */}
              <div className="flex min-h-0 flex-col gap-3">
                <div className="flex min-h-[180px] flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] md:min-h-0">
                  <div className="shrink-0 border-b border-[var(--border-subtle)] px-3 py-2 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
                    {t("tr.imgFound", "Text found in the image")}
                  </div>
                  {imgBusy ? (
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                      <VlIcon slug="spinner" size={16} className="animate-spin text-[var(--text-dim)]" />
                      <div className="text-[12.5px] text-[var(--text-muted)]">
                        {t("tr.imgReading", "Reading the image…")} {imgPct > 0 && `${imgPct}%`}
                      </div>
                      <div className="max-w-xs text-[11px] text-[var(--text-dim)]">
                        {t("tr.imgFirstRun", "First run downloads the recognition model — later images are fast.")}
                      </div>
                    </div>
                  ) : imgError ? (
                    <div className="m-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">{imgError}</div>
                  ) : (
                    <>
                      <textarea
                        value={imgText}
                        onChange={(e) => setImgText(e.target.value)}
                        dir={isRtl(effectiveFrom) ? "rtl" : "ltr"}
                        className="min-h-0 flex-1 resize-none bg-transparent px-4 py-3 text-[13.5px] leading-relaxed text-[var(--text-primary)] outline-none [scrollbar-color:var(--border-color)_transparent] [scrollbar-width:thin]"
                      />
                      <div className="flex shrink-0 items-center gap-2 border-t border-[var(--border-subtle)] px-2.5 py-1.5">
                        <button
                          type="button"
                          onClick={() => { void translateOnce(imgText).then(setImgOut); }}
                          disabled={!imgText.trim()}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] transition-opacity disabled:opacity-40"
                        >
                          <VlIcon slug="translate" size={13} /> {t("tr.title", "Translator")}
                        </button>
                        <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-dim)]">
                          {imgConfidence !== null && imgConfidence < 70
                            ? t("tr.imgLowConfidence", "The photo is hard to read — check the text before trusting it.")
                            : t("tr.imgEditHint", "You can edit the recognised text before translating.")}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex min-h-[150px] flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] md:min-h-0">
                  <div
                    dir={isRtl(to) ? "rtl" : "ltr"}
                    className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap px-4 py-3 text-[14px] leading-relaxed text-[var(--text-primary)] [scrollbar-color:var(--border-color)_transparent] [scrollbar-width:thin]"
                  >
                    {imgOut || <span className="text-[var(--text-dim)]">{t("tr.translation", "Translation")}</span>}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 border-t border-[var(--border-subtle)] px-2.5 py-1.5">
                    <button
                      type="button"
                      onClick={() => { if (imgOut) void navigator.clipboard.writeText(imgOut).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1400); }).catch(() => {}); }}
                      disabled={!imgOut}
                      title={copied ? t("tr.copied", "Copied") : t("tr.copy", "Copy")}
                      aria-label={t("tr.copy", "Copy")}
                      className={iconBtn}
                    >
                      {copied ? <VlIcon slug="check" size={15} /> : <VlIcon slug="copy-alt" size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Website tab ───────────────────────────────────────────────
           Reader-style translation of a public page. We never embed or
           re-serve the original site — only its text comes across. */
        <div className="mx-auto flex w-full min-h-0 max-w-[1600px] flex-1 flex-col gap-3 px-4 pb-14 pt-3 sm:px-6 sm:pb-6">
          <LanguageRow />

          <form
            onSubmit={(e) => { e.preventDefault(); void loadPage(); }}
            className="flex shrink-0 items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5"
          >
            <VlIcon slug="link-alt" size={14} className="ms-2 shrink-0 text-[var(--text-dim)]" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("tr.urlPlaceholder", "Paste a web address")}
              inputMode="url"
              dir="ltr"
              className="min-w-0 flex-1 bg-transparent px-1 py-2 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
            />
            <button
              type="submit"
              disabled={!url.trim() || pageBusy}
              className="shrink-0 rounded-xl bg-[var(--bg-inverted)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--text-inverted)] transition-opacity disabled:opacity-40"
            >
              {t("tr.urlGo", "Translate page")}
            </button>
          </form>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
            {pageError ? (
              <div className="m-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">{pageError}</div>
            ) : !page && !pageBusy ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <VlIcon slug="globe" size={28} className="text-[var(--text-dim)]" />
                <div className="max-w-sm text-[12.5px] text-[var(--text-dim)]">
                  {t("tr.urlHint", "Reads the page text and translates it. The original site is never embedded.")}
                </div>
              </div>
            ) : (
              <>
                <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
                  <VlIcon slug="globe" size={15} className="shrink-0 text-[var(--text-dim)]" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-muted)]">
                    {page?.url ?? t("tr.urlFetching", "Reading the page…")}
                  </span>
                  {page && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowSource((v) => !v)}
                        className="hidden shrink-0 rounded-lg px-2 py-1 text-[11.5px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] sm:block"
                      >
                        {showSource ? t("tr.hideOriginal", "Hide original") : t("tr.showOriginal", "Show original")}
                      </button>
                      {/* rel=noopener/noreferrer: the remote page must not get a
                          handle on our window or our URL. */}
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        title={t("tr.urlOriginal", "Open original")}
                        aria-label={t("tr.urlOriginal", "Open original")}
                        className={iconBtn}
                      >
                        <VlIcon slug="link-alt" size={14} />
                      </a>
                      <button type="button" onClick={resetPage} title={t("tr.urlAnother", "New page")} aria-label={t("tr.urlAnother", "New page")} className={iconBtn}>
                        <VlIcon slug="cross-small" size={15} />
                      </button>
                    </>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-color:var(--border-color)_transparent] [scrollbar-width:thin]">
                  <div className="mx-auto max-w-3xl space-y-3">
                    {pageRows.map((row, i) => (
                      <div key={i}>
                        <p
                          dir={isRtl(to) ? "rtl" : "ltr"}
                          className={`whitespace-pre-wrap leading-relaxed text-[var(--text-primary)] ${
                            i === 0 && page?.title ? "text-[17px] font-bold" : "text-[14px]"
                          }`}
                        >
                          {row.translated}
                        </p>
                        {showSource && (
                          <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--text-dim)]">
                            {row.source}
                          </p>
                        )}
                      </div>
                    ))}
                    {page?.truncated && !pageBusy && (
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[11.5px] text-[var(--text-muted)]">
                        {t("tr.urlTruncated", "Long page — only the first part was translated.")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 border-t border-[var(--border-subtle)] px-3 py-1.5 text-[11px] tabular-nums text-[var(--text-dim)]">
                  {pageBusy && <VlIcon slug="spinner" size={12} className="animate-spin" />}
                  {pageStep && pageStep.done < pageStep.total
                    ? t("tr.docProgress", "Translating {done} of {total}")
                        .replace("{done}", String(pageStep.done + 1))
                        .replace("{total}", String(pageStep.total))
                    : pageStep
                      ? t("tr.urlBlocks", "{n} sections").replace("{n}", String(pageStep.total))
                      : t("tr.urlFetching", "Reading the page…")}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── History / Saved overlay ──────────────────────────────────────
          Deliberately NOT a tab: these aren't ways to translate, they're
          places to look something up, and mixing them into the mode rail
          made the rail read as six equal choices. Opening over the
          workspace also means the text you were mid-way through typing is
          still there when you close it. */}
      {panel && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label={t("tr.close", "Close")}
            onClick={() => setPanel(null)}
            /* Blurred backdrop: the standing rule for every popup in the Hub —
               the layer behind a dialog is dimmed AND blurred so the sheet
               reads as the only live surface. */
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl sm:max-h-[80vh] sm:rounded-2xl">
            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
              <VlIcon slug={panel === "history" ? "history" : "star"} size={15} className="text-[var(--text-dim)]" />
              <h2 className="min-w-0 flex-1 truncate text-[14px] font-bold text-[var(--text-primary)]">
                {panel === "history" ? t("tr.history", "History") : t("tr.savedTab", "Saved")}
              </h2>
              {panel === "history" && history.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(t("tr.clearHistoryConfirm", "Clear all translation history on this device?"))) return;
                    setHistory([]);
                    writeLocal(HISTORY_KEY, []);
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                >
                  <VlIcon slug="trash-xmark" size={13} /> {t("tr.clearHistory", "Clear history")}
                </button>
              )}
              <button type="button" onClick={() => setPanel(null)} title={t("tr.close", "Close")} aria-label={t("tr.close", "Close")} className={iconBtn}>
                <VlIcon slug="cross-small" size={15} />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 [scrollbar-color:var(--border-color)_transparent] [scrollbar-width:thin]">
              <EntryList items={panel === "history" ? history : saved} kind={panel} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
