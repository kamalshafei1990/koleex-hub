import "server-only";

/* ---------------------------------------------------------------------------
   Server-side activity & presence helpers (service role).

   Everything here is BEST-EFFORT: a logging/presence write must NEVER block or
   fail the operation it accompanies. All functions swallow errors (logged to
   the server console only) — same discipline as qa/activity + inventory/audit.

   Security: these write to service-role-only tables (app_sessions,
   activity_events, user_devices). The browser cannot touch them directly; it
   calls our authenticated API routes which call these helpers.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { parseUserAgent } from "@/lib/account-security";
import { sha256Hex } from "@/lib/account-security";

export type ActivitySeverity = "info" | "warning" | "critical";

export interface RequestMeta {
  ip: string | null;
  country: string | null;
  city: string | null;
  user_agent: string | null;
  browser: string;
  os: string;
  device_type: string;
  device_name: string;
}

/** Extract IP / geo / parsed user-agent from an incoming request. Geo headers
 *  are set by Vercel's edge network when present; otherwise null. */
export function requestMeta(req: Request): RequestMeta {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  const ip =
    (fwd ? fwd.split(",")[0]?.trim() : null) ||
    h.get("x-real-ip")?.trim() ||
    null;
  const ua = h.get("user-agent");
  const parsed = parseUserAgent(ua);
  return {
    ip: ip && ip !== "unknown" ? ip : null,
    country: h.get("x-vercel-ip-country") || null,
    city: h.get("x-vercel-ip-city") || null,
    user_agent: ua,
    browser: parsed.browser,
    os: parsed.os,
    device_type: parsed.device_type,
    device_name: parsed.device_name,
  };
}

/** Human label for a request's geo, e.g. "Singapore" or "Belgrade, Serbia".
 *  `country` is an ISO-3166 alpha-2 code (Vercel edge header); we expand it to a
 *  full country name. Returns null when no geo is available (e.g. local dev). */
export function locationLabel(
  meta: { country: string | null; city: string | null } | null | undefined,
): string | null {
  if (!meta) return null;
  const code = meta.country?.trim() || null;
  let countryName: string | null = null;
  if (code) {
    try {
      countryName =
        new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) || code;
    } catch {
      countryName = code;
    }
  }
  const city = meta.city?.trim() || null;
  if (city && countryName) return `${city}, ${countryName}`;
  return city || countryName || null;
}

/* ── Generic activity-event insert ─────────────────────────────────────── */

export interface ActivityEventInput {
  account_id: string;
  tenant_id?: string | null;
  session_id?: string | null;
  device_id?: string | null;
  event_type: string;
  route?: string | null;
  module?: string | null;
  title?: string | null;
  referrer?: string | null;
  severity?: ActivitySeverity;
  meta?: RequestMeta | null;
  metadata?: Record<string, unknown>;
}

export async function logActivity(input: ActivityEventInput): Promise<void> {
  try {
    await supabaseServer.from("activity_events").insert({
      account_id: input.account_id,
      tenant_id: input.tenant_id ?? null,
      session_id: input.session_id ?? null,
      device_id: input.device_id ?? null,
      event_type: input.event_type,
      route: input.route ?? null,
      module: input.module ?? null,
      title: input.title ?? null,
      referrer: input.referrer ?? null,
      severity: input.severity ?? "info",
      ip: input.meta?.ip ?? null,
      country: input.meta?.country ?? null,
      browser: input.meta?.browser ?? null,
      os: input.meta?.os ?? null,
      device_type: input.meta?.device_type ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (e) {
    console.error("[activity.logActivity]", e instanceof Error ? e.message : e);
  }
}

/* ── Device registry (trust / block) ───────────────────────────────────── */

/** Upsert the user_devices row for (account, device). Marks first/last seen,
 *  IP/country, and the parsed UA. Returns whether this device is brand-new for
 *  the account (used to fire a "login from new device" alert). */
export async function touchDevice(args: {
  account_id: string;
  tenant_id?: string | null;
  device_id: string;
  meta: RequestMeta;
}): Promise<{ isNew: boolean; isBlocked: boolean }> {
  try {
    const { data: existing } = await supabaseServer
      .from("user_devices")
      .select("id, is_blocked")
      .eq("account_id", args.account_id)
      .eq("device_id", args.device_id)
      .maybeSingle();

    const uaHash = args.meta.user_agent ? await sha256Hex(args.meta.user_agent) : null;
    const now = new Date().toISOString();

    if (existing) {
      await supabaseServer
        .from("user_devices")
        .update({
          last_seen_at: now,
          last_ip: args.meta.ip,
          last_country: args.meta.country,
          browser: args.meta.browser,
          os: args.meta.os,
          device_type: args.meta.device_type,
          user_agent_hash: uaHash,
        })
        .eq("id", (existing as { id: string }).id);
      return { isNew: false, isBlocked: !!(existing as { is_blocked: boolean }).is_blocked };
    }

    await supabaseServer.from("user_devices").insert({
      account_id: args.account_id,
      tenant_id: args.tenant_id ?? null,
      device_id: args.device_id,
      browser: args.meta.browser,
      os: args.meta.os,
      device_type: args.meta.device_type,
      user_agent_hash: uaHash,
      last_ip: args.meta.ip,
      last_country: args.meta.country,
    });
    return { isNew: true, isBlocked: false };
  } catch (e) {
    console.error("[activity.touchDevice]", e instanceof Error ? e.message : e);
    return { isNew: false, isBlocked: false };
  }
}

/* ── Presence heartbeat (app_sessions upsert) ──────────────────────────── */

export interface HeartbeatInput {
  account_id: string;
  tenant_id?: string | null;
  device_id: string;
  status: "active" | "idle" | "offline";
  current_route?: string | null;
  current_module?: string | null;
  last_action?: string | null;
  meta: RequestMeta;
}

/** Upsert the live-presence row for (account, device). Returns the session id
 *  and whether the session has been revoked by an admin (so the client can
 *  force itself to sign out). */
export async function heartbeat(
  input: HeartbeatInput,
): Promise<{ session_id: string | null; revoked: boolean }> {
  try {
    const { data: existing } = await supabaseServer
      .from("app_sessions")
      .select("id, status")
      .eq("account_id", input.account_id)
      .eq("device_id", input.device_id)
      .maybeSingle();

    const now = new Date().toISOString();

    if (existing) {
      const row = existing as { id: string; status: string };
      // An admin-revoked session stays revoked — tell the client to sign out.
      if (row.status === "revoked") return { session_id: row.id, revoked: true };
      await supabaseServer
        .from("app_sessions")
        .update({
          status: input.status,
          last_seen_at: now,
          current_route: input.current_route ?? null,
          current_module: input.current_module ?? null,
          last_action: input.last_action ?? null,
          ip: input.meta.ip,
          country: input.meta.country,
          city: input.meta.city,
          browser: input.meta.browser,
          os: input.meta.os,
          device_type: input.meta.device_type,
          user_agent: input.meta.user_agent,
        })
        .eq("id", row.id);
      return { session_id: row.id, revoked: false };
    }

    const { data: inserted } = await supabaseServer
      .from("app_sessions")
      .insert({
        account_id: input.account_id,
        tenant_id: input.tenant_id ?? null,
        device_id: input.device_id,
        status: input.status,
        current_route: input.current_route ?? null,
        current_module: input.current_module ?? null,
        last_action: input.last_action ?? null,
        ip: input.meta.ip,
        country: input.meta.country,
        city: input.meta.city,
        browser: input.meta.browser,
        os: input.meta.os,
        device_type: input.meta.device_type,
        user_agent: input.meta.user_agent,
      })
      .select("id")
      .maybeSingle();
    return { session_id: (inserted as { id: string } | null)?.id ?? null, revoked: false };
  } catch (e) {
    console.error("[activity.heartbeat]", e instanceof Error ? e.message : e);
    return { session_id: null, revoked: false };
  }
}

/** Mark a device's presence row offline (called on tab close / sign-out). */
export async function endPresence(account_id: string, device_id: string): Promise<void> {
  try {
    await supabaseServer
      .from("app_sessions")
      .update({ status: "offline", ended_at: new Date().toISOString() })
      .eq("account_id", account_id)
      .eq("device_id", device_id)
      .neq("status", "revoked");
  } catch (e) {
    console.error("[activity.endPresence]", e instanceof Error ? e.message : e);
  }
}
