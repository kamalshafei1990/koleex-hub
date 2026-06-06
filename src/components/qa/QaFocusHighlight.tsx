"use client";

/* ---------------------------------------------------------------------------
   QaFocusHighlight — when a user arrives on a page via "Open Route" from the
   QA console, the URL carries QA params:
     • qa_issue  — the issue id (always, so we can show an arrival banner)
     • qa_title  — short issue title (for the banner text)
     • qa_focus  — the picked component name (only when one was pinned)

   Behaviour:
     • If a component was pinned AND a matching [data-kx-component] is found,
       scroll to it and draw an emerald ring + label for ~6s.
     • If NO component matches (whole-page report, approximate fallback, or
       untagged element), STILL show a top banner identifying the issue so the
       user knows they arrived via QA and what to look for — previously this
       case marked nothing at all (issue 46dba6b3 follow-up).
     • Banner stays ~9s with a manual dismiss; both auto-dismiss.
     • Query params are scrubbed after first handling so a reload doesn't
       re-trigger.
     • Skips the QA console + reporter view (no self-highlight).
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

const RING_MS = 6000;
const BANNER_MS = 9000;
const RETRY_BUDGET_MS = 5000;
const RETRY_INTERVAL = 250;

interface Box { top: number; left: number; width: number; height: number; label: string }

export default function QaFocusHighlight() {
  const pathname = usePathname() ?? "";
  const sp = useSearchParams();
  const router = useRouter();
  const focus = sp.get("qa_focus");
  const issueId = sp.get("qa_issue");
  const title = sp.get("qa_title");
  const [box, setBox] = useState<Box | null>(null);
  const [banner, setBanner] = useState<{ matched: boolean } | null>(null);

  // Don't run on the QA console / reporter view themselves.
  const skip = pathname.startsWith("/database/issues") || pathname.startsWith("/qa/report");
  // Trigger if EITHER param is present (qa_issue alone is enough for the banner).
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
        window.setTimeout(() => { if (!cancelled) setBanner(null); }, BANNER_MS);
        scrub();
        return;
      }
      // Keep retrying for the ring until the budget elapses…
      if (Date.now() - startedAt < RETRY_BUDGET_MS) {
        window.setTimeout(tick, RETRY_INTERVAL);
        return;
      }
      // …budget exhausted with no element match: show the context banner
      // anyway so the user isn't left wondering why nothing was marked.
      setBanner({ matched: false });
      window.setTimeout(() => { if (!cancelled) setBanner(null); }, BANNER_MS);
      scrub();
    };
    tick();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, focus, pathname]);

  // Reposition the ring on scroll/resize while it's visible.
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

  if (!box && !banner) return null;

  return (
    <>
      {/* Ring around the matched component (only when one was found). */}
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

      {/* Arrival banner — always shown when we came via QA, even with no
          component match. Tells the user which issue they're verifying. */}
      {banner && (
        <div
          data-qa-capture-skip=""
          className="fixed left-1/2 top-3 z-[190] flex max-w-[92vw] -translate-x-1/2 items-start gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/97 px-4 py-2.5 shadow-2xl backdrop-blur-md"
          role="status"
        >
          <span aria-hidden className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${banner.matched ? "bg-emerald-500" : "bg-amber-500"}`} />
          <div className="min-w-0">
            <div className="text-[12px] font-bold text-[var(--text-primary)]">
              QA — verifying issue{issueId ? ` #${issueId.slice(0, 6)}` : ""}
            </div>
            <div className="text-[11.5px] leading-snug text-[var(--text-secondary)]">
              {title ? `“${decodeURIComponent(title)}”` : "Reported on this page."}
              {banner.matched
                ? " — the reported element is outlined below."
                : " — no specific element was pinned; review this page and compare the reported screenshot."}
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
      )}
    </>
  );
}
