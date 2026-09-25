"use client";

import ModalShell from "./DiscussModalShell";
import type { DiscussT } from "./discuss-shared";

/* ═══════════════════════════════════════════════════════════════════════════
   EMOJI PICKER — compact static palette (full emoji search ships in Phase B)
   ═══════════════════════════════════════════════════════════════════════════ */

const EMOJI_PALETTE = [
  "😀", "😁", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😍",
  "🥰", "😘", "😗", "😎", "🤓", "🧐", "🤔", "😐", "😑", "😶",
  "🙄", "😏", "😣", "😥", "😮", "🤐", "😯", "😪", "😫", "🥱",
  "😴", "😌", "😛", "😜", "🤪", "😝", "🤤", "😒", "😓", "😔",
  "😕", "🙁", "☹️", "😖", "😞", "😟", "😤", "😢", "😭", "😦",
  "👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙",
  "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💪", "🦾", "❤️", "🧡",
  "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕",
  "🔥", "✨", "🎉", "🎊", "💯", "✅", "❌", "⭐", "🌟", "💡",
  "🚀", "📦", "📩", "📅", "📈", "📉", "💼", "💰", "🎯", "🏆",
];

export default function EmojiPicker({
  onCancel,
  onSelect,
  t,
}: {
  onCancel: () => void;
  onSelect: (emoji: string) => void;
  t: DiscussT;
}) {
  return (
    <ModalShell title={t("composer.emoji", "Emoji")} onCancel={onCancel} width={380} closeLabel={t("btn.close", "Close")}>
      <div className="p-4">
        {/* 7 columns on a phone, 10 from sm up — cells stretch to the grid
            instead of fixed 36px squares that overflowed a 320px screen. */}
        <div className="grid grid-cols-7 sm:grid-cols-10 gap-1">
          {EMOJI_PALETTE.map((e, i) => (
            <button
              key={`${e}-${i}`}
              type="button"
              onClick={() => onSelect(e)}
              aria-label={e}
              className="aspect-square w-full min-h-9 rounded-md flex items-center justify-center text-[20px] hover:bg-[var(--bg-surface)] transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}
