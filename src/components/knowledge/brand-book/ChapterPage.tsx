"use client";

/* ---------------------------------------------------------------------------
   One chapter of the brand book (the client half of
   /knowledge/brand-guidelines/[slug]; the route file prerenders every slug).

   A chapter that is listed but not written yet (or a slug that does not
   exist) gets a plain "not written yet" page with the way back — the
   contents never link to it, but a typed or old URL can still arrive here.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import BookShell from "./BookShell";
import { useBookBase, useBookLang } from "./kit";
import { CHAPTER_VIEWS } from "./registry";
import { chapterBySlug } from "@/lib/brand-book/chapters";

function NotReady() {
  const { ui } = useBookLang();
  const base = useBookBase();
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-8 max-w-[640px]">
      <h1 className="text-[22px] font-bold text-[var(--text-primary)]">{ui.notFoundTitle}</h1>
      <p className="mt-2 text-[14px] leading-6 text-[var(--text-secondary)]">{ui.notFoundBody}</p>
      <Link href={base} className="mt-5 inline-flex h-10 items-center rounded-xl bg-[var(--bg-inverted)] px-4 text-[13.5px] font-semibold text-[var(--text-inverted)]">
        {ui.allChapters}
      </Link>
    </div>
  );
}

export default function ChapterPage({ slug }: { slug: string }) {
  const chapter = chapterBySlug(slug);
  const View = chapter?.ready ? CHAPTER_VIEWS[slug] : undefined;

  return (
    <BookShell current={chapter?.n}>
      {View ? <View /> : <NotReady />}
    </BookShell>
  );
}
