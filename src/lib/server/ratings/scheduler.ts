import "server-only";

/* ---------------------------------------------------------------------------
   ratings/scheduler — the monthly rhythm, driven by cron (owner, 2026-10-07:
   "remind me to give the scores automatically, and the report reaches
   employees on the FIRST day of the month").

   The month M cycle's calendar:
     · day 20 of M     → open the cycle (compose everything) + tell the scorers
     · day 25 of M     → scoring deadline: remind whoever still owes scores
     · day 28 of M     → review/finalize deadline: nudge to finalize
     · day 1 of M+1    → a FINALIZED cycle publishes itself and the employees
                         are told (notifyRatingPublished); a cycle still in
                         scoring/review does NOT auto-finalize — the mandatory
                         gate exists for a reason — the CEO is nudged instead.

   Who is reminded: the cycle's opener plus every super admin (the CEO). The
   type (report_rating_reminder) sits in the reports activity — muting
   Reports notifications in Settings mutes these too; that is the off switch
   the owner asked for. Every reminder carries a supersede key so a new run
   replaces the older unread copy instead of stacking.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { notifyLite } from "@/lib/server/notify-lite";
import { composeCycleItems } from "@/lib/server/ratings/compose";
import { notifyRatingPublished } from "@/lib/server/ratings/publish";

const NOTIF_TYPE = "report_rating_reminder";

interface CycleRow {
  id: string; month: string; status: string; opened_by: string; tenant_id: string;
}

function monthOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function nextMonthOf(d: Date): string {
  return monthOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
}
function prevMonthOf(d: Date): string {
  return monthOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)));
}

/** The cycle's opener + every super admin — the people who can move a cycle. */
async function scorerAccounts(tenantId: string, openedBy: string | null): Promise<string[]> {
  const { data } = await supabaseServer
    .from("accounts").select("id")
    .eq("tenant_id", tenantId).eq("is_super_admin", true).eq("status", "active");
  const ids = new Set((data ?? []).map((a) => a.id as string));
  if (openedBy) ids.add(openedBy);
  return [...ids];
}

async function remind(tenantId: string, recipients: string[], cycleId: string, subject: string, body: string) {
  if (recipients.length === 0) return;
  await notifyLite({
    tenantId,
    recipients,
    type: NOTIF_TYPE,
    subject,
    body,
    link: "/hr?tab=ratings",
    supersede: { rating_cycle: cycleId },
  });
}

export interface RatingCycleRun {
  day: number;
  opened?: string;
  remindedScoring?: number;
  remindedFinalize?: number;
  published?: string;
  nudgedPublish?: number;
  skipped: string[];
}

export async function runRatingCycle(opts: { dryRun?: boolean; tenantId?: string | null } = {}): Promise<RatingCycleRun> {
  const out: RatingCycleRun = { day: 0, skipped: [] };
  const tenantId = opts.tenantId ?? null;
  if (!tenantId) { out.skipped.push("no tenant"); return out; }

  const now = new Date();
  const day = now.getUTCDate();
  out.day = day;

  const { data: cycles } = await supabaseServer
    .from("rating_cycles")
    .select("id, month, status, opened_by, tenant_id")
    .eq("tenant_id", tenantId)
    .eq("kind", "monthly")
    .order("month", { ascending: false })
    .limit(4);
  const all = (cycles ?? []) as CycleRow[];
  const byMonth = new Map(all.map((c) => [c.month, c]));

  const thisMonth = monthOf(now);
  const nextMonth = nextMonthOf(now);
  const prevMonth = prevMonthOf(now);

  /* ── day 20: open next month's cycle ── */
  if (day === 20 && !byMonth.get(nextMonth)) {
    if (opts.dryRun) {
      out.opened = nextMonth;
    } else {
      const { data: cycle, error } = await supabaseServer
        .from("rating_cycles")
        .insert({ tenant_id: tenantId, month: nextMonth, status: "scoring",
          opened_by: (await scorerAccounts(tenantId, null))[0] })
        .select("id").single();
      if (!error && cycle) {
        await composeCycleItems(cycle.id, tenantId);
        out.opened = nextMonth;
        await remind(tenantId, await scorerAccounts(tenantId, null), cycle.id,
          `The ${nextMonth.slice(0, 7)} rating cycle is open`,
          "Score every employee by the 25th — the report reaches them on the 1st.");
      }
    }
  }

  /* ── day 25: scoring deadline ── */
  const current = byMonth.get(thisMonth);
  if (day === 25 && current && current.status === "scoring") {
    const { count } = await supabaseServer
      .from("rating_items").select("id", { count: "exact", head: true })
      .eq("cycle_id", current.id).is("score", null);
    if ((count ?? 0) > 0) {
      out.remindedScoring = count ?? 0;
      if (!opts.dryRun) {
        await remind(tenantId, await scorerAccounts(tenantId, current.opened_by), current.id,
          `Scores are due today — ${current.month.slice(0, 7)}`,
          `${count} item${count === 1 ? " is" : "s are"} still unscored. The cycle finalizes on the 28th.`);
      }
    }
  }

  /* ── day 28: finalize deadline ── */
  if (day === 28 && current && (current.status === "scoring" || current.status === "review")) {
    out.remindedFinalize = 1;
    if (!opts.dryRun) {
      await remind(tenantId, await scorerAccounts(tenantId, current.opened_by), current.id,
        `Finalize the ${current.month.slice(0, 7)} ratings today`,
        "Employees receive their reports on the 1st — finalize needs a review pass first.");
    }
  }

  /* ── day 1: publish the finalized previous cycle ── */
  const prev = byMonth.get(prevMonth);
  if (day === 1 && prev) {
    if (prev.status === "finalized") {
      if (opts.dryRun) {
        out.published = prevMonth;
      } else {
        const { error } = await supabaseServer
          .from("rating_cycles")
          .update({ status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", prev.id).eq("status", "finalized");
        if (!error) {
          await notifyRatingPublished(prev);
          out.published = prevMonth;
        }
      }
    } else if (prev.status === "scoring" || prev.status === "review") {
      /* never auto-finalize past the mandatory gate — nudge the CEO instead */
      out.nudgedPublish = 1;
      if (!opts.dryRun) {
        await remind(tenantId, await scorerAccounts(tenantId, prev.opened_by), prev.id,
          `The ${prevMonth.slice(0, 7)} reports were due to employees today`,
          "The cycle is not finalized yet — one review pass and it can publish.");
      }
    }
  }

  return out;
}
