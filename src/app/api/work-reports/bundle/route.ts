import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/work-reports/bundle — everything the Reports home needs in ONE
   response: the counts for the KPI band, the latest reports sent to me, the
   templates this person may start, the people a report can go to, which
   number reports the Library may offer (each by its own app's permission),
   and (Phase 3A) what this person owes now — "Due from you" — plus whether
   they may see the compliance board. Phase 4E: the builder types this
   person may start (named, for the picker), the built-in types the tenant
   hides left out of `templates`, and whether they may open the builder.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { REPORT_LIST_COLS, listPeople, loadOrgTree, requireReportsUser } from "@/lib/server/reports/core";
import { REPORT_TEMPLATES } from "@/lib/reports/catalog";
import { OFFICE_MODULE } from "@/lib/reports/report-data";
import { loadMyDue } from "@/lib/server/reports/obligations";
import { TEMPLATES_MODULE, loadCustomHeads, loadHiddenKeys } from "@/lib/server/reports/custom-templates";

export const dynamic = "force-dynamic";

type Row = {
  id: string; template_key: string; author_account_id: string; title: string; period_start: string | null; period_end: string | null;
  period_key: string | null; status: string; confidential: boolean; review_required: boolean; version: number; superseded: boolean;
  submitted_at: string | null; updated_at: string; tpl_head?: unknown;
  work_report_recipients?: Array<{ role: string; read_at: string | null; acknowledged_at: string | null }>;
};
const quiet = <T,>(what: string, fallback: T) => (e: unknown): T => { console.error(`[reports] ${what}:`, e instanceof Error ? e.message : e); return fallback; };

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const me = auth.account_id;
  const t = auth.tenant_id;
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);

  /* .match({}) is a no-op, so one expression covers tenant and no-tenant. */
  const tm: Record<string, string> = t ? { tenant_id: t } : {};
  const inboxSel = `${REPORT_LIST_COLS}, work_report_recipients!inner(account_id, role, read_at, acknowledged_at)`;

  /* Everything in ONE parallel wave — no await after it touches the network. */
  const [people, tree, latest, unread, review, drafts, sent, hrView, hrCreate, finance, todo, due, custom, hidden, builder, office] = await Promise.all([
    listPeople(t),
    loadOrgTree(t),
    supabaseServer.from("work_reports").select(inboxSel).match(tm).eq("work_report_recipients.account_id", me).neq("status", "draft")
      .order("submitted_at", { ascending: false }).limit(6),
    supabaseServer.from("work_reports").select("id, work_report_recipients!inner(account_id, read_at)", { count: "exact", head: true }).match(tm)
      .eq("work_report_recipients.account_id", me).is("work_report_recipients.read_at", null).neq("status", "draft"),
    supabaseServer.from("work_reports").select("id, work_report_recipients!inner(account_id, role)", { count: "exact", head: true }).match(tm)
      .eq("work_report_recipients.account_id", me).eq("work_report_recipients.role", "to").eq("review_required", true).eq("status", "submitted"),
    supabaseServer.from("work_reports").select("id", { count: "exact", head: true }).match(tm).eq("author_account_id", me).eq("status", "draft"),
    supabaseServer.from("work_reports").select("id", { count: "exact", head: true }).match(tm).eq("author_account_id", me)
      .neq("status", "draft").gte("submitted_at", monthStart.toISOString()),
    requireModuleAction(auth, "HR", "view"),
    requireModuleAction(auth, "HR", "create"),
    requireModuleAccess(auth, "Finance"),
    requireModuleAccess(auth, "To-do"),
    /* The org tree is memoised per tenant, so this shares the read above. */
    loadMyDue(auth).catch((e: unknown) => { console.error("[reports] due:", e instanceof Error ? e.message : e); return []; }),
    /* 4E: the builder's types and the hidden built-ins — the same wave. */
    loadCustomHeads(t, { activeOnly: true }).catch(quiet("custom templates", [])),
    loadHiddenKeys(t).catch(quiet("hidden templates", [] as string[])),
    requireModuleAccess(auth, TEMPLATES_MODULE),
    /* 5B: «CEO Office» in Roles starts the CEO office's types. */
    requireModuleAction(auth, OFFICE_MODULE, "create"),
  ]);

  /* canStartTemplate's rule, decided once for the wave: an HR-only type
     (warning, exit interview) needs HR·create; a team type (5A) needs a
     team; a CEO-office type (5B) needs «CEO Office». A hidden built-in is not offered (4E); its old reports stay where
     they are. */
  const hasTeam = auth.is_super_admin || tree.descendantsOf(me).length > 0;
  const hasOffice = auth.is_super_admin || office === null;
  const hiddenSet = new Set(hidden);
  const templates = REPORT_TEMPLATES.filter((tpl) => !tpl.requestOnly && !hiddenSet.has(tpl.key) && (!tpl.hrOnly || hrCreate === null) && (!tpl.teamOnly || hasTeam) && (!tpl.officeOnly || hasOffice)).map((tpl) => tpl.key);
  const nameOf = new Map(people.map((p) => [p.id, p]));

  return NextResponse.json({
    me: { id: me, managerId: tree.chainOf(me)[0] ?? null, hasTeam, board: hasTeam || hrView === null, templates: builder === null },
    due,
    counts: { unread: unread.count ?? 0, review: review.count ?? 0, drafts: drafts.count ?? 0, sentThisMonth: sent.count ?? 0 },
    latest: ((latest.data ?? []) as Row[]).map((r) => {
      const mine = r.work_report_recipients?.[0] ?? null;
      const a = nameOf.get(r.author_account_id);
      return {
        id: r.id, templateKey: r.template_key, title: r.title, authorId: r.author_account_id, authorName: a?.name ?? "—", authorNameAlt: a?.nameAlt ?? null,
        periodStart: r.period_start, periodEnd: r.period_end, periodKey: r.period_key, status: r.status, confidential: r.confidential,
        reviewRequired: r.review_required, version: r.version, submittedAt: r.submitted_at, updatedAt: r.updated_at,
        myRole: mine?.role ?? null, readAt: mine?.read_at ?? null, acknowledgedAt: mine?.acknowledged_at ?? null,
        ...(r.tpl_head ? { tpl: r.tpl_head } : {}),
      };
    }),
    templates,
    custom: custom.filter((c) => (!c.hrOnly || hrCreate === null) && (!c.teamOnly || hasTeam) && (!c.officeOnly || hasOffice)),
    people: people.filter((p) => p.id !== me),
    library: { hr: hrView === null, finance: finance === null, tasks: todo === null },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
