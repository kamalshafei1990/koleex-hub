"use client";

/* KDS PopoverPanel — an MN-5 panel anchored to a trigger, rendered on <body>.

   WHY IT IS NOT RENDERED NEXT TO ITS TRIGGER. A `backdrop-filter` ancestor
   STARVES a descendant's own backdrop-filter: the child samples the parent's
   already-filtered layer instead of the page. Every form card in the Hub is
   `.kx-glass` (blur 16px), so a panel inside one has NO working glass at any
   radius — measured on the customer form: the panel asked for blur(140px) and
   the heading behind it stayed sharp. Three separate "fixes" raised the FILL
   instead, ending at 94% opacity, which is not glass, it is a tile.

   Portalling to <body> also removes two things that were being worked around
   one at a time: the panel can no longer be clipped by a card's `overflow`,
   and it can no longer be buried by a later sibling card — the `.kx-glass:has()`
   z-lift in globals.css exists only for panels that have NOT moved here yet,
   and should be deleted once they all have.

   The cost is that position has to be computed instead of inherited. That is
   what this component is: the rect, the listeners that keep it true, and the
   outside-click test that has to know about BOTH the anchor and the panel,
   since they are no longer in the same subtree. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { usePresence } from "./usePresence";

/* The panel renders null until it has measured itself, so measuring in a plain
   useEffect costs one painted frame with the scrim up and NO menu under it —
   a visible blink on every open, and worst on the notification bell, which
   mounts already-open and so blinks on the very first press. useLayoutEffect
   runs before paint, so the first frame the user sees already has the panel.
   Aliased because useLayoutEffect warns during SSR; this component renders
   nothing on the server anyway. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function PopoverPanel({
  anchorRef,
  open,
  onClose,
  className = "",
  matchAnchorWidth = true,
  align = "start",
  mobileSheet = false,
  scrim = true,
  maxHeight = 352,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  /** Sizing and any extra layout. The MN-5 shell is applied for you. */
  className?: string;
  /** Panel is at least as wide as the trigger — right for a form field, wrong
      for a menu hanging off a 32px icon button. */
  matchAnchorWidth?: boolean;
  /** `end` right-aligns the panel to the trigger, for menus near the viewport
      edge that would otherwise overflow. */
  align?: "start" | "end";
  /** Under 768px, drop the anchor and span the viewport under the header —
      the notification panel is a sheet on a phone and a dropdown above it.
      One panel, two positioning modes, because that is what it actually is. */
  mobileSheet?: boolean;
  /** A TYPE-AHEAD LIST IS NOT A MENU. Suggestions that appear while the user
      is still typing must not dim and blur the page behind them — the user is
      reading the field, not choosing from a modal surface, and darkening the
      screen mid-keystroke is an interruption. Owner: "when I search by typing
      the background become blur. for searching no need that."
      Menus opened by a deliberate press keep the scrim; pass false only for
      lists that open as a side effect of typing. */
  scrim?: boolean;
  /** Tallest the panel may grow when the room allows. 352 suits a select list;
      a feed with its own header and filter chips needs more before its inner
      scroller starts doing the work. Never a floor — the room still wins. */
  maxHeight?: number;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  /* One nudge per open — see the scroll note in place(). */
  const autoScrolled = useRef(false);
  const [rect, setRect] = useState<{ top: number; left: number; right: number; width: number; flip: boolean; maxH: number; sheet: boolean } | null>(null);

  /* onClose arrives as a fresh arrow on every parent render. Held in a ref so
     the effect below does not tear down and re-register on every render — it
     did, and since place() sets a brand-new object each time, that was a
     render → effect → setState → render cycle that left the panel showing a
     rect from some earlier layout. Measured: anchored 14px right and 8px above
     the field it belongs to, and a forced resize did not correct it. */
  const closeRef = useRef(onClose);
  /* Assigned in an effect, not during render: writing a ref while rendering is
     unsafe under concurrent rendering, and the lint rule says so. */
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  const place = useCallback(() => {
    const a = anchorRef.current;
    /* THE ANCHOR CAN BE NULL ON THE FIRST PASS, AND THAT IS NOT AN ERROR.
       This panel renders INSIDE the element `anchorRef` points at, and React
       attaches host refs child-first during commit — so a child's layout
       effect runs BEFORE its own ancestor's ref is assigned. Every other
       dropdown in the Hub escapes this because its trigger was mounted in an
       earlier commit and the ref has been set for ages. The notification bell
       is the one that mounts ALREADY OPEN (the gate hands over with
       `defaultOpen`), so its very first commit is also the commit that has to
       attach the anchor — and measuring there found nothing.

       Symptom when this is unhandled: the bell reports aria-expanded="true",
       the scrim is up, and there is no panel anywhere in the document. Any
       stray resize or scroll then makes it appear, which is what made it look
       intermittent.

       The recovery is the PASSIVE effect below, not a frame: passive effects
       run after the whole commit, when every ref is attached. It must not be a
       requestAnimationFrame — rAF does not fire in a background tab, so the
       panel would stay missing until the tab came forward. Measured exactly
       that: visibilityState "hidden", zero frames, two placement attempts and
       no third. */
    if (!a) return;
    const r = a.getBoundingClientRect();
    /* SHEET MODE. On a phone a 380px card hanging off a 32px icon button in
       the corner is not a menu, it is a sliver. So under 768px an opted-in
       panel stops being anchored: it spans the viewport under the header with
       12px margins, exactly where the bell's hand-rolled `inset-x-3` put it
       before this component existed. Anchor-independent, so no scroll nudge
       and no width matching. */
    if (mobileSheet && window.innerWidth < 768) {
      const headerH =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--kx-header-h"),
        ) || 56;
      const top = headerH + 8;
      const maxH = Math.max(0, window.innerHeight - top - 12);
      setRect((prev) =>
        prev && prev.sheet && prev.top === top && prev.maxH === maxH
          ? prev
          : { top, left: 12, right: 12, width: 0, flip: false, maxH, sheet: true },
      );
      return;
    }
    /* DOWN IS THE DEFAULT AND STAYS THE DEFAULT. The first version flipped
       whenever a full-height panel would not fit below, which is the textbook
       rule and looked wrong immediately: a field low on the page threw a 352px
       list upward across the header. Owner: "the dropdown menu open to up not
       down."

       So: open downward and SHRINK to the room available — the panel scrolls
       already, and a short list that starts where you are beats a tall one
       that jumps somewhere else. Flip only when down is genuinely unusable
       (under 200px) and up is roomier, which is the case a phone keyboard
       creates. maxHeight is inline so it beats the caller's max-h class. */
    let below = window.innerHeight - r.bottom - 12;
    let box = r;
    const above = r.top - 12;
    /* DOWN, ALWAYS. Owner: "the dropdown menu open to up not down." A textbook
       flip is not what he wants — a list that jumps above the field reads as a
       different control, and at its worst it covered the header. So when the
       room below is too small we do not move the PANEL, we move the PAGE: nudge
       the field's own scroller up so the list has somewhere to go. Once per
       open (autoScrolled), or the scroll listener would re-enter this and walk
       the page. Flip survives only for a field with no scroller under it and
       genuinely nowhere to go. */
    const WANT = 240;
    if (below < WANT && !autoScrolled.current) {
      let sc: HTMLElement | null = a.parentElement;
      while (sc) {
        const cs = getComputedStyle(sc);
        if (/auto|scroll/.test(cs.overflowY) && sc.scrollHeight > sc.clientHeight + 4) break;
        sc = sc.parentElement;
      }
      if (sc) {
        const room = sc.scrollHeight - sc.clientHeight - sc.scrollTop; /* left to give */
        const by = Math.min(WANT - below, Math.max(0, room));
        if (by > 0) {
          autoScrolled.current = true;
          sc.scrollTop += by;
          /* RE-MEASURE HERE, never `requestAnimationFrame(place); return;`.
             Setting scrollTop reflows synchronously, so the new rect is
             readable on the very next line. Waiting for a frame meant that
             when the frame never came — rAF does not fire in a background tab
             — place() had already returned WITHOUT setting a rect, and the
             panel never entered the DOM. Same dead end that was removed from
             kds/Select; both had it. */
          box = a.getBoundingClientRect();
          below = window.innerHeight - box.bottom - 12;
        }
      }
    }
    /* No flip at all. The nudge above handles the common case; when the
       scroller is already at its end there is nothing to nudge, and the honest
       answer is a shorter list that still starts at the field — not one that
       jumps above it. It scrolls internally, so three rows visible is a
       cramped list, never a lost one. `above` stays measured for the day a
       real reason to flip turns up. */
    void above;
    const flip = false;
    let top = box.bottom + 4;
    let maxH = Math.min(maxHeight, Math.max(0, below));
    /* A PANEL THAT SHRINKS TO NOTHING IS A BROKEN CONTROL. With no room below
       and nothing left to scroll, `below` goes to zero or negative and this
       used to render a 0px-tall box: present in the DOM, invisible on screen,
       swallowing the click. Reported as "I choose from the dropdown and
       nothing responds, nothing fills the field" — nothing was wrong with the
       choosing, there was simply no list to choose from.

       An earlier attempt at a floor let the panel overflow the viewport by
       exactly the shortfall, which is why the floor was removed. The fix is
       not to overflow but to SHIFT: keep a usable height and park the panel
       against the bottom edge. It still hangs off the field in the normal
       case — this only engages when the alternative is nothing at all. */
    const MIN = 120;
    if (maxH < MIN) {
      maxH = Math.min(maxHeight, MIN, Math.max(0, window.innerHeight - 24));
      top = Math.max(12, window.innerHeight - 12 - maxH);
    }
    setRect((prev) =>
      prev && !prev.sheet && prev.top === top && prev.left === box.left && prev.width === box.width
        && prev.flip === flip && prev.maxH === maxH
        ? prev /* same box — return the SAME object so React bails out */
        : { top, left: box.left, right: window.innerWidth - box.right, width: box.width, flip, maxH, sheet: false },
    );
  }, [anchorRef, mobileSheet, maxHeight]);

  useIsoLayoutEffect(() => {
    if (!open) { autoScrolled.current = false; return; }
    place();
    /* One more pass after paint: the anchor can still be moving when the panel
       opens — a section expanding, a font landing, the list above it growing. */
    const raf = requestAnimationFrame(place);
    /* CAPTURE phase. The Hub scrolls in nested containers, not on window, and
       a scroll event does not bubble — a normal listener would never fire and
       the panel would hang in mid-air while the field moved away under it. */
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      closeRef.current();
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, place, anchorRef]);

  /* The second placement, and the one that makes the bell work at all.
     Passive effects run after the ENTIRE commit, so `anchorRef.current` is
     guaranteed attached here even when this panel is a descendant of its own
     anchor and mounts already open. place() returns the previous rect object
     unchanged when the box has not moved, so in the normal case — trigger
     mounted long ago, layout effect already placed it — this costs one
     comparison and no re-render. */
  useEffect(() => {
    if (open) place();
  }, [open, place]);

  /* Exit choreography (owner-approved motion system): stay mounted while the
     140ms kx-pop-closing shrink plays; rect survives from the open phase. */
  const { mounted, closing } = usePresence(open);
  if (!mounted || !rect || typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* One scrim, owned here, for every panel that wants one. The four shell
          menus each hand-rolled this exact div; the selects had none at all,
          which is why page text read straight through an open menu over a
          dense list. The material is signed off and unchanged — the scrim is
          what gives it something soft to be glass AGAINST. Below the header by
          design: the header stays crisp and usable while a menu is open. */}
      {scrim && (
      <div
        aria-hidden
        onMouseDown={() => closeRef.current()}
        className={`fixed inset-x-0 bottom-0 top-[var(--kx-header-h)] bg-black/30 backdrop-blur-sm transition-opacity duration-150 ${closing ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        style={{ zIndex: 199 }}
      />
      )}
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        /* When flipped, anchor by the BOTTOM edge so the panel grows upward
           from the field instead of downward off the screen. */
        ...(rect.flip ? { bottom: window.innerHeight - rect.top } : { top: rect.top }),
        ...(rect.sheet
          ? { left: rect.left, right: rect.right }
          : align === "end"
            ? { right: rect.right }
            : { left: rect.left }),
        ...(matchAnchorWidth && !rect.sheet ? { minWidth: rect.width } : null),
        maxHeight: rect.maxH,
        overflowY: "auto",
        zIndex: 200,
      }}
      className={`kx-glass-pop kx-pop-panel ${closing ? "kx-pop-closing" : ""} ${className}`}
    >
      {children}
    </div>
    </>,
    document.body,
  );
}
