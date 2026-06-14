"use client";

import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* Monochrome placeholder shown for the brief moment the lazily-loaded
   QuotationA4Preview chunk (~9k LOC + embedded port-geo tables) is
   downloading on first open of the quotation / invoice editor. Neutral
   grays only — no color — per the KOLEEX monochrome brand guideline.
   Once the chunk loads it is replaced by the real editor surface with
   identical props and behavior. Print/PDF routes never use this — they
   import QuotationA4Preview eagerly so export output is unaffected. */
export default function QuotationPreviewSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex min-h-[60vh] w-full max-w-[820px] flex-col items-center justify-center gap-3 rounded-lg border border-white/[0.06] bg-[#141414] text-gray-500"
    >
      <SpinnerIcon className="h-6 w-6 animate-spin" />
      <span className="text-xs uppercase tracking-wider">Loading document…</span>
    </div>
  );
}
