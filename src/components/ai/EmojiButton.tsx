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

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  /* Phase 14.3: ref on the portal-rendered popover. Since the
     popover lives in document.body (outside wrapperRef) we need to
     check it separately in the outside-click handler. */
  const popoverRef = useRef<HTMLDivElement | null>(null);

  /* Close on outside click. Using mousedown (not click) so that
     clicking inside an emoji cell still fires the cell's onClick
     before the outside-close handler strips it. */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current && wrapperRef.current.contains(target)) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      setOpen(false);
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

  /* Phase 14.3: render the popover via a React Portal into document.body
     instead of inline. The composer pill has `backdrop-blur-xl` which
     creates a new stacking context — any z-index on an absolute-
     positioned descendant is trapped in that context, so the popover
     appeared BEHIND the message bubbles above. A portal escapes the
     ancestor stacking context entirely; combined with position:fixed
     and rect-based coordinates, the popover lives in the viewport's
     top-level stacking context and always renders above everything. */
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const popoverW = 252;

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (triggerRef.current) {
        setAnchorRect(triggerRef.current.getBoundingClientRect());
      }
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  /* Position computed from the trigger rect. Anchors the popover's
     BOTTOM just above the trigger's TOP (with 8 px gap). Clamps the
     left edge to stay within the viewport so opening on a narrow
     screen doesn't push the grid off-screen. */
  const popoverStyle: React.CSSProperties | null = anchorRect
    ? {
        position: "fixed" as const,
        bottom: typeof window !== "undefined"
          ? window.innerHeight - anchorRect.top + 8
          : 0,
        left: typeof window !== "undefined"
          ? Math.min(
              Math.max(8, anchorRect.left),
              window.innerWidth - popoverW - 8,
            )
          : anchorRect.left,
        width: popoverW,
        zIndex: 9999,
      }
    : null;

  const popoverNode =
    open && popoverStyle && typeof document !== "undefined" ? (
      <div
        ref={popoverRef}
        role="dialog"
        aria-label="Emoji picker"
        style={popoverStyle}
        className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl p-2"
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
    ) : null;

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
        {/* Monochrome SmileIcon (Koleex Hub UI style), size 24 matches
            the mic / send icon weight. */}
        <SmileIcon size={24} className="text-current" />
      </button>
      {popoverNode && typeof document !== "undefined"
        ? createPortal(popoverNode, document.body)
        : null}
    </div>
  );
}
