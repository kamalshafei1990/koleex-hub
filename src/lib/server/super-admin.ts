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

/* ── The person view of "who is online" ────────────────────────────────────
   The session list answers "what connections exist"; the owner's questions
   are about PEOPLE: who is on, when did they sign in, how long have they
   been on today, what are they doing. One row per account, with the live
   sessions folded in as a device count, today's accurate seconds joined
   from usage_daily, and the first successful login of the (UTC) day — the
   same day convention usage_daily itself uses, so the two numbers can never
   disagree about what "today" means. */
/* ── Route → document name (display-time resolution) ───────────────────────
   The owner's ask: "what is he doing EXACTLY, not just which app" — and the
   answer was already in the data. Every tracked route carries the record's id
   (/product-data/<id>/edit, /contracts/<id>, …); nothing new is collected
   from anyone's browser. This resolves those ids to display names AT READ
   TIME, on the super-admin's own request only — zero cost to the people
   being observed, a handful of indexed pk lookups for the observer, and a
   5-minute cache so the 8s poll doesn't re-ask for names that don't change.

   Only entities with a stable, cheap label are resolved; an unmatched route
   simply shows the module, as before. */
const ROUTE_ENTITY_PATTERNS: Array<{
  re: RegExp;
  table: string;
  select: string;
  label: (row: Record<string, unknown>) => string;
}> = [
  {
    re: /^\/(?:product-data|products)\/([0-9a-f-]{36})/,
    table: "products",
    select: "id, product_name",
    label: (r) => String(r.product_name ?? ""),
  },
  {
    re: /^\/contracts\/([0-9a-f-]{36})/,
    table: "sales_contracts",
    select: "id, contract_no",
    label: (r) => String(r.contract_no ?? ""),
  },
  {
    re: /^\/quotations\/([0-9a-f-]{36})/,
    table: "quotations",
    select: "id, quote_no",
    label: (r) => String(r.quote_no ?? ""),
  },
  {
    re: /^\/orders\/([0-9a-f-]{36})/,
    table: "orders",
    select: "id, order_no",
    label: (r) => String(r.order_no ?? ""),
  },
  {
    re: /^\/customers\/([0-9a-f-]{36})/,
    table: "customers",
    select: "id, name, company_name",
    label: (r) => String(r.company_name || r.name || ""),
  },
];

const routeLabelCache = new Map<string, { label: string | null; at: number }>();
const ROUTE_LABEL_TTL = 5 * 60_000;

export async function resolveRouteLabels(
  routes: Iterable<string | null | undefined>,
): Promise<Map<string, string>> {
  const now = Date.now();
  const out = new Map<string, string>();
  /* route → (pattern index, id) for the ones that need a lookup */
  const wanted = new Map<number, Map<string, string[]>>(); // patternIdx → id → routes
  for (const route of new Set(routes)) {
    if (!route) continue;
    const hit = routeLabelCache.get(route);
    if (hit && now - hit.at < ROUTE_LABEL_TTL) {
      if (hit.label) out.set(route, hit.label);
      continue;
    }
    ROUTE_ENTITY_PATTERNS.forEach((p, i) => {
      const m = route.match(p.re);
      if (!m) return;
      const byId = wanted.get(i) ?? new Map<string, string[]>();
      byId.set(m[1], [...(byId.get(m[1]) ?? []), route]);
      wanted.set(i, byId);
    });
  }
  await Promise.all(
    [...wanted.entries()].map(async ([i, byId]) => {
      const p = ROUTE_ENTITY_PATTERNS[i];
      const { data } = await supabaseServer.from(p.table).select(p.select).in("id", [...byId.keys()]);
      const labelById = new Map(
        ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => [String(r.id), p.label(r)]),
      );
      for (const [id, rts] of byId) {
        const label = labelById.get(id)?.trim() || null;
        for (const r of rts) {
          routeLabelCache.set(r, { label, at: now });
          if (label) out.set(r, label);
        }
      }
    }),
  );
  return out;
}

export interface OnlinePersonRow {
  account: AccountInfo;
  status: LiveStatus;
  device_count: number;
  sessions: OnlineUserRow[];
  current_route: string | null;
  current_module: string | null;
  /** The exact record the lead session is on, when the route names one. */
  current_doc: string | null;
  signed_in_today_at: string | null;
  today_seconds: number;
  last_seen_at: string;
}

export async function onlinePeople(): Promise<OnlinePersonRow[]> {
  const sessions = await onlineUsers();
  const byAccount = new Map<string, OnlineUserRow[]>();
  for (const s of sessions) {
    const arr = byAccount.get(s.account.account_id) ?? [];
    arr.push(s);
    byAccount.set(s.account.account_id, arr);
  }
  const ids = [...byAccount.keys()];
  if (ids.length === 0) return [];

  const todayStart = new Date().toISOString().slice(0, 10);
  const [usageRes, loginRes] = await Promise.all([
    supabaseServer
      .from("usage_daily")
      .select("account_id, active_seconds")
      .eq("day", todayStart)
      .in("account_id", ids),
    supabaseServer
      .from("account_login_history")
      .select("account_id, created_at")
      .eq("event_type", "login_success")
      .gte("created_at", `${todayStart}T00:00:00Z`)
      .in("account_id", ids)
      .order("created_at", { ascending: true }),
  ]);
  const todayBy = new Map<string, number>();
  for (const r of (usageRes.data ?? []) as Array<{ account_id: string; active_seconds: number }>) {
    todayBy.set(r.account_id, (todayBy.get(r.account_id) ?? 0) + (r.active_seconds ?? 0));
  }
  /* ascending order → the FIRST row per account is the first login. */
  const firstLogin = new Map<string, string>();
  for (const r of (loginRes.data ?? []) as Array<{ account_id: string; created_at: string }>) {
    if (!firstLogin.has(r.account_id)) firstLogin.set(r.account_id, r.created_at);
  }

  const docLabels = await resolveRouteLabels(
    [...byAccount.values()].map((arr) => arr[0]?.current_route),
  );

  const rank: Record<LiveStatus, number> = { online: 0, idle: 1, offline: 2 };
  return ids
    .map((id) => {
      /* onlineUsers is newest-activity-first, so [0] is the live session. */
      const sess = byAccount.get(id)!;
      const lead = sess[0];
      const best = sess.reduce<LiveStatus>(
        (acc, s) => (rank[s.status] < rank[acc] ? s.status : acc),
        "offline",
      );
      return {
        account: lead.account,
        status: best,
        device_count: sess.length,
        sessions: sess,
        current_route: lead.current_route,
        current_module: lead.current_module,
        current_doc: lead.current_route ? docLabels.get(lead.current_route) ?? null : null,
        signed_in_today_at: firstLogin.get(id) ?? null,
        today_seconds: todayBy.get(id) ?? 0,
        last_seen_at: lead.last_seen_at,
      };
    })
    .sort((a, b) => rank[a.status] - rank[b.status] || (a.last_seen_at < b.last_seen_at ? 1 : -1));
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
  /** Resolved record name when the route points at one (display-time). */
  doc_label?: string | null;
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
  const [dir, docLabels] = await Promise.all([
    accountDirectory(rows.map((r) => r.account_id)),
    resolveRouteLabels(rows.map((r) => r.route)),
  ]);
  return rows.map((r) => ({
    id: r.id,
    doc_label: r.route ? docLabels.get(r.route) ?? null : null,
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
  /* The requested day's events, OLDEST first — the drawer reads them as a
     journey (module → module with durations), which only makes sense in the
     order it happened. */
  day: string;
  day_events: ActivityRow[];
  usage: { today_s: number; last7_s: number; last30_s: number };
  devices: Array<Record<string, unknown>>;
  login_history: Array<Record<string, unknown>>;
  failed_logins: Array<Record<string, unknown>>;
}

/** Full activity detail for one account (for the drawer).
    `day` — UTC day (YYYY-MM-DD, same convention as usage_daily) whose events
    become the journey; defaults to today. */
export async function userDetail(accountId: string, day?: string | null): Promise<UserDetail> {
  const dayKey = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : new Date().toISOString().slice(0, 10);
  const nextDay = new Date(new Date(`${dayKey}T00:00:00Z`).getTime() + 86400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const d7 = new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10);
  const d30 = new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10);
  const dir = await accountDirectory([accountId]);
  const [sessRes, dayRes, usageRes, auditRes, devRes, histRes, failRes] = await Promise.all([
    supabaseServer
      .from("app_sessions")
      .select(
        "id, account_id, status, current_route, current_module, last_action, device_type, browser, os, ip, country, started_at, last_seen_at",
      )
      .eq("account_id", accountId)
      .order("last_seen_at", { ascending: false })
      .limit(50),
    /* The whole day, ascending — a journey read newest-first is a story told
       backwards. 500 caps a pathological day; a normal one is < 200 rows. */
    supabaseServer
      .from("activity_events")
      .select("id, account_id, event_type, route, module, title, severity, ip, country, created_at")
      .eq("account_id", accountId)
      .gte("created_at", `${dayKey}T00:00:00Z`)
      .lt("created_at", `${nextDay}T00:00:00Z`)
      .order("created_at", { ascending: true })
      .limit(500),
    supabaseServer
      .from("usage_daily")
      .select("day, active_seconds")
      .eq("account_id", accountId)
      .gte("day", d30),
    /* The day's ACTIONS. Page views say where someone was; audit_logs says
       what they DID — "Updated product — Auto-sharpening cutting machine" —
       with the human label already stored at write time. Merged into the
       journey as interrupt rows. */
    supabaseServer
      .from("audit_logs")
      .select("id, action_type, entity_type, entity_label, module, route, severity, created_at")
      .eq("account_id", accountId)
      .gte("created_at", `${dayKey}T00:00:00Z`)
      .lt("created_at", `${nextDay}T00:00:00Z`)
      .order("created_at", { ascending: true })
      .limit(300),
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

  const usageRows = (usageRes.data ?? []) as Array<{ day: string; active_seconds: number }>;
  const sum = (from: string) =>
    usageRows.filter((u) => u.day >= from).reduce((n, u) => n + (u.active_seconds ?? 0), 0);

  const anon = acc ?? { account_id: accountId, email: null, name: null, username: null, role: null, avatar_url: null };
  const verb: Record<string, string> = { create: "Created", update: "Updated", delete: "Deleted", export: "Exported" };
  const auditEvents = ((auditRes.data ?? []) as Array<Record<string, unknown>>).map((a) => ({
    id: `audit-${a.id as string}`,
    account: anon,
    event_type: "audit_action",
    route: (a.route as string | null) ?? null,
    module: (a.module as string | null) ?? null,
    title: [
      verb[(a.action_type as string) ?? ""] ?? ((a.action_type as string) ?? "Did"),
      (a.entity_type as string) ?? "",
      (a.entity_label as string) ? `— ${a.entity_label as string}` : "",
    ].filter(Boolean).join(" "),
    severity: (a.severity as string) ?? "info",
    ip: null,
    country: null,
    browser: null,
    os: null,
    device_type: null,
    metadata: {},
    created_at: a.created_at as string,
  })) as ActivityRow[];

  const dayEvents = ((dayRes.data ?? []) as Array<Record<string, unknown>>).map((e) => ({
    id: e.id as string,
    account: acc ?? { account_id: accountId, email: null, name: null, username: null, role: null, avatar_url: null },
    event_type: (e.event_type as string) ?? "event",
    route: (e.route as string | null) ?? null,
    module: (e.module as string | null) ?? null,
    title: (e.title as string | null) ?? null,
    severity: (e.severity as string) ?? "info",
    ip: (e.ip as string | null) ?? null,
    country: (e.country as string | null) ?? null,
    created_at: e.created_at as string,
  })) as ActivityRow[];

  const merged = [...dayEvents, ...auditEvents].sort((a, b) =>
    a.created_at < b.created_at ? -1 : 1,
  );
  const docLabels = await resolveRouteLabels(merged.map((e) => e.route));
  for (const e of merged) if (e.route) e.doc_label = docLabels.get(e.route) ?? null;

  return {
    account: acc,
    sessions,
    day: dayKey,
    day_events: merged,
    usage: { today_s: sum(today), last7_s: sum(d7), last30_s: sum(d30) },
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
