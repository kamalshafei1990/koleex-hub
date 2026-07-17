"use client";

/* ---------------------------------------------------------------------------
   AppHeaderSlot — a route-owned content slot in the global MainHeader.
   ---------------------------------------------------------------------------
   WHY THIS EXISTS. MainHeader is a fixed 56px band on every route. An app like
   Discuss also wants its own context bar (conversation avatar / name / status /
   actions), and rendering both stacks two identical-looking 56px bands above
   the content. This lets a route hand its context UP to the shell so there is
   exactly ONE header.

   THE CONTRACT IS DELIBERATELY DUMB. It carries a title, a subtitle, and three
   opaque ReactNodes. The shell never learns what a "channel" is: MainHeader
   imports nothing from Discuss, and Discuss keeps its own selected-channel
   state. Anything richer than this belongs in the route, not the shell.

   DEFAULT IS UNCHANGED BEHAVIOUR. A route that never calls useAppHeaderSlot()
   registers nothing, `content` stays null, and MainHeader renders exactly as it
   always has. That is what keeps the other 34 apps untouched.
   --------------------------------------------------------------------------- */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppHeaderContent = {
  /** Replaces the route's app-name breadcrumb while registered. */
  title: string;
  /** Secondary line — shown where space permits. */
  subtitle?: string;
  /** Avatar / icon node, rendered by the route so the shell stays generic. */
  avatar?: ReactNode;
  /** Back affordance. Rendered on mobile only; absent → no back button. */
  onBack?: () => void;
  /** Accessible label for the back button — routes localise their own copy. */
  backLabel?: string;
  /** Route-owned action controls, placed before the global bell/account. */
  actions?: ReactNode;
} | null;

type Ctx = {
  content: AppHeaderContent;
  setContent: (c: AppHeaderContent) => void;
};

const AppHeaderContext = createContext<Ctx>({
  content: null,
  setContent: () => {},
});

export function AppHeaderProvider({ children }: { children: ReactNode }) {
  const [content, setContentState] = useState<AppHeaderContent>(null);

  /* Stable identity so a consumer's effect never re-fires because the setter
     changed. Without this, every shell render would re-register the slot. */
  const setContent = useCallback((c: AppHeaderContent) => {
    setContentState((prev) => (prev === c ? prev : c));
  }, []);

  const value = useMemo(() => ({ content, setContent }), [content, setContent]);
  return <AppHeaderContext.Provider value={value}>{children}</AppHeaderContext.Provider>;
}

/** Read the slot. MainHeader is the only intended caller. */
export function useAppHeader(): AppHeaderContent {
  return useContext(AppHeaderContext).content;
}

/**
 * Register route-owned header content. Pass null to show the normal app name.
 *
 * The caller MUST pass a memoised object (useMemo) with stable callbacks
 * (useCallback) — this hook deliberately does not deep-compare, because the
 * `avatar`/`actions` ReactNodes are new objects on every render and comparing
 * them is neither cheap nor reliable. A `useMemo` on the caller's real inputs
 * (channel id, name, description, muted, translate prefs, mobile view) is both.
 *
 * Clears automatically on unmount, so leaving /discuss cannot strand a stale
 * conversation title in the shell.
 */
export function useAppHeaderSlot(content: AppHeaderContent): void {
  const { setContent } = useContext(AppHeaderContext);

  useEffect(() => {
    setContent(content);
  }, [content, setContent]);

  useEffect(() => {
    return () => setContent(null);
  }, [setContent]);
}
