"use client";

/* ===========================================================================
   GuidanceTip — Phase 2.5

   A quiet, monochrome operational help primitive. One component, one
   tap target, two render modes:

     · Desktop / tablet  → calm popover anchored next to the trigger.
                           Flips when near viewport edges.
     · Mobile (< 640px)  → bottom-sheet fallback so the content never
                           overflows or clips.

   Discipline rules baked in:

     · No hover dependency. Click / tap only.
     · ESC closes. Click outside closes.
     · 36px touch target on mobile; 18px desktop affordance.
     · One small "?" glyph button. No paragraphs in the trigger.
     · No global tooltip manager, no portal spam — the popover lives
       in the tip's own DOM subtree.
     · State-aware: pass a `state` prop and the registry resolves the
       state-specific variant (e.g. reconciliation_status === "mismatch").
   ========================================================================== */

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { getGuidance } from "@/lib/guidance/registry";

/* ---------------------------------------------------------------------------
   Mobile media-query store — React-19 blessed pattern using
   useSyncExternalStore so render stays pure (no
   react-hooks/set-state-in-effect violations).
   --------------------------------------------------------------------------- */

function subscribeMobile(cb: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia("(max-width: 639px)");
  const handler = () => cb();
  mql.addEventListener?.("change", handler);
  return () => mql.removeEventListener?.("change", handler);
}
function getMobileSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(max-width: 639px)").matches;
}
function getMobileServerSnapshot(): boolean { return false; }

interface Props {
  /** Registry id, e.g. "treasury.runway". */
  guidanceId: string;
  /** Optional state value for state-aware variants (e.g. "mismatch"). */
  state?: string;
  /** Optional override label rendered next to the "?" glyph. */
  label?: string;
  /** Bigger affordance for headers, smaller for inline labels. */
  size?: "xs" | "sm";
  /** Extra Tailwind class for the trigger button. */
  triggerClassName?: string;
  /** Optional accessible label override. */
  ariaLabel?: string;
}

export default function GuidanceTip({
  guidanceId, state, label, size = "xs", triggerClassName, ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const reactId = useId();
  const tipId = `guidance-${guidanceId.replace(/[^a-zA-Z0-9_-]/g, "-")}-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  /* React-19 blessed external-store pattern for mobile breakpoint. */
  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, getMobileServerSnapshot);

  /* Click-outside + ESC. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  }, []);

  /* Resolve bilingual content — both languages always shown in the
     popover so a Chinese-speaking operator and an English-speaking
     auditor can both read the same row at the same time. */
  const resolved = getGuidance(guidanceId, state);
  if (!resolved) {
    if (label) return <span className="text-[var(--text-primary)]">{label}</span>;
    return null;
  }

  const triggerSize = size === "sm" ? "h-3.5 w-3.5 text-[9px]" : "h-3 w-3 text-[8px]";

  return (
    <span ref={containerRef} className="relative inline-flex items-center gap-1">
      {label && <span className="text-inherit">{label}</span>}
      <button
        type="button"
        aria-label={ariaLabel ?? `Help: ${resolved.title.en}`}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={handleToggle}
        className={
          "inline-flex shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-gray-500 transition-colors hover:border-white/[0.18] hover:bg-white/[0.06] hover:text-gray-300 " +
          triggerSize + " " +
          /* 36px hit target via :before on touch devices only. */
          "before:absolute before:-inset-3 before:content-[''] sm:before:hidden " +
          (triggerClassName ?? "")
        }
      >
        ?
      </button>

      {open && (
        isMobile
          ? <GuidancePopoverMobile id={tipId} titleEn={resolved.title.en} titleZh={resolved.title.zh} contentEn={resolved.content.en} contentZh={resolved.content.zh} onClose={() => setOpen(false)} />
          : <GuidancePopoverDesktop id={tipId} titleEn={resolved.title.en} titleZh={resolved.title.zh} contentEn={resolved.content.en} contentZh={resolved.content.zh} />
      )}
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Desktop popover — anchored, calm, fixed width.
   --------------------------------------------------------------------------- */

interface BilingualPopoverProps {
  id: string;
  titleEn: string; titleZh: string;
  contentEn: string; contentZh: string;
}

function GuidancePopoverDesktop({
  id, titleEn, titleZh, contentEn, contentZh,
}: BilingualPopoverProps) {
  /* Position: bottom-start by default; auto-flip via a callback-ref
     measurement so render stays pure under React-19's
     react-hooks/set-state-in-effect rule. */
  const [placement, setPlacement] = useState<{ above: boolean; left: boolean }>(
    () => ({ above: false, left: false }),
  );
  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node || typeof window === "undefined") return;
    const rect = node.getBoundingClientRect();
    const above = rect.bottom + 24 > window.innerHeight;
    const left  = rect.right + 24 > window.innerWidth;
    setPlacement((prev) => (prev.above === above && prev.left === left ? prev : { above, left }));
  }, []);

  const placeCls =
    (placement.above ? "bottom-full mb-2" : "top-full mt-2") + " " +
    (placement.left ? "right-0" : "left-0");

  return (
    <div
      ref={measure}
      id={id}
      role="tooltip"
      className={
        "absolute z-[150] w-[260px] rounded-lg border border-white/[0.08] bg-[var(--bg-secondary)] px-2.5 py-2 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.55)] " +
        placeCls
      }
    >
      {/* EN block */}
      <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-gray-500">{titleEn}</div>
      <div className="mt-0.5 text-[10.5px] leading-snug text-gray-200">{contentEn}</div>
      {/* hairline divider */}
      <div className="my-1.5 h-px w-full bg-white/[0.06]" aria-hidden />
      {/* ZH block */}
      <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-gray-500">{titleZh}</div>
      <div className="mt-0.5 text-[10.5px] leading-snug text-gray-200">{contentZh}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Mobile bottom sheet — full-width, dismissable via tap outside or
   the close glyph.
   --------------------------------------------------------------------------- */

function GuidancePopoverMobile({
  id, titleEn, titleZh, contentEn, contentZh, onClose,
}: BilingualPopoverProps & { onClose: () => void }) {
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[150] flex items-end bg-black/30 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        id={id}
        role="tooltip"
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-2xl border-t border-white/[0.08] bg-[var(--bg-secondary)] px-4 pb-5 pt-3 shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.6)]"
        style={{ animation: "koleex-fade-in 200ms ease-out both" }}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/[0.10]" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-500">{titleEn} · {titleZh}</div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-gray-200"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="mt-1.5 text-[11.5px] leading-relaxed text-gray-200">{contentEn}</div>
        <div className="my-2 h-px w-full bg-white/[0.06]" aria-hidden />
        <div className="text-[11.5px] leading-relaxed text-gray-200">{contentZh}</div>
      </div>
    </div>
  );
}
