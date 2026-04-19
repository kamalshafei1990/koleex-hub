"use client";

/* ---------------------------------------------------------------------------
   AutoTranslate — inline wrapper that shows a string in the viewer's
   language, with a tiny 🌐 indicator + "show original" toggle.

     <AutoTranslate text={task.title} />
     <AutoTranslate text={task.notes} as="p" className="text-sm" />

   Falls back gracefully to the original on any failure — never breaks
   the layout.
   --------------------------------------------------------------------------- */

import { useState, type ElementType } from "react";
import { useAutoTranslate } from "@/lib/auto-translate";

export default function AutoTranslate({
  text,
  as,
  className,
  showBadge = true,
}: {
  text: string | null | undefined;
  as?: ElementType;
  className?: string;
  /** Show the tiny 🌐 badge when translation happened. Default true. */
  showBadge?: boolean;
}) {
  const Tag = (as ?? "span") as ElementType;
  const { display, wasTranslated, original, loading } = useAutoTranslate(text);
  const [showingOriginal, setShowingOriginal] = useState(false);
  if (!original) return null;

  const shown = showingOriginal ? original : display;
  return (
    <Tag className={className}>
      <span>{shown}</span>
      {wasTranslated && showBadge && !loading && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowingOriginal((v) => !v);
          }}
          title={showingOriginal ? "Show translation" : "Show original"}
          className="ms-1 inline-flex items-center gap-0.5 text-[9px] opacity-60 hover:opacity-100 transition-opacity align-middle"
          style={{ verticalAlign: "1px" }}
        >
          <span aria-hidden>🌐</span>
        </button>
      )}
    </Tag>
  );
}
