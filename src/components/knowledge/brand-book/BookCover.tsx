"use client";

/* ---------------------------------------------------------------------------
   The brand book's front page: the title, where to start, and the whole
   book as a map — every part, every chapter, the ready ones linked.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";
import KoleexLogo from "@/components/layout/KoleexLogo";
import { BOOK_CHAPTERS, BOOK_PARTS, BOOK_VERSION, chapterHref, pad, READY_CHAPTERS } from "@/lib/brand-book/chapters";
import { fill } from "@/lib/brand-book/ui";
import { useBookBase, useBookLang } from "./kit";

export default function BookCover() {
  const { lang, ui } = useBookLang();
  const base = useBookBase();
  const first = READY_CHAPTERS[0];

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-6 py-10 md:px-10 md:py-14">
        <div className="max-w-[640px]">
          <span className="block text-[var(--text-primary)]" style={{ width: "min(360px, 70%)" }}>
            <KoleexLogo className="block h-auto w-full" />
          </span>
          <h1 className="mt-6 text-[34px] md:text-[44px] font-bold leading-tight tracking-tight text-[var(--text-primary)]">{ui.bookTitle}</h1>
          <p className="mt-3 max-w-[56ch] text-[15px] leading-7 text-[var(--text-secondary)]">{ui.bookSubtitle}</p>
          <p className="mt-4 text-[12px] tabular-nums text-[var(--text-dim)]">
            {fill(ui.version, { v: BOOK_VERSION.label, date: BOOK_VERSION.date })} · {fill(ui.readyCount, { ready: READY_CHAPTERS.length, total: BOOK_CHAPTERS.length })}
          </p>
          {first && (
            <Link
              href={chapterHref(first.slug, base)}
              className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--bg-inverted)] px-5 text-[14px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90"
            >
              {ui.startReading}
              <ArrowRightIcon size={14} className="rtl:rotate-180" />
            </Link>
          )}
        </div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: "linear-gradient(90deg,#567FB2,#BCD8F0)" }} />
      </section>

      {BOOK_PARTS.map((p) => {
        const chapters = BOOK_CHAPTERS.filter((c) => c.part === p.n);
        return (
          <section key={p.n}>
            <div className="mb-3 flex items-baseline gap-3">
              <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">{fill(ui.part, { n: p.n })}</span>
              <h2 className="text-[18px] font-bold text-[var(--text-primary)]">{p.title[lang]}</h2>
              <span className="ms-auto text-[11.5px] tabular-nums text-[var(--text-dim)]">{chapters.filter((c) => c.ready).length}/{chapters.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {chapters.map((c) => {
                const body = (
                  <>
                    <span className="w-7 shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: c.ready ? "#567FB2" : undefined }}>{pad(c.n)}</span>
                    <span className="min-w-0 flex-1 text-[13px] leading-snug">{c.title[lang]}</span>
                    {!c.ready && <span className="shrink-0 text-[10.5px] text-[var(--text-ghost)]">{ui.soon}</span>}
                  </>
                );
                return c.ready ? (
                  <Link
                    key={c.n}
                    href={chapterHref(c.slug, base)}
                    className="flex items-start gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3.5 py-3 font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-focus)]"
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={c.n} className="flex items-start gap-2 rounded-xl border border-dashed border-[var(--border-faint)] px-3.5 py-3 text-[var(--text-dim)]">
                    {body}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
