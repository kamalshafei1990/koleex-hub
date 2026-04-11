"use client";

/* ---------------------------------------------------------------------------
   RootShell — client-side wrapper used by the root layout to gate every
   route behind the sign-in form.

   Why a separate component: `src/app/layout.tsx` is a server component, so
   it can't read `usePathname()` or render the AuthGate (client-only). This
   shell does both.

   Behaviour:
     · `/login` and `/auth/*` bypass the gate entirely (so Supabase Auth's
       redirect flow can still reach the sign-in UI when the flag flips on).
     · Every other route is wrapped in <AuthGate>. When unauthed, AdminAuth
       renders its own full-screen login form — which is why we also hide
       MainHeader on the gated path (AdminAuth owns the whole viewport).
     · Once authed, MainHeader + the page content render normally.
   --------------------------------------------------------------------------- */

import { usePathname } from "next/navigation";
import AuthGate from "@/components/admin/AuthGate";
import MainHeader from "./MainHeader";

const BYPASS_PREFIXES = ["/login", "/auth"];

function isBypassed(pathname: string | null): boolean {
  if (!pathname) return false;
  return BYPASS_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export default function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isBypassed(pathname)) {
    /* Auth-adjacent pages render without the header and without the gate.
       They're responsible for their own layout. */
    return <>{children}</>;
  }

  return (
    <AuthGate title="Koleex Hub" subtitle="Sign in to access the platform">
      <MainHeader />
      <div className="pt-14 flex-1 flex flex-col min-h-0">{children}</div>
    </AuthGate>
  );
}
