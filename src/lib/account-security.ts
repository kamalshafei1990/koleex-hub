/* ---------------------------------------------------------------------------
   Account security — Supabase CRUD + Web Crypto helpers.

   Backs the Security tab in AccountDetail. Three concerns:

     1. API keys   — full key shown once at creation; only sha256 stored.
     2. Sessions   — active devices, token stored as sha256 only.
     3. Login log  — append-only audit trail of auth / security events.

   Uses the untyped admin client (anon key) just like accounts-admin.ts.
   All access is gated at the UI layer by AdminAuth for now; once real
   Supabase Auth lands (see SUPABASE_AUTH_SETUP.md) RLS will take over.
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
import type {
  ApiKeyRow,
  ApiKeyInsert,
  AccountSessionRow,
  AccountSessionInsert,
  LoginHistoryRow,
  LoginEventType,
  DeviceType,
} from "@/types/supabase";

const API_KEYS = "account_api_keys";
const SESSIONS = "account_sessions";
const LOGIN_HISTORY = "account_login_history";

/* ============================================================================
   Web Crypto helpers (browser + Node 18+ both expose globalThis.crypto)
   ============================================================================ */

/** sha256 hex digest. Used to hash API keys + session tokens before storage. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a new API key token: `koleex_live_<40 random chars>`. */
export function generateApiKeyToken(): string {
  // crypto.randomUUID() → 36 chars with dashes; strip and concatenate two for entropy.
  const raw =
    crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  return `koleex_live_${raw.slice(0, 40)}`;
}

/** Identifier prefix shown in the list view so users can tell keys apart. */
export function keyPrefix(token: string): string {
  // Show the fixed prefix plus first 4 random chars: "koleex_live_ab3f"
  return token.slice(0, 16);
}

/* ============================================================================
   Device / User-Agent parsing (quick heuristic; no big ua-parser dependency)
   ============================================================================ */

export function parseUserAgent(ua: string | null | undefined): {
  device_name: string;
  device_type: DeviceType;
  os: string;
  browser: string;
} {
  const u = (ua || "").toLowerCase();
  let device_type: DeviceType = "desktop";
  if (/ipad|tablet/.test(u)) device_type = "tablet";
  else if (/mobile|iphone|android/.test(u)) device_type = "mobile";

  let os = "Unknown";
  if (/windows/.test(u)) os = "Windows";
  else if (/mac os|macintosh/.test(u)) os = "macOS";
  else if (/iphone|ipad|ios/.test(u)) os = "iOS";
  else if (/android/.test(u)) os = "Android";
  else if (/linux/.test(u)) os = "Linux";

  let browser = "Unknown";
  if (/edg\//.test(u)) browser = "Edge";
  else if (/chrome\//.test(u) && !/edg\//.test(u)) browser = "Chrome";
  else if (/safari\//.test(u) && !/chrome/.test(u)) browser = "Safari";
  else if (/firefox\//.test(u)) browser = "Firefox";

  return {
    device_name: `${browser} on ${os}`,
    device_type,
    os,
    browser,
  };
}

/* ============================================================================
   API keys
   ============================================================================ */

export async function fetchApiKeys(accountId: string): Promise<ApiKeyRow[]> {
  const { data, error } = await supabase
    .from(API_KEYS)
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[Security] fetchApiKeys:", error.message);
    return [];
  }
  return (data as ApiKeyRow[]) || [];
}

/**
 * Create a new API key for an account. Returns both the raw token (to show
 * the user exactly once) and the stored row. The caller is responsible for
 * displaying the token and never persisting it anywhere else.
 */
export async function createApiKey(
  accountId: string,
  opts: {
    name: string;
    scopes?: string[];
    expiresAt?: string | null;
  },
): Promise<{ token: string; row: ApiKeyRow } | null> {
  const token = generateApiKeyToken();
  const hash = await sha256Hex(token);
  const prefix = keyPrefix(token);

  const insert: ApiKeyInsert = {
    account_id: accountId,
    name: opts.name.trim(),
    key_prefix: prefix,
    key_hash: hash,
    scopes: opts.scopes || [],
    expires_at: opts.expiresAt || null,
    last_used_at: null,
    revoked_at: null,
  };

  const { data, error } = await supabase
    .from(API_KEYS)
    .insert(insert)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    console.error("[Security] createApiKey:", error?.message);
    return null;
  }

  // Audit log (best-effort — don't block on it).
  void logEvent(accountId, "api_key_created", { key_prefix: prefix });

  return { token, row: data as ApiKeyRow };
}

export async function revokeApiKey(id: string): Promise<boolean> {
  // Fetch the row first so we can include it in the audit log.
  const { data: existing } = await supabase
    .from(API_KEYS)
    .select("account_id, key_prefix")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from(API_KEYS)
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[Security] revokeApiKey:", error.message);
    return false;
  }

  if (existing) {
    const row = existing as { account_id: string; key_prefix: string };
    void logEvent(row.account_id, "api_key_revoked", {
      key_prefix: row.key_prefix,
    });
  }
  return true;
}

export async function deleteApiKey(id: string): Promise<boolean> {
  const { error } = await supabase.from(API_KEYS).delete().eq("id", id);
  if (error) {
    console.error("[Security] deleteApiKey:", error.message);
    return false;
  }
  return true;
}

/* ============================================================================
   Sessions / devices
   ============================================================================ */

export async function fetchSessions(
  accountId: string,
): Promise<AccountSessionRow[]> {
  const { data, error } = await supabase
    .from(SESSIONS)
    .select("*")
    .eq("account_id", accountId)
    .is("revoked_at", null)
    .order("last_active_at", { ascending: false });
  if (error) {
    console.error("[Security] fetchSessions:", error.message);
    return [];
  }
  return (data as AccountSessionRow[]) || [];
}

/**
 * Create a new session row. `rawToken` is any opaque string you want to tie
 * to this session — we never store it, only its sha256.
 */
export async function createSession(
  accountId: string,
  rawToken: string,
  meta: {
    user_agent?: string | null;
    ip_address?: string | null;
    expires_at?: string | null;
  } = {},
): Promise<AccountSessionRow | null> {
  const hash = await sha256Hex(rawToken);
  const ua = parseUserAgent(meta.user_agent);

  const insert: AccountSessionInsert = {
    account_id: accountId,
    session_token_hash: hash,
    device_name: ua.device_name,
    device_type: ua.device_type,
    os: ua.os,
    browser: ua.browser,
    ip_address: meta.ip_address || null,
    expires_at: meta.expires_at || null,
    revoked_at: null,
  };

  const { data, error } = await supabase
    .from(SESSIONS)
    .insert(insert)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[Security] createSession:", error.message);
    return null;
  }
  return (data as AccountSessionRow) || null;
}

export async function touchSession(id: string): Promise<boolean> {
  const { error } = await supabase
    .from(SESSIONS)
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[Security] touchSession:", error.message);
    return false;
  }
  return true;
}

export async function revokeSession(id: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from(SESSIONS)
    .select("account_id, device_name")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from(SESSIONS)
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[Security] revokeSession:", error.message);
    return false;
  }

  if (existing) {
    const row = existing as { account_id: string; device_name: string | null };
    void logEvent(row.account_id, "session_revoked", {
      device_name: row.device_name,
    });
  }
  return true;
}

/* ============================================================================
   Login / audit history
   ============================================================================ */

export async function fetchLoginHistory(
  accountId: string,
  limit = 50,
): Promise<LoginHistoryRow[]> {
  const { data, error } = await supabase
    .from(LOGIN_HISTORY)
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[Security] fetchLoginHistory:", error.message);
    return [];
  }
  return (data as LoginHistoryRow[]) || [];
}

/** Append-only audit event. Safe to call in the background. */
export async function logEvent(
  accountId: string,
  eventType: LoginEventType,
  metadata: Record<string, unknown> = {},
  opts: { ip_address?: string | null; user_agent?: string | null } = {},
): Promise<void> {
  const row = {
    account_id: accountId,
    event_type: eventType,
    ip_address: opts.ip_address || null,
    user_agent:
      opts.user_agent ||
      (typeof navigator !== "undefined" ? navigator.userAgent : null),
    metadata,
  };
  const { error } = await supabase.from(LOGIN_HISTORY).insert(row);
  if (error) {
    // Non-fatal — just log to the console so we don't break the UI flow.
    console.warn("[Security] logEvent failed:", error.message);
  }
}
