"use client";

/* ---------------------------------------------------------------------------
   SuggestionMenu — the floating list behind "/" (insert block) and "[["
   (link a note). The TipTap Suggestion plugin drives it through a
   MenuBridge (editor-extensions.ts); this file owns the bridge + the view.

   Accessibility: the menu is a listbox; the active option is announced via
   aria-activedescendant on the listbox (focus stays in the editor, like
   every rich-text autocomplete). Arrow keys move, Enter/Tab choose,
   Escape closes (handled by the plugin). Pointer: hover highlights, click
   chooses (mousedown is prevented so the editor keeps its selection).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import type { MenuBridge, MenuItem, MenuKind } from "./editor-extensions";

interface MenuState {
  kind: MenuKind;
  items: MenuItem[];
  index: number;
  rect: { top: number; bottom: number; left: number } | null;
  query: string;
  command: (item: MenuItem) => void;
}

export function useMenuBridge(): { bridge: MenuBridge; menu: MenuState | null; choose: (i: number) => void; hover: (i: number) => void } {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<MenuState | null>(null);
  const set = useCallback((m: MenuState | null) => { menuRef.current = m; setMenu(m); }, []);

  const bridge = useMemo<MenuBridge>(() => ({
    open: (kind: MenuKind, props: SuggestionProps<MenuItem, MenuItem>) => {
      const r = props.clientRect?.() ?? null;
      const prev = menuRef.current;
      const sameList = prev && prev.kind === kind && prev.query === props.query;
      set({
        kind,
        items: props.items,
        index: sameList ? Math.min(prev.index, Math.max(0, props.items.length - 1)) : 0,
        rect: r ? { top: r.top, bottom: r.bottom, left: r.left } : null,
        query: props.query,
        command: (item) => props.command(item),
      });
    },
    keyDown: (kind: MenuKind, { event }: SuggestionKeyDownProps) => {
      const m = menuRef.current;
      if (!m || m.kind !== kind) return false;
      if (event.key === "Escape") { set(null); return true; }
      if (!m.items.length) return false;
      if (event.key === "ArrowDown") { set({ ...m, index: (m.index + 1) % m.items.length }); return true; }
      if (event.key === "ArrowUp") { set({ ...m, index: (m.index - 1 + m.items.length) % m.items.length }); return true; }
      if (event.key === "Enter" || event.key === "Tab") {
        const item = m.items[m.index];
        if (item) m.command(item);
        return true;
      }
      return false;
    },
    close: (kind: MenuKind) => {
      if (menuRef.current?.kind === kind) set(null);
    },
  }), [set]);

  const choose = useCallback((i: number) => {
    const m = menuRef.current;
    const item = m?.items[i];
    if (m && item) m.command(item);
  }, []);
  const hover = useCallback((i: number) => {
    const m = menuRef.current;
    if (m && m.index !== i) set({ ...m, index: i });
  }, [set]);

  return { bridge, menu, choose, hover };
}

export default function SuggestionMenu({
  menu,
  title,
  emptyLabel,
  onChoose,
  onHover,
  renderIcon,
}: {
  menu: ReturnType<typeof useMenuBridge>["menu"];
  title: string;
  emptyLabel: string;
  onChoose: (i: number) => void;
  onHover: (i: number) => void;
  renderIcon?: (item: MenuItem) => ReactNode;
}) {
  const listId = useId();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [vh, setVh] = useState(0);
  useEffect(() => {
    const read = () => setVh(window.visualViewport?.height ?? window.innerHeight);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  // Keep the active option in view.
  const index = menu?.index ?? 0;
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!menu || !menu.rect) return null;
  const MAX_H = 300;
  const below = menu.rect.bottom + 6;
  const flip = vh > 0 && below + MAX_H > vh && menu.rect.top > MAX_H;
  const top = flip ? Math.max(8, menu.rect.top - 6 - MAX_H) : below;
  const left = Math.max(8, Math.min(menu.rect.left, (typeof window !== "undefined" ? window.innerWidth : 1024) - 288));

  return createPortal(
    <div
      style={{ position: "fixed", top, left, zIndex: 80 }}
      className="kx-glass-pop w-[280px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl overflow-hidden"
    >
      <div className="px-3 pt-2 pb-1 text-[9.5px] uppercase tracking-[1.2px] font-semibold text-[var(--text-dim)]">{title}</div>
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={title}
        aria-activedescendant={menu.items.length ? `${listId}-${menu.index}` : undefined}
        className="max-h-[260px] overflow-y-auto p-1"
      >
        {menu.items.length === 0 && (
          <div className="px-2.5 py-2 text-[12px] text-[var(--text-dim)]" role="status">{emptyLabel}</div>
        )}
        {menu.items.map((item, i) => (
          <div
            key={item.id}
            id={`${listId}-${i}`}
            data-index={i}
            role="option"
            aria-selected={i === menu.index}
            onMouseDown={(e) => { e.preventDefault(); onChoose(i); }}
            onMouseEnter={() => onHover(i)}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-[12.5px] ${
              i === menu.index ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
            }`}
          >
            {renderIcon && (
              <span className="h-7 w-7 shrink-0 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)]">
                {renderIcon(item)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span dir="auto" className="block truncate font-medium">{item.label}</span>
              {item.hint && <span dir="auto" className="block truncate text-[10.5px] text-[var(--text-dim)]">{item.hint}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
