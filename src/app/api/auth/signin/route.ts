import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/auth/signin — Legacy password sign-in, server-side.

   Request JSON:  { email?: string; username?: string; password: string }
   Response:      { ok: true, account: { id, username, ... } }
               or { ok: false, error: string } with 401

   Replaces the old client-side call to verifyAccountLogin. The browser
   never touches Supabase's accounts table directly — it asks this route,
   which verifies the password using the service-role client and then
   sets an HttpOnly signed session cookie. No secrets leave the server.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { setSessionCookie } from "@/lib/server/session";

/** Same base64-tag scheme the legacy write path used. Keep parity with
 *  accounts-admin.ts::hashTempPassword so existing stored hashes verify. */
function hashTempPassword(plain: string): string {
  return `tmp$${Buffer.from(plain, "utf8").toString("base64")}`;
}

export async function POST(req: Request) {
  // Outer try/catch so an unexpected throw (missing env var, DB outage,
  // etc.) never escapes as an HTML error page. The client parses the
  // body as JSON; if it receives HTML it surfaces a misleading
  // "service unreachable" error even when the real cause was a 500
  // we could have described precisely.
  try {
    let body: { email?: string; username?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid request body" },
        { status: 400 },
      );
    }

    const password = body.password?.trim();
    const emailOrUsername = (body.email ?? body.username ?? "").trim();
    if (!password || !emailOrUsername) {
      return NextResponse.json(
        { ok: false, error: "Email/username and password are required" },
        { status: 400 },
      );
    }

    // Look up the account by login_email or username (case-insensitive).
    // One round-trip either way so login latency is predictable.
    let account: {
      id: string;
      username: string;
      login_email: string;
      status: string;
      password_hash: string | null;
      user_type: string;
      force_password_change: boolean | null;
    } | null = null;

    const SELECT_COLS = "id, username, login_email, status, password_hash, user_type, force_password_change";
    if (emailOrUsername.includes("@")) {
      const { data } = await supabaseServer
        .from("accounts")
        .select(SELECT_COLS)
        .ilike("login_email", emailOrUsername)
        .maybeSingle();
      account = data ?? null;
    } else {
      const { data } = await supabaseServer
        .from("accounts")
        .select(SELECT_COLS)
        .ilike("username", emailOrUsername)
        .maybeSingle();
      account = data ?? null;
    }

    // Uniform error messages so attackers can't probe for valid emails.
    if (!account) {
      return NextResponse.json(
        { ok: false, error: "Invalid email/username or password" },
        { status: 401 },
      );
    }
    if (account.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "This account is disabled" },
        { status: 403 },
      );
    }

    const expected = hashTempPassword(password);
    if (!account.password_hash || account.password_hash !== expected) {
      return NextResponse.json(
        { ok: false, error: "Invalid email/username or password" },
        { status: 401 },
      );
    }

    // Success — mint the session cookie.
    await setSessionCookie(account.id);

    /* Stamp last_login_at + write an audit row. Fire-and-forget so a
       failure to record the event never blocks a legitimate login.
       Previously the Security tab on every account always showed
       "Last login: never" because nothing on the signin path ever
       wrote this column. */
    const now = new Date().toISOString();
    void supabaseServer
      .from("accounts")
      .update({ last_login_at: now })
      .eq("id", account.id);
    void supabaseServer.from("account_login_history").insert({
      account_id: account.id,
      event_type: "login_success",
      metadata: { via: "password" },
    });

    return NextResponse.json({
      ok: true,
      account: {
        id: account.id,
        username: account.username,
        login_email: account.login_email,
        user_type: account.user_type,
        /* Surface the flag so the client can redirect to
           /change-password on first login. Enforced server-side by
           middleware too — this is just the hint that saves an
           extra round-trip. */
        force_password_change: !!account.force_password_change,
      },
    });
  } catch (err) {
    // Must not throw out of this handler — the client parses the
    // response as JSON and any HTML error page would surface as a
    // misleading "service unreachable" error. Log the real cause and
    // return a machine-readable JSON 500 so the client can render a
    // precise message like "Auth configuration error" instead.
    const message =
      err instanceof Error ? err.message : "Unknown sign-in error";
    console.error("[api/auth/signin]", err);
    return NextResponse.json(
      { ok: false, error: "server_error", detail: message },
      { status: 500 },
    );
  }
}
