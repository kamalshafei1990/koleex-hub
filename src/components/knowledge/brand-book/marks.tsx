/* ---------------------------------------------------------------------------
   The brand marks as the book draws them.

   The wordmark is NEVER redrawn here: `Wordmark` is components/layout/
   KoleexLogo, the Hub's one inline copy of the official file, coloured with
   currentColor. The K monogram is the first path of that same file — the K
   of the wordmark, cut out by its own viewBox, not a new drawing (owner,
   27/09/2026: "yes, design the K").

   The Koleex Hub mark is a raster lockup (the "hub" script is a drawn
   gradient, not a font), so it is shown from the live files in
   public/brand/hub-logo — the "-e" set the Hub header uses today.
   --------------------------------------------------------------------------- */

import type { CSSProperties } from "react";
import KoleexLogo from "@/components/layout/KoleexLogo";

/** The official K path, verbatim from koleex-logo-black.svg (path 1). */
export const K_PATH =
  "M116.59,96.3v11.05h-10.6L14.66,62.47v44.88H0V1.58h14.66v43.53L105.99,1.58h10.6v11.05L28.42,53.9l88.18,42.4Z";
export const K_VIEWBOX = "0 0 116.59 107.57";
/** Give it a width OR a height (px, %, mm…); the ratio is locked to the file. */
export function Wordmark({ color = "#000000", width, height, className = "", style }: {
  color?: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      role="img"
      aria-label="KOLEEX"
      className={`inline-block shrink-0 ${className}`}
      style={{ color, width, height, aspectRatio: "719.83 / 107.57", ...style }}
    >
      <KoleexLogo className="block h-full w-full" />
    </span>
  );
}

export function Monogram({ color = "#000000", className = "", style }: {
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg viewBox={K_VIEWBOX} className={className} style={style} role="img" aria-label="KOLEEX K monogram">
      <path fill={color} d={K_PATH} />
    </svg>
  );
}

/** The K on a square tile — the avatar / favicon form. */
export function MonogramTile({ dark = true, size = 96, radius = 0.22, border = false }: {
  dark?: boolean;
  size?: number;
  /** Corner radius as a share of the tile side. 0 = square (the file form). */
  radius?: number;
  border?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: size * radius,
        background: dark ? "#0A0A0A" : "#FFFFFF",
        /* A hairline on both: the dark tile would vanish on a dark page,
           the light one on a light page. */
        boxShadow: dark ? "inset 0 0 0 1px rgba(255,255,255,0.16)" : border ? "inset 0 0 0 1px #E5E7EB" : "inset 0 0 0 1px rgba(0,0,0,0.08)",
      }}
    >
      <Monogram color={dark ? "#FFFFFF" : "#000000"} style={{ width: size * 0.46 }} />
    </span>
  );
}

type HubVariant = "for-dark" | "for-light" | "mono-dark" | "mono-light";

export const HUB_MARK_FILES = {
  horizontal: (v: HubVariant) => `/brand/hub-logo/koleex-hub-logo-${v}-e.png`,
  stacked: (v: "for-dark" | "for-light") => `/brand/hub-logo/koleex-hub-stacked-${v}-e.png`,
  script: "/brand/hub-logo/hub-script-e.png",
} as const;

export function HubMark({ variant = "for-dark", stacked = false, className = "", style }: {
  variant?: HubVariant;
  stacked?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const src = stacked
    ? HUB_MARK_FILES.stacked(variant === "for-light" || variant === "mono-light" ? "for-light" : "for-dark")
    : HUB_MARK_FILES.horizontal(variant);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a fixed brand file shown at its own ratio; next/image adds nothing here
    <img src={src} alt="Koleex Hub" className={`block h-auto ${className}`} style={style} draggable={false} />
  );
}
