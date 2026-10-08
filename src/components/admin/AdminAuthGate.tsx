"use client";

/* ---------------------------------------------------------------------------
   AdminAuthGate — the signed-in path of <AdminAuth>, without the sign-in
   screen in every page's first download.

   AdminAuth decides "show the Hub" or "show the form" from one localStorage
   flag, and for someone already signed in that is ALL it does — yet its
   module carries the whole form, the membership panel and their dictionary,
   ~28 KB of code the signed-in majority downloads and parses on every cold
   load and never runs (measured 25/09/2026 from the production source maps).

   This gate makes the same decision with the same flag and renders the same
   hydration spinner, and only when the answer is "signed out" does it load
   AdminAuth — unchanged, so the sign-in logic itself is untouched. It also
   listens for the same two events AdminAuth does (the server refused the
   cookie; another tab signed out), so a session that dies mid-visit still
   brings the form back in this tab.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import BrandLoading from "@/components/ui/BrandLoading";
import { SESSION_INVALID_EVENT } from "@/lib/session-hints";
import { LEGACY_SESSION_KEY } from "./session-keys";

/* The spinner AdminAuth itself shows while it resolves — identical, so the
   server HTML, the gate and the loading sign-in screen are one picture. */
const spinner = () => <BrandLoading className="h-[100dvh] overflow-hidden" />;

const AdminAuth = dynamic(() => import("./AdminAuth"), { ssr: false, loading: spinner });

type State = "checking" | "in" | "out";

export default function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>("checking");

  /* After hydration (the server cannot read localStorage, and the first
     client render must match its HTML). The codebase's usual microtask hop
     keeps the set-state-in-effect rule quiet. */
  useEffect(() => {
    void Promise.resolve().then(() => {
      let signedIn = false;
      try { signedIn = window.localStorage.getItem(LEGACY_SESSION_KEY) === "true"; } catch { /* storage blocked */ }
      setState(signedIn ? "in" : "out");
    });
  }, []);

  useEffect(() => {
    const onInvalid = () => setState("out");
    const onStorage = (e: StorageEvent) => {
      if (e.key === LEGACY_SESSION_KEY && e.newValue !== "true") setState("out");
    };
    window.addEventListener(SESSION_INVALID_EVENT, onInvalid);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SESSION_INVALID_EVENT, onInvalid);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (state === "checking") return spinner();
  /* Signed out (or the session just died): the full gate takes over from
     here — it reads the flag again, shows the form, and after a sign-in
     reloads the page, which lands back here as "in". */
  if (state === "out") return <AdminAuth>{children}</AdminAuth>;
  return <>{children}</>;
}
