import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/me — Return the authenticated account's profile context.

   Response when signed in:
     200 { account_id, tenant_id, role_id, is_super_admin,
           can_view_private, department, username, login_email,
           user_type, status }
   Response when not signed in:
     401 { error: "Not signed in" }

   Replaces the client-side loadScopeContext call. The browser uses this
   to hydrate the current user without ever reading from the accounts
   table directly.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server/auth";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.json(auth);
}
