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
import { getGuidanceLocale, type GuidanceLocale } from "@/lib/guidance/locale";
import { getLocalizedGuidance } from "@/lib/guidance/registry";

/* ---------------------------------------------------------------------------
   useSyncExternalStore subscriptions — React-19-blessed pattern for
   reading runtime values that can change without violating
   react-hooks/set-state-in-effect.
   --------------------------------------------------------------------------- */

function subscribeLocale(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener("koleex:guidance-locale", handler);
  return () => window.removeEventListener("koleex:guidance-locale", handler);
}
function getLocaleSnapshot(): GuidanceLocale { return getGuidanceLocale(); }
function getLocaleServerSnapshot(): GuidanceLocale { return "en"; }

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
  /* React-19 blessed external-store pattern for runtime values. */
  const locale   = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getLocaleServerSnapshot);
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

  /* Resolve content lazily — when registry misses an id we render
     nothing (silently degrades; no broken UI for unmigrated entries). */
  const resolved = getLocalizedGuidance(guidanceId, locale, state);
  if (!resolved) {
    if (label) return <span className="text-[var(--text-primary)]">{label}</span>;
    return null;
  }

  const triggerSize = size === "sm" ? "h-4 w-4 text-[10px]" : "h-3.5 w-3.5 text-[9px]";

  return (
    <span ref={containerRef} className="relative inline-flex items-center gap-1">
      {label && <span className="text-inherit">{label}</span>}
      <button
        type="button"
        aria-label={ariaLabel ?? `Help: ${resolved.title}`}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={handleToggle}
        className={
          "inline-flex shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-gray-400 transition-colors hover:border-white/[0.18] hover:bg-white/[0.06] hover:text-gray-200 " +
          triggerSize + " " +
          /* 36px hit target via padding on touch devices — picks up
             via the absolutely-positioned :before pseudo. */
          "before:absolute before:-inset-3 before:content-[''] sm:before:hidden " +
          (triggerClassName ?? "")
        }
      >
        ?
      </button>

      {open && (
        isMobile
          ? <GuidancePopoverMobile id={tipId} title={resolved.title} content={resolved.content} onClose={() => setOpen(false)} />
          : <GuidancePopoverDesktop id={tipId} title={resolved.title} content={resolved.content} />
      )}
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Desktop popover — anchored, calm, fixed width.
   --------------------------------------------------------------------------- */

function GuidancePopoverDesktop({
  id, title, content,
}: { id: string; title: string; content: string }) {
  /* Position: bottom-start by default; auto-flip to top when near the
     viewport's bottom edge.

     We use a callback ref so the placement decision happens *during*
     the DOM-attach step rather than after render, which keeps us
     compliant with React-19's react-hooks/set-state-in-effect rule
     (which forbids triggering state updates from inside useEffect). */
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
        "absolute z-[150] w-[280px] rounded-xl border border-white/[0.08] bg-[var(--bg-secondary)] px-3 py-2.5 text-[11px] leading-relaxed text-gray-200 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.6)] " +
        placeCls
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">{title}</div>
      <div className="mt-1 text-[12px] text-gray-200">{content}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Mobile bottom sheet — full-width, dismissable via tap outside or
   the close glyph.
   --------------------------------------------------------------------------- */

function GuidancePopoverMobile({
  id, title, content, onClose,
}: { id: string; title: string; content: string; onClose: () => void }) {
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
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">{title}</div>
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
        <div className="mt-1 text-[13px] leading-relaxed text-gray-200">{content}</div>
      </div>
    </div>
  );
}
