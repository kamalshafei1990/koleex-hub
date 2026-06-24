import "server-only";

/* ---------------------------------------------------------------------------
   Super Admin monitoring queries (service role, SA-gated at the route layer).

   These read the service-role-only monitoring tables + the existing security
   tables (account_login_history, login_attempts) and join in account identity
   (email / display name / role / avatar). Never returns password/auth secrets.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

/** Presence windows (ms): online if seen within ONLINE; idle within IDLE. */
export const ONLINE_MS = 90_000;
export const IDLE_MS = 5 * 60_000;

export type LiveStatus = "online" | "idle" | "offline";

export interface AccountInfo {
  account_id: string;
  email: string | null;
  name: string | null;
  username: string | null;
  role: string | null;
  avatar_url: string | null;
}

/** Batch-resolve display info for a set of account ids. */
export async function accountDirectory(ids: string[]): Promise<Map<string, AccountInfo>> {
  const map = new Map<string, AccountInfo>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return map;

  const { data: accounts } = await supabaseServer
    .from("accounts")
    .select("id, login_email, username, person_id, role_id, avatar_url")
    .in("id", unique);
  const accRows = (accounts ?? []) as Array<{
    id: string;
    login_email: string | null;
    username: string | null;
    person_id: string | null;
    role_id: string | null;
    avatar_url: string | null;
  }>;

  const personIds = accRows.map((a) => a.person_id).filter(Boolean) as string[];
  const roleIds = Array.from(new Set(accRows.map((a) => a.role_id).filter(Boolean) as string[]));

  const [peopleRes, rolesRes] = await Promise.all([
    personIds.length
      ? supabaseServer.from("people").select("id, full_name, avatar_url").in("id", personIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; avatar_url: string | null }> }),
    roleIds.length
      ? supabaseServer.from("roles").select("id, name").in("id", roleIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
  ]);
  const people = new Map(
    ((peopleRes.data ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>).map(
      (p) => [p.id, p],
    ),
  );
  const roles = new Map(
    ((rolesRes.data ?? []) as Array<{ id: string; name: string | null }>).map((r) => [r.id, r.name]),
  );

  for (const a of accRows) {
    const person = a.person_id ? people.get(a.person_id) : null;
    map.set(a.id, {
      account_id: a.id,
      email: a.login_email,
      name: person?.full_name ?? a.username ?? null,
      username: a.username,
      role: a.role_id ? roles.get(a.role_id) ?? null : null,
      avatar_url: a.avatar_url ?? person?.avatar_url ?? null,
    });
  }
  return map;
}

function liveStatus(lastSeen: string, raw: string): LiveStatus {
  if (raw === "revoked" || raw === "offline" || raw === "expired") return "offline";
  const age = Date.now() - new Date(lastSeen).getTime();
  if (age <= ONLINE_MS) return "online";
  if (age <= IDLE_MS) return "idle";
  return "offline";
}

export interface OnlineUserRow {
  session_id: string;
  account: AccountInfo;
  status: LiveStatus;
  raw_status: string;
  current_route: string | null;
  current_module: string | null;
  last_action: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  ip: string | null;
  country: string | null;
  started_at: string;
  last_seen_at: string;
}

/** Live users — one row per active presence session, newest activity first. */
export async function onlineUsers(): Promise<OnlineUserRow[]> {
  const sinceIdle = new Date(Date.now() - IDLE_MS).toISOString();
  const { data } = await supabaseServer
    .from("app_sessions")
    .select(
      "id, account_id, status, current_route, current_module, last_action, device_type, browser, os, ip, country, started_at, last_seen_at",
    )
    .neq("status", "revoked")
    .gte("last_seen_at", sinceIdle)
    .order("last_seen_at", { ascending: false })
    .limit(500);
  const rows = (data ?? []) as Array<{
    id: string;
    account_id: string;
    status: string;
    current_route: string | null;
    current_module: string | null;
    last_action: string | null;
    device_type: string | null;
    browser: string | null;
    os: string | null;
    ip: string | null;
    country: string | null;
    started_at: string;
    last_seen_at: string;
  }>;
  const dir = await accountDirectory(rows.map((r) => r.account_id));
  return rows.map((r) => ({
    session_id: r.id,
    account: dir.get(r.account_id) ?? {
      account_id: r.account_id,
      email: null,
      name: null,
      username: null,
      role: null,
      avatar_url: null,
    },
    status: liveStatus(r.last_seen_at, r.status),
    raw_status: r.status,
    current_route: r.current_route,
    current_module: r.current_module,
    last_action: r.last_action,
    device_type: r.device_type,
    browser: r.browser,
    os: r.os,
    ip: r.ip,
    country: r.country,
    started_at: r.started_at,
    last_seen_at: r.last_seen_at,
  }));
}

export interface ActivityFilters {
  account_id?: string | null;
  module?: string | null;
  event_type?: string | null;
  severity?: string | null;
  search?: string | null;
  from?: string | null; // ISO
  to?: string | null; // ISO
  criticalOnly?: boolean;
  limit?: number;
  before?: string | null; // created_at cursor for pagination
}

export interface ActivityRow {
  id: string;
  account: AccountInfo;
  event_type: string;
  route: string | null;
  module: string | null;
  title: string | null;
  severity: string;
  ip: string | null;
  country: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Activity feed with filters + cursor pagination (newest first). */
export async function activityFeed(filters: ActivityFilters): Promise<ActivityRow[]> {
  const limit = Math.min(filters.limit ?? 60, 200);
  let q = supabaseServer
    .from("activity_events")
    .select(
      "id, account_id, event_type, route, module, title, severity, ip, country, browser, os, device_type, metadata, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.account_id) q = q.eq("account_id", filters.account_id);
  if (filters.module) q = q.eq("module", filters.module);
  if (filters.event_type) q = q.eq("event_type", filters.event_type);
  if (filters.criticalOnly) q = q.eq("severity", "critical");
  else if (filters.severity) q = q.eq("severity", filters.severity);
  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);
  if (filters.before) q = q.lt("created_at", filters.before);
  if (filters.search) {
    const s = `%${filters.search}%`;
    q = q.or(`route.ilike.${s},title.ilike.${s},module.ilike.${s},event_type.ilike.${s}`);
  }

  const { data } = await q;
  const rows = (data ?? []) as Array<{
    id: string;
    account_id: string;
    event_type: string;
    route: string | null;
    module: string | null;
    title: string | null;
    severity: string;
    ip: string | null;
    country: string | null;
    browser: string | null;
    os: string | null;
    device_type: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  const dir = await accountDirectory(rows.map((r) => r.account_id));
  return rows.map((r) => ({
    id: r.id,
    account: dir.get(r.account_id) ?? {
      account_id: r.account_id,
      email: null,
      name: null,
      username: null,
      role: null,
      avatar_url: null,
    },
    event_type: r.event_type,
    route: r.route,
    module: r.module,
    title: r.title,
    severity: r.severity,
    ip: r.ip,
    country: r.country,
    browser: r.browser,
    os: r.os,
    device_type: r.device_type,
    metadata: r.metadata ?? {},
    created_at: r.created_at,
  }));
}

export interface Kpis {
  online_users: number;
  active_sessions: number;
  critical_alerts_today: number;
  failed_logins_today: number;
  sensitive_actions_today: number;
}

/** Dashboard KPI counters. */
export async function kpis(): Promise<Kpis> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const dayIso = startOfDay.toISOString();
  const onlineIso = new Date(Date.now() - ONLINE_MS).toISOString();
  const idleIso = new Date(Date.now() - IDLE_MS).toISOString();

  const [online, sessions, critical, failed, sensitive] = await Promise.all([
    supabaseServer
      .from("app_sessions")
      .select("account_id", { count: "exact", head: true })
      .neq("status", "revoked")
      .gte("last_seen_at", onlineIso),
    supabaseServer
      .from("app_sessions")
      .select("id", { count: "exact", head: true })
      .neq("status", "revoked")
      .gte("last_seen_at", idleIso),
    supabaseServer
      .from("activity_events")
      .select("id", { count: "exact", head: true })
      .eq("severity", "critical")
      .gte("created_at", dayIso),
    supabaseServer
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .in("outcome", ["failure", "blocked"])
      .gte("created_at", dayIso),
    supabaseServer
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .in("severity", ["warning", "critical"])
      .gte("created_at", dayIso),
  ]);

  return {
    online_users: online.count ?? 0,
    active_sessions: sessions.count ?? 0,
    critical_alerts_today: critical.count ?? 0,
    failed_logins_today: failed.count ?? 0,
    sensitive_actions_today: sensitive.count ?? 0,
  };
}

export interface UserDetail {
  account: AccountInfo | null;
  sessions: OnlineUserRow[];
  recent_activity: ActivityRow[];
  devices: Array<Record<string, unknown>>;
  login_history: Array<Record<string, unknown>>;
  failed_logins: Array<Record<string, unknown>>;
}

/** Full activity detail for one account (for the drawer). */
export async function userDetail(accountId: string): Promise<UserDetail> {
  const dir = await accountDirectory([accountId]);
  const [sessRes, actRes, devRes, histRes, failRes] = await Promise.all([
    supabaseServer
      .from("app_sessions")
      .select(
        "id, account_id, status, current_route, current_module, last_action, device_type, browser, os, ip, country, started_at, last_seen_at",
      )
      .eq("account_id", accountId)
      .order("last_seen_at", { ascending: false })
      .limit(50),
    activityFeed({ account_id: accountId, limit: 50 }),
    supabaseServer
      .from("user_devices")
      .select("device_id, browser, os, device_type, last_ip, last_country, is_trusted, is_blocked, first_seen_at, last_seen_at")
      .eq("account_id", accountId)
      .order("last_seen_at", { ascending: false }),
    supabaseServer
      .from("account_login_history")
      .select("event_type, ip_address, user_agent, metadata, created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabaseServer
      .from("login_attempts")
      .select("identifier, ip_address, outcome, reason, created_at")
      .eq("account_id", accountId)
      .in("outcome", ["failure", "blocked", "disabled"])
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const sessRows = (sessRes.data ?? []) as Array<{
    id: string;
    account_id: string;
    status: string;
    current_route: string | null;
    current_module: string | null;
    last_action: string | null;
    device_type: string | null;
    browser: string | null;
    os: string | null;
    ip: string | null;
    country: string | null;
    started_at: string;
    last_seen_at: string;
  }>;
  const acc = dir.get(accountId) ?? null;
  const sessions: OnlineUserRow[] = sessRows.map((r) => ({
    session_id: r.id,
    account: acc ?? {
      account_id: accountId,
      email: null,
      name: null,
      username: null,
      role: null,
      avatar_url: null,
    },
    status: liveStatus(r.last_seen_at, r.status),
    raw_status: r.status,
    current_route: r.current_route,
    current_module: r.current_module,
    last_action: r.last_action,
    device_type: r.device_type,
    browser: r.browser,
    os: r.os,
    ip: r.ip,
    country: r.country,
    started_at: r.started_at,
    last_seen_at: r.last_seen_at,
  }));

  return {
    account: acc,
    sessions,
    recent_activity: actRes,
    devices: (devRes.data ?? []) as Array<Record<string, unknown>>,
    login_history: (histRes.data ?? []) as Array<Record<string, unknown>>,
    failed_logins: (failRes.data ?? []) as Array<Record<string, unknown>>,
  };
}

/** Mark a presence session revoked (force-logout). Returns affected account. */
export async function revokeSession(
  sessionId: string,
  revokedBy: string,
): Promise<{ ok: boolean; account_id: string | null }> {
  const { data } = await supabaseServer
    .from("app_sessions")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: revokedBy })
    .eq("id", sessionId)
    .select("account_id")
    .maybeSingle();
  return { ok: !!data, account_id: (data as { account_id: string } | null)?.account_id ?? null };
}
