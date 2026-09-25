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
  createContext, useCallback, useContext, useRef, useState,
  type ElementType, type ReactNode,
} from "react";
import dynamic from "next/dynamic";

/* The overlay (hover engine + route → module labels) loads only when inspect
   mode starts — see inspector-overlay.tsx. */
const InspectorOverlay = dynamic(() => import("./inspector-overlay"), { ssr: false });

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
