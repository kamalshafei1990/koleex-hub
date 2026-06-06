"use client";

/* ---------------------------------------------------------------------------
   KOLEEX QA Inspector (Phase 2)

   A lightweight, isolated "inspect mode" that lets a tester point at a specific
   UI component and attach its structured metadata to a QA report — without
   touching business logic or breaking normal interactions.

   Architecture
   ────────────
   • Identification is via a formal metadata layer (data-kx-* attributes),
     injected by <KXInspectable> / kxInspectAttrs() — never via brittle CSS
     selectors or nth-child. Untagged elements get a safe best-effort fallback.
   • Isolation: a single provider exposes useInspector() = { active, start, stop }.
     The hover/highlight state lives ENTIRELY inside <InspectorOverlay>, which is
     only mounted while active — so pointer moves never re-render the app tree.
   • Safe events: while active, ONE set of capture-phase document listeners
     handles hover (rAF-throttled), select, and Esc. Clicks/mousedowns are
     neutralised (preventDefault + stopImmediatePropagation) so the underlying
     app never fires. Everything is removed on deactivate (no dangling
     listeners, no MutationObserver, no polling).
   --------------------------------------------------------------------------- */

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ElementType, type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { moduleForRoute } from "@/lib/qa/types";

export interface PickedComponent {
  component: string;
  module: string | null;
  section: string | null;
  recordId: string | null;
  route: string;
  rect: { top: number; left: number; width: number; height: number } | null;
  /** true when resolved from a best-effort fallback (no data-kx-component). */
  fallback: boolean;
  /** Computed styles snapshot of the picked element at click time. Lets the
   *  AI prompt diagnose UI/CSS bugs without having to open a browser. */
  styles?: Record<string, string>;
}

interface InspectorCtx {
  active: boolean;
  /** Enter inspect mode. The callback fires once with the pick (or null if cancelled). */
  start: (onPick: (c: PickedComponent | null) => void) => void;
  /** Cancel inspect mode (resolves the pending pick with null). */
  stop: () => void;
}

const Ctx = createContext<InspectorCtx | null>(null);

export function useInspector(): InspectorCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Safe no-op outside the provider (e.g. chrome-less routes).
    return { active: false, start: () => {}, stop: () => {} };
  }
  return ctx;
}

/* ── Metadata injection ──────────────────────────────────────────────────── */

export interface InspectMeta {
  component: string;
  module?: string;
  section?: string;
  recordId?: string | number | null;
}

/** Returns spreadable data-kx-* attributes for an existing element. Preferred
 *  over the wrapper when you don't want an extra DOM node. */
export function kxInspectAttrs(m: InspectMeta): Record<string, string> {
  const a: Record<string, string> = { "data-kx-component": m.component };
  if (m.module) a["data-kx-module"] = m.module;
  if (m.section) a["data-kx-section"] = m.section;
  if (m.recordId != null && String(m.recordId) !== "") a["data-kx-record-id"] = String(m.recordId);
  return a;
}

/** Convenience wrapper. Renders a <div> by default (override with `as`). */
export function KXInspectable({
  component, module, section, recordId, as, className, children, ...rest
}: InspectMeta & {
  as?: ElementType;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag className={className} {...kxInspectAttrs({ component, module, section, recordId })} {...rest}>
      {children}
    </Tag>
  );
}

/* ── Provider ────────────────────────────────────────────────────────────── */

export function QAInspectorProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const onPickRef = useRef<((c: PickedComponent | null) => void) | null>(null);

  const start = useCallback((onPick: (c: PickedComponent | null) => void) => {
    onPickRef.current = onPick;
    setActive(true);
  }, []);

  const finish = useCallback((result: PickedComponent | null) => {
    const cb = onPickRef.current;
    onPickRef.current = null;
    setActive(false);
    // Defer so the overlay unmounts before the consumer reacts (avoids
    // re-entrancy with the click that triggered selection).
    if (cb) requestAnimationFrame(() => cb(result));
  }, []);

  const stop = useCallback(() => finish(null), [finish]);

  // Stable context value — children never re-render on hover.
  const ctxRef = useRef<InspectorCtx>({ active, start, stop });
  ctxRef.current.active = active;
  ctxRef.current.start = start;
  ctxRef.current.stop = stop;

  return (
    <Ctx.Provider value={ctxRef.current}>
      {children}
      {active ? <InspectorOverlay onFinish={finish} /> : null}
    </Ctx.Provider>
  );
}

/* ── Overlay + event engine (mounted only while active) ──────────────────── */

interface Hover {
  rect: { top: number; left: number; width: number; height: number };
  meta: { component: string; module: string | null; section: string | null; recordId: string | null; fallback: boolean };
}

const IGNORE_ATTR = "data-kx-inspector"; // the overlay itself

function resolveElement(target: EventTarget | null): {
  el: HTMLElement;
  meta: Hover["meta"];
} | null {
  if (!(target instanceof HTMLElement)) return null;
  // Never inspect the overlay's own nodes.
  if (target.closest(`[${IGNORE_ATTR}]`)) return null;

  const tagged = target.closest<HTMLElement>("[data-kx-component]");
  if (tagged) {
    return {
      el: tagged,
      meta: {
        component: tagged.getAttribute("data-kx-component") || "Component",
        module: tagged.getAttribute("data-kx-module"),
        section: tagged.getAttribute("data-kx-section"),
        recordId: tagged.getAttribute("data-kx-record-id"),
        fallback: false,
      },
    };
  }

  // Fallback: best-effort label for an untagged element so inspect still works
  // everywhere. Prefer an accessible/visible label; never invent a selector.
  const labelHost =
    target.closest<HTMLElement>("button,a,[role='button'],input,select,textarea,[aria-label],[title]") ?? target;
  const label =
    labelHost.getAttribute("aria-label") ||
    labelHost.getAttribute("title") ||
    labelHost.getAttribute("placeholder") ||
    (labelHost.textContent || "").trim().replace(/\s+/g, " ").slice(0, 48) ||
    `<${labelHost.tagName.toLowerCase()}>`;
  return {
    el: labelHost,
    meta: { component: label, module: null, section: null, recordId: null, fallback: true },
  };
}

function rectOf(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** Snapshot the computed styles the AI prompt cares about for UI/CSS bugs.
 *  Tiny payload (≤12 fields), no DOM traversal, no allocation explosion. */
function stylesOf(el: HTMLElement): Record<string, string> {
  try {
    const cs = window.getComputedStyle(el);
    const pick = (k: string) => cs.getPropertyValue(k).trim();
    return {
      color: pick("color"),
      backgroundColor: pick("background-color"),
      fontFamily: pick("font-family"),
      fontSize: pick("font-size"),
      fontWeight: pick("font-weight"),
      lineHeight: pick("line-height"),
      letterSpacing: pick("letter-spacing"),
      textAlign: pick("text-align"),
      direction: pick("direction"),
      opacity: pick("opacity"),
      borderRadius: pick("border-radius"),
      display: pick("display"),
    };
  } catch { return {}; }
}

function InspectorOverlay({ onFinish }: { onFinish: (c: PickedComponent | null) => void }) {
  const pathname = usePathname() ?? "/";
  const [hover, setHover] = useState<Hover | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const resolved = resolveElement(e.target);
      if (!resolved) { lastElRef.current = null; return; }
      if (resolved.el === lastElRef.current) return; // cheap dedupe
      lastElRef.current = resolved.el;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setHover({ rect: rectOf(resolved.el), meta: resolved.meta });
      });
    };

    const neutralise = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation(); };

    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const resolved = resolveElement(e.target);
      if (!resolved) { onFinish(null); return; }
      const m = resolved.meta;
      try { resolved.el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* noop */ }
      onFinish({
        component: m.component,
        module: m.module || moduleForRoute(pathname),
        section: m.section,
        recordId: m.recordId,
        route: pathname,
        rect: rectOf(resolved.el),
        fallback: m.fallback,
        styles: stylesOf(resolved.el),
      });
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); onFinish(null); }
    };

    // Capture phase + immediate stop = app never sees the interaction.
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("mousedown", neutralise, true);
    document.addEventListener("pointerdown", neutralise, true);
    document.addEventListener("keydown", onKey, true);
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "crosshair";

    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("mousedown", neutralise, true);
      document.removeEventListener("pointerdown", neutralise, true);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.cursor = prevCursor;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [onFinish, pathname]);

  const r = hover?.rect;
  const tipTop = r ? Math.max(8, r.top - 8) : 0;
  const tipLeft = r ? Math.min(r.left, (typeof window !== "undefined" ? window.innerWidth : 9999) - 280) : 0;

  return (
    <div {...{ [IGNORE_ATTR]: "" }} className="pointer-events-none fixed inset-0 z-[300]">
      {/* Subtle dim so the inspected element stands out. */}
      <div className="absolute inset-0 bg-black/10" />

      {/* Mode banner */}
      <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-[var(--accent)]/40 bg-[var(--bg-secondary)]/95 px-3 py-1.5 text-[12px] font-medium text-[var(--text-primary)] shadow-lg backdrop-blur-md">
        Inspect mode — click a component · <span className="text-[var(--text-dim)]">Esc to cancel</span>
      </div>

      {r && (
        <>
          {/* Highlight box */}
          <div
            className="absolute rounded-[6px] ring-2 ring-[var(--accent)] bg-[var(--accent)]/10 transition-all duration-75"
            style={{ top: r.top, left: r.left, width: r.width, height: r.height }}
          />
          {/* Tooltip */}
          <div
            className="absolute max-w-[280px] -translate-y-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[11px] shadow-xl"
            style={{ top: tipTop, left: tipLeft }}
          >
            <div className="font-semibold text-[var(--text-primary)] truncate">
              {hover?.meta.component}
              {hover?.meta.fallback ? <span className="ml-1 text-[9px] font-normal text-[var(--text-ghost)]">(untagged)</span> : null}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-[var(--text-dim)]">
              {hover?.meta.module ? <span>{hover.meta.module}</span> : null}
              {hover?.meta.section ? <span>· {hover.meta.section}</span> : null}
              {hover?.meta.recordId ? <span>· #{hover.meta.recordId}</span> : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
