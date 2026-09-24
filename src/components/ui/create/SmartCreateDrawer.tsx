"use client";

/* ---------------------------------------------------------------------------
   SmartCreateDrawer — universal "+ Create" launcher.

   A single drawer mounted at the layout root that surfaces every
   creation flow. Operators open it from:
     · header chip ("+ Create")
     · any empty state via the openSmartCreate() event
     · keyboard shortcut "c"

   Picking a tile goes to that app with ?new=1, which opens its create form
   (lib/use-open-on-new-param); the /create/* pages are the form already.
   When the app is the page you are on, the form is asked to open in place.

   What it shows, in order (no filter typed):
     · Recent — the last three kinds this browser created
     · Suggested here — the kinds that belong to the app you are in
     · the rest
   Only kinds the viewer's role may CREATE are listed (usePermissions).
   ↑/↓ move, Enter opens; the filter matches all three languages.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePresence } from "@/components/kds/usePresence";
import { useCurrentAccountId } from "@/lib/identity";

/* The panel (tiles, translations, permission lookup) is its own chunk: this
   component sits in the root layout, so only the listener ships everywhere. */
const SmartCreatePanel = dynamic(() => import("./SmartCreatePanel"), { ssr: false });

const STORE_EVENT = "koleex:smart-create-open";

/** Imperatively open the drawer from anywhere in the app. */
export function openSmartCreate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STORE_EVENT));
}

export default function SmartCreateDrawer() {
  /* The drawer is mounted beside the sign-in screen too; it only works for
     a signed-in operator ("c" on the login form used to open it). */
  const signedIn = !!useCurrentAccountId();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  /* Fetch the panel's chunk once the page is idle, so the first "c" opens
     instantly — it stays out of the initial bundle either way. */
  useEffect(() => {
    const warm = () => { void import("./SmartCreatePanel"); };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(warm, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(warm, 3000);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    function onOpen() { setOpen(true); }
    function onKey(e: KeyboardEvent) {
      /* Keyboard shortcut: bare "c" toggles the drawer (skips when
         the operator is typing in a field). */
      if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      setOpen((o) => !o);
      e.preventDefault();
    }
    window.addEventListener(STORE_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(STORE_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  /* Motion + material match the KDS modals (FormModal): pop in, shrink
     away, on the .kx-glass-pop surface Aurora renders as glass. The panel
     (and its permission lookup) only exists while the drawer is shown. */
  const { mounted, closing } = usePresence(open && signedIn);
  if (!mounted) return null;
  return <SmartCreatePanel closing={closing} onClose={close} />;
}
