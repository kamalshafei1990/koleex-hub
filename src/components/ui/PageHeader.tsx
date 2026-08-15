"use client";

/* ---------------------------------------------------------------------------
   PageHeader — Koleex Hub canonical app header (Hero → Search → Menu).

   Three distinct stacked sections shared across every app:

     ┌─────────────────────────────────────────────────────────────────┐
     │ [←] [📦]  App Name                          [action] [actions]  │   ← Hero
     │           Subtitle text                                          │
     ├─────────────────────────────────────────────────────────────────┤
     │ 🔍 Search …                                              ⌘K     │   ← Search
     ├─────────────────────────────────────────────────────────────────┤
     │ [Home] [Items] [Movements] [Transfers] [Returns] [Balances] ▾   │   ← Menu
     └─────────────────────────────────────────────────────────────────┘

   · Back arrow auto-computes parent path (e.g. /inventory/items → /inventory)
   · App icon + name + optional subtitle form a clean visual hero
   · Search bar in the middle band — same shape on every app
   · Menu pills at the bottom — text + active state + "More ▾" overflow
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState, isValidElement, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { isUnderglassRoute, appOwnsTopRamp } from "@/lib/underglass";
import { APP_REGISTRY } from "@/lib/navigation";
import { useTopRampOwner } from "@/lib/useTopRampOwner";
import type { NavGroup } from "@/components/ui/PageNavPopup";

/* Sliding-pill geometry — change in one place. */
const TAB_WIDTH_LG = 148;
const TAB_WIDTH_MD = 132;
const TRACK_PADDING = 6;

export interface PageTab {
  key: string;
  label: string;
  icon?: RrIconName | ReactNode;
  /** When provided, tab renders as a state-toggle button. */
  onClick?: () => void;
  /** Force-mark this tab as active (useful for state-based apps). */
  active?: boolean;
}

export interface PageHeaderProps {
  /** The accessible name. Stays a STRING even when `titleNode` draws
   *  something else, because it is also the nav's aria-label — widening this
   *  to ReactNode would have produced "[object Object] navigation". */
  title: string;
  /** Drawn in place of `title` when an app's title is editable — a document
   *  name people rename in situ, rather than a page label. */
  titleNode?: ReactNode;
  subtitle?: string;
  icon: RrIconName | ReactNode;
  backHref?: string;
  /** Where the back button GOES, shown beside its arrow (BK-4). Defaults to
   *  "Hub". Set it when the parent is a specific record — "Quotation #1042" —
   *  so the control answers "back to what?" instead of just "back". */
  backLabel?: string;
  action?: ReactNode;
  controls?: ReactNode;
  meta?: ReactNode;
  tabs?: PageTab[];
  overflowTabs?: NavGroup[];
  popupTitle?: string;
  popupSubtitle?: string;
  showTabs?: boolean;
  /** Search bar placeholder. Omit to hide the search bar entirely. */
  searchPlaceholder?: string;
  /** Destination route — receives ?q=<term> on submit. */
  searchHref?: string;
  /** Custom submit handler (overrides searchHref). */
  onSearchSubmit?: (term: string) => void;
}

function parentPath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  if (idx <= 0) return "/";
  return trimmed.slice(0, idx);
}

export default function PageHeader({
  title,
  titleNode,
  subtitle,
  icon,
  backHref,
  backLabel,
  action,
  controls,
  meta,
  tabs,
  overflowTabs,
  popupTitle: _popupTitle,
  popupSubtitle: _popupSubtitle,
  showTabs = true,
  searchPlaceholder,
  searchHref,
  onSearchSubmit,
}: PageHeaderProps) {
  const pathname = usePathname() ?? "";
  const resolvedBackHref = backHref ?? parentPath(pathname);

  /* Does the system bar already carry this app's name? Resolved exactly the way
     MainHeader resolves it — longest matching registry route wins — so the two
     read one source and cannot drift apart. See the M-1 note on the title. */
  const systemBarNamesThisApp = useMemo(() => {
    const routes = APP_REGISTRY.filter((a) => a.route && a.tKey)
      .map((a) => a.route as string)
      .sort((a, b) => b.length - a.length);
    return routes.some((r) => pathname === r || pathname.startsWith(r + "/"));
  }, [pathname]);

  /* Flatten any overflow groups into the main tab list so every item
     is visible inline (no "More" dropdown). De-dup by key to avoid
     showing the same route twice when a primary tab also appears in
     overflow groups. */
  const tabsFromOverflow: PageTab[] =
    overflowTabs?.flatMap((g) =>
      g.items.map((i) => ({ key: i.key, label: i.label, icon: i.icon }))
    ) ?? [];
  const tabSet = new Set<string>();
  const mergedTabs: PageTab[] = [];
  for (const tab of [...(tabs ?? []), ...tabsFromOverflow]) {
    if (tabSet.has(tab.key)) continue;
    tabSet.add(tab.key);
    mergedTabs.push(tab);
  }

  const hasTabs = showTabs && mergedTabs.length > 0;
  const hasSearch = !!searchPlaceholder;

  /* ONE LONG RAMP BEHIND THE WHOLE TOP STRIP, owner's words on this header:
     "you only can use one but more longer — it can work for main header,
     search area and categories area", and later, pointing at Purchase, "put
     the blured edge on the back of the top page components".

     appOwnsTopRamp routes are the ones where MainHeader keeps a FLAT 56px
     frost instead of its own 104px ramp, precisely so the app can run a
     single taller one. Until now nothing in PageHeader actually drew it —
     measured on /inventory/items: .kx-ph-band computed backdrop-filter NONE
     — so the entry was a promise the header never kept, and the screen had
     no edge blur at all past the header line. This is the ramp it owes. */
  const ownsRamp = isUnderglassRoute(pathname) && appOwnsTopRamp(pathname) && hasTabs;

  /* Tell the shell this screen's blurred edge is already drawn, so the main
     header pane stands down and the screen shows one edge instead of two.
     `hasTabs` is in the condition above for the same reason the hook takes a
     flag at all: no band, no ramp, no claim. */
  useTopRampOwner(ownsRamp);

  /* Longest-prefix match — detail pages still light the right tab. */
  const allKeys = mergedTabs.map((t) => t.key);
  const active =
    allKeys
      .slice()
      .sort((a, b) => b.length - a.length)
      .find((k) => pathname === k || (k !== resolvedBackHref && pathname.startsWith(k + "/"))) ??
    (mergedTabs[0]?.key ?? "");

  return (
    <>
    {/* Hero + search live in their own block. The menu is a SIBLING (not
        nested) so its sticky positioning has the caller's full-page
        wrapper as the scroll context, instead of being trapped inside
        this short space-y wrapper (which would un-stick the moment the
        hero scrolled past). */}
    {/* relative z-30 LIFTS THE HERO ABOVE THE RAMP, and this is the whole
        difference between "frost behind the header" and a dark smear over it.
        The ramp below reaches UP past this block; anything left underneath it
        gets blurred as though it were scrolled-under content — which on
        Product Data turned the title and the divisions row to mush before the
        same fix was applied there. The frost passes behind these components;
        only real scrolling content dissolves into it. */}
    <div className={`space-y-3 sm:space-y-5 ${ownsRamp ? "relative z-30" : ""}`}>
      {/* ── Hero row: back + icon + name + subtitle + actions ───
          On mobile: tighter gaps (gap-2), smaller back/icon chips (h-8),
          smaller title (18px). Drops ~40px of vertical space so content
          starts higher on small viewports — addresses the "not organized"
          complaint that the header was dominating the screen. */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        {/* ⚠️ ALIGNMENT FOLLOWS THE LINE COUNT, AND M-1 CHANGED THE LINE COUNT.
            `sm:items-start` is right for a TWO-line block — a 26px title with a
            subtitle under it should hang from the top of the 40px chips beside
            it, not float in their middle. But from md up the title is now
            `sr-only`, so what is left is a SINGLE line, and top-aligning one
            line against 40px chips leaves it sitting high with a gap under it.
            Owner, on Purchases: "wht the text not in the middle?"

            So the alignment switches back to centre at exactly the breakpoint
            where the title disappears — the same `md` that MainHeader and the
            title itself use. Three places, one breakpoint, on purpose. */}
        <div
          className={`flex min-w-0 items-center gap-2 sm:items-start sm:gap-4 ${
            systemBarNamesThisApp ? "md:items-center" : ""
          }`}
        >
          {/* BK-4 — THE BACK BUTTON NAMES ITS DESTINATION (owner pick,
              2026-08-15: "i think the back button can be little longer").

              It was a 40×40 square, which made it an exact twin of the app-icon
              chip immediately to its right: two identical boxes, only one of
              them interactive. Longer for its own sake would fix the twinning
              and nothing else, so the extra width carries the answer to the
              question this control actually raises — back to WHAT — on a screen
              you can arrive at from three different places.

              The word is dropped below sm, where the row is tight and the title
              beside it must not be squeezed; there it is the wider arrow (BK-2)
              instead. `backLabel` lets a caller name a real parent
              ("Quotation #1042"); the default is the Hub. */}
          <Link
            href={resolvedBackHref}
            aria-label={backLabel ? `Back to ${backLabel}` : "Back"}
            className="kx-ph-chrome flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-[var(--text-dim)] transition-all duration-200 hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] sm:h-10 sm:rounded-xl sm:px-3 sm:hover:-translate-y-0.5"
          >
            <RrIcon name="arrow-left" size={14} />
            <span className="hidden text-[12px] font-medium sm:inline">{backLabel ?? "Hub"}</span>
          </Link>
          {/* NO kx-ph-chrome HERE. This is the app-icon chip: a plain div with
              no href and no handler, sitting next to a back LINK that wears
              the identical box. It was carrying the chrome recipe anyway, so
              hovering it lit the Hub-Blue border exactly like the button
              beside it — the header advertised an interaction that does not
              exist, and the one control there that IS clickable lost the only
              thing distinguishing it.

              Dropping the class costs nothing at rest: under Aurora
              .kx-ph-chrome declares ONLY a transition, and the resting look
              (border-subtle over bg-surface) comes from the utilities that are
              still here. Verified against the rule, not assumed. */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] sm:h-10 sm:w-10 sm:rounded-xl">
            {typeof icon === "string" ? (
              <RrIcon name={icon as RrIconName} size={16} />
            ) : isValidElement(icon) ? (
              icon
            ) : null}
          </div>
          {/* M-1 · CONTINUITY — DO NOT PRINT A NAME THE SYSTEM BAR IS ALREADY
              PRINTING (owner pick, 2026-08-15).

              Measured on /contacts before this: "Contacts" in the system bar,
              and the same word again 20px below it in this block. Both of the
              screenshots the owner sent showed it — KOLEEX hub | Settings, then
              Settings again. The Hub was spending its largest type on a word
              already on screen a finger-width away.

              ⚠️ THE CONDITION IS NOT A PROP, AND THAT IS DELIBERATE. MainHeader
              derives the app name from APP_REGISTRY by route; asking each of the
              23 call sites to declare "the bar shows my name" would be the same
              fact written twice, and would drift the first time a route moved.
              This reads the SAME source, so the two can never disagree — and a
              route that is not in the registry (a deep record page, a lab) gets
              no name up there and therefore keeps its title here.

              The <h1> never leaves the document: it stays for assistive tech and
              for the document outline, only visually hidden. What takes its
              place on screen is the subtitle, promoted to the primary line —
              which is where an app should say what the bar cannot: its state.

              ⚠️⚠️ AND IT IS `md:sr-only`, NOT `sr-only`. MainHeader renders the
              app name `hidden md:inline` — the phone header declutters to
              menu · logo · bell · avatar and drops the name entirely. Hiding
              the title unconditionally therefore deleted the app's name from
              the phone: caught on /documents at 375px, where the screen was
              left saying only "Koleex document formats — create, save…" with
              nothing naming the app. The breakpoint here MUST track the one in
              MainHeader; if that `md:` ever moves, this one moves with it. */}
          <div className="flex min-w-0 flex-col">
            <h1
              className={
                /* `&& !titleNode` — the sr-only exists because the system bar
                   already names the APP, so repeating it here is noise. A
                   titleNode is not the app's name: it is the DOCUMENT's, the
                   thing the reader renames in place. Hiding that on desktop
                   collapsed the h1 to 1px and took its input with it. */
                systemBarNamesThisApp && !titleNode
                  ? "text-[17px] font-bold leading-tight tracking-tight text-[var(--text-primary)] md:sr-only"
                  : "text-[17px] font-bold tracking-tight leading-tight text-[var(--text-primary)] sm:text-[24px] md:text-[26px]"
              }
            >
              {titleNode ?? title}
            </h1>
            {subtitle && (
              <p
                className={
                  systemBarNamesThisApp
                    ? "mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-[var(--text-muted)] md:mt-0 md:line-clamp-none md:text-[14px] md:text-[var(--text-secondary)]"
                    : "mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-[var(--text-muted)] sm:line-clamp-none sm:mt-1 sm:text-[13px]"
                }
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {(controls || action) && (
          <div className="flex flex-wrap items-center gap-2">
            {controls}
            {action}
          </div>
        )}
      </div>

      {meta && <div>{meta}</div>}

      {/* ── Search row ───────────────────────────────────────────── */}
      {hasSearch && (
        <HomeSearchBar
          placeholder={searchPlaceholder!}
          searchHref={searchHref}
          onSearchSubmit={onSearchSubmit}
        />
      )}
    </div>

    {/* ── Menu row — sticks at the TOP of the inner scroll container
          (which itself starts just below MainHeader via pt-14 on the
          shell) so the user can always navigate without scrolling back
          up. top-0 here = directly under the fixed MainHeader.
          Sibling (not nested) of the hero block so the sticky's
          containing block is the caller's full-page wrapper, not the
          short hero box (which would un-stick it the moment the hero
          scrolled past).
          -mx + px restore the page's horizontal padding so the bar
          bleeds to the edges and content scrolling under is hidden. */}
    {hasTabs && (
      <div
        /* THE BAND HOSTS THE RAMP, and drops to z-20 to do it: the layer has
           to sit UNDER the hero block (z-30) it reaches up behind, and under
           its own pill strip. kx-bar-host also strips any blur off the host
           itself — a host that filters becomes a backdrop root and starves
           the four layers inside it. */
        /* TWO VARS, AND THEY TRAVEL TOGETHER. Product Data sets both on its
           bar. I set only the tail, and that shipped a ramp which measured
           perfect and showed nothing.

           --kx-ramp-fade:4rem — the FADE, and it has to be an absolute length
           the moment --kx-ramp-top stretches the layer. The 45% default is a
           PERCENTAGE OF THE LAYER, and --kx-ramp-top:26rem makes that layer
           481px tall — so 45% became a 216px fade: the heavy blur's opaque
           band landed at y=-360..-96, entirely above the viewport, and the
           only stretch on screen (56..121, behind the tab strip) sat in the
           near-transparent tail. Owner: "the blur edge disappeared in purchase
           app." Every probe still passed — layer mounted, four blurs, opacity
           1, correct rect — because what had gone was the MASK, not the
           filter. Measure the layers' masks, not just their presence.

           ONCE THE FADE IS ABSOLUTE, A TALL LAYER IS FREE. I first "fixed"
           this by shrinking --kx-ramp-top to 6rem, which cured the scrolled
           state and broke the resting one: the band sits at y=203 at scroll
           top, so a 96px reach left everything above 107 with no backdrop at
           all, and the app title scrolled straight through the Hub logo.
           The frost boundary is `bottom - fade`, so height only ever extends
           it UPWARD — 26rem covers the header from both ends and the surplus
           is clipped above the viewport. --kx-ramp-top is reach; the fade is
           what had to stop being a percentage.

           --kx-ramp-ext:1rem — the TAIL, measured. At the 3rem default the
           ramp ended at y=298 while the first section heading under the bar
           starts at y=272, so the page's own first line of text sat 26px
           inside the blur. 16px clears it with room to spare. */
        className={`kx-ph-band sticky top-0 -mx-4 mt-3 bg-[var(--bg-primary)] px-4 py-2 sm:-mx-6 sm:mt-5 sm:px-6 ${
          ownsRamp ? "kx-bar-host z-20 [--kx-ramp-top:26rem] [--kx-ramp-ext:1rem] [--kx-ramp-fade:1.5rem]" : "z-30"
        }`}
        /* 26rem, the same as Product Data's, and generous on purpose: the
           strip's height changes with the title's wrap and whether a search
           row is present, and anything taller than needed is simply clipped
           above the viewport. Too SHORT is the visible failure — the frost
           would start mid-page. */
      >
        {ownsRamp && (
          <div aria-hidden className="kx-glass-bar kx-bar-prog">
            <i /><i /><i /><i />
          </div>
        )}
        {/* NO LIFT WRAPPER HERE — the host contract already does it.
            `.kx-bar-host > :not(.kx-glass-bar):not(.absolute):not(.fixed):not(.sticky)`
            gives every non-layer child `position:relative; z-index:1`, and
            being unlayered it beats a Tailwind z-* utility outright: the
            `relative z-30` wrapper I first wrapped this in measured z:1, not
            30. The strip is this bar's own content, so it is lifted above the
            layer automatically and the fade runs behind it. */}
        <SlidingPillNav
          tabs={mergedTabs}
          activeKey={active}
          ariaLabel={`${title} navigation`}
        />
      </div>
    )}
    </>
  );
}

/* ===========================================================================
   SlidingPillNav — single white pill that slides between fixed-width tabs.
   One DOM pill, no per-tab background, no width animation (only `left`).
   =========================================================================== */
function SlidingPillNav({
  tabs,
  activeKey,
  ariaLabel,
}: {
  tabs: PageTab[];
  activeKey: string;
  ariaLabel: string;
}) {
  const [tabWidth, setTabWidth] = useState<number>(TAB_WIDTH_LG);
  const trackRef = useRef<HTMLDivElement>(null);
  /* No scroll-arrow buttons: they were removed at Kamal's request (they read
     as clutter sitting on top of the rail). The track still scrolls by swipe,
     trackpad and shift-wheel, arrow keys still move focus between tabs, and
     the active pill is still auto-scrolled into view — so an off-screen tab
     is reachable, just without a chrome button advertising it. */

  /* Responsive tab width — 148px on ≥900px, 120px below. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 900px)");
    const update = () => setTabWidth(mq.matches ? TAB_WIDTH_MD : TAB_WIDTH_LG);
    update();
    const handler = (e: MediaQueryListEvent) => setTabWidth(e.matches ? TAB_WIDTH_MD : TAB_WIDTH_LG);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* Active index — supports both forced `tab.active` and longest-prefix `activeKey`. */
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => (t.active ?? (t.key === activeKey))),
  );

  /* Scroll the active pill into view ONLY when it changes AND is currently
     off-screen. Two guards stop the auto-scroll from fighting the user:
       1. If the active tab is already fully visible, do nothing.
       2. On the very first mount, jump instantly (no smooth animation) so
          the page doesn't visibly scroll as it loads.
     The smooth scroll only runs when the user navigates to a tab that's
     genuinely out of the visible area. */
  const firstMountRef = useRef(true);
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const el = track.querySelectorAll<HTMLElement>('[role="tab"]')[activeIndex];
    if (!el) return;
    const tabLeft  = el.offsetLeft;
    const tabRight = tabLeft + el.offsetWidth;
    const viewLeft  = track.scrollLeft;
    const viewRight = viewLeft + track.clientWidth;
    const inView = tabLeft >= viewLeft && tabRight <= viewRight;
    if (inView) return;
    const center = tabLeft - track.clientWidth / 2 + el.offsetWidth / 2;
    const max = track.scrollWidth - track.clientWidth;
    const left = Math.max(0, Math.min(center, max));
    track.scrollTo({
      left,
      behavior: firstMountRef.current ? "auto" : "smooth",
    });
    firstMountRef.current = false;
  }, [activeIndex]);

  /* iOS Safari fix: when the user scrolls the page vertically, iOS leaks
     a tiny amount of horizontal momentum into any sibling `overflow-x:auto`
     element — making the pill bar appear to drift sideways during a
     vertical body swipe. Lock the nav's scrollLeft whenever the user is
     NOT actively touching the nav itself. The locked value stays at the
     last position the user (or auto-scroll) put it.

     Implementation: track whether a touch is on the nav. If not, any
     `scroll` event on the nav that changes scrollLeft outside an
     auto-scroll batch gets snapped back to the locked value. */
  const lockedScrollRef = useRef<number | null>(null);
  const userScrollingRef = useRef(false);
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    /* Touch-only guard: this lock exists to absorb iOS momentum leakage.
       On mouse/trackpad devices touchstart never fires, so the lock would
       treat every wheel scroll as "not the user" and snap the strip back —
       making it impossible to scroll. Desktop needs no lock at all. */
    const isTouch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) return;
    /* The bug this replaces: the lock engaged the instant the finger lifted,
       but a touch scroll does not end when the finger lifts — iOS keeps the
       strip coasting. So a deliberate swipe of the tab bar was snapped back
       to wherever it happened to be at lift-off, and the bar appeared to
       fight the user. That is the "scroll bug" on the phone.

       Now the lock waits for the coast to finish: after touchend we stay in a
       SETTLING state that keeps adopting the strip's own position, and only
       once the scroll events stop for SETTLE_MS does the locked value freeze.
       Vertical-page leakage still gets caught, because that arrives with no
       preceding touch on the bar at all. */
    const SETTLE_MS = 220;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    const clearSettle = () => {
      if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
    };

    const onTouchStart = () => {
      clearSettle();
      userScrollingRef.current = true;
      lockedScrollRef.current = null;
    };
    const onTouchEnd = () => {
      /* Stay "user scrolling" through the momentum phase; the scroll handler
         below arms the timer that eventually ends it. */
      clearSettle();
      settleTimer = setTimeout(() => {
        userScrollingRef.current = false;
        lockedScrollRef.current = track.scrollLeft;
      }, SETTLE_MS);
    };
    const onScroll = () => {
      if (userScrollingRef.current) {
        /* Momentum is still running — keep pushing the freeze out so the
           coast completes, and remember where it has reached. */
        if (settleTimer) {
          clearSettle();
          settleTimer = setTimeout(() => {
            userScrollingRef.current = false;
            lockedScrollRef.current = track.scrollLeft;
          }, SETTLE_MS);
        }
        return;
      }
      const locked = lockedScrollRef.current;
      if (locked != null && Math.abs(track.scrollLeft - locked) > 1) {
        track.scrollLeft = locked;
      }
    };
    track.addEventListener("touchstart", onTouchStart, { passive: true });
    track.addEventListener("touchend", onTouchEnd, { passive: true });
    track.addEventListener("touchcancel", onTouchEnd, { passive: true });
    track.addEventListener("scroll", onScroll, { passive: true });
    // Initial lock: whatever the active-pill effect just set.
    lockedScrollRef.current = track.scrollLeft;
    return () => {
      clearSettle();
      track.removeEventListener("touchstart", onTouchStart);
      track.removeEventListener("touchend", onTouchEnd);
      track.removeEventListener("touchcancel", onTouchEnd);
      track.removeEventListener("scroll", onScroll);
    };
  }, []);

  /* Whenever the auto-scroll effect changes the active tab into view,
     refresh the lock target so the new committed position is the one we
     defend against iOS overscroll leakage. */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const t = setTimeout(() => { lockedScrollRef.current = track.scrollLeft; }, 400);
    return () => clearTimeout(t);
  }, [activeIndex, tabWidth]);

  /* Roving tabindex — arrow keys move focus between tabs. */
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const els = trackRef.current?.querySelectorAll<HTMLElement>('[role="tab"]');
    if (!els || els.length === 0) return;
    const list = Array.from(els);
    const focused = list.findIndex((el) => el === document.activeElement);
    const start = focused >= 0 ? focused : activeIndex;
    const delta = e.key === "ArrowLeft" ? -1 : 1;
    const next = (start + delta + list.length) % list.length;
    list[next]?.focus();
  };

  return (
    <div className="relative flex max-w-full items-center">
    <nav
      ref={trackRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      /* iOS-friendly scroll behavior:
         · overscroll-behavior-x: contain — keep horizontal scroll inside
           the bar (no back-nav hijack at edges).
         · WebkitOverflowScrolling: "auto" — disable iOS momentum here.
           "touch" momentum would let a vertical body fling leak tiny
           horizontal motion into the bar (the bug the user reported).
         · NO touch-action: pan-x — that was overrestricting and made
           iOS more likely to apply unwanted horizontal deltas. Default
           touch-action lets the page scroll vertically through the bar
           and only lets the bar scroll horizontally on a deliberate
           horizontal drag. The JS scrollLeft lock above defends against
           any residual iOS leakage. */
      style={{
        overscrollBehaviorX: "contain",
        WebkitOverflowScrolling: "auto",
        scrollSnapType: "x proximity",
        scrollPaddingLeft: `${TRACK_PADDING}px`,
      }}
      // Subtle but visible thin scrollbar — issue 4c9884b1 (Mustafa) reported
      // there was no scroll affordance when the nav overflowed. Hiding the
      // bar completely hid the fact that more tabs existed off-screen. A
      // thin, low-contrast scrollbar gives the cue without harming the
      // brand-minimal aesthetic.
      className="kx-ph-tabs relative inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-1.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab, i) => {
        const isActive = i === activeIndex;
        /* Canonical TabStrip pill: auto-width, per-button filled active.
           (Matches src/components/ui/TabStrip.tsx so every tab bar in the
           system looks identical.) */
        const tabClass =
          "relative z-10 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] " +
          (isActive
            ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
            : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]");
        const inner = (
          <>
            {/* Icon wrapper is inline-flex, not a bare span: the icon inside
                is an inline-block, so in a plain span it sits on the TEXT
                BASELINE and the line box reserves descender space below it —
                which pushed a 14px icon ~2.6px above the label's centre. As a
                flex container there's no baseline to sit on, so the icon
                centres against the text properly. */}
            {tab.icon && (
              <span
                aria-hidden
                className={`inline-flex items-center leading-none ${isActive ? "opacity-90" : "opacity-70"}`}
              >
                {typeof tab.icon === "string" ? (
                  <RrIcon name={tab.icon as RrIconName} size={14} />
                ) : (
                  tab.icon
                )}
              </span>
            )}
            <span>{tab.label}</span>
          </>
        );
        const baseProps = {
          role: "tab" as const,
          "aria-selected": isActive,
          tabIndex: isActive ? 0 : -1,
          /* scroll-snap-align: start so each tab settles at the left edge
             of the viewport when the user finishes a swipe. */
          style: { scrollSnapAlign: "start" as const },
          className: tabClass,
        };
        if (tab.onClick) {
          return (
            <button key={tab.key} type="button" onClick={tab.onClick} {...baseProps}>
              {inner}
            </button>
          );
        }
        return (
          <Link key={tab.key} href={tab.key} {...baseProps}>
            {inner}
          </Link>
        );
      })}
    </nav>
    </div>
  );
}

function HomeSearchBar({
  placeholder,
  searchHref,
  onSearchSubmit,
}: {
  placeholder: string;
  searchHref?: string;
  onSearchSubmit?: (term: string) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect Mac vs Windows/Linux so the shortcut badge actually matches the
  // user's keyboard. QA report d54f3e66 surfaced this: an Arabic Windows user
  // saw ⌘K and didn't know what it meant — the Cmd glyph isn't on their
  // keyboard. We now render "Ctrl K" on Windows/Linux and "⌘K" on Mac, and
  // make the badge a real, focusable button with a hover tooltip explaining
  // what it does. The shortcut itself is wired below.
  const [isMac, setIsMac] = useState(false);
  const [lang, setLang] = useState<"en" | "zh" | "ar">("en");
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
      ?? navigator.platform ?? "";
    setIsMac(/Mac|iPhone|iPod|iPad/i.test(platform));
    const l = (document.documentElement.lang as "en" | "zh" | "ar") || "en";
    setLang(l === "zh" || l === "ar" ? l : "en");
  }, []);

  // Localized hint text for the tooltip + accessibility label. Falls back to
  // English so a missing lang attribute never produces an empty tooltip.
  const HINT: Record<"en" | "zh" | "ar", { focus: string; key: string }> = {
    en: { focus: "Focus search", key: isMac ? "Cmd + K" : "Ctrl + K" },
    zh: { focus: "聚焦搜索", key: isMac ? "Cmd + K" : "Ctrl + K" },
    ar: { focus: "تركيز البحث", key: isMac ? "Cmd + K" : "Ctrl + K" },
  };
  const hint = `${HINT[lang].focus} — ${HINT[lang].key}`;
  const shortcutLabel = isMac ? "⌘K" : "Ctrl K";

  const focusInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    // Select existing content so re-pressing the shortcut clears it on next
    // keystroke — feels closer to standard global search palettes.
    try { el.select(); } catch { /* no-op */ }
  };

  // Real, working keyboard shortcut. Catches Cmd+K on Mac and Ctrl+K on
  // everywhere else. Ignored while the user is already typing in a text
  // field other than this one (so it doesn't fight other search palettes).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "k" && e.key !== "K") return;
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      focusInput();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    if (onSearchSubmit) onSearchSubmit(trimmed);
    else if (searchHref) router.push(`${searchHref}?q=${encodeURIComponent(trimmed)}`);
  };
  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="kx-ph-search group flex h-11 w-full items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 transition-colors duration-200 focus-within:border-[var(--border-focus)] hover:border-[var(--border-color)] sm:h-12 sm:gap-3 sm:px-4">
        <RrIcon name="search" size={15} className="shrink-0 text-[var(--text-dim)] transition-colors group-focus-within:text-[var(--text-muted)]" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={hint}
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-dim)] sm:text-[13.5px]"
        />
        {/* Fixed-width right slot so swapping the badge ↔ Search button never
            resizes the input or shifts the bar when you start typing. */}
        <div className="flex w-[72px] shrink-0 items-center justify-end">
          {q.trim() ? (
            <button
              type="submit"
              className="rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90"
            >
              Search
            </button>
          ) : (
            // The shortcut badge is a real button — clicking it focuses the
            // search input (so users on touch / unfamiliar keyboards have an
            // affordance) and the tooltip explains what the shortcut does.
            <button
              type="button"
              onClick={focusInput}
              title={hint}
              aria-label={hint}
              className="hidden cursor-pointer items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--text-dim)] transition-colors hover:border-[var(--border-color)] hover:text-[var(--text-secondary)] sm:inline-flex"
            >
              <kbd className="font-medium">{shortcutLabel}</kbd>
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
