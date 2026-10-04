import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — compliance by month (owner's pick 26/09/2026,
   «إحصائيات الالتزام بالشهور»): each person's months — on time, late,
   missing, pending — and the team's, over the last months counting has
   run. The rules are the pure lib/reports/compliance-stats.ts; the facts
   are the compliance board's own (loadOwners, loadClocks, loadSent), in the
   board's scope: a super admin and HR·view everyone, a manager their own
   people at every level, anyone else nobody. Whether a report was sent,
   never its text. Reads only.
   --------------------------------------------------------------------------- */

import type { ServerAuthContext } from "@/lib/server/auth";
import { listPeople, loadOrgTree, type PersonLite } from "@/lib/server/reports/core";
import { canSeeEveryone, loadClocks, loadOwners, loadSent, loadTrackingFrom, obligationClock } from "@/lib/server/reports/obligations";
import { addDays, effectiveObliged, prevMonth, type ObligationKey } from "@/lib/reports/obligations";
import { addTally, emptyTally, monthBounds, monthTallies, statMonths, type MonthTally } from "@/lib/reports/compliance-stats";

export interface StatsRow { person: PersonLite; months: Record<string, MonthTally> }
export interface ComplianceStats { months: string[]; trackingFrom: string | null; rows: StatsRow[]; team: Record<string, MonthTally> }

/** The last `n` months (1–12) up to this one, from the month counting started. */
export async function loadComplianceStats(auth: ServerAuthContext, n: number): Promise<ComplianceStats> {
  const [tree, everyone, trackingFrom, people] = await Promise.all([
    loadOrgTree(auth.tenant_id), canSeeEveryone(auth), loadTrackingFrom(auth.tenant_id), listPeople(auth.tenant_id),
  ]);
  const now = new Date().toISOString();
  const months = statMonths(now.slice(0, 10), n, trackingFrom);
  if (!months.length) return { months, trackingFrom, rows: [], team: {} };
  const scope = everyone ? undefined : new Set(tree.descendantsOf(auth.account_id));
  const owners = scope && scope.size === 0 ? [] : await loadOwners(tree, scope);
  const owing = owners.map((o) => ({ o, obliged: effectiveObliged(o, o.exceptions) })).filter(({ obliged }) => obliged.daily || obliged.weekly || obliged.monthly);
  if (!owing.length) return { months, trackingFrom, rows: [], team: {} };

  const { first } = monthBounds(months[0]);
  const { last } = monthBounds(months[months.length - 1]);
  /* The reports that can fall due inside: a week begun the week before, a
     month's report from the month before. */
  const from = `${prevMonth(months[0])}-01`;
  const [clocks, { sent }] = await Promise.all([
    loadClocks(auth.tenant_id, owing.map(({ o }) => o), addDays(from, -7), addDays(last, 10), trackingFrom),
    loadSent(owing.map(({ o }) => o.accountId), addDays(first, -45), last),
  ]);
  const nameOf = new Map(people.map((p) => [p.id, p]));
  const rows: StatsRow[] = [];
  for (const { o, obliged } of owing) {
    const clock = clocks.get(o.accountId);
    if (!clock) continue;
    rows.push({
      person: nameOf.get(o.accountId) ?? { id: o.accountId, name: "—", nameAlt: null, avatar: null, position: null },
      months: monthTallies({ obliged, clock }, months, (k: ObligationKey, pk: string) => sent.get(`${o.accountId}|${k}|${pk}`) ?? null, now, obligationClock),
    });
  }
  rows.sort((a, b) => a.person.name.localeCompare(b.person.name));
  const team: Record<string, MonthTally> = Object.fromEntries(months.map((m) => [m, rows.reduce((t, r) => addTally(t, r.months[m] ?? emptyTally()), emptyTally())]));
  return { months, trackingFrom, rows, team };
}
