"use client";

/* ---------------------------------------------------------------------------
   VisualGlyph — monochrome inline line-glyphs for the visual option system.

   One component, keyed by a string token from the visual-options registry
   (motor-servo, feed-drop, plug, app-shirt, weight-heavy, …). All glyphs are
   single-stroke, currentColor, 24×24 — they inherit the surrounding text
   colour so they read as part of the monochrome KOLEEX UI, never as a
   colourful icon pack. Unknown tokens fall back to a neutral tag glyph.
   --------------------------------------------------------------------------- */

import type { CSSProperties } from "react";

interface Props {
  token: string;
  className?: string;
  style?: CSSProperties;
}

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function paths(token: string): React.ReactNode {
  switch (token) {
    /* ── Boolean / state ── */
    case "check":
      return <path d="M5 12.5l4 4 10-10" {...S} />;
    case "dot":
      return <circle cx="12" cy="12" r="3" {...S} />;

    /* ── Generic metric (gauge) — for numeric anchors with no domain glyph ── */
    case "gauge":
      return (
        <>
          <path d="M4 15a8 8 0 0 1 16 0" {...S} />
          <path d="M12 15l4-4" {...S} />
          <circle cx="12" cy="15" r="1.2" {...S} />
        </>
      );

    /* ── Motors ── */
    case "motor-servo":
    case "motor-direct":
    case "motor-clutch":
    case "motor-integrated":
      return (
        <>
          <rect x="4" y="8" width="11" height="8" rx="1.5" {...S} />
          <path d="M15 10.5h3.5a1.5 1.5 0 0 1 1.5 1.5v0a1.5 1.5 0 0 1-1.5 1.5H15" {...S} />
          <path d="M2 12h2" {...S} />
          {token === "motor-direct" ? <circle cx="9.5" cy="12" r="2" {...S} /> : null}
          {token === "motor-servo" ? <path d="M7 12h5M9.5 9.5v5" {...S} /> : null}
          {token === "motor-clutch" ? <path d="M9.5 9.8v4.4" {...S} /> : null}
        </>
      );

    /* ── Feed ── */
    case "feed-drop":
      return (
        <>
          <path d="M4 14h16" {...S} />
          <path d="M6 14l1.2-2 1.2 2M10 14l1.2-2 1.2 2M14 14l1.2-2 1.2 2" {...S} />
        </>
      );
    case "feed-compound":
      return (
        <>
          <path d="M4 15h16" {...S} />
          <path d="M7 15l1.2-2 1.2 2M13 15l1.2-2 1.2 2" {...S} />
          <path d="M12 5v6" {...S} />
          <path d="M10.5 9.5L12 11l1.5-1.5" {...S} />
        </>
      );
    case "feed-walking":
      return (
        <>
          <path d="M4 15h16" {...S} />
          <rect x="7" y="7" width="4" height="5" rx="1" {...S} />
          <rect x="13" y="9" width="4" height="3" rx="1" {...S} />
        </>
      );

    /* ── Hook / looper ── */
    case "hook-rotary":
      return (
        <>
          <circle cx="12" cy="12" r="6" {...S} />
          <path d="M12 6a6 6 0 0 1 5 9" {...S} />
        </>
      );
    case "hook-osc":
      return (
        <>
          <path d="M6 12a6 6 0 0 1 12 0" {...S} />
          <path d="M9 12a3 3 0 0 1 6 0" {...S} />
        </>
      );
    case "hook-vert":
      return (
        <>
          <circle cx="12" cy="12" r="5.5" {...S} />
          <path d="M12 6.5v11" {...S} />
        </>
      );

    /* ── Plug / socket ── */
    case "plug":
      return (
        <>
          <rect x="5" y="4" width="14" height="16" rx="3" {...S} />
          <circle cx="9.5" cy="10" r="1" {...S} />
          <circle cx="14.5" cy="10" r="1" {...S} />
          <path d="M10 14.5h4" {...S} />
        </>
      );

    /* ── Material weight ── */
    case "weight-light":
      return <><path d="M5 15h14" {...S} /><path d="M8 12h8" {...S} /></>;
    case "weight-medium":
      return <><path d="M5 16h14" {...S} /><path d="M6 13h12" {...S} /><path d="M8 10h8" {...S} /></>;
    case "weight-heavy":
      return (
        <>
          <path d="M4 17h16" {...S} /><path d="M5 14h14" {...S} />
          <path d="M6 11h12" {...S} /><path d="M8 8h8" {...S} />
        </>
      );

    /* ── Automation ── */
    case "automation":
      return (
        <>
          <circle cx="12" cy="12" r="3" {...S} />
          <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" {...S} />
        </>
      );

    /* ── Garments / applications ── */
    case "app-shirt":
    case "app-sport":
    case "app-uniform":
      return (
        <>
          <path d="M8 4l-3 2 1.5 3L8 8v12h8V8l1.5 1 1.5-3-3-2-2 1.5h-2L8 4z" {...S} />
        </>
      );
    case "app-trouser":
      return (
        <>
          <path d="M8 4h8l-.5 16h-2.5l-1-9-1 9H7.5L8 4z" {...S} />
        </>
      );
    case "app-jacket":
    case "app-suit":
      return (
        <>
          <path d="M8 4l4 3 4-3 3 3-2 2v11H7V9L5 7l3-3z" {...S} />
          <path d="M12 7v13" {...S} />
        </>
      );
    case "app-dress":
    case "app-lingerie":
      return (
        <>
          <path d="M9 4h6l-1 4 3 12H7l3-12-1-4z" {...S} />
        </>
      );
    case "app-jeans":
      return (
        <>
          <path d="M8 4h8l-.5 16h-2.5l-1-9-1 9H7.5L8 4z" {...S} />
          <path d="M8 7h8" {...S} />
        </>
      );
    case "app-leather":
      return (
        <>
          <rect x="6" y="8" width="12" height="11" rx="1.5" {...S} />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" {...S} />
        </>
      );
    case "app-apparel":
    default:
      // neutral tag / generic fallback
      return (
        <>
          <path d="M4 9l8-4 8 4-8 4-8-4z" {...S} />
          <path d="M4 9v6l8 4 8-4V9" {...S} />
        </>
      );
  }
}

export default function VisualGlyph({ token, className, style }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      aria-hidden="true"
      role="img"
    >
      {paths(token)}
    </svg>
  );
}
