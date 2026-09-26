import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the launch preview (owner's pick 26/09/2026,
   «نشغّل التقارير فعلًا»). Before counting starts, whoever sets it up picks a
   start day and sees that first week as it would run, person by person:
   each report due, when its author is reminded, when and to whom a missing
   one goes — and the days their calendar gives off, so a holiday that is
   missing from it shows up as a working day before anyone is asked for
   anything.

   READS ONLY. The same facts and rules as the reminder job (loadOwners,
   loadClocks, the pure planWindow on the rules nudgesDue acts on, and
   escalationRecipients) — nothing is claimed, stored or sent. Once counting
   has started, the plan reads the real start date instead of the day asked
   about, so the same view shows any week ahead.
   --------------------------------------------------------------------------- */

import type { ServerAuthContext } from "@/lib/server/auth";
import { listPeople, loadOrgTree, superAdminIds, type PersonLite } from "@/lib/server/reports/core";
import { escalationRecipients, loadClocks, loadOwners, loadSettings, obligationClock } from "@/lib/server/reports/obligations";
import { addDays, daysOffIn, effectiveObliged, planWindow, type DayOffWhy, type PlanItem } from "@/lib/reports/obligations";

/** The window: one week from the day asked about. */
export const LAUNCH_DAYS = 7;

export interface LaunchPerson {
  person: PersonLite;
  tz: string;
  workEnd: string;
  /** Hired after the window opens: nothing is asked before this day. */
  startsOn: string | null;
  daysOff: Array<{ day: string; why: DayOffWhy }>;
  items: PlanItem[];
  /** Who hears of a missing report — the manager, else every super admin. */
  escalateTo: PersonLite[];
  noManager: boolean;
}

export interface LaunchPlan {
  first: string;
  last: string;
  /** The start date in force; null = counting has not started. */
  trackingFrom: string | null;
  reminders: boolean;
  escalations: boolean;
  people: LaunchPerson[];
  /** People who owe no report (super admins, or every report switched off). */
  exempt: number;
}

export async function loadLaunchPlan(auth: ServerAuthContext, first: string): Promise<LaunchPlan> {
  const last = addDays(first, LAUNCH_DAYS - 1);
  const [tree, settings, people, admins] = await Promise.all([
    loadOrgTree(auth.tenant_id), loadSettings(auth.tenant_id), listPeople(auth.tenant_id), superAdminIds(auth.tenant_id),
  ]);
  const owners = await loadOwners(tree);
  const owing = owners
    .map((o) => ({ o, obliged: effectiveObliged(o, o.exceptions) }))
    .filter(({ obliged }) => obliged.daily || obliged.weekly || obliged.monthly);
  /* Before counting starts the day asked about IS the start being judged. A
     month's report falls due in the next month and an escalation a working
     day later — the calendar is read wide enough for both. */
  const start = settings.trackingFrom ?? first;
  const clocks = await loadClocks(auth.tenant_id, owing.map(({ o }) => o), addDays(first, -62), addDays(last, 31), start);
  const nameOf = new Map(people.map((p) => [p.id, p]));
  const personOf = (id: string): PersonLite => nameOf.get(id) ?? { id, name: "—", nameAlt: null, avatar: null, position: null };

  const out: LaunchPerson[] = [];
  for (const { o, obliged } of owing) {
    const clock = clocks.get(o.accountId);
    if (!clock) continue;
    out.push({
      person: personOf(o.accountId),
      tz: clock.tz,
      workEnd: clock.workEnd,
      startsOn: clock.from && clock.from > first ? clock.from : null,
      daysOff: daysOffIn(clock, first, last),
      items: planWindow({ obliged, clock }, first, last, obligationClock),
      escalateTo: escalationRecipients(tree, admins, o.accountId).map(personOf),
      noManager: !tree.chainOf(o.accountId)[0],
    });
  }
  out.sort((a, b) => a.person.name.localeCompare(b.person.name));
  return {
    first, last, trackingFrom: settings.trackingFrom, reminders: settings.reminders, escalations: settings.escalations,
    people: out, exempt: owners.length - owing.length,
  };
}
