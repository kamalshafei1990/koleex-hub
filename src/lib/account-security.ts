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

import type {
  ApiKeyRow,
  AccountSessionRow,
  LoginHistoryRow,
  LoginEventType,
  DeviceType,
} from "@/types/supabase";


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

/* Every database operation here goes through /api/accounts/[id]/security.
   account_api_keys, account_sessions and account_login_history have RLS on
   with ZERO policies, so the browser queries these replace could not read or
   write a single row: the Security tab showed nothing, creating a key returned
   nothing, revoking did nothing, and the audit trail — logEvent, called from
   the account flows — was silently never written. */
async function sec<T>(accountId: string, path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`/api/accounts/${accountId}/security${path}`, {
      credentials: "include",
      ...init,
    });
    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403 && res.status !== 404) {
        console.error("[Security]", path, res.status);
      }
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error("[Security]", path, "failed:", e);
    return null;
  }
}
const post = (accountId: string, body: Record<string, unknown>) =>
  sec<Record<string, unknown>>(accountId, "", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export async function fetchApiKeys(accountId: string): Promise<ApiKeyRow[]> {
  const j = await sec<{ keys: ApiKeyRow[] }>(accountId, "?part=keys");
  return j?.keys ?? [];
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
  /* The token is generated HERE and only its hash crosses the wire — the
     plaintext key is shown to the admin once and is never stored anywhere. */
  const token = generateApiKeyToken();
  const hash = await sha256Hex(token);
  const prefix = keyPrefix(token);

  const j = await post(accountId, {
    action: "createKey",
    name: opts.name.trim(),
    key_prefix: prefix,
    key_hash: hash,
    scopes: opts.scopes || [],
    expires_at: opts.expiresAt || null,
  });
  const row = (j as { key?: ApiKeyRow } | null)?.key;
  if (!row) return null;
  return { token, row };
}

export async function revokeApiKey(id: string, accountId: string): Promise<boolean> {
  const j = await post(accountId, { action: "revokeKey", id });
  return j != null;
}

export async function deleteApiKey(id: string, accountId: string): Promise<boolean> {
  const j = await post(accountId, { action: "deleteKey", id });
  return j != null;
}

/* ============================================================================
   Sessions / devices
   ============================================================================ */

export async function fetchSessions(
  accountId: string,
): Promise<AccountSessionRow[]> {
  const j = await sec<{ sessions: AccountSessionRow[] }>(accountId, "?part=sessions");
  return j?.sessions ?? [];
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
  const j = await post(accountId, {
    action: "createSession",
    session_token_hash: hash,
    device_name: ua.device_name,
    device_type: ua.device_type,
    os: ua.os,
    browser: ua.browser,
    user_agent: meta.user_agent ?? null,
    ip_address: meta.ip_address || null,
    expires_at: meta.expires_at || null,
  });
  return ((j as { session?: AccountSessionRow } | null)?.session) ?? null;
}

export async function touchSession(id: string, accountId: string): Promise<boolean> {
  const j = await post(accountId, { action: "touchSession", id });
  return j != null;
}

export async function revokeSession(id: string, accountId: string): Promise<boolean> {
  /* The route writes the session_revoked audit row itself, from the session —
     an audit entry whose author the client can choose is not an audit entry. */
  const j = await post(accountId, { action: "revokeSession", id });
  return j != null;
}

/* ============================================================================
   Login / audit history
   ============================================================================ */

export async function fetchLoginHistory(
  accountId: string,
  limit = 50,
): Promise<LoginHistoryRow[]> {
  const j = await sec<{ history: LoginHistoryRow[] }>(
    accountId, `?part=history&limit=${limit}`,
  );
  return j?.history ?? [];
}

/** Append-only audit event. Safe to call in the background. */
export async function logEvent(
  accountId: string,
  eventType: LoginEventType,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await post(accountId, { action: "logEvent", event_type: eventType, metadata });
}
