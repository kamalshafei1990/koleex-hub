import "server-only";

/* ---------------------------------------------------------------------------
   /api/marketing/plan — the weekly plan (lib/server/marketing/week-plan).

   GET ?space=&week=YYYY-MM-DD — a week's plan (this week's when none is
   asked) with its progress, the weeks before with their tallies, and what
   the reader may do. Needs "view".

   POST { space, action, … }:
     draft    { week }                      Koleex AI drafts this week's plan (none yet) — "edit"; the approvers are asked
     redraft  { id, version }               Koleex AI drafts a draft again — "edit"
     edit     { id, version, tasks }        the tasks, edited — "edit" (an approved plan: approvers only)
     approve  { id, version }               approvers only (canApprovePosts)
     tick     { id, version, task, done }   a hand task done or not — "edit"
   Every change carries the plan's version: a stale one answers 409 with the
   plan as it is now.
   --------------------------------------------------------------------------- */

import { after, NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction, type ServerAuthContext } from "@/lib/server/auth";
import { canApprovePosts } from "@/lib/server/marketing/approvals";
import { notifyPlanReady, settlePlan } from "@/lib/server/marketing/notify";
import {
  approvePlan, draftPlan, editPlan, loadPlan, planById, planHistory, planPlatforms, redraftPlan, tickTask,
  type Change, type PlanError,
} from "@/lib/server/marketing/week-plan";
import { aiProviderConfigured } from "@/lib/server/ai-provider";
import { SPACE_MODULE, asSpace, type MarketingSpace } from "@/lib/marketing/spaces";
import { planWeekStart } from "@/lib/marketing/week-plan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** A week is named by its Monday. */
const isMonday = (day: string) => DAY_RE.test(day) && new Date(`${day}T00:00:00Z`).getUTCDay() === 1;

async function mayOf(auth: ServerAuthContext, space: MarketingSpace) {
  const edit = (await requireModuleAction(auth, SPACE_MODULE[space], "edit")) === null;
  return { edit, approve: edit && (await canApprovePosts(auth, space)) };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const params = req.nextUrl.searchParams;
  const space = asSpace(params.get("space"));
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
  if (denied) return denied;
  const current = planWeekStart();
  const asked = params.get("week") ?? "";
  const week = isMonday(asked) && asked <= current ? asked : current;
  try {
    const [plan, history, platforms, may] = await Promise.all([
      loadPlan(auth.tenant_id, space, week),
      planHistory(auth.tenant_id, space, current),
      planPlatforms(auth.tenant_id, space),
      mayOf(auth, space),
    ]);
    return NextResponse.json({ week, current, plan, history, platforms, may, ai: aiProviderConfigured() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/marketing/plan GET]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not load the plan." }, { status: 500 });
  }
}

const MESSAGES: Record<PlanError | "later", { status: number; error: string }> = {
  not_found: { status: 404, error: "This plan no longer exists." },
  conflict: { status: 409, error: "Someone changed this plan a moment ago — this is the plan as it is now." },
  locked: { status: 409, error: "This plan can no longer be changed this way." },
  not_manual: { status: 400, error: "Only a task done by hand can be ticked." },
  no_accounts: { status: 400, error: "Connect a Facebook Page or an Instagram account first." },
  later: { status: 503, error: "Koleex AI is busy — try again in a minute." },
};

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const space = asSpace(typeof body.space === "string" ? body.space : null);
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "edit");
  if (denied) return denied;
  const action = typeof body.action === "string" ? body.action : "";
  const id = typeof body.id === "string" && UUID_RE.test(body.id) ? body.id : null;
  const version = typeof body.version === "number" && Number.isInteger(body.version) ? body.version : null;
  const fail = async (code: PlanError | "later") => {
    const m = MESSAGES[code];
    /* A stale version: the screen gets the plan as it is now. */
    const plan = code === "conflict" && id ? await planById(auth.tenant_id, space, id) : undefined;
    return NextResponse.json({ error: m.error, code, ...(plan !== undefined ? { plan } : {}) }, { status: m.status });
  };
  const answer = async (r: Change) => ("error" in r ? fail(r.error) : NextResponse.json({ plan: r.plan }));
  try {
    if (action === "draft") {
      const week = typeof body.week === "string" ? body.week : "";
      if (week !== planWeekStart()) return NextResponse.json({ error: "Only this week's plan can be drafted." }, { status: 400 });
      const r = await draftPlan(auth.tenant_id, space, week, { aiWithinMs: 50_000 });
      if ("error" in r) return fail(r.error);
      if (r.created) after(() => notifyPlanReady(auth.tenant_id, r.plan.id, auth.account_id));
      return NextResponse.json({ plan: r.plan });
    }
    if (!id || version === null) return NextResponse.json({ error: "Which plan, and which version of it?" }, { status: 400 });
    if (action === "redraft") return answer(await redraftPlan(auth.tenant_id, space, id, version));
    if (action === "edit") {
      if (!Array.isArray(body.tasks)) return NextResponse.json({ error: "The tasks are missing." }, { status: 400 });
      const { approve } = await mayOf(auth, space);
      return answer(await editPlan(auth.tenant_id, space, id, version, body.tasks, { approver: approve }));
    }
    if (action === "approve") {
      if (!(await canApprovePosts(auth, space))) return NextResponse.json({ error: "Only an approver can approve the plan." }, { status: 403 });
      const r = await approvePlan(auth.tenant_id, space, id, version, auth.account_id);
      if (!("error" in r)) after(() => settlePlan(r.plan.id));
      return answer(r);
    }
    if (action === "tick") {
      const task = typeof body.task === "string" ? body.task : "";
      if (!task || typeof body.done !== "boolean") return NextResponse.json({ error: "Which task, and is it done?" }, { status: 400 });
      return answer(await tickTask(auth.tenant_id, space, id, version, task, body.done, auth.account_id));
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    console.error("[api/marketing/plan POST]", action, e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not save the plan." }, { status: 500 });
  }
}
