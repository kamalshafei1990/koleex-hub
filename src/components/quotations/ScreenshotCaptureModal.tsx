"use client";

/* ---------------------------------------------------------------------------
   ScreenshotCaptureModal — lets the user grab an image straight from their
   screen (or clipboard) and hand it back as a File, so it can flow through
   the exact same upload pipeline as a picked file.

   Two paths, both ending in onCapture(file):
     1. Screen capture (navigator.mediaDevices.getDisplayMedia) — the user
        picks a screen / window / tab in the browser's native sheet, arranges
        what they want, then clicks Capture; we grab that video frame to a
        canvas → PNG File.
     2. Clipboard paste — for the common "Cmd/Ctrl+Shift+4 → region to
        clipboard" flow: a Paste button + a global paste listener.

   Rendered through a portal to <body> so it's never clipped by a transformed
   ancestor (the editor's animated containers). Cleans up the media stream on
   close / unmount / when the user stops sharing from the browser UI.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Stage = "starting" | "preview" | "error";

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stopStream = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const close = useCallback(() => {
    stopStream();
    onClose();
  }, [stopStream, onClose]);

  /* Filenames carry a timestamp; computed at call time (not render) so it's
     fine in a client component. */
  const stampName = (prefix: string) => `${prefix}-${Date.now()}.png`;

  const emit = useCallback(
    (file: File) => {
      stopStream();
      onCapture(file);
      onClose();
    },
    [stopStream, onCapture, onClose],
  );

  /* Kick off screen capture as soon as the modal opens — the native picker
     appears immediately, which is the smoothest flow. */
  const startCapture = useCallback(async () => {
    setError(null);
    setStage("starting");
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!md || typeof md.getDisplayMedia !== "function") {
      setStage("error");
      setError(
        "This browser can't capture the screen here. You can still take a screenshot with your OS (Cmd/Ctrl+Shift+4) and click “Paste from clipboard”.",
      );
      return;
    }
    try {
      const stream = await md.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => {});
      }
      // If the user ends sharing from the browser's own control, bail out.
      const track = stream.getVideoTracks()[0];
      if (track) track.addEventListener("ended", () => close());
      setStage("preview");
    } catch {
      // User cancelled the picker or denied permission.
      setStage("error");
      setError("Screen capture was cancelled. Try again, or paste a screenshot from your clipboard.");
    }
  }, [close]);

  useEffect(() => {
    if (!open) return;
    void startCapture();
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Esc closes; global paste while open grabs an image from the clipboard. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
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
  }, [open, close, emit]);

  const capture = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) emit(new File([blob], stampName("screenshot"), { type: "image/png" }));
      },
      "image/png",
    );
  }, [emit]);

  const pasteFromClipboard = useCallback(async () => {
    setError(null);
    try {
      // navigator.clipboard.read is the explicit-permission path (Chrome).
      const anyNav = navigator as Navigator & { clipboard?: { read?: () => Promise<ClipboardItem[]> } };
      if (!anyNav.clipboard?.read) {
        setError("Press Cmd/Ctrl+V to paste your screenshot, or use Screen Capture.");
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
      setError("No image in the clipboard yet. Take a screenshot (Cmd/Ctrl+Shift+4) then click Paste.");
    } catch {
      setError("Clipboard access was blocked — press Cmd/Ctrl+V instead, or use Screen Capture.");
    }
  }, [emit]);

  if (!mounted || !open) return null;

  const btnBase: React.CSSProperties = {
    padding: "10px 18px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "transparent",
    color: "rgba(255,255,255,0.85)",
  };

  return createPortal(
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          width: "min(760px, 94vw)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          background: "#0D0D0D",
          border: "1px solid #2E2E2E",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid #2E2E2E",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "0.01em" }}>
            Capture a screenshot
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{ ...btnBase, padding: "4px 10px", fontSize: 16, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* body */}
        <div style={{ padding: 18, flex: 1, minHeight: 0, overflow: "auto" }}>
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              background: "#111",
              border: "1px solid #2E2E2E",
              borderRadius: 10,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* live preview of the shared screen */}
            <video
              ref={videoRef}
              muted
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: stage === "preview" ? "block" : "none",
                background: "#000",
              }}
            />
            {stage !== "preview" && (
              <div style={{ textAlign: "center", padding: 24, maxWidth: 460 }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
                  {stage === "starting"
                    ? "Choose the screen, window, or tab to capture in the prompt…"
                    : error}
                </div>
              </div>
            )}
          </div>

          <p
            style={{
              margin: "12px 2px 0",
              fontSize: 12,
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.6,
            }}
          >
            Pick a window or your whole screen, arrange what you want, then{" "}
            <b style={{ color: "rgba(255,255,255,0.8)" }}>Capture</b>. Or take an OS screenshot to
            your clipboard and <b style={{ color: "rgba(255,255,255,0.8)" }}>Paste</b> it.
          </p>
        </div>

        {/* footer actions */}
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            flexWrap: "wrap",
            padding: "14px 18px",
            borderTop: "1px solid #2E2E2E",
          }}
        >
          <button type="button" onClick={pasteFromClipboard} style={btnBase}>
            Paste from clipboard
          </button>
          {stage === "error" ? (
            <button
              type="button"
              onClick={() => void startCapture()}
              style={{ ...btnBase, border: "1px solid #3385FF", color: "#3385FF" }}
            >
              Try screen capture again
            </button>
          ) : (
            <button
              type="button"
              onClick={capture}
              disabled={stage !== "preview"}
              style={{
                ...btnBase,
                border: "1px solid #0066FF",
                background: stage === "preview" ? "#0066FF" : "rgba(0,102,255,0.35)",
                color: "#fff",
                cursor: stage === "preview" ? "pointer" : "not-allowed",
              }}
            >
              Capture
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
