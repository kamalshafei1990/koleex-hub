import "server-only";

/* GET /api/super-admin/usage — per-user system usage hours (Super Admin only).

   Two data sources, clearly labelled per day:
     · usage_daily — ACCURATE. Fed by the presence heartbeat: every beat with
       status=active credits 30s to (account, day). Started 2026-07-24; grows
       forward from there.
     · activity_events — ESTIMATED backfill for days BEFORE usage_daily
       coverage. Events (page views, logins, session ends) are stitched into
       sessions: a gap longer than 15 minutes ends a session, and each
       session contributes (last-first) clamped to at least one minute. This
       undercounts long single-page reading and is marked `estimated`.

   Response: { users: [{ account, today_s, last7_s, last30_s, estimated_s,
   first_accurate_day }] } — seconds, UI formats to hours. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { getServerAuth } from "@/lib/server/auth";

const GAP_MS = 15 * 60 * 1000;
const MIN_SESSION_MS = 60 * 1000;

function dayStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.is_super_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const now = new Date();
  const today = dayStr(now);
  const d7 = dayStr(new Date(now.getTime() - 6 * 86400_000));
  const d30 = dayStr(new Date(now.getTime() - 29 * 86400_000));

  const [usageRes, eventsRes, accountsRes] = await Promise.all([
    supabaseServer
      .from("usage_daily")
      .select("account_id, day, active_seconds")
      .gte("day", d30),
    /* Events for the estimate window. 30 days × current volume is ~5k rows —
       trivial; if this ever grows, aggregate server-side instead. */
    supabaseServer
      .from("activity_events")
      .select("account_id, created_at")
      .gte("created_at", `${d30}T00:00:00Z`)
      .order("created_at", { ascending: true })
      .limit(50_000),
    supabaseServer
      .from("accounts")
      .select("id, username, avatar_url, person:people ( full_name )")
      .eq("user_type", "internal"),
  ]);

  type UsageRow = { account_id: string; day: string; active_seconds: number };
  type EventRow = { account_id: string; created_at: string };

  const usage = (usageRes.data ?? []) as UsageRow[];
  const events = (eventsRes.data ?? []) as EventRow[];

  /* Days that have ACCURATE coverage per account — the estimate must never
     double-count a day the heartbeat already measured. */
  const accurateDays = new Map<string, Set<string>>();
  const acc = new Map<string, { today: number; last7: number; last30: number; estimated: number; firstAccurate: string | null }>();
  const bucket = (id: string) => {
    let b = acc.get(id);
    if (!b) { b = { today: 0, last7: 0, last30: 0, estimated: 0, firstAccurate: null }; acc.set(id, b); }
    return b;
  };

  for (const r of usage) {
    const b = bucket(r.account_id);
    b.last30 += r.active_seconds;
    if (r.day >= d7) b.last7 += r.active_seconds;
    if (r.day === today) b.today += r.active_seconds;
    if (!b.firstAccurate || r.day < b.firstAccurate) b.firstAccurate = r.day;
    let set = accurateDays.get(r.account_id);
    if (!set) { set = new Set(); accurateDays.set(r.account_id, set); }
    set.add(r.day);
  }

  /* Session-stitch the events per account for non-accurate days. */
  const byAccount = new Map<string, EventRow[]>();
  for (const e of events) {
    const list = byAccount.get(e.account_id) ?? [];
    list.push(e);
    byAccount.set(e.account_id, list);
  }
  for (const [accountId, list] of byAccount) {
    const covered = accurateDays.get(accountId) ?? new Set<string>();
    let sessionStart: number | null = null;
    let prev: number | null = null;
    const flush = (endTs: number) => {
      if (sessionStart == null) return;
      const day = dayStr(new Date(sessionStart));
      if (!covered.has(day)) {
        bucket(accountId).estimated += Math.max(MIN_SESSION_MS, endTs - sessionStart) / 1000;
      }
      sessionStart = null;
    };
    for (const e of list) {
      const ts = new Date(e.created_at).getTime();
      if (prev != null && ts - prev > GAP_MS) flush(prev);
      if (sessionStart == null) sessionStart = ts;
      prev = ts;
    }
    if (prev != null) flush(prev);
  }

  type AccountRow = {
    id: string;
    username: string;
    avatar_url: string | null;
    person: { full_name: string } | Array<{ full_name: string }> | null;
  };
  const users = ((accountsRes.data ?? []) as AccountRow[])
    .map((a) => {
      const person = Array.isArray(a.person) ? a.person[0] ?? null : a.person;
      const b = acc.get(a.id);
      return {
        account_id: a.id,
        username: a.username,
        name: person?.full_name ?? null,
        avatar_url: a.avatar_url,
        today_s: Math.round(b?.today ?? 0),
        last7_s: Math.round(b?.last7 ?? 0),
        last30_s: Math.round(b?.last30 ?? 0),
        estimated_s: Math.round(b?.estimated ?? 0),
        first_accurate_day: b?.firstAccurate ?? null,
      };
    })
    .filter((u) => u.last30_s > 0 || u.estimated_s > 0)
    .sort((a, b) => (b.last30_s + b.estimated_s) - (a.last30_s + a.estimated_s));

  return NextResponse.json(
    { users },
    /* Usage totals move by 30s ticks — a minute of client cache is invisible. */
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
