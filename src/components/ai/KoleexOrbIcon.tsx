"use client";

/* KoleexOrbIcon — the Koleex AI character as an app icon.
   Thin wrapper around <KoleexOrb> (idle) that matches the shared AppIcon
   signature ({ size?, className? }) so it can be used in navigation.ts,
   the launcher, the sidebar, etc. Extra props (e.g. `animated`) are ignored. */

import KoleexOrb from "./KoleexGlowOrb";

export default function KoleexOrbIcon({
  size = 24,
  className,
  /** Owner call (2026-10-07): the orb visually overwhelmed the neighbouring
     line icons in the rail and launcher — a filled glowing ball carries
     more weight than a 1.5px stroke at the same box size. It now renders
     slightly UNDER the box and lets its natural glow make up the weight. */
  scaleClass = "scale-[0.78]",
}: {
  size?: number | string;
  className?: string;
  /** Tailwind scale-* class — grows the orb visually without changing its
     layout box (so it never enlarges the slot/card it sits in). */
  scaleClass?: string;
}) {
  const px = typeof size === "string" ? parseInt(size, 10) || 24 : size;
  /* The orb artboard has transparent margin; earlier this wrapper scaled the
     orb UP to compensate, which the owner flagged as "much bigger than the
     others". Slightly under the box reads level with the line icons. */
  return (
    <KoleexOrb
      state="idle"
      size={px}
      className={(className ? className + " " : "") + scaleClass}
    />
  );
}
