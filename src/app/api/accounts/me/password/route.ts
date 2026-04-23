import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/accounts/me/password

   Self-service password change for the signed-in account. Used by the
   /change-password page (first-login forced reset) and any future
   "Change password" action in the user menu.

   Body:   { currentPassword: string, newPassword: string }
   Returns { ok: true } or { ok: false, error }

   Why a separate route from /api/accounts/[id]/password?
   - That one requires the "Accounts" module permission — admins only.
     A regular employee shouldn't need admin rights to change their own
     password.
   - This one validates currentPassword and operates on the caller's own
     account_id from the session cookie, so no permission check needed.
   - Clears force_password_change on success so middleware stops
     redirecting.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

function hashTempPassword(plain: string): string {
  return `tmp$${Buffer.from(plain, "utf8").toString("base64")}`;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const currentPassword = body.currentPassword?.trim() ?? "";
  const newPassword = body.newPassword?.trim() ?? "";

  if (!newPassword) {
    return NextResponse.json(
      { ok: false, error: "New password is required" },
      { status: 400 },
    );
  }
  /* Same floor as /api/accounts/[id]/password so admins can't create
     accounts with stronger rules than self-service enforces. */
  if (newPassword.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }
  if (newPassword === currentPassword) {
    return NextResponse.json(
      { ok: false, error: "New password must be different from the current one" },
      { status: 400 },
    );
  }

  /* Verify the current password BEFORE writing. We skip this check
     when force_password_change=true AND the user has never changed
     their password — the admin set a temp password they want
     replaced, so requiring the old temp just to change it again is
     pointless friction. Still require it for every other case so
     stolen session cookies can't silently change the password. */
  const { data: acc, error: readErr } = await supabaseServer
    .from("accounts")
    .select("id, password_hash, force_password_change")
    .eq("id", auth.account_id)
    .maybeSingle();
  if (readErr || !acc) {
    return NextResponse.json({ ok: false, error: "Account not found" }, { status: 404 });
  }

  const mustVerify = !acc.force_password_change;
  if (mustVerify) {
    const expected = hashTempPassword(currentPassword);
    if (!currentPassword) {
      return NextResponse.json(
        { ok: false, error: "Current password is required" },
        { status: 400 },
      );
    }
    if (!acc.password_hash || acc.password_hash !== expected) {
      return NextResponse.json(
        { ok: false, error: "Current password is incorrect" },
        { status: 401 },
      );
    }
  }

  const { error: updErr } = await supabaseServer
    .from("accounts")
    .update({
      password_hash: hashTempPassword(newPassword),
      force_password_change: false,
    })
    .eq("id", auth.account_id);

  if (updErr) {
    console.error("[api/accounts/me/password]", updErr.message);
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  /* Audit. Same event_type as admin-driven resets so one query pulls
     the whole password-change history. */
  void supabaseServer.from("account_login_history").insert({
    account_id: auth.account_id,
    event_type: "password_changed",
    metadata: { by_account_id: auth.account_id, self_service: true },
  });

  return NextResponse.json({ ok: true });
}
