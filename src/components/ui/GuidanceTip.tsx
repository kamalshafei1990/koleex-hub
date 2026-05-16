"use client";

/* ===========================================================================
   GuidanceTip — hover-triggered bilingual (EN + 中文) help icon

   Visual + interaction parity with the Quotations Quick-Fill `?` tip:
     · 15px × 15px outlined circle, 0.85-alpha glyph, calm hover halo
     · Opens on `mouseenter`, closes on `mouseleave`
     · Tooltip is position: fixed with an edge-aware coordinate so it
       is never clipped by an overflow:auto ancestor
     · Always renders both EN and 中文, with a clear divider
     · Touch fallback: tap opens the tip, second tap or tap-outside closes
       (covers iOS / Android where there is no hover)
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import { getGuidance } from "@/lib/guidance/registry";

interface Props {
  /** Registry id, e.g. "treasury.runway". */
  guidanceId: string;
  /** Optional state value for state-aware variants (e.g. "mismatch"). */
  state?: string;
  /** Optional override label rendered next to the "?" glyph. */
  label?: string;
  /** Kept for source compat — both render the same trigger now. */
  size?: "xs" | "sm";
  triggerClassName?: string;
  ariaLabel?: string;
}

export default function GuidanceTip({
  guidanceId, state, label, triggerClassName, ariaLabel,
}: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  /* On touch devices `mouseenter` fires only after a tap; we use a
     manual "stuck" flag so a second tap closes it again. */
  const [stuck, setStuck] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  const resolved = getGuidance(guidanceId, state);

  /* Outside-click closes the stuck (touch-pinned) state. */
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

  const onEnter = useCallback((e: React.MouseEvent) => {
    if (stuck) return;
    setRect((e.currentTarget as HTMLElement).getBoundingClientRect());
  }, [stuck]);
  const onLeave = useCallback(() => {
    if (stuck) return;
    setRect(null);
  }, [stuck]);
  const onClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (stuck) {
      setStuck(false);
      setRect(null);
    } else {
      setRect((e.currentTarget as HTMLElement).getBoundingClientRect());
      setStuck(true);
    }
  }, [stuck]);

  if (!resolved) {
    /* Silent degrade — render the label if we have one, otherwise nothing. */
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
        style={{
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
          cursor: "help",
          background: "rgba(255,255,255,0.06)",
          userSelect: "none",
          flexShrink: 0,
        }}
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

/* ---------------------------------------------------------------------------
   Bilingual tooltip — fixed-position, edge-aware. Mirrors the
   Quotations Quick-Fill style exactly: slate-800 surface,
   single-column EN block then 中文 block, never clipped.
   --------------------------------------------------------------------------- */

function BilingualTooltip({
  anchorRect, titleEn, titleZh, en, zh,
}: { anchorRect: DOMRect; titleEn: string; titleZh: string; en: string; zh: string }) {
  const WIDTH = 320;
  const margin = 8;
  let left = anchorRect.left;
  if (typeof window !== "undefined" && left + WIDTH + 16 > window.innerWidth) {
    left = Math.max(8, window.innerWidth - WIDTH - 16);
  }
  let top = anchorRect.bottom + margin;
  if (typeof window !== "undefined" && top + 200 > window.innerHeight) {
    top = Math.max(8, anchorRect.top - 200 - margin);
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
      <div style={{ fontWeight: 700, fontSize: 9, color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", marginBottom: 2 }}>
        EN · {titleEn}
      </div>
      <div style={{ marginBottom: 8 }}>{en}</div>
      <div style={{ fontWeight: 700, fontSize: 9, color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", marginBottom: 2 }}>
        中文 · {titleZh}
      </div>
      <div>{zh}</div>
    </div>
  );
}
