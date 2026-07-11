import "server-only";

/* GET /api/me/export
   A self-service export of the CURRENT user's own account-level data —
   profile, preferences, and recent sign-in history. Read-only, self-scoped
   (never other users), no new tables. Returns a JSON body the client saves
   as a file. Excludes secrets (password hash, tokens) and heavy blobs. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { getServerAuth } from "@/lib/server/auth";
import { withDefaults } from "@/lib/access-control";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  /* Account (safe columns only) + linked person. */
  const { data: acct } = await supabaseServer
    .from("accounts")
    .select("id, username, login_email, user_type, status, created_at, person_id, preferences")
    .eq("id", auth.account_id)
    .maybeSingle();

  let person: Record<string, unknown> | null = null;
  const personId = (acct as { person_id?: string } | null)?.person_id;
  if (personId) {
    const { data } = await supabaseServer
      .from("people")
      .select("full_name, email, phone, created_at")
      .eq("id", personId)
      .maybeSingle();
    person = data ?? null;
  }

  /* Recent sign-ins (self-scoped, same shape as the Login history view). */
  const { data: logins } = await supabaseServer
    .from("login_attempts")
    .select("ip_address, user_agent, outcome, created_at")
    .eq("account_id", auth.account_id)
    .order("created_at", { ascending: false })
    .limit(50);

  const preferences = withDefaults(
    (acct as { preferences?: unknown } | null)?.preferences as never,
  );

  const payload = {
    exported_at: new Date().toISOString(),
    account: acct
      ? {
          id: (acct as { id: string }).id,
          username: (acct as { username: string }).username,
          login_email: (acct as { login_email: string }).login_email,
          user_type: (acct as { user_type: string }).user_type,
          status: (acct as { status: string }).status,
          role_id: auth.role_id ?? null,
          created_at: (acct as { created_at: string }).created_at,
        }
      : null,
    profile: person,
    preferences,
    recent_sign_ins: logins ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="koleex-account-export.json"`,
      "Cache-Control": "no-store",
    },
  });
}
