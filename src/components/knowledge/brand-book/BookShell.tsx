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

   Parts open and close; the part that holds the current chapter starts
   open, and so does every part that has a ready chapter, so what can be read
   is visible without a click.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import MenuBurgerIcon from "@/components/icons/ui/MenuBurgerIcon";
import KoleexLogo from "@/components/layout/KoleexLogo";
import { BOOK_BASE, BOOK_CHAPTERS, BOOK_PARTS, BOOK_VERSION, chapterHref, pad, READY_CHAPTERS } from "@/lib/brand-book/chapters";
import { fill } from "@/lib/brand-book/ui";
import { useBookLang } from "./kit";

function Contents({ current, onPick }: { current?: number; onPick?: () => void }) {
  const { lang, ui } = useBookLang();
  const [open, setOpen] = useState<Set<number>>(() => {
    const s = new Set<number>();
    for (const p of BOOK_PARTS) {
      if (BOOK_CHAPTERS.some((c) => c.part === p.n && (c.ready || c.n === current))) s.add(p.n);
    }
    return s;
  });

  return (
    <nav aria-label={ui.contents} className="space-y-1">
      {BOOK_PARTS.map((p) => {
        const chapters = BOOK_CHAPTERS.filter((c) => c.part === p.n);
        const ready = chapters.filter((c) => c.ready).length;
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
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start transition-colors hover:bg-[var(--bg-surface-hover)]"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--bg-inverted)] text-[10px] font-bold text-[var(--text-inverted)] tabular-nums">{p.n}</span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--text-primary)]">{p.title[lang]}</span>
              <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--text-dim)]">{ready}/{chapters.length}</span>
              <AngleDownIcon size={10} className={`shrink-0 text-[var(--text-dim)] transition-transform ${isOpen ? "" : "-rotate-90 rtl:rotate-90"}`} />
            </button>
            {isOpen && (
              <ul className="mb-2 ms-3 border-s border-[var(--border-faint)] ps-2">
                {chapters.map((c) => {
                  const active = c.n === current;
                  const row = (
                    <>
                      <span className="w-6 shrink-0 text-[10.5px] tabular-nums text-[var(--text-dim)]">{pad(c.n)}</span>
                      <span className="min-w-0 flex-1 leading-snug">{c.title[lang]}</span>
                      {!c.ready && <span className="shrink-0 text-[10px] text-[var(--text-ghost)]">{ui.soon}</span>}
                    </>
                  );
                  return (
                    <li key={c.n}>
                      {c.ready ? (
                        <Link
                          href={chapterHref(c.slug)}
                          onClick={onPick}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-[12.5px] transition-colors ${
                            active
                              ? "bg-[var(--bg-surface)] font-semibold text-[var(--text-primary)] shadow-[inset_2px_0_0_#567FB2] rtl:shadow-[inset_-2px_0_0_#567FB2]"
                              : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {row}
                        </Link>
                      ) : (
                        <span className="flex items-start gap-2 px-2 py-1.5 text-[12.5px] text-[var(--text-ghost)]">{row}</span>
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
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href={current ? BOOK_BASE : "/knowledge"}
          className="kx-glass kx-hover-glow flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
          aria-label={current ? ui.backToBook : ui.backToKnowledge}
        >
          <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" />
        </Link>
        <Link href={BOOK_BASE} className="flex min-w-0 items-center gap-2.5">
          <span className="text-[var(--text-primary)]" style={{ width: 92 }}>
            <KoleexLogo className="block h-auto w-full" />
          </span>
          <span className="h-4 w-px bg-[var(--border-subtle)]" aria-hidden />
          <span className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{ui.bookTitle}</span>
        </Link>
        <span className="ms-auto hidden sm:inline text-[11.5px] text-[var(--text-dim)] tabular-nums">
          {fill(ui.version, { v: BOOK_VERSION.label, date: BOOK_VERSION.date })} · {fill(ui.readyCount, { ready: READY_CHAPTERS.length, total: BOOK_CHAPTERS.length })}
        </span>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          className="lg:hidden ms-auto sm:ms-0 inline-flex h-8 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-[12.5px] font-medium text-[var(--text-primary)]"
        >
          <MenuBurgerIcon size={13} />
          {mobileOpen ? ui.hideContents : ui.contents}
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden mb-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2">
          <Contents current={current} onPick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex gap-8 xl:gap-10">
        <aside className="hidden lg:block w-[272px] shrink-0" data-kx-pane>
          <div className="sticky top-4 max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain pe-1">
            <Contents current={current} />
          </div>
        </aside>
        {/* Not <main>: the Hub shell already has one, and a page gets one. */}
        <div className="min-w-0 flex-1" data-kx-pane>{children}</div>
      </div>
    </div>
  );
}
