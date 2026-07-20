"use client";

/* ---------------------------------------------------------------------------
   AuthGate — meta-wrapper that dispatches admin routes to the correct
   auth mechanism based on NEXT_PUBLIC_USE_SUPABASE_AUTH.

     - flag OFF (default): renders the legacy <AdminAuth> password gate.
     - flag ON: checks for a live Supabase session, redirects to /login?next=…
       if there's none, and renders children once authenticated.

   Drop-in replacement for <AdminAuth>: same props, same behavior, zero
   risk to the existing deployment until the flag is set.
   --------------------------------------------------------------------------- */

import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import AdminAuth from "./AdminAuth";
/* Same check as auth-client.isSupabaseAuthEnabled — inlined so this always-
   mounted gate never statically imports the supabase client. */
const isSupabaseAuthEnabled = () =>
  process.env.NEXT_PUBLIC_USE_SUPABASE_AUTH === "true";

/* Set once a Supabase session is confirmed on this device; cleared on sign-out
   or a failed check. Lets the gate paint the shell instantly for a returning
   user instead of blocking every cold load behind a session-check spinner —
   the single biggest first-paint cost on weak clients (X5 webview / low-spec
   Windows). Only a hint for paint timing: the real session is still verified in
   the background every load, and all data is enforced server-side per request. */
const AUTHED_HINT_KEY = "koleex-authed";
/* useLayoutEffect on the server is a no-op and warns; fall back to useEffect. */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface Props {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export default function AuthGate({ title, subtitle, children }: Props) {
  // Flag is read once at mount; env vars can't change at runtime anyway.
  const useSupabase = isSupabaseAuthEnabled();

  // Legacy path: identical behaviour to Phase 1.
  if (!useSupabase) {
    return (
      <AdminAuth title={title} subtitle={subtitle}>
        {children}
      </AdminAuth>
    );
  }

  // Phase 2 path: Supabase Auth session check.
  return <SupabaseGate>{children}</SupabaseGate>;
}

function SupabaseGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  /* Start "checking" so the SSR/first-hydration render matches (no mismatch).
     The layout effect below promotes to "authed" BEFORE paint when the device
     has a confirmed-session hint, so a returning user never sees the spinner. */
  const [state, setState] = useState<"checking" | "authed" | "redirecting">(
    "checking",
  );

  /* Optimistic paint: pre-paint, before the network check, trust the hint. */
  useIsoLayoutEffect(() => {
    try {
      if (localStorage.getItem(AUTHED_HINT_KEY) === "1") setState("authed");
    } catch {
      /* storage blocked — fall back to the spinner + network check */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { getCurrentSession } = await import("@/lib/auth-client");
      const session = await getCurrentSession();
      if (cancelled) return;

      if (session) {
        try { localStorage.setItem(AUTHED_HINT_KEY, "1"); } catch { /* ignore */ }
        setState("authed");
      } else {
        // Stale hint (session expired / revoked): drop it and redirect. The
        // shell may have painted for a moment, but no data is exposed — every
        // API call would 401 — and we're leaving immediately.
        try { localStorage.removeItem(AUTHED_HINT_KEY); } catch { /* ignore */ }
        setState("redirecting");
        const next = encodeURIComponent(pathname || "/");
        router.replace(`/login?next=${next}`);
      }
    })();

    // Keep the gate in sync if the user signs out in another tab.
    let unsubscribe: (() => void) | null = null;
    void import("@/lib/auth-client").then(({ onAuthStateChange }) => {
      if (cancelled) return;
      unsubscribe = onAuthStateChange((session) => {
        if (cancelled) return;
        if (!session) {
          try { localStorage.removeItem(AUTHED_HINT_KEY); } catch { /* ignore */ }
          const next = encodeURIComponent(pathname || "/");
          router.replace(`/login?next=${next}`);
        } else {
          try { localStorage.setItem(AUTHED_HINT_KEY, "1"); } catch { /* ignore */ }
        }
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [router, pathname]);

  if (state !== "authed") {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
