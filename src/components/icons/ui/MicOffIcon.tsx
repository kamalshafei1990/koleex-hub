import { forwardRef } from "react";

/* MicOffIcon — the microphone is closed. MicIcon's pair: the same capsule,
   arc and stem, cut around a diagonal so the slash is part of the drawing
   rather than a line ruled over it. House grammar — 24-grid, 2px
   round-capped, minimal — the owner's rule for new marks (2026-09-14:
   "same style, same stroke size, rounded and minimal"). */
const MicOffIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={s}
        height={s}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        {...rest}
      >
        <path d="M15 9.5V5a3 3 0 0 0-5.86-.88" />
        <path d="M9 9.9V12a3 3 0 0 0 4.6 2.54" />
        <path d="M18.4 13.4A7 7 0 0 0 19 12v-2" />
        <path d="M5 10v2a7 7 0 0 0 10.9 5.8" />
        <line x1="12" x2="12" y1="19" y2="22" />
        {/* Inset from the corners: a slash ruled across the whole box reads
            as damage over the drawing, not as its state. */}
        <line x1="4" y1="3.5" x2="20" y2="20.5" />
      </svg>
    );
  },
);
MicOffIcon.displayName = "MicOffIcon";
export default MicOffIcon;
