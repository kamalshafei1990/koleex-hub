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
  inverted = false,
  className,
}: {
  body: string;
  messageId: string;
  mentions: DiscussMention[];
  autoTranslate: boolean;
  targetLang: string;
  t: (key: string, fallback?: string) => string;
  /** Own messages sit on the solid --bg-inverted bubble, so the body text and
   *  the Translate pill flip to --text-inverted to stay readable. */
  inverted?: boolean;
  className?: string;
}) {
  const resolvedClassName =
    className ??
    `text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
      inverted ? "text-[var(--text-inverted)]" : "text-[var(--text-primary)]"
    }`;
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
  /* A translation exists AND differs from the source → offer the original ⇄
     translation toggle. Otherwise (not translated yet, or translation came back
     identical) keep the plain "Translate" button so the control NEVER
     disappears — the user can always re-trigger it. */
  const canToggle = translated !== undefined && changed;

  /* Shared pill style — a small, always-visible button under the message.
     Own messages (inverted) flip the pill to the --text-inverted family so it
     reads on the solid bubble. */
  const pill = inverted
    ? "inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10.5px] font-medium " +
      "border border-[var(--text-inverted)]/25 text-[var(--text-inverted)]/70 " +
      "hover:text-[var(--text-inverted)] hover:bg-[var(--text-inverted)]/10 transition-colors " +
      "select-none"
    : "inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10.5px] font-medium " +
      "border border-[var(--border-subtle)] text-[var(--text-dim)] " +
      "hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors " +
      "select-none";
  const metaText = inverted ? "text-[var(--text-inverted)]/60" : "text-[var(--text-dim)]";

  return (
    <div className={resolvedClassName}>
      {renderDiscussMarkdown(displayText, mentions, `mb-${messageId}`)}
      <div className="mt-1 flex items-center gap-2 not-italic whitespace-normal">
        {loading ? (
          <span className={`inline-flex items-center gap-1 h-6 px-2 text-[10.5px] ${metaText}`}>
            <SpinnerIcon className="h-3 w-3 animate-spin" />
            {t("translate.working", "Translating…")}
          </span>
        ) : canToggle ? (
          <button
            type="button"
            onClick={() => setShowOriginal((v) => !v)}
            className={pill}
          >
            <LanguagesIcon className="h-3 w-3" />
            {showOriginal
              ? t("translate.showTranslation", "Show translation")
              : t("translate.showOriginal", "Show original")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void run()}
            className={pill}
          >
            <LanguagesIcon className="h-3 w-3" />
            {t("translate.action", "Translate")}
          </button>
        )}
        {canToggle && !showOriginal && (
          <span className={`text-[9.5px] uppercase tracking-wide ${metaText}`}>
            {translateLangLabel(targetLang)}
          </span>
        )}
      </div>
    </div>
  );
}
