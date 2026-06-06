"use client";

/* ---------------------------------------------------------------------------
   QaFocusHighlight — when a user arrives on a page via "Open Route" from the
   QA console, the URL carries QA params:
     • qa_issue  — the issue id (always, so we can show an arrival banner)
     • qa_title  — short issue title (for the banner text)
     • qa_focus  — the picked component name (only when one was pinned)

   Behaviour:
     • If a component was pinned AND a matching [data-kx-component] is found,
       scroll to it and draw an emerald ring + label.
     • Always show a top banner identifying the issue so the user knows they
       arrived via QA and what to look for (issue 46dba6b3 follow-up).
     • CAPTURE AFTER: the banner has a one-click button that html2canvas-es
       the CURRENT page (the real affected route, not the QA console),
       uploads it via the existing /api/qa/upload pipeline, and attaches it
       as an AFTER fix-evidence cycle on the issue — so the BEFORE/AFTER
       comparison fills with a real screenshot of the real page. This is how
       before/after photos actually get created for AI-applied fixes (the AI
       has no browser; a human on the page captures in one click).
     • Skips the QA console + reporter view (no self-highlight / self-capture).
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

const RING_MS = 6000;
const RETRY_BUDGET_MS = 5000;
const RETRY_INTERVAL = 250;

interface Box { top: number; left: number; width: number; height: number; label: string }
type CaptureState = "idle" | "capturing" | "done" | "error";

export default function QaFocusHighlight() {
  const pathname = usePathname() ?? "";
  const sp = useSearchParams();
  const router = useRouter();
  const focus = sp.get("qa_focus");
  const issueId = sp.get("qa_issue");
  const title = sp.get("qa_title");
  const [box, setBox] = useState<Box | null>(null);
  const [banner, setBanner] = useState<{ matched: boolean } | null>(null);
  const [capture, setCapture] = useState<CaptureState>("idle");
  const [captureMsg, setCaptureMsg] = useState<string | null>(null);

  const skip = pathname.startsWith("/database/issues") || pathname.startsWith("/qa/report");
  const active = !skip && (!!issueId || !!focus);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const startedAt = Date.now();
    const target = (focus ?? "").toLowerCase();

    const findEl = (): HTMLElement | null => {
      if (!focus) return null;
      const tagged = document.querySelector<HTMLElement>(`[data-kx-component="${CSS.escape(focus)}"]`);
      if (tagged) return tagged;
      const all = Array.from(document.querySelectorAll<HTMLElement>("[data-kx-component]"));
      for (const el of all) {
        const v = el.getAttribute("data-kx-component")?.toLowerCase() ?? "";
        if (v && (v === target || v.startsWith(target) || target.startsWith(v))) return el;
      }
      return null;
    };

    const scrub = () => {
      const params = new URLSearchParams(sp.toString());
      params.delete("qa_focus"); params.delete("qa_issue"); params.delete("qa_title");
      const qs = params.toString();
      try { router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }); } catch { /* keep */ }
    };

    const tick = () => {
      if (cancelled) return;
      const el = findEl();
      if (el) {
        try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* noop */ }
        const r = el.getBoundingClientRect();
        setBox({ top: r.top, left: r.left, width: r.width, height: r.height, label: el.getAttribute("data-kx-component") || (focus ?? "") });
        setBanner({ matched: true });
        window.setTimeout(() => { if (!cancelled) setBox(null); }, RING_MS);
        // NOTE: banner does NOT auto-dismiss — it holds the Capture AFTER
        // button. The user dismisses it manually (or after capturing).
        return;
      }
      if (Date.now() - startedAt < RETRY_BUDGET_MS) {
        window.setTimeout(tick, RETRY_INTERVAL);
        return;
      }
      setBanner({ matched: false });
    };
    tick();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, focus, pathname]);

  useEffect(() => {
    if (!box) return;
    const reposition = () => {
      const el = document.querySelector<HTMLElement>(`[data-kx-component="${CSS.escape(box.label)}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setBox((prev) => prev ? { ...prev, top: r.top, left: r.left, width: r.width, height: r.height } : prev);
    };
    window.addEventListener("scroll", reposition, { passive: true });
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition);
      window.removeEventListener("resize", reposition);
    };
  }, [box]);

  /* Capture the current page → upload → attach as AFTER evidence on the issue.
     Uses the same html2canvas-pro + /api/qa/upload pipeline as the reporter
     capture; skips [data-qa-capture-skip] so this banner/ring don't appear. */
  const captureAfter = async () => {
    if (!issueId || capture === "capturing") return;
    setCapture("capturing"); setCaptureMsg(null);
    // Hide the ring during capture so it isn't baked into the shot.
    setBox(null);
    try {
      // Let React paint the hidden state before capturing.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const mod = await import("html2canvas-pro");
      const html2canvas = mod.default;
      const canvas = await html2canvas(document.body, {
        backgroundColor: getComputedStyle(document.body).backgroundColor || "#0d0d0d",
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        logging: false,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight,
        x: window.scrollX,
        y: window.scrollY,
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
        ignoreElements: (n) => (n as HTMLElement).hasAttribute?.("data-qa-capture-skip"),
      });
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("Could not render the page.");

      // 1) Upload via the existing QA upload endpoint.
      const fd = new FormData();
      fd.append("file", new File([blob], `after-${Date.now()}.png`, { type: "image/png" }));
      const up = await fetch("/api/qa/upload", { method: "POST", body: fd });
      const upJson = (await up.json().catch(() => null)) as { path?: string; error?: string } | null;
      if (!up.ok || !upJson?.path) throw new Error(`${upJson?.error || "Upload failed"} (HTTP ${up.status})`);

      // 2) Attach as a new AFTER fix-evidence cycle on the issue.
      const ev = await fetch(`/api/qa/reports/${issueId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: `AFTER capture from ${pathname}`,
          after_attachments: [{ path: upJson.path, type: "image/png", size: blob.size, label: "AFTER" }],
        }),
      });
      const evJson = (await ev.json().catch(() => null)) as { error?: string } | null;
      if (!ev.ok) throw new Error(`${evJson?.error || "Could not attach evidence"} (HTTP ${ev.status})`);

      setCapture("done");
      setCaptureMsg("AFTER screenshot attached to the issue.");
    } catch (e) {
      setCapture("error");
      setCaptureMsg(e instanceof Error ? e.message : "Capture failed.");
    }
  };

  if (!box && !banner) return null;

  return (
    <>
      {box && (
        <div data-qa-capture-skip="" aria-hidden className="pointer-events-none fixed inset-0 z-[180]">
          <div
            className="absolute rounded-[6px] ring-4 ring-emerald-500 ring-offset-2 ring-offset-[var(--bg-primary)] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] transition-all"
            style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
          />
          <div
            className="absolute -translate-y-full rounded-md border border-emerald-500 bg-emerald-600 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg"
            style={{ top: Math.max(8, box.top - 8), left: Math.max(8, box.left) }}
          >
            QA fix · {box.label}
          </div>
        </div>
      )}

      {banner && (
        <div
          data-qa-capture-skip=""
          className="fixed left-1/2 top-3 z-[190] flex max-w-[92vw] -translate-x-1/2 flex-col gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/97 px-4 py-2.5 shadow-2xl backdrop-blur-md"
          role="status"
        >
          <div className="flex items-start gap-3">
            <span aria-hidden className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${banner.matched ? "bg-emerald-500" : "bg-amber-500"}`} />
            <div className="min-w-0">
              <div className="text-[12px] font-bold text-[var(--text-primary)]">
                QA — verifying issue{issueId ? ` #${issueId.slice(0, 6)}` : ""}
              </div>
              <div className="text-[11.5px] leading-snug text-[var(--text-secondary)]">
                {title ? `“${decodeURIComponent(title)}”` : "Reported on this page."}
                {banner.matched
                  ? " — the reported element is outlined below."
                  : " — no specific element was pinned; review this page."}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBanner(null)}
              aria-label="Dismiss"
              className="ms-1 shrink-0 rounded-md px-1.5 text-[13px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
            >
              ✕
            </button>
          </div>

          {/* Capture AFTER — only when we know the issue id. Produces a real
              screenshot of THIS page and attaches it to the issue's evidence. */}
          {issueId && (
            <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] pt-2">
              <button
                type="button"
                onClick={captureAfter}
                disabled={capture === "capturing" || capture === "done"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                </svg>
                {capture === "capturing" ? "Capturing…" : capture === "done" ? "Captured ✓" : "Capture AFTER"}
              </button>
              {captureMsg && (
                <span className={`text-[11px] ${capture === "error" ? "text-rose-500" : "text-[var(--text-secondary)]"}`}>{captureMsg}</span>
              )}
              {capture === "idle" && !captureMsg && (
                <span className="text-[11px] text-[var(--text-dim)]">Snaps this page as the “after” evidence.</span>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
