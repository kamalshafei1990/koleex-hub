import { forwardRef } from "react";

/* WaveformIcon — a voice: the Speak control that starts a call, and the
   mark under a message that was said aloud on one. Five bars, tallest in the
   middle. It was drawn by hand in four places (the Speak pill, its loading
   stand-in, the round call control and the voice mark); one mark now, so
   they cannot drift apart. House grammar — 24-grid, 2px round-capped,
   minimal (owner, 2026-09-14: "same style, same stroke size, rounded and
   minimal"). */
const WaveformIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
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
        <line x1="4" y1="10" x2="4" y2="14" />
        <line x1="8" y1="7" x2="8" y2="17" />
        <line x1="12" y1="4" x2="12" y2="20" />
        <line x1="16" y1="7" x2="16" y2="17" />
        <line x1="20" y1="10" x2="20" y2="14" />
      </svg>
    );
  },
);
WaveformIcon.displayName = "WaveformIcon";
export default WaveformIcon;
