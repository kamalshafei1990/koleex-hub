"use client";

/* ---------------------------------------------------------------------------
   AnnotationEditor — lightweight in-browser annotation layer for QA shots.

   Phase 9 (finalisation). Tools: Arrow · Rectangle · Circle · Highlight ·
   Blur · Text · Undo · Save · Cancel. Brand-aligned (KOLEEX monochrome +
   single blue accent for active control / arrow / rect / circle, soft amber
   for highlight, the canvas's own pixels for blur).

   Architecture
   ────────────
   • One <img> for the source frame, rendered into an internal canvas to fix
     intrinsic size (DPR clamped to 2). Drawing happens on a second canvas
     layered on top, redrawn from a shape stack on every change.
   • No external libraries — only the 2D canvas API.
   • Blur tool: copies the under-shape region from the source canvas, blurs
     it via ctx.filter, and stamps it back at scale. This is fast and works
     in every modern browser.
   • Save composes the source + every shape into one canvas → Blob → File,
     mime preserved from the input where possible.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ACCENT = "#0066FF";
const HIGHLIGHT = "rgba(255, 204, 0, 0.45)"; // brand warning tint, translucent
const BLUR_RADIUS_PX = 10;
const ARROW_HEAD = 14;

type Tool = "arrow" | "rect" | "circle" | "highlight" | "blur" | "text";
type Shape =
  | { kind: "arrow"; from: [number, number]; to: [number, number]; color: string; w: number }
  | { kind: "rect"; from: [number, number]; to: [number, number]; color: string; w: number }
  | { kind: "circle"; from: [number, number]; to: [number, number]; color: string; w: number }
  | { kind: "highlight"; from: [number, number]; to: [number, number] }
  | { kind: "blur"; from: [number, number]; to: [number, number] }
  | { kind: "text"; at: [number, number]; text: string; color: string; size: number };

interface Props {
  file: File;
  onSave: (out: File) => void;
  onCancel: () => void;
  labels: {
    title: string;
    arrow: string; rect: string; circle: string; highlight: string;
    blur: string; text: string; undo: string; save: string; cancel: string;
    textPrompt: string;
  };
}

export default function AnnotationEditor({ file, onSave, onCancel, labels }: Props) {
  const [tool, setTool] = useState<Tool>("arrow");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [drag, setDrag] = useState<{ from: [number, number]; to: [number, number] } | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const srcCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number; cssW: number; cssH: number } | null>(null);

  // Load the image once when the file changes.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => setImg(el);
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Fit the canvases to the image, capped so a huge shot still fits on screen.
  useEffect(() => {
    if (!img || !wrapperRef.current) return;
    const max = { w: Math.min(window.innerWidth - 64, 1600), h: Math.min(window.innerHeight - 200, 980) };
    const scale = Math.min(1, max.w / img.naturalWidth, max.h / img.naturalHeight);
    const cssW = Math.round(img.naturalWidth * scale);
    const cssH = Math.round(img.naturalHeight * scale);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    setDims({ w, h, cssW, cssH });
    requestAnimationFrame(() => {
      const sc = srcCanvasRef.current; const dc = drawCanvasRef.current;
      if (!sc || !dc) return;
      sc.width = w; sc.height = h;
      dc.width = w; dc.height = h;
      const sctx = sc.getContext("2d");
      if (sctx) { sctx.imageSmoothingQuality = "high"; sctx.drawImage(img, 0, 0, w, h); }
    });
  }, [img]);

  // Repaint the overlay whenever shapes / drag change.
  useEffect(() => {
    const dc = drawCanvasRef.current;
    if (!dc || !dims) return;
    const ctx = dc.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, dc.width, dc.height);
    const all: Shape[] = drag
      ? [...shapes, ({ ...buildShapeFromDrag(tool, drag) } as Shape)]
      : shapes;
    for (const s of all) drawShape(ctx, s, srcCanvasRef.current);
  }, [shapes, drag, tool, dims]);

  const toLocal = (e: React.PointerEvent): [number, number] => {
    const dc = drawCanvasRef.current!;
    const r = dc.getBoundingClientRect();
    const sx = dc.width / r.width;
    const sy = dc.height / r.height;
    return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!dims) return;
    e.preventDefault();
    if (tool === "text") {
      const p = toLocal(e);
      const text = window.prompt(labels.textPrompt, "");
      if (text && text.trim()) {
        setShapes((prev) => [...prev, { kind: "text", at: p, text: text.trim(), color: ACCENT, size: 22 * (dims.w / dims.cssW) }]);
      }
      return;
    }
    const p = toLocal(e);
    setDrag({ from: p, to: p });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    setDrag({ from: drag.from, to: toLocal(e) });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag) return;
    const to = toLocal(e);
    const final = { from: drag.from, to };
    const dx = to[0] - drag.from[0]; const dy = to[1] - drag.from[1];
    // Only commit shapes with a real extent (>4 px on either axis).
    if (Math.abs(dx) >= 4 || Math.abs(dy) >= 4) {
      setShapes((prev) => [...prev, buildShapeFromDrag(tool, final) as Shape]);
    }
    setDrag(null);
  };

  const undo = useCallback(() => setShapes((prev) => prev.slice(0, -1)), []);

  const save = useCallback(async () => {
    const sc = srcCanvasRef.current; const dc = drawCanvasRef.current;
    if (!sc || !dc) return;
    const out = document.createElement("canvas");
    out.width = sc.width; out.height = sc.height;
    const octx = out.getContext("2d");
    if (!octx) return;
    octx.drawImage(sc, 0, 0);
    octx.drawImage(dc, 0, 0);
    const mime = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
    const blob: Blob | null = await new Promise((res) => out.toBlob(res, mime, 0.92));
    if (!blob) return;
    const stem = file.name.replace(/\.(png|jpe?g|webp)$/i, "");
    const ext = mime === "image/jpeg" ? "jpg" : "png";
    onSave(new File([blob], `${stem}-annotated.${ext}`, { type: mime }));
  }, [file, onSave]);

  // Esc cancels, ⌘Z / Ctrl+Z undoes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, undo]);

  const toolBtn = useMemo(() => (id: Tool, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTool(id)}
      aria-pressed={tool === id}
      className={`rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-colors ${tool === id ? "border-[var(--text-secondary)] bg-[var(--bg-surface)] text-[var(--text-primary)]" : "border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
    >
      {label}
    </button>
  ), [tool]);

  return (
    <div className="fixed inset-0 z-[220] flex flex-col bg-black/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={labels.title}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-white">{labels.title}</span>
        <div className="ms-2 flex flex-wrap items-center gap-1.5">
          {toolBtn("arrow", labels.arrow)}
          {toolBtn("rect", labels.rect)}
          {toolBtn("circle", labels.circle)}
          {toolBtn("highlight", labels.highlight)}
          {toolBtn("blur", labels.blur)}
          {toolBtn("text", labels.text)}
        </div>
        <div className="ms-auto flex items-center gap-1.5">
          <button type="button" onClick={undo} disabled={shapes.length === 0} className="rounded-md border border-[var(--border-color)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40">{labels.undo}</button>
          <button type="button" onClick={onCancel} className="rounded-md border border-[var(--border-color)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{labels.cancel}</button>
          <button type="button" onClick={save} className="rounded-md bg-[var(--bg-inverted)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] shadow-sm hover:opacity-90">{labels.save}</button>
        </div>
      </div>
      <div ref={wrapperRef} className="relative mx-auto flex flex-1 items-center justify-center overflow-auto rounded-lg bg-[var(--bg-secondary)]">
        {dims && (
          <div className="relative" style={{ width: dims.cssW, height: dims.cssH }}>
            <canvas ref={srcCanvasRef} style={{ width: dims.cssW, height: dims.cssH, display: "block" }} />
            <canvas
              ref={drawCanvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{ width: dims.cssW, height: dims.cssH, position: "absolute", inset: 0, cursor: tool === "text" ? "text" : "crosshair", touchAction: "none" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Shape pipeline ────────────────────────────────────────────────────────── */

function buildShapeFromDrag(tool: Tool, d: { from: [number, number]; to: [number, number] }): Shape {
  const base = { from: d.from, to: d.to, color: ACCENT, w: 4 };
  switch (tool) {
    case "arrow": return { kind: "arrow", ...base };
    case "rect": return { kind: "rect", ...base };
    case "circle": return { kind: "circle", ...base };
    case "highlight": return { kind: "highlight", from: d.from, to: d.to };
    case "blur": return { kind: "blur", from: d.from, to: d.to };
    case "text": return { kind: "rect", ...base }; // never reached; text uses prompt path
  }
}

function drawShape(ctx: CanvasRenderingContext2D, s: Shape, src: HTMLCanvasElement | null) {
  ctx.save();
  switch (s.kind) {
    case "arrow": {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.w; ctx.lineCap = "round"; ctx.lineJoin = "round";
      const [x1, y1] = s.from; const [x2, y2] = s.to;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const h = ARROW_HEAD;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - h * Math.cos(angle - Math.PI / 7), y2 - h * Math.sin(angle - Math.PI / 7));
      ctx.lineTo(x2 - h * Math.cos(angle + Math.PI / 7), y2 - h * Math.sin(angle + Math.PI / 7));
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      break;
    }
    case "rect": {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.w;
      const [x1, y1] = s.from; const [x2, y2] = s.to;
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      break;
    }
    case "circle": {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.w;
      const [x1, y1] = s.from; const [x2, y2] = s.to;
      const cx = (x1 + x2) / 2; const cy = (y1 + y2) / 2;
      const rx = Math.abs(x2 - x1) / 2; const ry = Math.abs(y2 - y1) / 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case "highlight": {
      ctx.fillStyle = HIGHLIGHT;
      const [x1, y1] = s.from; const [x2, y2] = s.to;
      ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      break;
    }
    case "blur": {
      // Sample the source canvas's pixels under the shape and stamp them back
      // through ctx.filter = blur. Skip if source is missing (precaution).
      if (!src) break;
      const [x1, y1] = s.from; const [x2, y2] = s.to;
      const x = Math.min(x1, x2); const y = Math.min(y1, y2);
      const w = Math.max(1, Math.abs(x2 - x1)); const h = Math.max(1, Math.abs(y2 - y1));
      ctx.save();
      ctx.filter = `blur(${BLUR_RADIUS_PX}px)`;
      // Draw the source region scaled 1:1 over itself, blurred.
      ctx.drawImage(src, x, y, w, h, x, y, w, h);
      ctx.restore();
      break;
    }
    case "text": {
      ctx.fillStyle = s.color;
      ctx.font = `bold ${s.size}px Helvetica, Arial, sans-serif`;
      ctx.textBaseline = "top";
      // Soft outline for readability over any background.
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = Math.max(2, s.size / 8);
      ctx.lineJoin = "round";
      ctx.strokeText(s.text, s.at[0], s.at[1]);
      ctx.fillText(s.text, s.at[0], s.at[1]);
      break;
    }
  }
  ctx.restore();
}
