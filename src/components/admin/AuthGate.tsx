"use client";

/* ---------------------------------------------------------------------------
   AuthGate — the gate RootShell puts around every route it does not bypass.

   It is <AdminAuthGate>: the Hub's own username + password sign-in, backed by
   the HttpOnly `koleex_session` cookie the server checks on every request.

   There used to be a second mode here, SupabaseGate, behind
   NEXT_PUBLIC_USE_SUPABASE_AUTH. It was retired on 26/09/2026: the flag was
   never switched on, the server never accepted a Supabase session, and with
   /login deleted (452344e8) that mode had no sign-in screen at all. One gate,
   one sign-in screen.
   --------------------------------------------------------------------------- */

/* The signed-in path of AdminAuth; the sign-in screen itself loads only when
   someone is signed out (see AdminAuthGate). */
import AdminAuthGate from "./AdminAuthGate";

interface Props {
  children: React.ReactNode;
}

export default function AuthGate({ children }: Props) {
  return <AdminAuthGate>{children}</AdminAuthGate>;
}
