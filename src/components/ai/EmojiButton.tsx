"use client";

/* ---------------------------------------------------------------------------
   EmojiButton — iOS-style emoji picker.

   Replaces the previous 48-emoji curated grid with a comprehensive
   picker matching the iOS / macOS Emoji popover:

     · 8 category tabs along the bottom (Smileys, Animals, Food,
       Activity, Travel, Objects, Symbols, Flags).
     · Search bar at the top — filters across ALL emojis by keyword.
     · ~700 emojis total. Hand-curated rather than the full Unicode
       set because we want to ship calm, common ones without a
       2-megabyte font payload.
     · Categories scroll vertically; tapping a tab jumps to that
       category's anchor.
     · Selection keeps the popover open so users can insert several
       in a row.

   Behaviour preserved from the v1 picker:
     · Portal into document.body to escape the composer's stacking
       context.
     · Outside-click + Escape close it; focus returns to the trigger.
     · Position computed from the trigger's bounding rect on layout.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SmileIcon from "@/components/icons/ui/SmileIcon";
import { EMOJI_CATEGORIES, ALL_EMOJIS, type EmojiEntry } from "@/components/ai/emojiData";
import { COPY } from "@/components/ai/copy";
import { type Lang } from "@/lib/i18n";

interface Props {
  onSelect: (emoji: string) => void;
  label?: string;
  className?: string;
  /* OPTIONAL, DEFAULTING TO ENGLISH, because this component was written
     without a language at all and every caller would otherwise have to be
     changed at once. The default is what it already did; passing one is
     what makes it stop being an English island in an Arabic interface. */
  lang?: Lang;
}

const POPOVER_W = 340;
const POPOVER_H = 420;

export default function EmojiButton({
  onSelect,
  label,
  className,
  lang = "en",
}: Props): React.ReactElement {
  const copy = COPY[lang] ?? COPY.en;
  const triggerLabel = label ?? copy.emojiPicker;
  /* The data file's own English label is the FALLBACK, not the source: a
     category added there without a translation still renders, in English,
     instead of rendering blank. */
  const catName = useCallback(
    (id: string, fallback: string) => copy.emojiCategories[id] ?? fallback,
    [copy],
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>(EMOJI_CATEGORIES[0].id);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const searchRef = useRef<HTMLInputElement | null>(null);

  /* Search filter — case-insensitive keyword OR character match,
     applied across all categories so the user can type "fire" or
     "🇪🇬" and find it without picking a tab first. */
  const searched: EmojiEntry[] | null = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return ALL_EMOJIS.filter((e) =>
      e.k.toLowerCase().includes(q) || e.c.includes(q),
    ).slice(0, 200);
  }, [query]);

  /* Closing resets search + tab so the next open starts fresh; done in
     the close handlers (not an effect) so no setState runs inside an
     effect body. */
  const closePopover = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveCat(EMOJI_CATEGORIES[0].id);
  }, []);

  /* Outside-click + Escape — same pattern as v1, both must close. */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current && wrapperRef.current.contains(target)) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      closePopover();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, closePopover]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closePopover();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, closePopover]);

  /* When the popover opens, auto-focus the search input — matches
     iOS where the keyboard pops up ready to type. */
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
    }
  }, [open]);

  const handlePick = useCallback(
    (emoji: string) => {
      onSelect(emoji);
      /* Keep popover open so multi-emoji insertion works. */
    },
    [onSelect],
  );

  /* Scroll-to-category when a tab is clicked. The section anchors
     live in the scrollable grid below; jumping is instant (no
     smooth) so the picker feels snappy. */
  const jumpToCategory = useCallback((id: string) => {
    setActiveCat(id);
    setQuery("");
    const target = sectionRefs.current[id];
    if (target && scrollRef.current) {
      scrollRef.current.scrollTop = target.offsetTop;
    }
  }, []);

  /* Track which category is in view as the user scrolls, so the
     tab strip highlights the current section. */
  useEffect(() => {
    if (!open) return;
    const sc = scrollRef.current;
    if (!sc) return;
    const onScroll = () => {
      if (query) return;
      const top = sc.scrollTop;
      let current = EMOJI_CATEGORIES[0].id;
      for (const cat of EMOJI_CATEGORIES) {
        const el = sectionRefs.current[cat.id];
        if (el && el.offsetTop <= top + 12) current = cat.id;
      }
      setActiveCat(current);
    };
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => sc.removeEventListener("scroll", onScroll);
  }, [open, query]);

  /* Position the portal-rendered popover above the trigger. */
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (triggerRef.current) setAnchorRect(triggerRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const popoverStyle: React.CSSProperties | null = anchorRect
    ? {
        position: "fixed" as const,
        bottom: typeof window !== "undefined"
          ? window.innerHeight - anchorRect.top + 8
          : 0,
        left: typeof window !== "undefined"
          ? Math.min(
              Math.max(8, anchorRect.left),
              window.innerWidth - POPOVER_W - 8,
            )
          : anchorRect.left,
        width: POPOVER_W,
        height: POPOVER_H,
        zIndex: 9999,
      }
    : null;

  const popoverNode =
    open && popoverStyle && typeof document !== "undefined" ? (
      <div
        ref={popoverRef}
        role="dialog"
        aria-label={copy.emojiPicker}
        style={{ ...popoverStyle, backgroundColor: "var(--bg-primary)" }}
        className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] shadow-2xl"
      >
        {/* Search */}
        <div className="p-2 border-b border-[var(--border-subtle)]">
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.searchEmoji}
            aria-label={copy.searchEmoji}
            className="w-full h-8 px-2.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
            /* 16px font on iOS prevents the zoom-on-focus, but the
               picker lives over a fixed-position panel and 12.5 here
               is consistent with the rest of the Hub composer. */
          />
        </div>

        {/* Scrollable emoji grid */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-1.5 py-1.5">
          {searched ? (
            searched.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-[var(--text-dim)]">
                No emoji match &ldquo;{query}&rdquo;
              </div>
            ) : (
              <div className="grid grid-cols-8 gap-0.5">
                {searched.map((e, i) => (
                  <EmojiCell key={`search-${i}-${e.c}`} entry={e} onPick={handlePick} insertLabel={copy.insertEmoji} />
                ))}
              </div>
            )
          ) : (
            EMOJI_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                ref={(el) => {
                  sectionRefs.current[cat.id] = el;
                }}
                className="pb-2"
              >
                <div className="px-1 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                  {catName(cat.id, cat.label)}
                </div>
                <div className="grid grid-cols-8 gap-0.5">
                  {cat.emojis.map((e, i) => (
                    <EmojiCell key={`${cat.id}-${i}-${e.c}`} entry={e} onPick={handlePick} insertLabel={copy.insertEmoji} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Category tab strip — iOS pattern. */}
        <div className="flex items-center justify-around border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-1 py-1">
          {EMOJI_CATEGORIES.map((cat) => {
            const isActive = !query && activeCat === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => jumpToCategory(cat.id)}
                aria-label={catName(cat.id, cat.label)}
                title={catName(cat.id, cat.label)}
                className={`h-7 w-7 flex items-center justify-center rounded-md text-[16px] transition-colors ${
                  isActive
                    ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    : "text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                }`}
              >
                <span aria-hidden>{cat.icon}</span>
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => (open ? closePopover() : setOpen(true))}
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={
          className ??
          "h-10 w-10 rounded-full flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
        }
      >
        <SmileIcon size={16} className="text-current" />
      </button>
      {popoverNode && typeof document !== "undefined"
        ? createPortal(popoverNode, document.body)
        : null}
    </div>
  );
}

/* ── Single emoji cell ─────────────────────────────────────────────── */

function EmojiCell({
  entry, onPick, insertLabel,
}: {
  entry: EmojiEntry;
  onPick: (emoji: string) => void;
  /* The verb only — the emoji itself follows it, and an emoji needs no
     translating. Passed in rather than resolved here so this cell stays the
     cheap leaf it is: it renders once per emoji, and there are thousands. */
  insertLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(entry.c)}
      className="aspect-square rounded-md flex items-center justify-center text-[22px] hover:bg-[var(--bg-surface-subtle)] active:bg-[var(--bg-surface)] transition-colors"
      aria-label={`${insertLabel} ${entry.c}`}
      title={entry.k.split(" ").slice(0, 3).join(" ")}
    >
      <span aria-hidden>{entry.c}</span>
    </button>
  );
}
