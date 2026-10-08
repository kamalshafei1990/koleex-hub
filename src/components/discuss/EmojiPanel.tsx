"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   EMOJI PANEL — mobile inline panel under the composer (WeChat style).
   NOT a modal: no backdrop, no dimming, the chat above stays fully visible
   and interactive. The composer row stays on top and the emoji button in it
   toggles this panel. Includes a "Recently Used" row (persisted locally)
   and a backspace key at the bottom-right like WeChat's keyboard panel.
   Desktop never renders it (hidden max-md:block) — it keeps the modal.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import BackspaceIcon from "@/components/icons/ui/BackspaceIcon";
import type { DiscussT } from "./discuss-shared";
import { EMOJI_PALETTE } from "./EmojiPicker";
import { loadRecentEmojis, rememberEmoji } from "./emoji-recents";

export default function EmojiPanel({
  onSelect,
  onBackspace,
  t,
}: {
  onSelect: (emoji: string) => void;
  onBackspace: () => void;
  t: DiscussT;
}) {
  const [recent, setRecent] = useState<string[]>([]);

  /* Load after mount (localStorage is client-only; SSR must render empty). */
  useEffect(() => {
    setRecent(loadRecentEmojis());
  }, []);

  const pick = (emoji: string) => {
    rememberEmoji(emoji);
    setRecent(loadRecentEmojis());
    onSelect(emoji);
  };

  const cell =
    "flex h-10 items-center justify-center rounded-lg text-[22px] active:bg-[var(--bg-surface-active)] transition-colors";

  return (
    <div className="hidden max-md:block pt-2">
      <div className="max-h-[42dvh] overflow-y-auto overscroll-contain">
        {recent.length > 0 && (
          <>
            <div className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-dim)]">
              {t("emoji.recentlyUsed", "Recently Used")}
            </div>
            <div className="grid grid-cols-8 gap-1">
              {recent.map((e, i) => (
                <button key={`r-${e}-${i}`} type="button" onClick={() => pick(e)} aria-label={e} className={cell}>
                  {e}
                </button>
              ))}
            </div>
            <div className="my-2 border-t border-[var(--border-subtle)]" />
          </>
        )}
        <div className="grid grid-cols-8 gap-1">
          {EMOJI_PALETTE.map((e, i) => (
            <button key={`${e}-${i}`} type="button" onClick={() => pick(e)} aria-label={e} className={cell}>
              {e}
            </button>
          ))}
        </div>
      </div>
      {/* WeChat keyboard-panel bottom bar: backspace pinned bottom-right. */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onBackspace}
          aria-label={t("emoji.backspace", "Delete")}
          className="h-9 w-12 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] active:bg-[var(--bg-surface-active)] transition-colors"
        >
          <BackspaceIcon size={18} />
        </button>
      </div>
    </div>
  );
}
