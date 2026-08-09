import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET /api/accounts/availability?username=…&loginEmail=…&excludeId=…
   Is this username / login email free? Used by the account form while typing.

   The browser checks this replaces read `accounts` with the anon key, and on
   any error they returned TRUE — "available". `accounts` is service-role-only,
   so the read always errored and the form always said the name was free, for
   every name, including one already in use. The unique constraint still caught
   it at insert, so the user learned about the clash from a failed save instead
   of from the field.

   Fails CLOSED now: an error answers "not available" rather than waving a
   duplicate through. The comparison is case-insensitive, because sign-in
   resolves the account that way. */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Accounts");
  if (deny) return deny;

  const url = new URL(req.url);
  const username = url.searchParams.get("username")?.trim();
  const loginEmail = url.searchParams.get("loginEmail")?.trim();
  const excludeId = url.searchParams.get("excludeId");

  const free = async (column: string, value: string): Promise<boolean | null> => {
    let q = supabaseServer.from("accounts").select("id").ilike(column, value);
    if (excludeId) q = q.neq("id", excludeId);
    const { data, error } = await q;
    if (error) {
      console.error(`[api/accounts/availability] ${column}:`, error.message);
      return null;
    }
    return (data ?? []).length === 0;
  };

  const out: { username?: boolean; loginEmail?: boolean } = {};
  if (username) out.username = (await free("username", username)) ?? false;
  if (loginEmail) out.loginEmail = (await free("login_email", loginEmail)) ?? false;
  return NextResponse.json(out);
}
