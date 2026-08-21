"use client";

/* ---------------------------------------------------------------------------
   ViewTransitions — cross-fade the app↔Home navigation.

   THE COMPLAINT (owner, on an iPad 11" in portrait): "when I press app then
   press back to home page the transition between enter the app and back to
   home page not so soft and look jump, not smooth and ease enough."

   He read it exactly right, and the two directions were not symmetrical:
   entering an app has AppLaunchSplash (a designed brand moment, shown once
   the route takes longer than 120ms), while coming back to Home had NOTHING
   — the App Router swaps the tree and the new page simply appears. On a fast
   link the entry splash never shows either, so both directions were a hard
   cut.

   WHY THIS AND NOT React's <ViewTransition>: Next 16 accepts the
   `viewTransition` config flag, but the component ships only in React canary
   — React 19.2.4 (what we run) does not export it. So this drives the
   browser's own API directly.

   HOW: one capture-phase click listener on the document. A plain left-click
   on an in-app link runs the App Router push INSIDE
   document.startViewTransition(), so the browser snapshots the old page,
   commits the new one, and cross-fades between them. Everything the browser
   or the user might mean differently — new tab, modifier keys, downloads,
   external hosts, hash-only jumps — is left completely alone.

   Unsupported engines (Firefox today) fall through to the normal navigation
   with no behavioural change at all: the feature is additive by construction.

   The animation itself lives in globals.css so it can use the Aurora curve
   and honour prefers-reduced-motion in one place.
   --------------------------------------------------------------------------- */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type DocWithVT = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => {
    finished: Promise<void>;
    ready?: Promise<void>;
    updateCallbackDone?: Promise<void>;
  };
};

export default function ViewTransitions() {
  const router = useRouter();

  useEffect(() => {
    const doc = document as DocWithVT;
    if (typeof doc.startViewTransition !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onClick = (e: MouseEvent) => {
      /* Anything but a plain primary click means something else entirely —
         open in new tab, save, context menu. Never intercept those. */
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const a = (e.target as Element | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      /* Opt-out hatch for any link that owns its own transition. */
      if (a.hasAttribute("data-no-view-transition")) return;

      let url: URL;
      try { url = new URL(href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
      /* Same page — nothing to cross-fade, and starting a transition here
         would flash the identical screen. */
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      e.preventDefault();
      const vt = doc.startViewTransition!(() => {
        router.push(url.pathname + url.search + url.hash);
      });
      /* An aborted transition REJECTS these promises — and something on this
         shell aborts them routinely: the return-flight card mutates the DOM
         mid-snapshot, a second navigation lands, the tab hides. All of that
         is fine (the navigation itself already happened); the rejection is
         only noise — but UNCAUGHT it surfaced as "InvalidStateError:
         Transition was aborted" on every back-to-Home, which is the red
         "1 Issue" badge the owner screenshotted twice. Swallow all three. */
      vt.finished?.catch(() => {});
      vt.ready?.catch(() => {});
      vt.updateCallbackDone?.catch(() => {});
    };

    /* Capture phase so we decide before React's own handler runs; the
       listener is passive-unfriendly by nature (it calls preventDefault),
       so it must not be registered as passive. */
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}
