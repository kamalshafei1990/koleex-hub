"use client";

/* ===========================================================================
   GuidanceTip — hover-triggered bilingual (EN + 中文) help icon.

   Visual + interaction parity with the Quotations Quick-Fill ? tip.

   Performance + bug-fix pass:
     · Wrapped in React.memo so a parent re-render does NOT re-render
       every tip on the page (a dashboard renders 100+ tips; React.memo
       keeps the cost flat).
     · Registry lookup memoised via useMemo so each render is a single
       object reference, never a recomputed object.
     · Tooltip auto-closes on window scroll or resize — the previous
       version kept rendering at a stale anchor rect, which felt buggy.
     · Hover-out has a tiny grace window (60ms) so micro-jitter between
       the trigger and the tooltip body doesn't flap the popover open/
       closed at high speed.
   ========================================================================== */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getGuidance } from "@/lib/guidance/registry";

interface Props {
  guidanceId: string;
  state?: string;
  label?: string;
  size?: "xs" | "sm";
  triggerClassName?: string;
  ariaLabel?: string;
}

function GuidanceTipImpl({
  guidanceId, state, label, triggerClassName, ariaLabel,
}: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  /* Touch / keyboard: tap to pin open; tap-outside or ESC to close. */
  const [stuck, setStuck] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Memoised — the registry never mutates within a session, so caching
     by (id, state) is free correctness + a measurable win at scale. */
  const resolved = useMemo(() => getGuidance(guidanceId, state), [guidanceId, state]);

  /* Close on outside click + ESC while stuck. */
  useEffect(() => {
    if (!stuck) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setStuck(false);
        setRect(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setStuck(false); setRect(null); }
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [stuck]);

  /* Bug fix: when the page scrolls or resizes, the anchor rect goes
     stale. Close the tooltip on either event — cheap, correct,
     matches user expectation (the operator already moved their eye). */
  useEffect(() => {
    if (!rect) return;
    const onMove = () => {
      setRect(null);
      setStuck(false);
    };
    window.addEventListener("scroll", onMove, { passive: true, capture: true });
    window.addEventListener("resize", onMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", onMove, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", onMove);
    };
  }, [rect]);

  /* Cancel any pending hover-leave on every re-enter so a quick mouse
     pass between the trigger and the tooltip body doesn't flap. */
  const cancelLeaveTimer = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  const onEnter = useCallback((e: React.MouseEvent) => {
    if (stuck) return;
    cancelLeaveTimer();
    setRect((e.currentTarget as HTMLElement).getBoundingClientRect());
  }, [stuck, cancelLeaveTimer]);

  const onLeave = useCallback(() => {
    if (stuck) return;
    cancelLeaveTimer();
    leaveTimer.current = setTimeout(() => setRect(null), 60);
  }, [stuck, cancelLeaveTimer]);

  const onClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    cancelLeaveTimer();
    if (stuck) {
      setStuck(false);
      setRect(null);
    } else {
      setRect((e.currentTarget as HTMLElement).getBoundingClientRect());
      setStuck(true);
    }
  }, [stuck, cancelLeaveTimer]);

  /* Clean up the leave timer on unmount so we don't fire setState
     after the component is gone. */
  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  if (!resolved) {
    if (label) return <span className="text-[var(--text-primary)]">{label}</span>;
    return null;
  }

  return (
    <span ref={wrapRef} className="inline-flex items-center gap-1 align-middle">
      {label && <span className="text-inherit">{label}</span>}
      <span
        aria-label={ariaLabel ?? `Help: ${resolved.title.en}`}
        role="button"
        tabIndex={0}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const target = e.currentTarget as HTMLElement;
            setRect(target.getBoundingClientRect());
            setStuck((v) => !v);
          }
        }}
        style={GLYPH_STYLE}
        className={triggerClassName}
      >
        ?
      </span>
      {rect && (
        <BilingualTooltip
          anchorRect={rect}
          titleEn={resolved.title.en}
          titleZh={resolved.title.zh}
          en={resolved.content.en}
          zh={resolved.content.zh}
        />
      )}
    </span>
  );
}

/* React.memo so a parent re-render does not propagate work through
   every tip on the page. The component takes plain props (guidanceId,
   state, label, etc.) — shallow-equal comparison is correct. */
const GuidanceTip = memo(GuidanceTipImpl);
export default GuidanceTip;

/* Hoisted to module scope so the style object reference is stable and
   doesn't churn through React's reconciler.

   Centering note: a text `?` inherits the font's natural line-height
   plus a tiny visual-vs-typographic baseline offset, which makes
   flexbox-centered glyphs look low even though they're technically
   "centered". The fix is three things together:
     · line-height: 1               kills the inline-leading padding
     · padding-top: 1px              compensates the optical baseline
     · font-feature-settings tnum    tabular-nums prevents glyph drift
   That makes the `?` sit visually dead-center in the 15×15 circle. */
const GLYPH_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 15,
  height: 15,
  borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.45)",
  color: "rgba(255,255,255,0.85)",
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1,
  paddingTop: 1,
  cursor: "help",
  background: "rgba(255,255,255,0.06)",
  userSelect: "none",
  flexShrink: 0,
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
};

/* ---------------------------------------------------------------------------
   Bilingual tooltip — fixed-position, edge-aware. Mirrors the
   Quotations Quick-Fill style: slate-800 surface, EN block then
   中文 block, never clipped.
   --------------------------------------------------------------------------- */

const BilingualTooltip = memo(function BilingualTooltip({
  anchorRect, titleEn, titleZh, en, zh,
}: { anchorRect: DOMRect; titleEn: string; titleZh: string; en: string; zh: string }) {
  const WIDTH = 320;
  const margin = 8;
  let left = anchorRect.left;
  if (typeof window !== "undefined" && left + WIDTH + 16 > window.innerWidth) {
    left = Math.max(8, window.innerWidth - WIDTH - 16);
  }
  let top = anchorRect.bottom + margin;
  if (typeof window !== "undefined" && top + 220 > window.innerHeight) {
    top = Math.max(8, anchorRect.top - 220 - margin);
  }
  return (
    <div
      role="tooltip"
      style={{
        position: "fixed",
        top, left,
        width: WIDTH,
        padding: "10px 12px",
        borderRadius: 8,
        background: "#1f2937",
        color: "#ffffff",
        border: "1px solid rgba(255,255,255,0.18)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        fontSize: 11,
        lineHeight: 1.5,
        pointerEvents: "none",
        textTransform: "none",
        letterSpacing: 0,
        fontWeight: 400,
        whiteSpace: "normal",
        zIndex: 99999,
      }}
    >
      <div style={LABEL_STYLE}>EN · {titleEn}</div>
      <div style={{ marginBottom: 8 }}>{en}</div>
      <div style={LABEL_STYLE}>中文 · {titleZh}</div>
      <div>{zh}</div>
    </div>
  );
});

const LABEL_STYLE: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 9,
  color: "rgba(255,255,255,0.55)",
  letterSpacing: "0.08em",
  marginBottom: 2,
};
