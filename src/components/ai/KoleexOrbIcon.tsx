"use client";

/* KoleexOrbIcon — the Koleex AI character as an app icon.
   Thin wrapper around <KoleexOrb> (idle) that matches the shared AppIcon
   signature ({ size?, className? }) so it can be used in navigation.ts,
   the launcher, the sidebar, etc. Extra props (e.g. `animated`) are ignored. */

import KoleexOrb from "./KoleexOrb";

export default function KoleexOrbIcon({
  size = 24,
  className,
}: {
  size?: number | string;
  className?: string;
}) {
  const px = typeof size === "string" ? parseInt(size, 10) || 24 : size;
  return <KoleexOrb state="idle" size={px} className={className} />;
}
