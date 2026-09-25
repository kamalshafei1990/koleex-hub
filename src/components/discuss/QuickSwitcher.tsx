"use client";

/* ---------------------------------------------------------------------------
   QuickSwitcher — Ctrl/⌘+K "jump to a conversation" for Discuss.

   A combobox inside the shared Discuss dialog shell: type to fuzzy-filter
   every conversation in the sidebar (channels, groups, DMs, customer chats),
   ↑/↓ to move, Enter to open, Esc to close. Conversations with unread come
   first when the query is empty, then by recency (the sidebar's own order).
   --------------------------------------------------------------------------- */

import { useId, useMemo, useRef, useState } from "react";
import ModalShell from "./DiscussModalShell";
import { DiscussAvatar as Avatar } from "./DiscussAvatar";
import HashtagIcon from "@/components/icons/ui/HashtagIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import BellOffIcon from "@/components/icons/ui/BellOffIcon";
import type { DiscussChannelListRow } from "@/lib/discuss";
import type { DiscussT } from "./discuss-shared";

export type SwitcherItem = {
  channel: DiscussChannelListRow;
  name: string;
  /** Secondary text used for matching too (username, alt name, description). */
  hint: string;
  unread: number;
};

/** Subsequence fuzzy score: lower is better, -1 = no match. Contiguous and
 *  word-start hits score best, so "gen" finds "#general" before "sign-in". */
export function fuzzyScore(text: string, q: string): number {
  const t = text.toLowerCase();
  if (!q) return 0;
  const idx = t.indexOf(q);
  if (idx === 0) return 0;
  if (idx > 0) return /[\s#@_\-./]/.test(t[idx - 1]) ? 1 : 2 + idx / 100;
  let ti = 0;
  let gaps = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return -1;
    gaps += found - ti;
    ti = found + 1;
  }
  return 10 + gaps;
}

export default function QuickSwitcher({
  items,
  onSelect,
  onCancel,
  t,
}: {
  items: SwitcherItem[];
  onSelect: (channelId: string) => void;
  onCancel: () => void;
  t: DiscussT;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...items].sort((a, b) => (b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0)).slice(0, 50);
    }
    const scored: Array<{ it: SwitcherItem; s: number }> = [];
    for (const it of items) {
      const a = fuzzyScore(it.name, q);
      const b = fuzzyScore(it.hint, q);
      const s = a >= 0 && b >= 0 ? Math.min(a, b + 0.5) : a >= 0 ? a : b >= 0 ? b + 0.5 : -1;
      if (s >= 0) scored.push({ it, s });
    }
    scored.sort((x, y) => x.s - y.s);
    return scored.slice(0, 50).map((x) => x.it);
  }, [items, query]);

  const clamped = results.length === 0 ? 0 : Math.min(active, results.length - 1);
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const move = (delta: number) => {
    if (results.length === 0) return;
    const next = (clamped + delta + results.length) % results.length;
    setActive(next);
    document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
  };

  return (
    <ModalShell title={t("switcher.title", "Jump to a conversation")} onCancel={onCancel} width={480} closeLabel={t("btn.close", "Close")}>
      <div className="p-4 flex flex-col gap-3">
        <div className="h-10 px-3 flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)] transition-colors">
          <SearchIcon className="h-4 w-4 text-[var(--text-dim)] shrink-0" />
          <input
            type="text"
            autoFocus
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results.length > 0 ? optionId(clamped) : undefined}
            aria-label={t("switcher.placeholder", "Type a channel or person…")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
              else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
              else if (e.key === "Enter") {
                e.preventDefault();
                const pick = results[clamped];
                if (pick) onSelect(pick.channel.id);
              }
            }}
            placeholder={t("switcher.placeholder", "Type a channel or person…")}
            className="flex-1 min-w-0 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none"
          />
        </div>
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label={t("switcher.title", "Jump to a conversation")}
          className="max-h-[360px] overflow-y-auto flex flex-col gap-0.5"
        >
          {results.length === 0 && (
            <li className="p-4 text-center text-[11.5px] text-[var(--text-dim)]" role="presentation">
              {t("search.noResults", "No results")}
            </li>
          )}
          {results.map((it, i) => {
            const c = it.channel;
            const selected = i === clamped;
            return (
              <li
                key={c.id}
                id={optionId(i)}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(c.id)}
                className={`w-full px-2.5 py-2 flex items-center gap-2.5 rounded-lg cursor-pointer transition-colors ${
                  selected ? "bg-[var(--bg-surface-active)]" : "hover:bg-[var(--bg-surface)]"
                }`}
              >
                {c.kind === "direct" ? (
                  <Avatar name={it.name} url={c.other?.avatar_url} size={28} />
                ) : (
                  <span className="h-7 w-7 shrink-0 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
                    {c.kind === "channel" ? (
                      <HashtagIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    ) : c.kind === "customer" ? (
                      <MessageSquareIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    ) : (
                      <UsersIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    )}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold text-[var(--text-primary)] truncate">{it.name}</span>
                  {it.hint && (
                    <span className="block text-[10.5px] text-[var(--text-dim)] truncate">{it.hint}</span>
                  )}
                </span>
                {c.muted && <BellOffIcon className="h-3 w-3 shrink-0 text-[var(--text-dim)]" aria-hidden />}
                {it.unread > 0 && (
                  <span className="h-[18px] min-w-[18px] px-1.5 rounded-full text-[10.5px] font-bold tabular-nums flex items-center justify-center bg-[var(--bg-inverted)] text-[var(--text-inverted)]">
                    {it.unread > 99 ? "99+" : it.unread}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="text-[10.5px] text-[var(--text-dim)] px-1">{t("switcher.hint", "↑↓ to move · Enter to open · Esc to close")}</div>
      </div>
    </ModalShell>
  );
}
