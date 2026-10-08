/* ---------------------------------------------------------------------------
   The brand marks as the book draws them.

   The wordmark is NEVER redrawn here: `Wordmark` is components/layout/
   KoleexLogo, the Hub's one inline copy of the official file, coloured with
   currentColor. There is no K monogram any more (owner, 27/09/2026: "don't
   put K but put the full Koleex logo in a suitable size and position") —
   LogoTile fits the whole logo into avatars, app icons and favicons.

   The Koleex Hub mark is a raster lockup (the "hub" script is a drawn
   gradient, not a font), so it is shown from the live files in
   public/brand/hub-logo — the "-e" set the Hub header uses today.
   --------------------------------------------------------------------------- */

import type { CSSProperties } from "react";
import KoleexLogo, { KoleexLogoPaths } from "@/components/layout/KoleexLogo";

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

const LOCKUP_FONT = "var(--font-inter), Inter, 'Helvetica Neue', Arial, sans-serif";

/** The group lockup (owner, 27/09/2026): the logo with KOLEEX INTERNATIONAL
 *  GROUP under it — Inter Light, spaced out to exactly the logo's width, in
 *  the logo's own colour. `horizontal` is the wide form: logo | hairline |
 *  the name on three lines (card backs, e-mail signatures, headers). */
export function GroupLockup({ color = "#000000", width, horizontal = false, style }: {
  color?: string;
  width?: number | string;
  horizontal?: boolean;
  style?: CSSProperties;
}) {
  if (horizontal) {
    return (
      <span role="img" aria-label="KOLEEX International Group" className="inline-block shrink-0" style={{ color, width, aspectRatio: "1190 / 160", ...style }}>
        <svg viewBox="0 0 1190 160" className="block h-full w-full" fill="currentColor" aria-hidden="true">
          <svg x="0" y="26" width="720" height="108" viewBox="0 0 719.83 107.57"><KoleexLogoPaths /></svg>
          <rect x="786" y="0" width="3" height="160" />
          <text fontFamily={LOCKUP_FONT} fontWeight={300} fontSize={40} letterSpacing={1}>
            <tspan x="846" y="42">KOLEEX</tspan>
            <tspan x="846" y="99">INTERNATIONAL</tspan>
            <tspan x="846" y="156">GROUP</tspan>
          </text>
        </svg>
      </span>
    );
  }
  return (
    <span role="img" aria-label="KOLEEX International Group" className="inline-block shrink-0" style={{ color, width, aspectRatio: "720 / 166", ...style }}>
      <svg viewBox="0 0 720 166" className="block h-full w-full" fill="currentColor" aria-hidden="true">
        <svg x="0" y="0" width="720" height="108" viewBox="0 0 719.83 107.57"><KoleexLogoPaths /></svg>
        <text x="0" y="160" fontFamily={LOCKUP_FONT} fontWeight={300} fontSize={30} textLength={720} lengthAdjust="spacing">KOLEEX INTERNATIONAL GROUP</text>
      </svg>
    </span>
  );
}

/** The FULL logo on a tile — the avatar, app-icon and favicon form. There
 *  is no separate monogram (owner, 27/09/2026): small spaces use the whole
 *  logo, fitted to 70% of the tile's width. */
export function LogoTile({ dark = true, size = 96, round = false, border = false }: {
  dark?: boolean;
  size?: number;
  /** A circle (profile pictures) instead of a rounded square (app icons). */
  round?: boolean;
  border?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: round ? "50%" : size * 0.22,
        background: dark ? "#000000" : "#FFFFFF",
        /* A hairline on both: the dark tile would vanish on a dark page,
           the light one on a light page. */
        boxShadow: dark ? "inset 0 0 0 1px rgba(255,255,255,0.16)" : border ? "inset 0 0 0 1px #D2D2D7" : "inset 0 0 0 1px rgba(0,0,0,0.08)",
      }}
    >
      <Wordmark color={dark ? "#FFFFFF" : "#000000"} width={size * 0.7} />
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
