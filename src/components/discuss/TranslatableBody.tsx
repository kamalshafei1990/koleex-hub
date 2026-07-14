"use client";

/* ---------------------------------------------------------------------------
   TranslatableBody — renders a Discuss message body with a translation
   affordance. Multi-national teams: the sender writes in their own language;
   the reader either clicks "Translate" per message or turns on Auto-translate
   (see TranslateControl in DiscussApp) so every incoming message is rendered
   in their language automatically. "Show original" always restores the source
   text, so the conversation is never lost in translation.

   Shared by the main channel list (MessageBubble) and the ThreadPane so both
   surfaces behave identically.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import type { DiscussMention } from "@/types/supabase";
import { renderDiscussMarkdown } from "./markdown";
import LanguagesIcon from "@/components/icons/ui/LanguagesIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import {
  translateText,
  peekTranslation,
  translateLangLabel,
} from "@/lib/discuss-translate";

export function TranslatableBody({
  body,
  messageId,
  mentions,
  autoTranslate,
  targetLang,
  t,
  className = "text-[13px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-words",
}: {
  body: string;
  messageId: string;
  mentions: DiscussMention[];
  autoTranslate: boolean;
  targetLang: string;
  t: (key: string, fallback?: string) => string;
  className?: string;
}) {
  /* undefined = not translated yet; string = translated text (may equal body
     when source == target or the provider is unavailable). */
  const [translated, setTranslated] = useState<string | undefined>(() =>
    peekTranslation(body, targetLang),
  );
  const [loading, setLoading] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const out = await translateText(body, targetLang);
      setTranslated(out);
      setShowOriginal(false);
    } finally {
      setLoading(false);
    }
  }, [body, targetLang]);

  /* Auto-translate: fetch whenever the mode is on and we don't already have a
     translation for this exact (body, lang). Re-runs if the target changes. */
  useEffect(() => {
    if (!autoTranslate) return;
    const cached = peekTranslation(body, targetLang);
    if (cached !== undefined) {
      setTranslated(cached);
      return;
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTranslate, targetLang, body]);

  const changed = translated !== undefined && translated.trim() !== body.trim();
  const displayText =
    translated !== undefined && !showOriginal ? translated : body;
  const isTranslatedView = translated !== undefined && !showOriginal && changed;

  return (
    <div className={className}>
      {renderDiscussMarkdown(displayText, mentions, `mb-${messageId}`)}
      <div className="mt-0.5 flex items-center gap-2 text-[10.5px] not-italic whitespace-normal">
        {loading ? (
          <span className="inline-flex items-center gap-1 text-[var(--text-dim)]">
            <SpinnerIcon className="h-3 w-3 animate-spin" />
            {t("translate.working", "Translating…")}
          </span>
        ) : translated === undefined ? (
          <button
            type="button"
            onClick={() => void run()}
            className="inline-flex items-center gap-1 text-[var(--text-dim)] hover:text-blue-400 transition-colors"
          >
            <LanguagesIcon className="h-3 w-3" />
            {t("translate.action", "Translate")}
          </button>
        ) : !changed ? null : isTranslatedView ? (
          <>
            <span className="text-[var(--text-dim)]">
              {t("translate.translatedTo", "Translated · {lang}").replace(
                "{lang}",
                translateLangLabel(targetLang),
              )}
            </span>
            <button
              type="button"
              onClick={() => setShowOriginal(true)}
              className="text-[var(--text-muted)] hover:text-blue-400 transition-colors"
            >
              {t("translate.showOriginal", "Show original")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowOriginal(false)}
            className="inline-flex items-center gap-1 text-[var(--text-dim)] hover:text-blue-400 transition-colors"
          >
            <LanguagesIcon className="h-3 w-3" />
            {t("translate.showTranslation", "Show translation")}
          </button>
        )}
      </div>
    </div>
  );
}
