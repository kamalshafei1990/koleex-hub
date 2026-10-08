"use client";

/* ---------------------------------------------------------------------------
   /knowledge/brand-guidelines — the KOLEEX Brand Guidelines, front page.

   READ-ONLY REFERENCE: no table, no API, no writes. Everything is compiled
   in from src/lib/brand-book and src/components/knowledge/brand-book, and
   the downloadable files are static assets under public/brand.

   Gated by the Knowledge layout like every Knowledge document. A public,
   no-sign-in link for people outside the company (owner, 27/09/2026) is a
   separate, later step.
   --------------------------------------------------------------------------- */

import BookShell from "@/components/knowledge/brand-book/BookShell";
import BookCover from "@/components/knowledge/brand-book/BookCover";

export default function BrandGuidelinesPage() {
  return (
    <BookShell>
      <BookCover />
    </BookShell>
  );
}
