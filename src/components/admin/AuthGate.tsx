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

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import AdminAuth from "./AdminAuth";
import {
  isSupabaseAuthEnabled,
  getCurrentSession,
  onAuthStateChange,
} from "@/lib/auth-client";

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
  const [state, setState] = useState<"checking" | "authed" | "redirecting">(
    "checking",
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await getCurrentSession();
      if (cancelled) return;

      if (session) {
        setState("authed");
      } else {
        setState("redirecting");
        const next = encodeURIComponent(pathname || "/");
        router.replace(`/login?next=${next}`);
      }
    })();

    // Keep the gate in sync if the user signs out in another tab.
    const unsubscribe = onAuthStateChange((session) => {
      if (cancelled) return;
      if (!session) {
        const next = encodeURIComponent(pathname || "/");
        router.replace(`/login?next=${next}`);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
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
