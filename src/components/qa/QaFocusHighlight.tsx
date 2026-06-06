"use client";

/* ---------------------------------------------------------------------------
   QaFocusHighlight — when a user arrives on a page via "Open Route" from the
   QA console, the URL carries `?qa_focus=<component name>`. This client
   component scans the DOM for the matching [data-kx-component] (or, as a
   fallback, the first element whose text starts with the focus string),
   scrolls it into view, and draws an attention-grabbing outline + label for
   ~6 seconds. Then it auto-dismisses.

   Mounted globally (RootShell) so every authenticated page benefits.
   Defence-in-depth:
     • bail silently on the QA console itself (no recursion / self-highlight)
     • bail when there's no qa_focus param
     • bail when DOM has nothing matching after a short retry budget
     • scrub the query params from the URL after highlighting so a reload
       doesn't re-trigger
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

const HIGHLIGHT_MS = 6000;
const RETRY_BUDGET_MS = 5000;
const RETRY_INTERVAL = 250;

interface Box { top: number; left: number; width: number; height: number; label: string }

export default function QaFocusHighlight() {
  const pathname = usePathname() ?? "";
  const sp = useSearchParams();
  const router = useRouter();
  const focus = sp.get("qa_focus");
  const issueId = sp.get("qa_issue");
  const [box, setBox] = useState<Box | null>(null);

  // Hide when we're on the QA console itself.
  const skip = pathname.startsWith("/database/issues") || pathname.startsWith("/qa/report");

  useEffect(() => {
    if (skip || !focus) return;
    let cancelled = false;
    const startedAt = Date.now();
    const target = focus.toLowerCase();

    const findEl = (): HTMLElement | null => {
      // Preferred: exact data-kx-component match.
      const tagged = document.querySelector<HTMLElement>(`[data-kx-component="${CSS.escape(focus)}"]`);
      if (tagged) return tagged;
      // Loose match — case-insensitive contains. Useful when reporter picked
      // an untagged element and the inspector used its text content.
      const all = Array.from(document.querySelectorAll<HTMLElement>("[data-kx-component]"));
      for (const el of all) {
        const v = el.getAttribute("data-kx-component")?.toLowerCase() ?? "";
        if (v && (v === target || v.startsWith(target) || target.startsWith(v))) return el;
      }
      return null;
    };

    const tick = () => {
      if (cancelled) return;
      const el = findEl();
      if (el) {
        try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* noop */ }
        const r = el.getBoundingClientRect();
        setBox({
          top: r.top, left: r.left, width: r.width, height: r.height,
          label: el.getAttribute("data-kx-component") || focus,
        });
        // Auto-dismiss + scrub the URL so a reload doesn't re-trigger.
        window.setTimeout(() => { if (!cancelled) setBox(null); }, HIGHLIGHT_MS);
        const params = new URLSearchParams(sp.toString());
        params.delete("qa_focus");
        params.delete("qa_issue");
        const qs = params.toString();
        try {
          router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
        } catch { /* keep state if router fails */ }
        return;
      }
      if (Date.now() - startedAt < RETRY_BUDGET_MS) {
        window.setTimeout(tick, RETRY_INTERVAL);
      }
    };
    tick();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, skip, pathname]);

  // Reposition on window resize / scroll while the highlight is up.
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

  if (!box) return null;

  return (
    <div
      data-qa-capture-skip=""
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[180]"
    >
      {/* Outline */}
      <div
        className="absolute rounded-[6px] ring-4 ring-emerald-500 ring-offset-2 ring-offset-[var(--bg-primary)] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] transition-all"
        style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
      />
      {/* Floating label */}
      <div
        className="absolute -translate-y-full rounded-md border border-emerald-500 bg-emerald-600 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg"
        style={{ top: Math.max(8, box.top - 8), left: Math.max(8, box.left) }}
      >
        QA fix · {box.label}
        {issueId ? <span className="ms-2 opacity-80">#{issueId.slice(0, 6)}</span> : null}
      </div>
    </div>
  );
}
