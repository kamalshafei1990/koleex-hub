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
import { getActiveAppId } from "@/lib/navigation";

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

      /* ── THE SLIDING DOOR, LIVE-DOM EDITION ────────────────────────────
         Owner pick #12, fourth architecture, and the reason for the fourth:
         the VT-snapshot version stalled at its FIRST frame — capturing a
         full-page snapshot and rendering Home inside the transition
         callback blocks the main thread, and no easing curve can hide a
         hitch at frame one ("still no good"). So no snapshots at all: the
         LIVE scroller — the app's actual, still-mounted screen — slides
         fully off on the compositor; in the off-screen beat only the aurora
         ground breathes (that gap is a feature, not a flaw: a clean breath
         between rooms); the route commits while nothing is on stage; and
         the freshly-mounted Home slides in from the other side. Every
         frame animates a live layer; nothing is captured, nothing stalls.

         Geometry guards: the shell clips horizontally during the flight
         (html[data-kx-door] rule) so the 112% travel can never grow a
         scrollbar — the no-dancing rule; direction follows dir (RTL
         mirrors); a 1.6s failsafe strips transform + flag so no failure
         mode can strand the page off-screen. */
      const homeReturn = url.pathname === "/" && !!getActiveAppId(window.location.pathname);
      const stage = homeReturn ? document.getElementById("main-scroll-container") : null;
      if (homeReturn && stage && document.documentElement.dataset.kxDoor !== "1") {
        const html = document.documentElement;
        html.dataset.kxDoor = "1";
        const dir = html.dir === "rtl" ? -1 : 1;
        const cleanup = () => {
          stage.getAnimations().forEach((a) => a.cancel());
          stage.style.transform = "";
          delete html.dataset.kxDoor;
        };
        const failsafe = window.setTimeout(cleanup, 1600);
        const out = stage.animate(
          [
            { transform: "translateX(0%)" },
            { transform: `translateX(${dir * 112}%)` },
          ],
          { duration: 380, easing: "cubic-bezier(0.5, 0, 0.7, 0.6)", fill: "forwards" },
        );
        out.onfinish = () => {
          router.push(url.pathname + url.search + url.hash);
          /* Wait for Home to COMMIT (its stage marker exists), then slide it
             in. rAF poll, bounded by the failsafe above. */
          const deadline = performance.now() + 1100;
          const arrive = () => {
            const committed =
              window.location.pathname === "/" && document.querySelector("[data-kx-home-stage]");
            if (!committed && performance.now() < deadline) {
              requestAnimationFrame(arrive);
              return;
            }
            const inn = stage.animate(
              [
                { transform: `translateX(${dir * -64}%)`, opacity: 0.6 },
                { transform: "translateX(0%)", opacity: 1 },
              ],
              { duration: 520, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
            );
            inn.onfinish = () => { window.clearTimeout(failsafe); cleanup(); };
          };
          requestAnimationFrame(arrive);
        };
        return;
      }

      const vt = doc.startViewTransition!(() => {
        router.push(url.pathname + url.search + url.hash);
      });
      /* Aborted transitions REJECT these promises (second nav, tab hide…);
         the navigation itself already happened, so the rejection is pure
         noise — but uncaught noise raised the dev overlay's red badge. */
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
