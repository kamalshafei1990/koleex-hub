"use client";

/* ---------------------------------------------------------------------------
   SearchPanel — Phase C full-text search overlay for Discuss.

   Behavior:
     · Mounts as a slide-in panel on top of the thread column
     · Debounced input feeds `searchDiscussMessages()` which returns
       hits scoped to the current user's channels only
     · Results grouped by channel with <mark>-highlighted snippets
     · Clicking a hit closes the panel and jumps to the channel +
       scrolls the message into view (parent wires the scroll)

   Rendering snippet highlights:
     The data layer returns snippets pre-wrapped in <mark>…</mark> tags.
     We split on those tags and render the matches with a styled span
     instead of using dangerouslySetInnerHTML — zero XSS surface.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Hash, Loader2, MessageSquare, Search, User, X } from "lucide-react";
import { searchDiscussMessages } from "@/lib/discuss";
import type {
  DiscussChannelKind,
  DiscussSearchResult,
} from "@/types/supabase";

function useDebounced<T>(value: T, delay = 240): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const h = window.setTimeout(() => setD(value), delay);
    return () => window.clearTimeout(h);
  }, [value, delay]);
  return d;
}

export interface SearchPanelProps {
  currentAccountId: string;
  /** Close the panel (the user hit X or clicked a hit). */
  onClose: () => void;
  /** Called when the user clicks a search hit. Parent switches to the
   *  channel and scrolls the message into view. */
  onJump: (channelId: string, messageId: string) => void;
  /** Optional scope: when set, search is restricted to this channel. */
  scopedChannelId?: string | null;
  /** Optional initial query (e.g. when opened from a "search in channel"
   *  button with pre-filled context). */
  initialQuery?: string;
  /** i18n helper. */
  t: (key: string, fallback?: string) => string;
}

export function SearchPanel({
  currentAccountId,
  onClose,
  onJump,
  scopedChannelId,
  initialQuery = "",
  t,
}: SearchPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<DiscussSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounced(query, 240);

  useEffect(() => {
    let cancelled = false;
    const q = debounced.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    searchDiscussMessages({
      accountId: currentAccountId,
      query: q,
      channelId: scopedChannelId ?? undefined,
      limit: 40,
    })
      .then((rows) => {
        if (cancelled) return;
        setResults(rows);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[Discuss] Search failed:", err);
        setResults([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, currentAccountId, scopedChannelId]);

  /* Group hits by channel — easier to scan "look, three hits in #general". */
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { channel: DiscussSearchResult; items: DiscussSearchResult[] }
    >();
    for (const r of results) {
      const bucket = map.get(r.channel_id);
      if (bucket) bucket.items.push(r);
      else map.set(r.channel_id, { channel: r, items: [r] });
    }
    return Array.from(map.values());
  }, [results]);

  const handleJump = useCallback(
    (hit: DiscussSearchResult) => {
      onJump(hit.channel_id, hit.message_id);
      onClose();
    },
    [onJump, onClose],
  );

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[var(--bg-primary)]/95 backdrop-blur-md border-s border-[var(--border-subtle)]">
      {/* Header + input */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[14px] font-semibold text-[var(--text-primary)]">
            {t("search.panel.title", "Search Discuss")}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
            aria-label={t("btn.close", "Close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-10 px-3 flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)] transition-colors">
          <Search className="h-4 w-4 text-[var(--text-dim)] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(
              "search.panel.placeholder",
              "Search messages, people, files…",
            )}
            className="flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-[var(--text-dim)] hover:text-[var(--text-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {scopedChannelId && (
          <div className="mt-2 text-[10.5px] text-[var(--text-dim)]">
            {t(
              "search.panel.scoped",
              "Showing results from this channel only",
            )}
          </div>
        )}
      </div>

      {/* Results scroll area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-10 text-[var(--text-dim)]">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {!loading && query.trim().length < 2 && (
          <div className="px-5 py-10 text-center">
            <div className="text-[12px] text-[var(--text-muted)]">
              {t("search.panel.prompt", "Type at least 2 characters to search")}
            </div>
            <div className="mt-1 text-[10.5px] text-[var(--text-dim)]">
              {t(
                "search.panel.hint",
                "Search looks across every message in your channels and DMs.",
              )}
            </div>
          </div>
        )}
        {!loading && query.trim().length >= 2 && results.length === 0 && (
          <div className="px-5 py-10 text-center">
            <div className="text-[12px] text-[var(--text-muted)]">
              {t("search.panel.empty", "No messages found")}
            </div>
            <div className="mt-1 text-[10.5px] text-[var(--text-dim)]">
              {t(
                "search.panel.emptyHint",
                "Try different words or shorter phrases.",
              )}
            </div>
          </div>
        )}
        {!loading && grouped.length > 0 && (
          <div className="py-3">
            {grouped.map(({ channel, items }) => (
              <div key={channel.channel_id} className="mb-4">
                {/* Channel header */}
                <div className="px-4 pb-1.5 flex items-center gap-1.5">
                  <ChannelIcon kind={channel.channel_kind} />
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-dim)] truncate">
                    {channel.channel_name ??
                      (channel.channel_kind === "direct"
                        ? t("channel.direct", "Direct message")
                        : t("channel.untitled", "Untitled"))}
                  </span>
                  <span className="text-[10.5px] text-[var(--text-dim)]">
                    · {items.length}
                  </span>
                </div>
                {/* Hit rows */}
                <div className="flex flex-col">
                  {items.map((hit) => (
                    <button
                      key={hit.message_id}
                      type="button"
                      onClick={() => handleJump(hit)}
                      className="w-full text-start px-4 py-2 hover:bg-[var(--bg-surface)] transition-colors"
                    >
                      <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                        <span className="font-semibold text-[var(--text-primary)] truncate">
                          {hit.author_full_name ??
                            hit.author_username ??
                            t("channel.unknown", "Unknown")}
                        </span>
                        <span className="text-[var(--text-dim)]">·</span>
                        <span className="tabular-nums text-[10.5px]">
                          {formatSearchTime(hit.created_at)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[12px] text-[var(--text-muted)] leading-relaxed break-words line-clamp-3">
                        {renderSnippet(hit.snippet)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelIcon({ kind }: { kind: DiscussChannelKind }) {
  if (kind === "direct")
    return <User className="h-3 w-3 text-[var(--text-dim)]" />;
  if (kind === "customer")
    return <MessageSquare className="h-3 w-3 text-[var(--text-dim)]" />;
  return <Hash className="h-3 w-3 text-[var(--text-dim)]" />;
}

/** Turn a snippet string with <mark>…</mark> tags into a safe React tree
 *  with highlighted spans. We never use dangerouslySetInnerHTML — the
 *  data layer gave us known markers, so we just split on them. */
function renderSnippet(snippet: string): React.ReactNode {
  if (!snippet) return null;
  const parts = snippet.split(/<mark>|<\/mark>/g);
  return parts.map((p, i) => {
    /* Odd indices are the highlighted matches since the string
       alternates: [plain, mark, plain, mark, …]. */
    if (i % 2 === 1) {
      return (
        <mark
          key={i}
          className="bg-yellow-400/20 text-yellow-200 px-0.5 rounded-sm not-italic"
        >
          {p}
        </mark>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function formatSearchTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) {
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
