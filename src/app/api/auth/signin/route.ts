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
import { verifyPassword } from "@/lib/server/password";
import {
  rateLimitMode,
  clientIp,
  clientUserAgent,
  normalizeIdentifier,
  computeWouldBlock,
  recordAttempt,
  type WouldBlockResult,
} from "@/lib/server/rate-limit";
import { recordSessionShadow } from "@/lib/server/session-shadow";
import { requestMeta, logActivity, locationLabel } from "@/lib/server/activity";
import { notifySuperAdmins } from "@/lib/server/sa-notify";

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
    /* ---- Rate-limiting OBSERVE MODE (S2c) ----------------------------------
       Capture IP / UA / normalized identifier and compute the would-block
       decision AT ARRIVAL (before the account lookup, matching real enforcement
       semantics). This NEVER blocks in S2c. Zero work when AUTH_RATELIMIT=off. */
    const rlMode = rateLimitMode();
    const rlActive = rlMode !== "off";
    const ip = rlActive ? clientIp(req) : "";
    const userAgent = rlActive ? clientUserAgent(req) : null;
    const identifier = rlActive ? normalizeIdentifier(emailOrUsername) : "";
    const wouldBlock: WouldBlockResult = rlActive
      ? await computeWouldBlock(ip, identifier)
      : { would_block: false, rule: null, counts: {} };

    let account: {
      id: string;
      username: string;
      login_email: string;
      status: string;
      password_hash: string | null;
      password_algo: string | null;
      user_type: string;
      force_password_change: boolean | null;
      tenant_id: string | null;
    } | null = null;

    const SELECT_COLS = "id, username, login_email, status, password_hash, password_algo, user_type, force_password_change, tenant_id";
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
      if (rlActive) {
        await recordAttempt({
          ip, identifier, userAgent, accountId: null, tenantId: null,
          outcome: "unknown_user", reason: "unknown_account", wouldBlock, mode: rlMode,
        });
      }
      return NextResponse.json(
        { ok: false, error: "Invalid email/username or password" },
        { status: 401 },
      );
    }
    if (account.status !== "active") {
      if (rlActive) {
        await recordAttempt({
          ip, identifier, userAgent, accountId: account.id, tenantId: account.tenant_id,
          outcome: "disabled", reason: "disabled_account", wouldBlock, mode: rlMode,
        });
      }
      return NextResponse.json(
        { ok: false, error: "This account is disabled" },
        { status: 403 },
      );
    }

    // Polymorphic verify (legacy tmp$ / argon2id / bcrypt / null). Uniform 401
    // on failure — same behavior as before. Detection is by hash prefix; the
    // password_algo column is advisory only.
    const verdict = await verifyPassword(password, account.password_hash, account.password_algo);
    if (!verdict.ok) {
      if (rlActive) {
        await recordAttempt({
          ip, identifier, userAgent, accountId: account.id, tenantId: account.tenant_id,
          outcome: "failure", reason: "invalid_password", wouldBlock, mode: rlMode,
        });
        // Brute-force signal: alert Super Admins when failures for this account
        // cross a threshold in a short window. Best-effort; never blocks the 401.
        try {
          const since = new Date(Date.now() - 15 * 60_000).toISOString();
          const { count } = await supabaseServer
            .from("login_attempts")
            .select("id", { count: "exact", head: true })
            .eq("account_id", account.id)
            .in("outcome", ["failure", "blocked"])
            .gte("created_at", since);
          if ((count ?? 0) >= 5) {
            await notifySuperAdmins({
              kind: "failed_login_threshold",
              subject: `Repeated failed logins for ${account.username || account.login_email}`,
              actorName: account.username || account.login_email,
              action: `${count} failed sign-in attempts in 15 min`,
              location: locationLabel(requestMeta(req)),
              body: `${count} failed attempts in the last 15 minutes${ip ? ` · ${ip}` : ""}`,
              severity: "critical",
              tenantId: account.tenant_id,
              metadata: { account_id: account.id, attempts: count, ip },
            });
          }
        } catch {
          /* never block the 401 on the alert path */
        }
      }
      return NextResponse.json(
        { ok: false, error: "Invalid email/username or password" },
        { status: 401 },
      );
    }

    // Success — mint the session cookie. (Unchanged.)
    await setSessionCookie(account.id);

    /* Best-effort side-effects, AWAITED.
       On Vercel the lambda freezes right after the Response resolves, so
       un-awaited (fire-and-forget) writes are dropped — confirmed on the
       S1c preview (login worked but the rehash + last_login + history never
       persisted). We therefore AWAIT them, but wrap in allSettled + try/catch
       so a DB hiccup can NEVER block or fail an already-successful login.

       Includes the lazy Argon2id upgrade for legacy logins (flag-gated by
       AUTH_LAZY_REHASH). Never logs the password or hash. */
    const now = new Date().toISOString();
    const doRehash =
      verdict.needsRehash && verdict.newHash && process.env.AUTH_LAZY_REHASH !== "off";
    try {
      await Promise.allSettled([
        doRehash
          ? supabaseServer
              .from("accounts")
              .update({
                password_hash: verdict.newHash,
                password_algo: verdict.newAlgo ?? "argon2id",
                password_changed_at: now,
                last_login_at: now,
              })
              .eq("id", account.id)
          : supabaseServer
              .from("accounts")
              .update({ last_login_at: now })
              .eq("id", account.id),
        supabaseServer.from("account_login_history").insert({
          account_id: account.id,
          event_type: "login_success",
          metadata: { via: "password" },
        }),
      ]);
    } catch {
      /* never block a successful login on a side-effect write */
    }

    // Observe-mode: record the successful attempt (awaited, self-guarded).
    if (rlActive) {
      await recordAttempt({
        ip, identifier, userAgent, accountId: account.id, tenantId: account.tenant_id,
        outcome: "success", reason: "login_success", wouldBlock, mode: rlMode,
      });
    }

    /* P1 · S1 — stateful-session SHADOW (write + comparator). SUCCESS ONLY.
       Flag-gated (SESSION_STATEFUL_SHADOW); log-only; never authoritative.
       The legacy cookie set above remains the ONLY auth source. Self-guarded
       so a shadow-write/comparator/DB hiccup can NEVER block an already-
       successful login. No token is ever returned to the client. */
    await recordSessionShadow({
      accountId: account.id,
      accountStatus: account.status,
      req,
    }).catch(() => undefined);

    /* Super Admin activity monitoring — record the login in the activity feed.
       Best-effort + awaited (Vercel freezes the lambda after the response);
       logActivity self-guards so it can never block a successful login. The
       client's first heartbeat will register the device with its real id. */
    await logActivity({
      account_id: account.id,
      tenant_id: account.tenant_id,
      event_type: "login",
      module: "Auth",
      title: "Signed in",
      meta: requestMeta(req),
      metadata: { via: "password" },
    }).catch(() => undefined);

    // Super-Admin "user logged in" alert (other admins; never self).
    const loginMeta = requestMeta(req);
    await notifySuperAdmins({
      kind: "login",
      subject: `${account.username || account.login_email} signed in`,
      actorName: account.username || account.login_email,
      action: "Signed in",
      location: locationLabel(loginMeta),
      severity: "info",
      actorAccountId: account.id,
      tenantId: account.tenant_id,
      metadata: { username: account.username },
    }).catch(() => undefined);

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
