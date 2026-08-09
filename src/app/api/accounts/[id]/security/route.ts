import "server-only";

/* The account Security tab: API keys, active sessions, login history.

   GET  ?part=keys|sessions|history
   POST { action: "createKey" | "revokeKey" | "deleteKey" | "createSession"
                 | "touchSession" | "revokeSession" | "logEvent", ... }

   account_api_keys, account_sessions and account_login_history all have RLS on
   with ZERO policies — deny-all for everything except service_role. Every one
   of these operations used to run in the browser with the anon key, so the
   Security tab showed no keys, no devices and no history, creating a key
   returned nothing, and revoking did nothing.

   The audit trail was the quiet casualty: `logEvent` is called from the
   account flows (force-reset toggled, key revoked, device signed out) and it
   has been writing nothing at all. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

const API_KEYS = "account_api_keys";
const SESSIONS = "account_sessions";
const LOGIN_HISTORY = "account_login_history";

/** The target account must live in the caller's tenant. Without this an admin
 *  on one tenant could read another tenant's devices by guessing an id. */
async function guard(accountId: string, tenantId: string | null) {
  let q = supabaseServer.from("accounts").select("id").eq("id", accountId);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q.maybeSingle();
  return data ? null : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: accountId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Accounts");
  if (deny) return deny;
  const bad = await guard(accountId, auth.tenant_id);
  if (bad) return bad;

  const part = new URL(req.url).searchParams.get("part");
  const fail = (what: string, msg: string) => {
    console.error(`[api/accounts/security ${what}]`, msg);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  };

  if (part === "keys") {
    const { data, error } = await supabaseServer
      .from(API_KEYS).select("*").eq("account_id", accountId)
      .order("created_at", { ascending: false });
    if (error) return fail("keys", error.message);
    return NextResponse.json({ keys: data ?? [] });
  }
  if (part === "sessions") {
    const { data, error } = await supabaseServer
      .from(SESSIONS).select("*").eq("account_id", accountId)
      .is("revoked_at", null)
      .order("last_active_at", { ascending: false });
    if (error) return fail("sessions", error.message);
    return NextResponse.json({ sessions: data ?? [] });
  }
  if (part === "history") {
    const limitRaw = Number(new URL(req.url).searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 200) : 50;
    const { data, error } = await supabaseServer
      .from(LOGIN_HISTORY).select("*").eq("account_id", accountId)
      .order("created_at", { ascending: false }).limit(limit);
    if (error) return fail("history", error.message);
    return NextResponse.json({ history: data ?? [] });
  }
  return NextResponse.json({ error: "Unknown part" }, { status: 400 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: accountId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const bad0 = await requireModuleAccess(auth, "Accounts");
  if (bad0) return bad0;
  const bad = await guard(accountId, auth.tenant_id);
  if (bad) return bad;

  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : null;
  if (!action) return NextResponse.json({ error: "action is required" }, { status: 400 });

/* The table CHECK-constrains event_type. Anything outside this set is
     rejected by Postgres, so it is rejected here too — with a 400 that names
     the problem, rather than an insert that fails inside a handler which has
     already decided to answer ok. */
  const EVENT_TYPES = new Set([
    "login_success", "login_failed", "logout", "password_reset",
    "force_reset_enabled", "force_reset_cleared",
    "two_factor_enabled", "two_factor_disabled",
    "api_key_created", "api_key_revoked", "session_revoked",
    "passkey_enrolled", "passkey_revoked",
  ]);

  const audit = async (eventType: string, metadata: Record<string, unknown> = {}) => {
    if (!EVENT_TYPES.has(eventType)) {
      console.error("[api/accounts/security audit] unknown event_type:", eventType);
      return false;
    }
    const { error } = await supabaseServer.from(LOGIN_HISTORY).insert({
      account_id: accountId,
      event_type: eventType,
      ip_address: null,
      user_agent: req.headers.get("user-agent"),
      metadata,
    });
    if (error) {
      console.error("[api/accounts/security audit]", error.message);
      return false;
    }
    return true;
  };

  switch (action) {
    /* The TOKEN is generated in the browser and only its hash is sent here —
       the plaintext key is shown to the admin once and never stored. */
    case "createKey": {
      const denyW = await requireModuleAction(auth, "Accounts", "create");
      if (denyW) return denyW;
      const { data, error } = await supabaseServer
        .from(API_KEYS)
        .insert({
          account_id: accountId,
          name: String(body.name ?? "").trim(),
          key_prefix: body.key_prefix ?? null,
          key_hash: body.key_hash ?? null,
          scopes: body.scopes ?? [],
          expires_at: body.expires_at ?? null,
        })
        .select("*")
        .single();
      if (error) {
        console.error("[api/accounts/security createKey]", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const logged = await audit("api_key_created", { name: body.name, prefix: body.key_prefix });
      return NextResponse.json({ key: data, audited: logged });
    }

    case "revokeKey": {
      const denyW = await requireModuleAction(auth, "Accounts", "edit");
      if (denyW) return denyW;
      const id = String(body.id ?? "");
      const { data: existing } = await supabaseServer
        .from(API_KEYS).select("account_id, key_prefix").eq("id", id).maybeSingle();
      const { error } = await supabaseServer
        .from(API_KEYS).update({ revoked_at: new Date().toISOString() }).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const logged = await audit("api_key_revoked", { prefix: (existing as { key_prefix?: string } | null)?.key_prefix });
      return NextResponse.json({ ok: true, audited: logged });
    }

    case "deleteKey": {
      const denyW = await requireModuleAction(auth, "Accounts", "delete");
      if (denyW) return denyW;
      const { error } = await supabaseServer
        .from(API_KEYS).delete().eq("id", String(body.id ?? ""));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "createSession": {
      const { data, error } = await supabaseServer
        .from(SESSIONS)
        .insert({
          account_id: accountId,
          session_token_hash: body.session_token_hash ?? null,
          device_name: body.device_name ?? null,
          device_type: body.device_type ?? null,
          browser: body.browser ?? null,
          os: body.os ?? null,
          user_agent: body.user_agent ?? req.headers.get("user-agent"),
          ip_address: body.ip_address ?? null,
          expires_at: body.expires_at ?? null,
        })
        .select("*")
        .single();
      if (error) {
        console.error("[api/accounts/security createSession]", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ session: data });
    }

    case "touchSession": {
      const { error } = await supabaseServer
        .from(SESSIONS)
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", String(body.id ?? ""));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "revokeSession": {
      const id = String(body.id ?? "");
      const { data: existing } = await supabaseServer
        .from(SESSIONS).select("account_id, device_name").eq("id", id).maybeSingle();
      const { error } = await supabaseServer
        .from(SESSIONS).update({ revoked_at: new Date().toISOString() }).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const logged = await audit("session_revoked", { device: (existing as { device_name?: string } | null)?.device_name });
      return NextResponse.json({ ok: true, audited: logged });
    }

    /* An audit write that quietly fails is worse than no audit at all — the
       caller believes the trail has an entry it does not have. */
    case "logEvent": {
      const type = String(body.event_type ?? "");
      if (!EVENT_TYPES.has(type)) {
        return NextResponse.json(
          { error: `Unknown event_type: ${type}` },
          { status: 400 },
        );
      }
      const ok = await audit(type, (body.metadata as Record<string, unknown>) ?? {});
      return ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: "Audit write failed" }, { status: 500 });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
