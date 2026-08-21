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

    /* THE ONE GUARANTEED EXIT for the door. The choreography below holds
       the live stage off-screen (fill: forwards) between the out and the
       in — and the owner caught the failure class this creates: any path
       that skips the release leaves a BLACK page (Home mounted, stage —
       and the aurora ground inside it — parked at 112%) that only a
       refresh could fix. So one idempotent restore, converged on from
       EVERY terminal: arrival finish, arrival cancel, the armed failsafe,
       and — crucially — the top of the NEXT click, so even an unforeseen
       path self-heals the moment the user touches anything. Cancelling
       animations and clearing inline styles is safe at any moment,
       including after a clean finish. */
    /* When the current door flight began, and how long a door may legally
       be up before the next click treats it as stuck. */
    let doorStartedAt = 0;
    const DOOR_STUCK_MS = 1600;
    /* Generation token for the directional-nav attribute: a second
       navigation ABORTS the first, whose rejected `finished` promise then
       settles a microtask later and would strip the attribute the SECOND
       nav just set — the push would silently degrade mid-flight. Only the
       newest navigation may clear it. */
    let navGen = 0;

    const restoreDoor = () => {
      const st = document.getElementById("main-scroll-container");
      if (st) {
        st.getAnimations().forEach((a) => a.cancel());
        st.style.transform = "";
        st.style.opacity = "";
      }
      delete document.documentElement.dataset.kxDoor;
    };

    const onClick = (e: MouseEvent) => {
      /* A stuck door heals on the very next interaction — but ONLY once it
         is genuinely stuck. Healing unconditionally cancelled healthy
         in-flight doors: router.push lives in the exit animation's
         onfinish, and a cancelled animation never finishes, so a stray tap
         within the 380ms flight silently swallowed the whole navigation
         (owner-visible as "back does nothing"). Past the failsafe window
         it is stuck by definition. */
      if (
        document.documentElement.dataset.kxDoor === "1" &&
        performance.now() - doorStartedAt > DOOR_STUCK_MS
      ) restoreDoor();

      /* The Hub's own Reduce-motion preference lives on a class, and it is
         read PER CLICK: the media check below runs once at bind time, so a
         user toggling the pref mid-session kept every flight. Also, the
         `.kx-reduce-motion *` nuke is a DESCENDANT selector and can never
         reach ::view-transition-* pseudo-elements, which hang off <html> —
         so these transitions have to bail in JS, not in CSS. */
      if (document.documentElement.classList.contains("kx-reduce-motion")) return;
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
        doorStartedAt = performance.now();
        const dir = html.dir === "rtl" ? -1 : 1;
        const failsafe = window.setTimeout(restoreDoor, 1600);
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
          const deadline = performance.now() + 1000;
          const arrive = () => {
            const committed =
              window.location.pathname === "/" && document.querySelector("[data-kx-home-stage]");
            if (!committed && performance.now() < deadline) {
              requestAnimationFrame(arrive);
              return;
            }
            /* Home SETTLES, it does not slide (owner, twice: "I don't want
               the home page motion slide"). The app LEAVES with motion; the
               place you return to is already where it belongs — it comes
               into focus: fade up from a 12px rise, the shell's standard
               arrival language one size larger.

               CANCEL THE OUT FIRST, in this exact order. `out` holds the
               stage at 112% with fill:forwards; while `inn` runs it wins
               the composite, but the moment `inn` FINISHES (it has no
               fill), the out's held transform would RESUME for the frame
               before cleanup lands — a full-screen flash off-screen right.
               Killing the hold before starting the arrival removes that
               frame entirely; `inn`'s own first keyframe (opacity 0)
               covers the same instant, so nothing flashes at X=0 either. */
            out.cancel();
            stage.style.transform = "";
            const inn = stage.animate(
              [
                { transform: "translateY(12px) scale(0.992)", opacity: 0 },
                { transform: "translateY(0) scale(1)", opacity: 1 },
              ],
              { duration: 460, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
            );
            inn.onfinish = () => { window.clearTimeout(failsafe); restoreDoor(); };
            inn.oncancel = () => { window.clearTimeout(failsafe); restoreDoor(); };
          };
          requestAnimationFrame(arrive);
        };
        return;
      }

      /* Directional page push (owner pick 4A, motion system 2026-08-21):
         opening a RECORD from a list pushes the content area in from the
         side with the old page sliding under in parallax; going back up
         pops it the other way. Everything else keeps the plain cross-fade.
         The attribute scopes the ::view-transition CSS in globals; only the
         #main-scroll-container group slides — the shell header holds
         still. RTL flips in CSS.

         ⚠️ PATH DEPTH ALONE IS NOT A DRILL-IN. Apps like Purchases and
         Inventory build their TAB BAR out of real sub-routes
         (/purchase → /purchase/orders → /purchase/rfqs), so a pure
         "target extends current" test made one tab bar produce three
         different motions — a full sideways push from the home tab, a
         plain fade between tabs, a pop on the way back. Owner, on both
         apps: "the motion and navigation is totally wrong".

         So a destination that any TAB/NAV on this page points at is a
         lateral move by definition, however deep its path looks. That
         covers both the tab itself and a shortcut card aimed at the same
         place, which is what keeps one destination feeling like one
         thing. */
      const cur = window.location.pathname.replace(/\/$/, "");
      const tgt = url.pathname.replace(/\/$/, "");
      const navHost = a.closest('nav, [role="tablist"]');
      let isNavDestination = !!navHost || !!a.closest('[role="navigation"], aside');
      if (!isNavDestination) {
        for (const link of document.querySelectorAll<HTMLAnchorElement>(
          'nav a[href], [role="tablist"] a[href], [role="navigation"] a[href]',
        )) {
          const p = link.getAttribute("href");
          if (!p || !p.startsWith("/")) continue;
          if (p.replace(/\/$/, "").split("?")[0] === tgt) { isNavDestination = true; break; }
        }
      }

      /* A ROUTE-BASED TAB BAR STILL DESERVES THE TAB MOTION.
         Apps like Inventory and Purchases build their tab strip out of real
         sub-routes, so treating those clicks as plain navigations left them
         with only the root cross-fade — which reads as nothing at all
         (owner: "there is no motion when I switch from tab to another, I
         want it same as Product Data"). Product Data's tabs are component
         state, so their direction comes from the tab INDEX; do the same
         here and the two feel identical. Index, not path depth: depth is
         what made one tab bar play three different motions. */
      let tabDir = "";
      if (navHost) {
        const items = [...navHost.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')];
        const to = items.indexOf(a as HTMLAnchorElement);
        let from = items.findIndex((l) => l.getAttribute("aria-selected") === "true");
        if (from < 0) from = items.findIndex((l) => (l.getAttribute("href") || "").replace(/\/$/, "") === cur);
        if (to >= 0 && from >= 0 && to !== from) tabDir = to > from ? "tab-fwd" : "tab-back";
      }

      const nav = tabDir ? tabDir
        : isNavDestination ? ""
        : tgt.startsWith(cur + "/") ? "fwd"
        : cur.startsWith(tgt + "/") ? "back"
        : "";
      const myGen = ++navGen;
      const clearNav = () => {
        if (navGen === myGen) document.documentElement.removeAttribute("data-kx-nav");
      };
      if (nav) {
        document.documentElement.setAttribute("data-kx-nav", nav);
        /* Belt & braces: a skipped/aborted transition must never leave the
           attribute behind to mis-direct the NEXT navigation. */
        window.setTimeout(clearNav, 900);
      }

      const vt = doc.startViewTransition!(() => {
        router.push(url.pathname + url.search + url.hash);
      });
      /* Aborted transitions REJECT these promises (second nav, tab hide…);
         the navigation itself already happened, so the rejection is pure
         noise — but uncaught noise raised the dev overlay's red badge. */
      vt.finished?.catch(() => {}).finally(clearNav);
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
