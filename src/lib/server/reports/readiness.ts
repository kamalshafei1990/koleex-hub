import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — staff readiness (owner's pick 26/09/2026, «جاهزية
   الموظفين قبل 12 أكتوبر»): for each person who owes reports, whether the
   reminder can reach them — the last day they used Koleex Hub, whether a
   device of theirs receives notifications — and whether they have sent a
   report yet. The reminder lives only in the bell and in push (no e-mail),
   so someone who never opens the Hub and has no device on hears nothing.

   A SUPER ADMIN's only: the days someone used the Hub are the Activity
   Monitor's (usage_daily), which only a super admin reads. Shown before
   counting starts and for its first two weeks. Reads only.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { PersonLite } from "@/lib/server/reports/core";
import type { Owner } from "@/lib/server/reports/obligations";
import { GUIDE_DAYS, OBLIGATION_KEYS, addDays, effectiveObliged } from "@/lib/reports/obligations";

export interface ReadinessRow {
  person: PersonLite;
  /** The last day they used Koleex Hub (usage, else their last sign-in). */
  lastUsed: string | null;
  /** Their devices that receive notifications now. */
  devices: number;
  /** Their first report sent — on or after the start once counting is set. */
  firstSent: string | null;
}

/** Shown before counting starts and for its first two weeks. */
export const readinessWindow = (trackingFrom: string | null, today: string): boolean => !trackingFrom || today <= addDays(trackingFrom, GUIDE_DAYS);

/** One row per person who owes a report, by name. At most 100 people. */
export async function loadReadiness(owners: Owner[], trackingFrom: string | null, nameOf: Map<string, PersonLite>): Promise<ReadinessRow[]> {
  const owing = owners.filter((o) => { const ob = effectiveObliged(o, o.exceptions); return ob.daily || ob.weekly || ob.monthly; }).slice(0, 100);
  if (!owing.length) return [];
  const ids = owing.map((o) => o.accountId);
  let sentQ = supabaseServer.from("work_reports").select("author_account_id, submitted_at")
    .in("author_account_id", ids).in("template_key", OBLIGATION_KEYS).neq("status", "draft").not("submitted_at", "is", null)
    .order("submitted_at", { ascending: true }).limit(1000);
  if (trackingFrom) sentQ = sentQ.gte("submitted_at", `${trackingFrom}T00:00:00Z`);
  const [usage, logins, subs, sent] = await Promise.all([
    /* One read per person: their newest usage day. */
    Promise.all(ids.map((id) => supabaseServer.from("usage_daily").select("day").eq("account_id", id).order("day", { ascending: false }).limit(1).maybeSingle())),
    supabaseServer.from("accounts").select("id, last_login_at").in("id", ids),
    supabaseServer.from("push_subscriptions").select("account_id").in("account_id", ids).eq("is_active", true).is("revoked_at", null),
    sentQ,
  ]);
  const loginOf = new Map(((logins.data ?? []) as Array<{ id: string; last_login_at: string | null }>).map((a) => [a.id, a.last_login_at ? String(a.last_login_at).slice(0, 10) : null]));
  const devicesOf = new Map<string, number>();
  for (const s of (subs.data ?? []) as Array<{ account_id: string }>) devicesOf.set(s.account_id, (devicesOf.get(s.account_id) ?? 0) + 1);
  const firstOf = new Map<string, string>();
  for (const r of (sent.data ?? []) as Array<{ author_account_id: string; submitted_at: string }>) if (!firstOf.has(r.author_account_id)) firstOf.set(r.author_account_id, String(r.submitted_at));
  return owing.map((o, i) => {
    const day = (usage[i].data as { day?: string } | null)?.day ?? null;
    const login = loginOf.get(o.accountId) ?? null;
    const lastUsed = [day ? String(day).slice(0, 10) : null, login].filter((x): x is string => !!x).sort().at(-1) ?? null;
    return {
      person: nameOf.get(o.accountId) ?? { id: o.accountId, name: "—", nameAlt: null, avatar: null, position: null },
      lastUsed, devices: devicesOf.get(o.accountId) ?? 0, firstSent: firstOf.get(o.accountId) ?? null,
    };
  }).sort((a, b) => a.person.name.localeCompare(b.person.name));
}
