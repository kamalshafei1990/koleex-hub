"use client";

/* ---------------------------------------------------------------------------
   SidebarContext — shared state between Sidebar and MainHeader.

   expanded  = desktop sidebar width (collapsed 60 px / expanded 220 px)
   mobileOpen = mobile drawer visibility
   --------------------------------------------------------------------------- */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface SidebarState {
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  mobileOpen: boolean;
  setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggle: () => void;
}

const Ctx = createContext<SidebarState>({
  expanded: false,
  setExpanded: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
  toggle: () => {},
});

export const SIDEBAR_EXPANDED_W = 220;
export const SIDEBAR_COLLAPSED_W = 60;

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  /* Restore preference */
  useEffect(() => {
    const saved = localStorage.getItem("koleex-sidebar");
    if (saved === "expanded") setExpanded(true);
  }, []);

  /* Persist preference */
  useEffect(() => {
    localStorage.setItem("koleex-sidebar", expanded ? "expanded" : "collapsed");
  }, [expanded]);

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  return (
    <Ctx.Provider value={{ expanded, setExpanded, mobileOpen, setMobileOpen, toggle }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSidebar() {
  return useContext(Ctx);
}
