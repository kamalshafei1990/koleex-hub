/* ---------------------------------------------------------------------------
   /knowledge/brand-guidelines/[slug] — one chapter of the brand book.

   A server file only so that every chapter is PRERENDERED at build time:
   the book is static reference material, and a static page is served from
   the CDN instead of costing a function round trip per chapter. The page
   itself is the client component ChapterPage.
   --------------------------------------------------------------------------- */

import ChapterPage from "@/components/knowledge/brand-book/ChapterPage";
import { BOOK_CHAPTERS } from "@/lib/brand-book/chapters";

export function generateStaticParams(): Array<{ slug: string }> {
  return BOOK_CHAPTERS.map((c) => ({ slug: c.slug }));
}

export default async function BrandGuidelinesChapterRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ChapterPage slug={slug} />;
}
