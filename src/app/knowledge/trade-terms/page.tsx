"use client";

/* ---------------------------------------------------------------------------
   /knowledge/trade-terms — Trade & Payment Terms.

   READ-ONLY BY DESIGN. This section is reference material: it reads no table,
   calls no API and writes nothing. Everything on screen is compiled in from
   src/lib/trade-terms, which is also what the AI agent answers from — one
   source, so a term can never mean one thing on this page and another in a
   conversation.

   INTERNAL ONLY, matching the AI knowledge it shares a source with.

   LANGUAGE FOLLOWS THE HEADER, LIVE. The first version read
   localStorage["koleex-lang"] once on mount and stopped listening — so the
   page came up in the saved language but ignored the header switch until a
   reload, which is exactly what the owner's screenshots showed (zh selected,
   Explorer still `lang: "en"`). `useTranslation` is the Hub's one language
   subscription: it reads the saved value and listens to the `langchange`
   event the header dispatches. The page passes it no dictionary because its
   strings live in TRADE_TERMS_UI, typed per language — only the `lang` is
   wanted here.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import Explorer from "@/components/knowledge/trade-terms/Explorer";
import { useTranslation } from "@/lib/i18n";
import { TRADE_TERMS_UI, type TradeLang } from "@/lib/trade-terms/ui";

/* Module-level so the hook's dependency never changes identity. */
const NO_DICTIONARY = {};

export default function TradeTermsPage() {
  const { lang: hubLang } = useTranslation(NO_DICTIONARY);
  /* The Hub's Lang and TradeLang are the same three values today; the
     narrowing is so an unexpected stored value falls to English instead of
     indexing TRADE_TERMS_UI with undefined. */
  const lang: TradeLang = hubLang === "zh" || hubLang === "ar" ? hubLang : "en";
  const t = TRADE_TERMS_UI[lang];

  return (
    <div className="kx-app relative min-h-screen bg-[var(--bg-primary)]">
      <div className="relative z-[1] max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Link
            href="/knowledge"
            className="kx-glass kx-hover-glow h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" />
          </Link>
          <h1 className="text-xl md:text-[22px] font-bold tracking-tight">{t.title}</h1>
        </div>

        <p className="text-[12.5px] leading-relaxed text-[var(--text-dim)] mb-6 md:mb-8 max-w-2xl ms-0 md:ms-11">
          {t.subtitle}
        </p>

        <Explorer lang={lang} />
      </div>
    </div>
  );
}
