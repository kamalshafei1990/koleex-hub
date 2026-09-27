"use client";

/* ---------------------------------------------------------------------------
   The brand book's front page — Apple style (owner, 27/09/2026): one black
   hero with the white logo and a silver headline, the ten parts as big
   tiles, then the whole book as a quiet index.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import KoleexLogo from "@/components/layout/KoleexLogo";
import { BOOK_CHAPTERS, BOOK_PARTS, BOOK_VERSION, chapterHref, pad, READY_CHAPTERS } from "@/lib/brand-book/chapters";
import { SILVER } from "@/lib/brand-book/tokens";
import { fill } from "@/lib/brand-book/ui";
import { useBookBase, useBookLang } from "./kit";

export default function BookCover() {
  const { lang, ui } = useBookLang();
  const base = useBookBase();
  const first = READY_CHAPTERS[0];
  const downloads = BOOK_CHAPTERS.find((c) => c.slug === "downloads");

  return (
    <div className="space-y-16 md:space-y-24">
      <section className="rounded-[32px] bg-black px-6 py-16 text-center md:px-12 md:py-24" style={{ color: "#F5F5F7" }}>
        <span className="mx-auto block text-white" style={{ width: "min(240px, 60%)" }}>
          <KoleexLogo className="block h-auto w-full" />
        </span>
        <h1
          className="mx-auto mt-10 max-w-[14ch] text-[48px] md:text-[80px] font-semibold leading-[1.02] tracking-[-0.035em] [text-wrap:balance]"
          style={{ backgroundImage: SILVER.cssText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
        >
          One brand. Everywhere.
        </h1>
        <p className="mx-auto mt-6 max-w-[46ch] text-[17px] md:text-[21px] leading-[1.45] text-[#A1A1A6]">{ui.bookSubtitle}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {first && (
            <Link href={chapterHref(first.slug, base)} className="inline-flex h-11 items-center rounded-full px-6 text-[15px] font-medium text-white transition-opacity hover:opacity-90" style={{ background: "#567FB2" }}>
              {ui.startReading}
            </Link>
          )}
          {downloads && (
            <Link href={chapterHref(downloads.slug, base)} className="text-[15px] font-medium text-[#7FA9D6] hover:underline underline-offset-4">
              {downloads.title[lang]} ›
            </Link>
          )}
        </div>
        <p className="mt-10 text-[12px] tabular-nums text-[#6E6E73]">
          {fill(ui.version, { v: BOOK_VERSION.label, date: BOOK_VERSION.date })} · {BOOK_CHAPTERS.length} chapters
        </p>
      </section>

      <section>
        <h2 className="text-[30px] md:text-[40px] font-semibold tracking-[-0.025em] text-[var(--text-primary)]">Ten parts.</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {BOOK_PARTS.map((p) => {
            const chapters = BOOK_CHAPTERS.filter((c) => c.part === p.n);
            const start = chapters.find((c) => c.ready);
            const tile = (
              <>
                <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--text-ghost)]">{p.n}</span>
                <span className="mt-6 block text-[22px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{p.title[lang]}</span>
                <span className="mt-2 block text-[15px] leading-[1.45] text-[var(--text-dim)]">{p.blurb}</span>
                <span className="mt-5 block text-[14px] font-medium text-[var(--bk-link)]">{chapters.length} chapters ›</span>
              </>
            );
            return start ? (
              <Link key={p.n} href={chapterHref(start.slug, base)} className="block rounded-[28px] bg-[var(--bg-secondary)] p-7 transition-colors hover:bg-[var(--bg-surface-hover)]">{tile}</Link>
            ) : (
              <div key={p.n} className="rounded-[28px] bg-[var(--bg-secondary)] p-7">{tile}</div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-[30px] md:text-[40px] font-semibold tracking-[-0.025em] text-[var(--text-primary)]">Every chapter.</h2>
        <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {BOOK_PARTS.map((p) => (
            <div key={p.n}>
              <p className="text-[13px] font-semibold text-[var(--text-dim)]">{fill(ui.part, { n: p.n })} · {p.title[lang]}</p>
              <ul className="mt-3 space-y-1.5">
                {BOOK_CHAPTERS.filter((c) => c.part === p.n).map((c) => (
                  <li key={c.n} className="flex gap-2 text-[14px] leading-snug">
                    <span className="w-6 shrink-0 tabular-nums text-[var(--text-ghost)]">{pad(c.n)}</span>
                    {c.ready ? (
                      <Link href={chapterHref(c.slug, base)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{c.title[lang]}</Link>
                    ) : (
                      <span className="text-[var(--text-ghost)]">{c.title[lang]} · {ui.soon}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
