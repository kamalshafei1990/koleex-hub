"use client";

/* ---------------------------------------------------------------------------
   ScreenshotCaptureModal — WeChat-style "mark a region" screen capture that
   hands the cropped area back as a File (so it flows through the same upload
   pipeline as a picked file).

   Browser reality: a web page cannot freeze the real OS screen and let you
   drag on it the way a native app does — the only way to read screen pixels
   is getDisplayMedia, which first asks the user to pick a screen/window/tab.
   So the flow is:
     1. Ask once via getDisplayMedia (the browser's share prompt).
     2. Grab a single frame, stop the stream, and show that frame FROZEN,
        full-screen, dimmed.
     3. The user drags a rectangle over the part they want (everything
        outside the box stays dimmed — the WeChat marquee look).
     4. Confirm → we crop exactly that rectangle from the full-resolution
        frame → PNG File.

   Also supports clipboard paste (Cmd/Ctrl+V or button) for the OS
   "screenshot-to-clipboard" flow, which drops straight in.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Stage = "starting" | "marking" | "error";
interface Frame { url: string; w: number; h: number }
interface Sel { x: number; y: number; w: number; h: number }

const ACCENT = "#0066FF";

export function ScreenshotCaptureModal({
  open,
  onCapture,
  onClose,
}: {
  open: boolean;
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<Stage>("starting");
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [sel, setSel] = useState<Sel | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const stampName = (p: string) => `${p}-${Date.now()}.png`;

  const emit = useCallback(
    (file: File) => {
      onCapture(file);
      onClose();
    },
    [onCapture, onClose],
  );

  const reset = useCallback(() => {
    setFrame(null);
    setSel(null);
    dragStart.current = null;
  }, []);

  /* Ask for the screen, grab ONE frame, stop the stream, freeze it. */
  const startCapture = useCallback(async () => {
    setError(null);
    reset();
    setStage("starting");
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!md || typeof md.getDisplayMedia !== "function") {
      setStage("error");
      setError(
        "This browser can't capture the screen here. Take a screenshot with your OS (Cmd/Ctrl+Shift+4) and click “Paste from clipboard”.",
      );
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await md.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play().catch(() => {});
      // give the pipeline a couple of frames so the first paint isn't black
      await new Promise((r) => setTimeout(r, 250));
      const w = video.videoWidth || 1920;
      const h = video.videoHeight || 1080;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
      const url = canvas.toDataURL("image/png");
      stream.getTracks().forEach((t) => t.stop()); // we only needed one frame
      video.srcObject = null;
      setFrame({ url, w, h });
      setStage("marking");
    } catch {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      setStage("error");
      setError("Screen capture was cancelled. Try again, or paste a screenshot from your clipboard.");
    }
  }, [reset]);

  useEffect(() => {
    if (!open) return;
    void startCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Esc cancels; Enter confirms a selection; global paste drops an image in. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Enter" && sel && sel.w > 4 && sel.h > 4) confirmCrop();
    };
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type.startsWith("image/")) {
          const blob = it.getAsFile();
          if (blob) {
            e.preventDefault();
            emit(new File([blob], stampName("pasted"), { type: blob.type || "image/png" }));
            return;
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sel, emit, onClose]);

  const pasteFromClipboard = useCallback(async () => {
    setError(null);
    try {
      const anyNav = navigator as Navigator & { clipboard?: { read?: () => Promise<ClipboardItem[]> } };
      if (!anyNav.clipboard?.read) {
        setError("Press Cmd/Ctrl+V to paste your screenshot.");
        return;
      }
      const items = await anyNav.clipboard.read();
      for (const it of items) {
        const type = it.types.find((t) => t.startsWith("image/"));
        if (type) {
          const blob = await it.getType(type);
          emit(new File([blob], stampName("pasted"), { type: blob.type || "image/png" }));
          return;
        }
      }
      setError("No image in the clipboard yet. Take a screenshot, then click Paste.");
    } catch {
      setError("Clipboard access was blocked — press Cmd/Ctrl+V instead.");
    }
  }, [emit]);

  /* ---- region marking (drag a rectangle over the frozen frame) -------- */
  const clampToImage = (clientX: number, clientY: number) => {
    const r = imgRef.current?.getBoundingClientRect();
    if (!r) return { x: clientX, y: clientY };
    return {
      x: Math.min(Math.max(clientX, r.left), r.right),
      y: Math.min(Math.max(clientY, r.top), r.bottom),
    };
  };

  const onDown = (e: React.MouseEvent) => {
    if (stage !== "marking") return;
    const p = clampToImage(e.clientX, e.clientY);
    dragStart.current = p;
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const onMove = (e: React.MouseEvent) => {
    if (!dragStart.current) return;
    const p = clampToImage(e.clientX, e.clientY);
    const s = dragStart.current;
    setSel({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  };
  const onUp = () => {
    dragStart.current = null;
    if (sel && (sel.w < 5 || sel.h < 5)) setSel(null);
  };

  const confirmCrop = useCallback(() => {
    const img = imgRef.current;
    if (!img || !frame || !sel || sel.w < 5 || sel.h < 5) return;
    const r = img.getBoundingClientRect();
    const scaleX = frame.w / r.width;
    const scaleY = frame.h / r.height;
    const sx = Math.max(0, (sel.x - r.left) * scaleX);
    const sy = Math.max(0, (sel.y - r.top) * scaleY);
    const sw = Math.min(frame.w - sx, sel.w * scaleX);
    const sh = Math.min(frame.h - sy, sel.h * scaleY);
    if (sw < 1 || sh < 1) return;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) emit(new File([blob], stampName("screenshot"), { type: "image/png" }));
    }, "image/png");
  }, [frame, sel, emit]);

  if (!mounted || !open) return null;

  const hasSel = !!sel && sel.w > 4 && sel.h > 4;

  /* ---- MARKING: full-screen frozen frame + marquee -------------------- */
  if (stage === "marking" && frame) {
    return createPortal(
      <div
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2147483000,
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "crosshair",
          userSelect: "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={frame.url}
          alt=""
          draggable={false}
          style={{ maxWidth: "100vw", maxHeight: "100vh", objectFit: "contain", pointerEvents: "none" }}
        />

        {/* Dim everything until the user starts marking. */}
        {!hasSel && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", pointerEvents: "none" }} />
        )}

        {/* Selection rectangle — box-shadow spotlights it (dims the rest). */}
        {sel && (
          <div
            style={{
              position: "fixed",
              left: sel.x,
              top: sel.y,
              width: sel.w,
              height: sel.h,
              border: `1.5px solid ${ACCENT}`,
              boxShadow: "0 0 0 100vmax rgba(0,0,0,0.45)",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Hint while idle. */}
        {!hasSel && (
          <div
            style={{
              position: "fixed",
              top: 18,
              left: "50%",
              transform: "translateX(-50%)",
              padding: "8px 16px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.75)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              pointerEvents: "none",
            }}
          >
            Drag to mark the area you want · Esc to cancel
          </div>
        )}

        {/* Confirm toolbar near the bottom-right of the selection. */}
        {hasSel && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              left: Math.max(8, Math.min(sel!.x + sel!.w - 150, window.innerWidth - 158)),
              top: Math.min(sel!.y + sel!.h + 8, window.innerHeight - 48),
              display: "flex",
              gap: 8,
              padding: 6,
              borderRadius: 10,
              background: "#0D0D0D",
              border: "1px solid #2E2E2E",
              boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
            }}
          >
            <button
              type="button"
              onClick={() => setSel(null)}
              style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Redo
            </button>
            <button
              type="button"
              onClick={confirmCrop}
              style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${ACCENT}`, background: ACCENT, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Use selection
            </button>
          </div>
        )}

        {/* Always-available exits, top-right. */}
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: "fixed", top: 14, right: 16, display: "flex", gap: 8 }}
        >
          <button
            type="button"
            onClick={() => void startCapture()}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            Re-capture
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  /* ---- STARTING / ERROR: small centered dialog ------------------------ */
  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "min(440px, 92vw)", background: "#0D0D0D", border: "1px solid #2E2E2E", borderRadius: 16, padding: 22, color: "#fff", textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Capture a screenshot</div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, margin: "0 0 18px" }}>
          {stage === "starting"
            ? "Choose the screen or window to capture in the prompt — then drag to mark the part you want."
            : error}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={pasteFromClipboard}
            style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Paste from clipboard
          </button>
          <button
            type="button"
            onClick={() => void startCapture()}
            style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${ACCENT}`, background: stage === "error" ? "transparent" : ACCENT, color: stage === "error" ? ACCENT : "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {stage === "error" ? "Try again" : "Choosing…"}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
