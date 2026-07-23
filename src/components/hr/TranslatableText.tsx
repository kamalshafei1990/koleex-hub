"use client";

/* ---------------------------------------------------------------------------
   TranslatableText — show free text with a one-tap translation.

   The case that motivated it: an employee writes their leave reason in
   Chinese and the approving manager reads English (or the reverse). The
   manager was left approving something they could not read.

   Translation goes through /api/ai/translate, which is tenant-cached in
   Postgres — the same reason translated once is free for everyone after, and
   the round trip is only paid when someone actually asks. Nothing is
   translated automatically: it costs tokens, and most reasons are already in
   a language the reader understands.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import LanguagesIcon from "@/components/icons/ui/LanguagesIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/** Rough script detection — enough to pick a sensible target language without
 *  asking the reader, and to skip the button when it would be a no-op. */
function detectLang(text: string): "zh" | "ar" | "en" {
  if (/[一-鿿㐀-䶿]/.test(text)) return "zh";
  if (/[؀-ۿ]/.test(text)) return "ar";
  return "en";
}

export default function TranslatableText({
  text,
  viewerLang,
  className,
  translateLabel,
  showOriginalLabel,
  translatedNote,
  failedLabel,
}: {
  text: string;
  /** The reader's UI language — the default translation target. */
  viewerLang: string;
  className?: string;
  translateLabel: string;
  showOriginalLabel: string;
  /** Caption under the translated text, e.g. "Translated automatically". */
  translatedNote: string;
  failedLabel: string;
}) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const source = detectLang(text);
  const target = viewerLang === "zh" || viewerLang === "ar" ? viewerLang : "en";
  /* Already in the reader's language — offering "Translate" would be noise. */
  const worthTranslating = source !== target;

  const run = async () => {
    if (translated) { setShowing(true); return; }
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target_lang: target, source_lang: source }),
      });
      const json = (await res.json().catch(() => null)) as { translated?: string } | null;
      if (!res.ok || !json?.translated) { setFailed(true); return; }
      setTranslated(json.translated);
      setShowing(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className={className} lang={showing ? target : source}>
        {showing && translated ? translated : text}
      </div>

      {showing && (
        <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
          {translatedNote}
        </div>
      )}

      {worthTranslating && (
        <button
          type="button"
          onClick={() => (showing ? setShowing(false) : void run())}
          disabled={busy}
          className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--accent)] hover:underline disabled:opacity-50"
        >
          {busy
            ? <SpinnerIcon size={11} className="animate-spin" />
            : <LanguagesIcon size={11} />}
          {showing ? showOriginalLabel : translateLabel}
        </button>
      )}

      {failed && (
        <div className="mt-1 text-[11px] text-[var(--text-dim)]">{failedLabel}</div>
      )}
    </div>
  );
}
