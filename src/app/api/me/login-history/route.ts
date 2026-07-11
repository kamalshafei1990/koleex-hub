import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { getServerAuth } from "@/lib/server/auth";

/* GET /api/me/login-history
   Recent sign-in attempts for the CURRENT account only. Reads the
   service-role-only public.login_attempts table (recorded by the auth
   layer) and returns a trimmed, self-scoped list — never other users'.

   Scope: match on account_id first; fall back to the account's own
   identifiers (username / login_email) for rows recorded before an
   account_id was resolved (e.g. an early failed attempt). */
export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const identifiers = [auth.username, auth.login_email]
    .filter(Boolean)
    .map((s) => String(s).trim().toLowerCase());

  // account_id match OR identifier match (self only).
  const orParts = [`account_id.eq.${auth.account_id}`];
  for (const id of identifiers) orParts.push(`identifier.eq.${id}`);

  const { data, error } = await supabaseServer
    .from("login_attempts")
    .select("ip_address, user_agent, outcome, created_at")
    .or(orParts.join(","))
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    console.error("[me/login-history]", error.message);
    return NextResponse.json({ error: "Could not load login history" }, { status: 500 });
  }

  return NextResponse.json({ attempts: data ?? [] });
}
