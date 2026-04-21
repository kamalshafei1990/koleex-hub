"use client";

/* ---------------------------------------------------------------------------
   EmojiButton — small emoji picker for the composer.

   Design notes:
     · No third-party library. A ~60-emoji curated grid handles 95% of
       business-chat needs without shipping emoji-mart's 200 KB bundle
       or hitting a CDN for font data.
     · Categories in one flat grid (no tabs) — fewer clicks for the
       common case. Users who want obscure emojis can use their OS
       keyboard (✔ on mobile, ctrl+cmd+space on macOS).
     · Deterministic layout: 6 columns × 10 rows = 60 slots, works on
       a 320 px mobile screen without overflow.
     · Focus/keyboard: Escape closes, clicking outside closes, Tab
       cycles through emojis. Cursor goes back to the textarea after
       an insert so the user can keep typing.
     · No animation — instant open/close. Small popovers don't need
       motion to feel responsive.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";

/** Curated 60-emoji grid. Ordered roughly by frequency of use in
 *  business messaging — smileys first (~20), reactions/gestures next
 *  (~15), hearts + celebrations (~10), office + objects (~15). */
const EMOJIS: string[] = [
  // Row 1-3: smileys
  "😀", "😊", "🙂", "😉", "😎", "😁",
  "😍", "🥰", "😂", "🤣", "😅", "🤔",
  "😇", "🙃", "🤩", "😢", "😭", "😡",
  // Row 4-5: gestures
  "👍", "👎", "👌", "🙏", "👋", "💪",
  "🤝", "👏", "🙌", "✋", "👉", "🤷",
  // Row 6-7: hearts + celebrations
  "❤️", "💙", "💚", "💛", "🧡", "💜",
  "💯", "🔥", "✨", "⭐", "🎉", "🏆",
  // Row 8-10: office + objects
  "✅", "❌", "⚠️", "📌", "📎", "📝",
  "💼", "📊", "📈", "📉", "📅", "🕐",
  "💡", "🚀", "📱", "💻", "📧", "☕",
];

interface Props {
  /** Called with the emoji character when the user picks one. The
   *  parent is responsible for inserting at the cursor position. */
  onSelect: (emoji: string) => void;
  /** Accessible label for the trigger button. */
  label?: string;
  /** Optional className for the trigger button so the host can match
   *  other composer buttons. */
  className?: string;
}

export default function EmojiButton({
  onSelect,
  label = "Insert emoji",
  className,
}: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  /* Close on outside click. Using mousedown (not click) so that
     clicking inside an emoji cell still fires the cell's onClick
     before the outside-close handler strips it. */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /* Close on Escape. */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        /* Return focus to the trigger so keyboard users aren't
           orphaned. */
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handlePick = useCallback(
    (emoji: string) => {
      onSelect(emoji);
      /* Keep the popover open so users can insert multiple reactions
         in a row without re-opening. Close happens on outside click
         or on Escape. */
    },
    [onSelect],
  );

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={
          className ??
          "h-10 w-10 rounded-full flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors text-[20px]"
        }
      >
        <span aria-hidden>😊</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Emoji picker"
          className="absolute bottom-full right-0 mb-2 z-[60] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl p-2 w-[248px] max-h-[320px] overflow-y-auto"
        >
          <div className="grid grid-cols-6 gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => handlePick(e)}
                className="aspect-square rounded-md flex items-center justify-center text-[22px] hover:bg-[var(--bg-surface-subtle)] active:bg-[var(--bg-surface)] transition-colors"
                aria-label={`Insert ${e}`}
              >
                <span aria-hidden>{e}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
