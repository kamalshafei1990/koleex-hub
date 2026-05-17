"use client";

/* ---------------------------------------------------------------------------
   FocusMode — optional "hide secondary nav" toggle for forms and
   workflow pages. Persists per-browser via localStorage.

   Usage:
     <FocusToggle />              -- header button
     useFocusMode()               -- boolean reader
     <FocusBoundary>{...}</FocusBoundary>
                                  -- wrap secondary chrome (top-level
                                     navigation, sidebars, sticky
                                     footers) so focus mode can hide it
   --------------------------------------------------------------------------- */

import { useEffect, useState, type ReactNode } from "react";
import RrIcon from "@/components/ui/RrIcon";

const STORAGE_KEY = "koleex.focus-mode";

function readInitial(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function useFocusMode(): [boolean, (next: boolean) => void] {
  const [focused, setFocused] = useState(false);
  useEffect(() => { setFocused(readInitial()); }, []);
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setFocused(e.newValue === "1");
    }
    function onCustom(e: Event) {
      const ev = e as CustomEvent<boolean>;
      setFocused(!!ev.detail);
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("koleex:focus-mode", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("koleex:focus-mode", onCustom as EventListener);
    };
  }, []);
  const setter = (next: boolean) => {
    setFocused(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      window.dispatchEvent(new CustomEvent("koleex:focus-mode", { detail: next }));
    }
  };
  return [focused, setter];
}

export function FocusToggle() {
  const [focused, setFocused] = useFocusMode();
  return (
    <button type="button" onClick={() => setFocused(!focused)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] transition-colors ${
              focused
                ? "border-emerald-300/40 bg-emerald-300/[0.08] text-emerald-100"
                : "border-white/[0.10] bg-white/[0.04] text-gray-300 hover:bg-white/[0.06]"
            }`}
            aria-pressed={focused}
            title={focused ? "Exit focus mode" : "Hide secondary chrome while you work"}>
      <RrIcon name={focused ? "eye" : "eye"} size={11} />
      {focused ? "Focus on" : "Focus"}
    </button>
  );
}

export function FocusBoundary({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [focused] = useFocusMode();
  if (focused) return null;
  return <div className={className}>{children}</div>;
}
