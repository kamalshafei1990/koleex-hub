"use client";

/* KoleexOrbIcon — the Koleex AI character as an app icon.
   Thin wrapper around <KoleexOrb> (idle) that matches the shared AppIcon
   signature ({ size?, className? }) so it can be used in navigation.ts,
   the launcher, the sidebar, etc. Extra props (e.g. `animated`) are ignored. */

import KoleexOrb from "./KoleexOrb";

export default function KoleexOrbIcon({
  size = 24,
  className,
  scaleClass = "scale-150",
}: {
  size?: number | string;
  className?: string;
  /** Tailwind scale-* class — grows the orb visually without changing its
     layout box (so it never enlarges the slot/card it sits in). */
  scaleClass?: string;
}) {
  const px = typeof size === "string" ? parseInt(size, 10) || 24 : size;
  /* The orb artboard has transparent margin, so it reads ~40% smaller than its
     box. Scale it up (layout box stays `px`, only the visual grows) so it fills
     an icon slot with the same weight as the other line icons. */
  return (
    <KoleexOrb
      state="idle"
      size={px}
      className={(className ? className + " " : "") + scaleClass}
    />
  );
}
