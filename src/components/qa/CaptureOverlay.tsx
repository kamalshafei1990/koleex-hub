"use client";

/* ---------------------------------------------------------------------------
   CaptureOverlay — in-app smart screenshot capture (Phase 9 v1).

   Replaces the old getDisplayMedia() flow. No OS / browser permissions, no
   share-picker — everything happens inside the page via html2canvas.

   UX
   ──
   • The report modal hides while this overlay is active so its own chrome
     never appears in the shot.
   • A subtle dim covers the page; the cursor becomes a crosshair.
   • Drag to select a rectangle → on release, that exact region is rendered
     and returned as a PNG/JPEG File.
   • Click a tagged component (data-kx-component) WITHOUT dragging → that
     element's exact bounds are captured.
   • ESC cancels.

   The overlay never appears in the screenshot: html2canvas's ignoreElements
   skips any node carrying [data-qa-capture-skip], which the overlay marks on
   itself AND the report FAB / minimized pill (see ReportIssueButton).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
// html2canvas-pro is the maintained fork. We use it because Tailwind v4
// emits utility colors as oklch(), which classic html2canvas can't parse —
// it throws on the first Tailwind-coloured element it walks.
/* html2canvas-pro is ~221KB raw — loaded ON DEMAND at capture time so the
   QA screenshot engine never rides in any page's first-load bundle. */

const SKIP_ATTR = "data-qa-capture-skip";

interface Rect { x: number; y: number; w: number; h: number }

interface Props {
  /** Resolves with the captured image (or null if user cancelled). */
  onResult: (file: File | null, error?: string) => void;
  /** Maximum file size; anything larger gets re-encoded as JPEG. */
  maxBytes: number;
  /** i18n strings passed in so the overlay stays language-agnostic. */
  labels: {
    hint: string;        // "Drag to select an area · click a component · Esc to cancel"
    rendering: string;   // "Rendering screenshot…"
    fail: string;        // "Couldn't capture. Try uploading instead."
  };
}

export default function CaptureOverlay({ onResult, maxBytes, labels }: Props) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [hover, setHover] = useState<Rect | null>(null);
  const [rendering, setRendering] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  // Locked once we begin a capture so late mouseups can't trigger a second.
  const lockRef = useRef(false);
  // Track whether the mouse moved enough to count as a drag vs a click.
  const movedRef = useRef(false);

  /**
   * Auto-trim solid-color borders (the page background) from a freshly
   * rendered canvas. Walks each edge inward until it hits a row/column with
   * pixels that differ meaningfully from the sampled background colour, then
   * crops to that bounding box. Skipped if the bg can't be detected, or if
   * the trim would remove >85% of the image (a sign that detection went
   * wrong, or the user really did capture an empty area).
   */
  const autoTrim = useCallback((canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const w = canvas.width;
    const h = canvas.height;
    if (w < 20 || h < 20) return canvas;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return canvas;
    let img: ImageData;
    try { img = ctx.getImageData(0, 0, w, h); } catch { return canvas; }
    const d = img.data;
    // Sample the four corners — if they all agree (within tolerance), that's
    // our background colour. Otherwise the edges aren't uniform and trimming
    // would be unsafe; skip.
    const pixAt = (x: number, y: number): [number, number, number, number] => {
      const i = (y * w + x) * 4;
      return [d[i], d[i + 1], d[i + 2], d[i + 3]];
    };
    const dist = (a: number[], b: number[]) =>
      Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    const c1 = pixAt(2, 2);
    const c2 = pixAt(w - 3, 2);
    const c3 = pixAt(2, h - 3);
    const c4 = pixAt(w - 3, h - 3);
    const cornerTol = 18;
    if (dist(c1, c2) > cornerTol || dist(c1, c3) > cornerTol || dist(c1, c4) > cornerTol) {
      return canvas;
    }
    const bg = c1;
    const pixelTol = 28; // generous — anti-aliasing dust and JPEG noise.
    const isContent = (x: number, y: number) => dist(pixAt(x, y), bg) > pixelTol;
    // Scan every 2nd pixel for speed — we only need the bounding-box edges.
    const step = 2;
    let top = 0, bottom = h - 1, left = 0, right = w - 1;
    outer: for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) if (isContent(x, y)) { top = y; break outer; }
    }
    outer: for (let y = h - 1; y >= 0; y -= step) {
      for (let x = 0; x < w; x += step) if (isContent(x, y)) { bottom = y; break outer; }
    }
    outer: for (let x = 0; x < w; x += step) {
      for (let y = top; y <= bottom; y += step) if (isContent(x, y)) { left = x; break outer; }
    }
    outer: for (let x = w - 1; x >= 0; x -= step) {
      for (let y = top; y <= bottom; y += step) if (isContent(x, y)) { right = x; break outer; }
    }
    // Pad a few pixels so we don't shave the outermost content.
    const pad = 4;
    top = Math.max(0, top - pad);
    left = Math.max(0, left - pad);
    bottom = Math.min(h - 1, bottom + pad);
    right = Math.min(w - 1, right + pad);
    const tw = right - left + 1;
    const th = bottom - top + 1;
    if (tw < 20 || th < 20) return canvas;
    const removed = 1 - (tw * th) / (w * h);
    if (removed > 0.85) return canvas; // sanity guard.
    if (removed < 0.04) return canvas; // not worth a re-encode.
    const out = document.createElement("canvas");
    out.width = tw; out.height = th;
    const octx = out.getContext("2d");
    if (!octx) return canvas;
    octx.drawImage(canvas, left, top, tw, th, 0, 0, tw, th);
    return out;
  }, []);

  const finishWith = useCallback(
    async (target: { kind: "rect"; rect: Rect } | { kind: "element"; el: HTMLElement }) => {
      if (lockRef.current) return;
      lockRef.current = true;
      setRendering(true);

      // Hide the overlay visually for the render pass even though it's marked
      // with SKIP_ATTR — extra belt-and-braces, and keeps the page un-dimmed
      // in the shot. We do this by moving the dim div opacity to 0 just before.
      await new Promise<void>((r) => requestAnimationFrame(() => r()));

      try {
        const scale = Math.min(window.devicePixelRatio || 1, 2);
        const html2canvas = (await import("html2canvas-pro")).default;
        let canvas: HTMLCanvasElement;
        if (target.kind === "element") {
          canvas = await html2canvas(target.el, {
            backgroundColor: null,
            scale,
            useCORS: true,
            logging: false,
            ignoreElements: (n) => (n as HTMLElement).hasAttribute?.(SKIP_ATTR),
          });
        } else {
          // Render the viewport then crop to the selected rectangle. This is
          // more reliable than html2canvas-ing an absolutely-positioned wrapper.
          const full = await html2canvas(document.body, {
            backgroundColor: getComputedStyle(document.body).backgroundColor || "#0d0d0d",
            scale,
            useCORS: true,
            logging: false,
            windowWidth: document.documentElement.clientWidth,
            windowHeight: document.documentElement.clientHeight,
            x: window.scrollX,
            y: window.scrollY,
            width: document.documentElement.clientWidth,
            height: document.documentElement.clientHeight,
            ignoreElements: (n) => (n as HTMLElement).hasAttribute?.(SKIP_ATTR),
          });
          const r = target.rect;
          const sx = Math.round(r.x * scale);
          const sy = Math.round(r.y * scale);
          const sw = Math.max(1, Math.round(r.w * scale));
          const sh = Math.max(1, Math.round(r.h * scale));
          canvas = document.createElement("canvas");
          canvas.width = sw; canvas.height = sh;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("no-2d-context");
          ctx.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
        }

        // Auto-trim solid background borders — turns wide-rectangle drags
        // that landed empty space on the right / bottom into clean shots of
        // just the actual content.
        const trimmed = autoTrim(canvas);
        const toBlob = (type: string, q?: number) =>
          new Promise<Blob | null>((res) => trimmed.toBlob(res, type, q));
        let blob = await toBlob("image/png");
        if (blob && blob.size > maxBytes) blob = await toBlob("image/jpeg", 0.9);
        if (blob && blob.size > maxBytes) blob = await toBlob("image/jpeg", 0.75);
        if (!blob || blob.size === 0) throw new Error("empty-blob");
        const ext = blob.type === "image/jpeg" ? "jpg" : "png";
        const file = new File([blob], `screenshot-${Date.now()}.${ext}`, { type: blob.type });
        onResult(file);
      } catch (e) {
        // Surface the real reason so a stale error never hides behind a
        // generic "Couldn't capture". Logged loudly + appended to the toast
        // text so QA can paste it back into a report if it reappears.
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[qa.capture] html2canvas failed:", e);
        onResult(null, `${labels.fail} (${msg.slice(0, 140)})`);
      }
    },
    [maxBytes, onResult, labels.fail, autoTrim],
  );

  // Find the nearest tagged component under a point (for click-without-drag).
  const elementForPoint = useCallback((x: number, y: number): HTMLElement | null => {
    const hostList = document.elementsFromPoint(x, y) as HTMLElement[];
    for (const n of hostList) {
      if (n.hasAttribute?.(SKIP_ATTR)) continue;
      const tagged = n.closest?.<HTMLElement>("[data-kx-component]");
      if (tagged && !tagged.hasAttribute(SKIP_ATTR)) return tagged;
    }
    return null;
  }, []);

  useEffect(() => {
    if (rendering) return;
    const CLICK_THRESHOLD = 4; // px — moves smaller than this count as a click.

    const onDown = (e: PointerEvent) => {
      if (lockRef.current) return;
      // Left-button only
      if (e.button !== 0) return;
      e.preventDefault();
      startRef.current = { x: e.clientX, y: e.clientY };
      movedRef.current = false;
      setRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
    };

    const onMove = (e: PointerEvent) => {
      if (lockRef.current) return;
      // Hover preview of tagged components (only when not dragging).
      if (!startRef.current) {
        const el = elementForPoint(e.clientX, e.clientY);
        if (el) {
          const r = el.getBoundingClientRect();
          setHover({ x: r.left, y: r.top, w: r.width, h: r.height });
        } else {
          setHover(null);
        }
        return;
      }
      const s = startRef.current;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) movedRef.current = true;
      const x = Math.min(s.x, e.clientX);
      const y = Math.min(s.y, e.clientY);
      const w = Math.abs(dx);
      const h = Math.abs(dy);
      setRect({ x, y, w, h });
    };

    const onUp = (e: PointerEvent) => {
      if (lockRef.current) return;
      const s = startRef.current;
      startRef.current = null;
      if (!s) return;
      if (movedRef.current && rect && rect.w >= 4 && rect.h >= 4) {
        // Region capture.
        void finishWith({ kind: "rect", rect });
      } else {
        // Click without drag → capture a tagged component if any, otherwise
        // a sensible block-level container under the cursor (closest section
        // / article / main / form / button / card-ish element).
        const el =
          elementForPoint(e.clientX, e.clientY) ??
          (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>(
            "section,article,main,form,[role='dialog'],table,figure,nav,aside,div",
          ) ??
          null;
        if (el && !el.hasAttribute(SKIP_ATTR)) void finishWith({ kind: "element", el });
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onResult(null);
      }
    };

    // Block accidental text selection while dragging.
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.userSelect = prevUserSelect;
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [rect, rendering, elementForPoint, finishWith, onResult]);

  // Use the active drag rectangle if any, else the hovered component for the
  // highlight box. The overlay itself is a single element marked SKIP so it
  // never lands in the rendered canvas.
  const box = rect && (rect.w > 1 || rect.h > 1) ? rect : hover;

  return (
    <div
      {...{ [SKIP_ATTR]: "" }}
      className="fixed inset-0 z-[400] cursor-crosshair"
      aria-hidden="true"
      style={{
        // 4-rect "spotlight" dim: dim everything outside the highlight box.
        // While there's no box, the whole screen is dimmed evenly.
        background: "transparent",
      }}
    >
      {/* Even dim base */}
      <div className="absolute inset-0 bg-black/35" />

      {/* When we have a box, knock it out so the user can see what they're capturing. */}
      {box && (
        <div
          className="absolute ring-2 ring-[#0066FF] shadow-[0_0_0_99999px_rgba(0,0,0,0.35)] rounded-[4px]"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h, background: "transparent" }}
        />
      )}

      {/* Live dimensions while dragging */}
      {rect && (rect.w > 4 || rect.h > 4) && (
        <div
          className="absolute rounded-md bg-[#0066FF] px-2 py-0.5 text-[11px] font-mono font-semibold text-white shadow-lg"
          style={{
            left: Math.min(rect.x + rect.w + 8, window.innerWidth - 80),
            top: Math.max(8, rect.y - 22),
          }}
        >
          {Math.round(rect.w)} × {Math.round(rect.h)}
        </div>
      )}

      {/* Hint banner */}
      <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-white/15 bg-black/80 px-3 py-1.5 text-[12px] font-medium text-white shadow-lg backdrop-blur-md">
        {rendering ? labels.rendering : labels.hint}
      </div>
    </div>
  );
}
