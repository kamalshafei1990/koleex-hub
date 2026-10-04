"use client";

/* ---------------------------------------------------------------------------
   ComposerAddMenu — the one "+" at the start of the message box.

   UI/UX pass, 2026-09-24 (owner: "clean and clear and easy"). The row under
   the text used to carry three small round buttons — attach, emoji, web
   search — before the model name and the call. On a phone that is seven
   targets in one line, and two of them (the emoji face and the globe) were
   guessed at more than read. Now there is one "+", and behind it the two
   things it can add: files and photos, and a search of the web. The phone's
   own keyboard already has emoji; the picker went.

   WEB SEARCH STAYS VISIBLE WHEN IT IS ON. A mode hidden inside a menu is a
   mode people forget they turned on, so while it is on a small "Search" chip
   sits beside the "+", and tapping its × turns it off again.

   Built like ModelPicker: portalled, fixed against the message box, opens
   UPWARD, arrow keys / Escape / Tab close it and give focus back.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import PaperclipIcon from "@/components/icons/ui/PaperclipIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import type { Lang } from "@/lib/i18n";

export interface ComposerAddMenuCopy {
  addMenu: string;
  attachFilesPhotos: string;
  searchWeb: string;
  webSearchChip: string;
  webSearchChipOff: string;
}

const W = 240;
const GAP = 6;
const EDGE = 8;

export default function ComposerAddMenu({
  onAttach,
  webSearch,
  onWebSearchChange,
  lang,
  copy,
}: {
  /** Opens the file picker. Called inside the tap, so iOS allows it. */
  onAttach: () => void;
  webSearch: boolean;
  onWebSearchChange: (on: boolean) => void;
  lang: Lang;
  copy: ComposerAddMenuCopy;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus({ preventScroll: true });
  }, []);

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    /* Rise above the whole message box so the list never covers the text. */
    const top = (el.closest("form") ?? el).getBoundingClientRect().top;
    const rtl = getComputedStyle(el).direction === "rtl";
    /* Hang from the button's leading edge: its left in English and Chinese,
       its right in Arabic — then keep the panel on the screen. */
    const wanted = rtl ? r.right - W : r.left;
    const left = Math.min(Math.max(EDGE, wanted), window.innerWidth - W - EDGE);
    setPos({ bottom: window.innerHeight - top + GAP, left: Math.max(EDGE, left) });
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus({ preventScroll: true });
    });
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); closeMenu(); } };
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, closeMenu]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => { e.preventDefault(); items[(n + items.length) % items.length].focus(); };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Tab") { e.preventDefault(); closeMenu(); }
  };

  const item =
    "w-full min-h-11 flex items-center gap-3 px-4 py-2.5 text-start text-[14px] text-[var(--text-primary)] transition-colors focus:outline-none hover:bg-[var(--bg-surface-subtle)] focus-visible:bg-[var(--bg-surface-subtle)]";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (!open) place();
          setOpen((v) => !v);
        }}
        className={`h-10 w-10 rounded-full inline-flex items-center justify-center shrink-0 transition-colors ${
          open
            ? "text-[var(--text-primary)] bg-[var(--bg-surface-subtle)]"
            : "text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={copy.addMenu}
        title={copy.addMenu}
      >
        <span aria-hidden className="inline-flex"><PlusIcon size={16} /></span>
      </button>

      {webSearch && (
        <button
          type="button"
          onClick={() => onWebSearchChange(false)}
          className="h-8 ps-2.5 pe-2 rounded-full inline-flex items-center gap-1.5 shrink-0 text-[13px] font-medium bg-[var(--kx-ai-accent-soft)] text-[var(--kx-ai-accent)] ring-1 ring-[var(--kx-ai-accent-line)] transition-colors"
          aria-label={copy.webSearchChipOff}
          title={copy.webSearchChipOff}
        >
          <span aria-hidden className="inline-flex"><GlobeIcon size={13} /></span>
          <span>{copy.webSearchChip}</span>
          <span aria-hidden className="inline-flex opacity-70"><CrossIcon size={9} /></span>
        </button>
      )}

      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            role="menu"
            aria-label={copy.addMenu}
            onKeyDown={onMenuKey}
            dir={lang === "ar" ? "rtl" : "ltr"}
            className="kx-pop-panel kx-ai-tokens fixed z-[61] py-1.5"
            style={{ bottom: pos.bottom, left: pos.left, width: W }}
          >
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                /* The picker opens inside this tap — iOS refuses a file
                   dialog that is not part of a user gesture. */
                onAttach();
                setOpen(false);
              }}
              className={item}
            >
              <span aria-hidden className="inline-flex text-[var(--text-dim)]"><PaperclipIcon size={16} /></span>
              <span className="flex-1 min-w-0">{copy.attachFilesPhotos}</span>
            </button>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={webSearch}
              tabIndex={-1}
              onClick={() => {
                onWebSearchChange(!webSearch);
                closeMenu();
              }}
              className={item}
            >
              <span aria-hidden className={`inline-flex ${webSearch ? "text-[var(--kx-ai-accent)]" : "text-[var(--text-dim)]"}`}><GlobeIcon size={16} /></span>
              <span className="flex-1 min-w-0">{copy.searchWeb}</span>
              <span className="h-5 w-5 shrink-0 inline-flex items-center justify-center text-[var(--text-primary)]">
                {webSearch && <span aria-hidden className="inline-flex"><CheckIcon size={16} /></span>}
              </span>
            </button>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
