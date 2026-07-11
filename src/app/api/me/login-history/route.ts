import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { getServerAuth } from "@/lib/server/auth";

/* GET /api/me/login-history
   Recent sign-in attempts for the CURRENT account only. Reads the
   service-role-only public.login_attempts table (recorded by the auth
   layer) and returns a trimmed, self-scoped list — never other users'.

   Scoped strictly by account_id (a UUID parameterized by the query builder)
   rather than interpolating the account's username/email into a PostgREST
   .or() string, which a comma/paren in the value could break. */
export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data, error } = await supabaseServer
    .from("login_attempts")
    .select("ip_address, user_agent, outcome, created_at")
    .eq("account_id", auth.account_id)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    console.error("[me/login-history]", error.message);
    return NextResponse.json({ error: "Could not load login history" }, { status: 500 });
  }

  return NextResponse.json({ attempts: data ?? [] });
}
