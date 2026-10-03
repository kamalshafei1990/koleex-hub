/* Recently-used emoji for the Discuss composer — shared by the mobile
   EmojiPanel and the desktop EmojiPicker modal so picks from either
   surface feed the same row. Browser-only; every access is wrapped. */

const RECENT_KEY = "kx-discuss-recent-emoji";
const RECENT_MAX = 16;

export function loadRecentEmojis(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

export function rememberEmoji(emoji: string): void {
  try {
    const next = [emoji, ...loadRecentEmojis().filter((e) => e !== emoji)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — recents are a nicety, never a blocker */
  }
}
