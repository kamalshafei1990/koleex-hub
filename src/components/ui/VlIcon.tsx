"use client";

/* ---------------------------------------------------------------------------
   VlIcon — render an icon from the Database app's Visual Library.

   The standing rule is that icons come from the General Icons Library, not
   hand-authored SVG. This is the shared way to consume one:

       <VlIcon slug="translate" size={20} />

   The slug→path map and the mask helper live in
   src/lib/visual-library/icons.ts so server-rendered surfaces (app-registry
   icons) can share them without pulling in a client boundary.
   --------------------------------------------------------------------------- */

import { vlMaskStyle, type VlIconSlug } from "@/lib/visual-library/icons";

export type { VlIconSlug };

export default function VlIcon({
  slug,
  size = 16,
  className,
  title,
}: {
  slug: VlIconSlug;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <span
      aria-hidden
      title={title}
      /* align-middle matters: an empty inline-block otherwise sits ON the
         text baseline, so next to a label it reads as floating high by a
         couple of pixels. `middle` centres it against the text instead.
         Inside a flex row this is inert (flex items ignore vertical-align),
         so it only ever helps. */
      className={`inline-block shrink-0 bg-current align-middle ${className ?? ""}`}
      style={vlMaskStyle(slug, size)}
    />
  );
}
