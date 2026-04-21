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
import SmileIcon from "@/components/icons/ui/SmileIcon";

/** Curated 48-emoji grid (6 × 8). Trimmed from the original 60 so
 *  the popover fits on a 568 px iPhone SE viewport without needing
 *  internal scroll — the scrollbar was hiding the top row (smileys)
 *  in the wild. Still covers ~95% of business-chat reactions. */
const EMOJIS: string[] = [
  // Row 1-2: smileys (12)
  "😀", "😊", "🙂", "😉", "😎", "😁",
  "😍", "😂", "🤣", "🤔", "😅", "🙃",
  // Row 3-4: gestures (12)
  "👍", "👎", "👌", "🙏", "👋", "💪",
  "🤝", "👏", "🙌", "✋", "🤷", "👉",
  // Row 5-6: hearts + celebrations (12)
  "❤️", "💙", "💚", "🧡", "💯", "🔥",
  "✨", "⭐", "🎉", "🏆", "💡", "🚀",
  // Row 7-8: office + objects (12)
  "✅", "❌", "⚠️", "📌", "📎", "📝",
  "💼", "📊", "📈", "📅", "🕐", "☕",
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
          "h-10 w-10 rounded-full flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
        }
      >
        {/* Phase 14.1: monochrome SmileIcon (Koleex Hub UI style),
            not the colored 😊 emoji — matches the mic / send / icon
            buttons around it. Size 24 matches the mic/send icon
            visual weight so the composer's three action buttons
            feel balanced. */}
        <SmileIcon size={24} className="text-current" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Emoji picker"
          /* left-0 anchors the popover to the LEFT edge of the trigger
             (the button is now on the left of the composer), so the
             grid opens rightward into the empty space above the
             textarea instead of clipping off-screen. bottom-full
             keeps it above the composer. */
          className="absolute bottom-full left-0 mb-2 z-[60] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl p-2 w-[252px]"
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
