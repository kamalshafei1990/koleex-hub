"use client";

/* ---------------------------------------------------------------------------
   BookShell — the frame around every page of the brand book: the header
   line (back, title, version) and the contents.

   The contents list ALL 140 chapters (the owner wants the whole book in
   view), grouped by part. A ready chapter is a link; a chapter that is not
   written yet is plain text with "Soon" — never a link to an empty page.

   Desktop: the contents sit in a sticky column at the start side.
   Phone/tablet: they fold into a panel under the header, opened by a
   "Contents" button — inline, not a popup, so nothing has to trap focus or
   portal out of a glass container.

   Parts open and close; only the part that holds the current chapter
   starts open (the first part on the cover), so the list stays short.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import MenuBurgerIcon from "@/components/icons/ui/MenuBurgerIcon";
import KoleexLogo from "@/components/layout/KoleexLogo";
import { BOOK_CHAPTERS, BOOK_PARTS, BOOK_VERSION, chapterHref, pad } from "@/lib/brand-book/chapters";
import { fill } from "@/lib/brand-book/ui";
import { BOOK_THEME, useBookBase, useBookLang } from "./kit";

function Contents({ current, onPick }: { current?: number; onPick?: () => void }) {
  const { lang, ui } = useBookLang();
  const base = useBookBase();
  const [open, setOpen] = useState<Set<number>>(() => {
    const s = new Set<number>();
    for (const p of BOOK_PARTS) {
      if (BOOK_CHAPTERS.some((c) => c.part === p.n && c.n === current)) s.add(p.n);
    }
    if (s.size === 0) s.add(1);
    return s;
  });

  return (
    <nav aria-label={ui.contents} className="space-y-0.5">
      {BOOK_PARTS.map((p) => {
        const chapters = BOOK_CHAPTERS.filter((c) => c.part === p.n);
        const isOpen = open.has(p.n);
        return (
          <div key={p.n}>
            <button
              type="button"
              data-kx-keep-hover
              onClick={() => setOpen((prev) => {
                const s = new Set(prev);
                if (s.has(p.n)) s.delete(p.n); else s.add(p.n);
                return s;
              })}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start transition-colors hover:bg-[var(--bg-secondary)]"
            >
              <span className="w-5 shrink-0 text-[12px] font-semibold tabular-nums text-[var(--text-dim)]">{p.n}</span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[var(--text-primary)]">{p.title[lang]}</span>
              <AngleDownIcon size={10} className={`shrink-0 text-[var(--text-dim)] transition-transform ${isOpen ? "" : "-rotate-90 rtl:rotate-90"}`} />
            </button>
            {isOpen && (
              <ul className="mb-2 mt-0.5 space-y-px">
                {chapters.map((c) => {
                  const active = c.n === current;
                  const row = (
                    <>
                      <span className="w-6 shrink-0 text-[11px] tabular-nums text-[var(--text-dim)]">{pad(c.n)}</span>
                      <span className="min-w-0 flex-1 leading-snug">{c.title[lang]}</span>
                      {!c.ready && <span className="shrink-0 text-[10.5px] text-[var(--text-ghost)]">{ui.soon}</span>}
                    </>
                  );
                  return (
                    <li key={c.n}>
                      {c.ready ? (
                        <Link
                          href={chapterHref(c.slug, base)}
                          onClick={onPick}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-start gap-2 rounded-xl py-1.5 pe-3 ps-8 text-[13px] transition-colors ${
                            active
                              ? "bg-[var(--bg-secondary)] font-semibold text-[var(--text-primary)]"
                              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {row}
                        </Link>
                      ) : (
                        <span className="flex items-start gap-2 py-1.5 pe-3 ps-8 text-[13px] text-[var(--text-ghost)]">{row}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default function BookShell({ current, children }: { current?: number; children: ReactNode }) {
  const { ui } = useBookLang();
  const base = useBookBase();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    /* The book paints its own page (BOOK_THEME): solid white or black, so
       the Hub's ground and glass never show through the brand guidelines. */
    <div className={`relative min-h-[100dvh] w-full ${BOOK_THEME}`}>
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 lg:px-10 py-5 md:py-7">
        <div className="mb-8 md:mb-12 flex flex-wrap items-center gap-3">
          <Link
            href={current ? base : "/knowledge"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
            aria-label={current ? ui.backToBook : ui.backToKnowledge}
          >
            <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" />
          </Link>
          <Link href={base} className="flex min-w-0 items-center gap-3">
            <span className="text-[var(--text-primary)]" style={{ width: 88 }}>
              <KoleexLogo className="block h-auto w-full" />
            </span>
            <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">{ui.bookTitle}</span>
          </Link>
          <span className="ms-auto hidden sm:inline text-[12px] text-[var(--text-dim)] tabular-nums">
            {fill(ui.version, { v: BOOK_VERSION.label, date: BOOK_VERSION.date })}
          </span>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            className="lg:hidden ms-auto sm:ms-0 inline-flex h-9 items-center gap-2 rounded-full bg-[var(--bg-secondary)] px-4 text-[13px] font-medium text-[var(--text-primary)]"
          >
            <MenuBurgerIcon size={13} />
            {mobileOpen ? ui.hideContents : ui.contents}
          </button>
        </div>

        {mobileOpen && (
          <div className="lg:hidden mb-8 rounded-[24px] bg-[var(--bg-secondary)] p-2 [--bg-secondary:var(--bg-surface-hover)]">
            <Contents current={current} onPick={() => setMobileOpen(false)} />
          </div>
        )}

        <div className="flex gap-10 xl:gap-14">
          <aside className="hidden lg:block w-[264px] shrink-0" data-kx-pane>
            <div className="sticky top-4 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain pe-1">
              <Contents current={current} />
            </div>
          </aside>
          {/* Not <main>: the Hub shell already has one, and a page gets one. */}
          <div className="min-w-0 flex-1 pb-16" data-kx-pane>{children}</div>
        </div>
      </div>
    </div>
  );
}
