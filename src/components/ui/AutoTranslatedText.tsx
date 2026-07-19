"use client";

/* ---------------------------------------------------------------------------
   AutoTranslatedText — shows user-entered free text in the VIEWER's language.

   A Chinese teammate types a note in Chinese; an English/Arabic teammate sees
   it auto-translated to their language (and vice-versa). The original is always
   preserved and one tap reveals it.

   - Uses useAutoTranslate(): detects the text's script, and only calls the
     translation API when it differs from the viewer's UI language.
   - The API (/api/ai/translate) caches per-tenant, so the same note is
     translated once for the whole team; a memory cache avoids re-fetching on
     re-render / language toggle.
   - Fails safe: on any error it shows the original text.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import { useAutoTranslate } from "@/lib/auto-translate";
import { useTranslation } from "@/lib/i18n";
import { commonT } from "@/lib/translations/common";
import LanguagesIcon from "@/components/icons/ui/LanguagesIcon";

interface Props {
  text?: string | null;
  className?: string;
  /** Render the text block as a <p> (multi-line) instead of inline <span>. */
  block?: boolean;
  /** Text only — no "auto-translated" toggle chip. The original is exposed
      via the title tooltip instead. REQUIRED inside <button> hosts (labels,
      dropdown rows, chips): the chip is itself a button and nested buttons
      are invalid HTML (hydration error) — and it visually clutters tight UI. */
  plain?: boolean;
}

export default function AutoTranslatedText({ text, className, block, plain }: Props) {
  const { t } = useTranslation(commonT);
  const { display, wasTranslated, original, loading } = useAutoTranslate(text);
  const [showOriginal, setShowOriginal] = useState(false);

  if (!text || !text.trim()) return null;

  const shown = showOriginal ? original : display;
  const Wrapper = (block ? "p" : "span") as "p" | "span";

  if (plain) {
    return (
      <Wrapper className={className} title={wasTranslated ? original ?? undefined : undefined}
        style={block ? { whiteSpace: "pre-wrap" } : undefined}>
        {display}
      </Wrapper>
    );
  }

  return (
    <Wrapper className={className} style={block ? { whiteSpace: "pre-wrap" } : undefined}>
      {shown}
      {loading && (
        <span className="ms-1 align-middle text-[10px] text-[var(--text-ghost)]">…</span>
      )}
      {wasTranslated && !loading && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowOriginal((v) => !v); }}
          title={showOriginal ? "" : t("translate.autoTranslated", "auto-translated")}
          className="ms-1.5 inline-flex items-center gap-0.5 align-middle text-[10px] font-medium text-[var(--accent,#0066FF)] hover:underline"
        >
          <LanguagesIcon size={10} />
          {showOriginal ? t("translate.showOriginal", "show original") : t("translate.autoTranslated", "auto-translated")}
        </button>
      )}
    </Wrapper>
  );
}
