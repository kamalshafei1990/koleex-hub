import "server-only";

/* ---------------------------------------------------------------------------
   marketing/week-plan — the weekly plan (owner, 29/09/2026): Koleex AI drafts
   it each Monday (Shanghai) from the accounts' numbers, an approver approves
   it, the Hub counts its progress, and at the week's end it is closed with
   its tally.

   · Koleex AI gets the numbers only (the last 28 days per account, the
     formats, the top post, the comments waiting, last week's tally, the days
     left) and answers JSON; cleanTasks keeps only what the Hub can act on,
     and each publish task's expected views are the server's — from our own
     posts — never Koleex AI's. When Koleex AI cannot answer, the cron tries
     again on its next runs for PLAN_RETRY_H hours, then a plain plan stands
     in; a person asking for a draft gets the plain plan at once (and may
     draft again).
   · A draft is edited by anyone who may edit Social Marketing and approved
     by an approver (canApprovePosts); an approved plan is changed by an
     approver only, and its hand tasks ticked by anyone who may edit. Every
     change carries the plan's version, so two people never overwrite each
     other. Progress is never stored while the week runs: it is counted from
     the posts and the comments whenever the plan is read — the closing tally
     is stored, task by task.
   · The cron (step 7): plans of weeks that have ended are closed; from
     Monday 09:00 (Shanghai) a tenant with connected accounts gets its draft
     and the approvers are asked (notifyPlanReady — reminded after a day by
     the Hub's approval reminders while it is still a draft).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { allRowsOrThrow } from "@/lib/server/all-rows";
import { aiChat, aiProviderConfigured } from "@/lib/server/ai-provider";
import { listAccounts } from "@/lib/server/marketing/accounts";
import { loadInsights } from "@/lib/server/marketing/insights";
import { needsReplyCount } from "@/lib/server/marketing/comments";
import { later, notifyPlanReady, settlePlan } from "@/lib/server/marketing/notify";
import { formatOf } from "@/lib/marketing/insights";
import {
  PLAN_LIMITS, addWeeks, cleanTasks, defaultTasks, localized, planThreads, planWeekStart, taskProgress, viewsEstimate, weekRange,
  type Localized, type PlanPlatform, type PlanPost, type PlanStatus, type PlanTask, type TaskProgress,
} from "@/lib/marketing/week-plan";
import type { ThreadRow } from "@/lib/marketing/comment-types";
import type { MarketingSpace } from "@/lib/marketing/spaces";

export interface PlanResult { done: number; total: number; tasks?: Record<string, TaskProgress> }

export interface PlanRow {
  id: string;
  tenant_id: string;
  space: MarketingSpace;
  week_start: string;
  status: PlanStatus;
  tasks: PlanTask[];
  summary: Localized | null;
  version: number;
  approved_by: string | null;
  approved_at: string | null;
  closed_at: string | null;
  result: PlanResult | null;
  created_at: string;
  updated_at: string;
}

export interface PlanView extends PlanRow {
  progress: Record<string, TaskProgress>;
  done: number;
  total: number;
}

/** Only Social Marketing's space has a plan: CEO Brand has no screens yet. */
export const PLAN_SPACES: readonly MarketingSpace[] = ["company"];
/** A new week's plan is drafted from this hour of its Monday (Shanghai), so
 *  the approvers are asked at the start of the working day, not at midnight. */
export const PLAN_DRAFT_HOUR = 9;
/** How long the cron keeps asking Koleex AI before the plain plan stands in. */
export const PLAN_RETRY_H = 3;
/** Room for the answer: reasons and a summary in three languages. */
const PLAN_MAX_TOKENS = 1400;

const COLUMNS = "id, tenant_id, space, week_start, status, tasks, summary, version, approved_by, approved_at, closed_at, result, created_at, updated_at";
const DAY_MS = 86_400_000;
const POST_MONTHS = 12;
const COMMENT_DAYS = 120;

type PlanAccount = { id: string; platform: PlanPlatform };

const text = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

async function planAccounts(tenantId: string, space: MarketingSpace): Promise<PlanAccount[]> {
  return (await listAccounts(tenantId, space))
    .filter((a) => a.connection === "api" && a.status !== "disconnected" && (a.platform === "facebook" || a.platform === "instagram"))
    .map((a) => ({ id: a.id, platform: a.platform as PlanPlatform }));
}

export const platformsOf = (accounts: ReadonlyArray<{ platform: PlanPlatform }>) => [...new Set(accounts.map((a) => a.platform))];

/** The platforms a plan may name: the space's connected Pages and accounts. */
export async function planPlatforms(tenantId: string, space: MarketingSpace): Promise<PlanPlatform[]> {
  return platformsOf(await planAccounts(tenantId, space));
}

async function loadRow(tenantId: string, space: MarketingSpace, weekStart: string): Promise<PlanRow | null> {
  const { data, error } = await supabaseServer.from("marketing_week_plans").select(COLUMNS)
    .eq("tenant_id", tenantId).eq("space", space).eq("week_start", weekStart).maybeSingle();
  if (error) throw new Error(`marketing week plans: ${error.message}`);
  return (data as PlanRow | null) ?? null;
}

async function byId(tenantId: string, space: MarketingSpace, id: string): Promise<PlanRow | null> {
  const { data, error } = await supabaseServer.from("marketing_week_plans").select(COLUMNS)
    .eq("tenant_id", tenantId).eq("space", space).eq("id", id).maybeSingle();
  if (error) throw new Error(`marketing week plans: ${error.message}`);
  return (data as PlanRow | null) ?? null;
}

/** The posts and comment threads a week's progress is counted from. */
async function weekData(accounts: PlanAccount[], weekStart: string) {
  const { from, to } = weekRange(weekStart);
  const ids = accounts.map((a) => a.id);
  if (!ids.length) return { posts: [] as PlanPost[], threads: [] as Array<{ first: ThreadRow; replies: ThreadRow[] }> };
  const platformOf = new Map(accounts.map((a) => [a.id, a.platform]));
  const [{ data: posts, error: pErr }, rows] = await Promise.all([
    supabaseServer.from("marketing_remote_posts").select("account_id, posted_at, media").in("account_id", ids)
      .gte("posted_at", new Date(from).toISOString()).lt("posted_at", new Date(to).toISOString()).limit(1000),
    /* A thread whose customer message is in the week may have started
       weeks before; the replies may come after it. Every row: a busy
       account passes 1000 comments in 120 days. */
    allRowsOrThrow<ThreadRow>(
      "marketing plan comments",
      supabaseServer.from("marketing_comments").select("account_id, external_id, parent_external_id, is_ours, hidden, commented_at, handled_at").in("account_id", ids)
        .gte("commented_at", new Date(from - COMMENT_DAYS * DAY_MS).toISOString()).not("external_id", "like", "pending:%")
        .order("commented_at", { ascending: true }).order("id"),
    ),
  ]);
  if (pErr) throw new Error(`marketing posts: ${pErr.message}`);
  return {
    posts: ((posts ?? []) as Array<{ account_id: string; posted_at: string | null; media: Array<{ kind?: string }> | null }>)
      .map((p) => ({ platform: platformOf.get(p.account_id) ?? "", posted_at: p.posted_at, media: p.media })),
    threads: planThreads(rows),
  };
}

function withProgress(plan: PlanRow, data: Awaited<ReturnType<typeof weekData>>): PlanView {
  const progress: Record<string, TaskProgress> = {};
  for (const t of plan.tasks) progress[t.id] = taskProgress(t, plan.week_start, data.posts, data.threads);
  const done = plan.tasks.filter((t) => progress[t.id].done).length;
  return { ...plan, progress, done, total: plan.tasks.length };
}

async function view(plan: PlanRow): Promise<PlanView> {
  /* A closed week shows the tally it was closed with. */
  if (plan.status === "closed" && plan.result) {
    return { ...plan, progress: plan.result.tasks ?? {}, done: plan.result.done, total: plan.result.total };
  }
  return withProgress(plan, await weekData(await planAccounts(plan.tenant_id, plan.space), plan.week_start));
}

/** A week's plan with its progress (null when there is none yet). */
export async function loadPlan(tenantId: string, space: MarketingSpace, weekStart: string): Promise<PlanView | null> {
  const plan = await loadRow(tenantId, space, weekStart);
  return plan ? view(plan) : null;
}

export type PlanWeek = Pick<PlanRow, "id" | "week_start" | "status" | "result">;

/** The weeks before, newest first, with their tallies. */
export async function planHistory(tenantId: string, space: MarketingSpace, before: string, limit = 12): Promise<PlanWeek[]> {
  const { data, error } = await supabaseServer.from("marketing_week_plans").select("id, week_start, status, result")
    .eq("tenant_id", tenantId).eq("space", space).lt("week_start", before).order("week_start", { ascending: false }).limit(limit);
  if (error) throw new Error(`marketing week plans: ${error.message}`);
  return (data ?? []) as PlanWeek[];
}

/* ── Drafting ── */

export interface PostStat { platform: PlanPlatform; posted_at: string | null; format: string; views: number | null }

async function postStats(accounts: PlanAccount[], now: number): Promise<PostStat[]> {
  if (!accounts.length) return [];
  const since = new Date(now - POST_MONTHS * 31 * DAY_MS).toISOString();
  const platformOf = new Map(accounts.map((a) => [a.id, a.platform]));
  const rows = await allRowsOrThrow<{ account_id: string; posted_at: string | null; media: Array<{ kind?: string }> | null; metrics: Record<string, number> | null }>(
    "marketing plan posts",
    supabaseServer.from("marketing_remote_posts").select("account_id, posted_at, media, metrics").in("account_id", accounts.map((a) => a.id))
      .gte("posted_at", since).order("posted_at", { ascending: false }).order("id"),
  );
  return rows.map((r) => ({
    platform: platformOf.get(r.account_id)!,
    posted_at: r.posted_at,
    format: formatOf(r.media),
    views: typeof r.metrics?.views === "number" ? r.metrics.views : null,
  }));
}

/** A publish task's expected views per post: that format's posts on the
 *  platform when there are enough of them, else all the platform's. */
export function estimateFor(task: PlanTask, stats: readonly PostStat[]): { low: number; high: number } | null {
  const seen = (s: PostStat) => s.platform === task.platform && s.views !== null;
  const byFormat = task.format ? stats.filter((s) => seen(s) && s.format === task.format).map((s) => s.views as number) : [];
  return viewsEstimate(byFormat.length >= 3 ? byFormat : stats.filter(seen).map((s) => s.views as number));
}

const withEstimates = (tasks: PlanTask[], stats: readonly PostStat[]) =>
  tasks.map((t) => (t.kind === "publish" ? { ...t, estimate: estimateFor(t, stats) } : t));

const PLAN_VOICE = [
  "You are Koleex AI, planning the coming week of social media for KOLEEX, an industrial sewing-machine brand.",
  "You receive the accounts' numbers as JSON and answer with a short plan the team can finish in the days left of the week.",
  "Rules: use only the numbers you are given — never invent a figure. 3 to 6 tasks. A publish task names one of the connected platforms, optionally one format (photo, video, album, text) — prefer the formats whose posts get more views — and a target of 1 to 5 posts, sized to daysLeft. At most one reply task, only when comments are waiting. At most two manual tasks, for work the Hub cannot count (a story, a reel idea, a campaign), each with a short title.",
  "Each reason is one short factual sentence (at most 14 words) that cites the numbers, in English, Chinese and Arabic; the summary is one sentence (at most 25 words). Reply with compact JSON only, no code fence:",
  '{"summary":{"en":"…","zh":"…","ar":"…"},"tasks":[{"kind":"publish","platform":"facebook","format":"video","target":2,"why":{"en":"…","zh":"…","ar":"…"}},{"kind":"reply","why":{"en":"…","zh":"…","ar":"…"}},{"kind":"manual","title":{"en":"…","zh":"…","ar":"…"},"why":{"en":"…","zh":"…","ar":"…"}}]}',
].join("\n");

/** The JSON object in Koleex AI's answer (it may wrap it in prose or a fence). */
export function parsePlan(reply: string): { summary: Localized | null; tasks: unknown } | null {
  const start = reply.indexOf("{"), end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const o = JSON.parse(reply.slice(start, end + 1)) as { summary?: unknown; tasks?: unknown };
    return Array.isArray(o.tasks) ? { summary: localized(o.summary), tasks: o.tasks } : null;
  } catch {
    return null;
  }
}

async function planContext(tenantId: string, space: MarketingSpace, accounts: PlanAccount[], stats: PostStat[], weekStart: string, now: number) {
  const [insights, waiting, last] = await Promise.all([
    loadInsights(tenantId, space, 28, null),
    needsReplyCount(tenantId, space),
    loadRow(tenantId, space, addWeeks(weekStart, -1)),
  ]);
  const ids = new Set(accounts.map((a) => a.id));
  return {
    week: weekStart,
    daysLeft: Math.max(1, Math.min(7, Math.ceil((weekRange(weekStart).to - now) / DAY_MS))),
    platforms: platformsOf(accounts),
    accounts: insights.accounts.filter((a) => ids.has(a.account.id)).map((a) => {
      const mine = stats.filter((s) => s.platform === a.account.platform);
      const m = a.metrics;
      return {
        platform: a.account.platform,
        followers: a.account.audience,
        last28Days: {
          views: m.views?.now ?? null,
          viewersOrReach: (m.viewers ?? m.reach)?.now ?? null,
          follows: m.follows?.now ?? null,
          unfollows: m.unfollows?.now ?? null,
          interactions: m.interactions?.now ?? null,
          postsPublished: mine.filter((s) => s.posted_at && now - Date.parse(s.posted_at) < 28 * DAY_MS).length,
        },
        daysSinceLastPost: mine[0]?.posted_at ? Math.max(0, Math.round((now - Date.parse(mine[0].posted_at)) / DAY_MS)) : null,
        formats: a.formats,
        topPost: a.top[0] ? { views: a.top[0].views, format: a.top[0].format } : null,
        audienceTopCountries: a.audience?.countries.slice(0, 3).map(([k]) => k) ?? [],
      };
    }),
    commentsWaiting: waiting,
    lastWeek: last?.result ? { done: last.result.done, total: last.result.total } : null,
  };
}

/** Koleex AI did not answer (in time, or with a plan): nothing is written,
 *  the caller tries again later (the cron's next run). */
class TryLater extends Error {}

async function askKoleexAi(context: unknown, withinMs?: number): Promise<{ summary: Localized | null; tasks: unknown } | null> {
  const ask = aiChat([
    { role: "system", content: PLAN_VOICE },
    { role: "user", content: JSON.stringify(context) },
  ], { maxTokens: PLAN_MAX_TOKENS }).then((r) => (r ? parsePlan(r.reply) : null)).catch((e: unknown) => {
    console.warn(`[marketing/week-plan] Koleex AI did not answer: ${text(e)}`);
    return null;
  });
  if (!withinMs) return ask;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<"late">((resolve) => { timer = setTimeout(() => resolve("late"), withinMs); });
  const r = await Promise.race([ask, late]);
  clearTimeout(timer);
  if (r === "late") throw new TryLater();
  return r;
}

const DEFAULT_SUMMARY: Localized = {
  en: "A plain plan from the connected accounts: post regularly and answer the comments.",
  zh: "根据已连接账号生成的基础计划：定期发布并回复评论。",
  ar: "خطة بسيطة من الحسابات المربوطة: انشر بانتظام ورد على التعليقات.",
};

/** Koleex AI's tasks for a week, cleaned, with the server's estimates.
 *  Koleex AI proposing nothing to publish is not an answer: without
 *  `fallback` the caller tries again later (TryLater); with it — or with no
 *  Koleex AI at all — a plain plan stands in, with its own summary. */
async function draftTasks(
  tenantId: string, space: MarketingSpace, accounts: PlanAccount[], weekStart: string, now: number,
  opts: { aiWithinMs?: number; fallback: boolean },
) {
  const platforms = platformsOf(accounts);
  const stats = await postStats(accounts, now);
  const context = await planContext(tenantId, space, accounts, stats, weekStart, now);
  const configured = aiProviderConfigured();
  const ai = configured ? await askKoleexAi(context, opts.aiWithinMs) : null;
  let tasks = ai ? cleanTasks(ai.tasks, platforms) : [];
  const byAi = tasks.some((t) => t.kind === "publish");
  if (!byAi && configured && !opts.fallback) throw new TryLater();
  if (!byAi) tasks = [...defaultTasks(platforms, context.commentsWaiting > 0), ...tasks.filter((t) => t.kind === "manual")];
  tasks = withEstimates(tasks.map((t) => ({ ...t, done_manual: false, done_by: null, done_at: null })), stats);
  return { tasks, summary: (byAi && ai?.summary) || DEFAULT_SUMMARY };
}

export type DraftOutcome = { plan: PlanView; created: boolean } | { error: "no_accounts" | "later" };

/** A week's first draft. created = this call wrote it (the caller asks the
 *  approvers); a plan already there is returned as it is. aiWithinMs: how
 *  long Koleex AI may take before the draft is left for later; fallback:
 *  when Koleex AI gives no plan, the plain plan instead of "later". */
export async function draftPlan(
  tenantId: string, space: MarketingSpace, weekStart: string, opts: { now?: number; aiWithinMs?: number; fallback?: boolean } = {},
): Promise<DraftOutcome> {
  const now = opts.now ?? Date.now();
  const existing = await loadRow(tenantId, space, weekStart);
  if (existing) return { plan: await view(existing), created: false };
  const accounts = await planAccounts(tenantId, space);
  if (!accounts.length) return { error: "no_accounts" };
  let drafted: Awaited<ReturnType<typeof draftTasks>>;
  try {
    drafted = await draftTasks(tenantId, space, accounts, weekStart, now, { aiWithinMs: opts.aiWithinMs, fallback: opts.fallback ?? true });
  } catch (e) {
    if (e instanceof TryLater) return { error: "later" };
    throw e;
  }
  const { tasks, summary } = drafted;
  const { data, error } = await supabaseServer.from("marketing_week_plans")
    .insert({ tenant_id: tenantId, space, week_start: weekStart, status: "draft", tasks, summary }).select(COLUMNS);
  if (error) {
    /* Two drafts at once (the cron and a person): the first one stands. */
    if (error.code === "23505") {
      const row = await loadRow(tenantId, space, weekStart);
      if (row) return { plan: await view(row), created: false };
    }
    throw new Error(`marketing week plans: ${error.message}`);
  }
  return { plan: await view((data ?? [])[0] as PlanRow), created: true };
}

/* ── Changes by people ── */

export type PlanError = "not_found" | "conflict" | "locked" | "not_manual" | "no_accounts";
export type Change = { plan: PlanView } | { error: PlanError };

async function write(plan: PlanRow, patch: Partial<PlanRow>): Promise<Change> {
  const { data, error } = await supabaseServer.from("marketing_week_plans")
    .update({ ...patch, version: plan.version + 1, updated_at: new Date().toISOString() })
    .eq("id", plan.id).eq("version", plan.version).select(COLUMNS);
  if (error) throw new Error(`marketing week plans: ${error.message}`);
  return data?.length ? { plan: await view(data[0] as PlanRow) } : { error: "conflict" };
}

async function current(tenantId: string, space: MarketingSpace, id: string, version: number): Promise<PlanRow | { error: "not_found" | "conflict" }> {
  const plan = await byId(tenantId, space, id);
  if (!plan) return { error: "not_found" };
  if (plan.version !== version) return { error: "conflict" };
  return plan;
}

/** The plan as it is now, for a 409's answer (null when it is gone). */
export async function planById(tenantId: string, space: MarketingSpace, id: string): Promise<PlanView | null> {
  const plan = await byId(tenantId, space, id);
  return plan ? view(plan) : null;
}

/** A draft drafted again by Koleex AI; the hand tasks already ticked stay. */
export async function redraftPlan(tenantId: string, space: MarketingSpace, id: string, version: number): Promise<Change> {
  const plan = await current(tenantId, space, id, version);
  if ("error" in plan) return plan;
  if (plan.status !== "draft") return { error: "locked" };
  const accounts = await planAccounts(tenantId, space);
  if (!accounts.length) return { error: "no_accounts" };
  const { tasks, summary } = await draftTasks(tenantId, space, accounts, plan.week_start, Date.now(), { fallback: true });
  const ticked = plan.tasks.filter((t) => t.kind === "manual" && t.done_manual).slice(0, PLAN_LIMITS.manual);
  const newManual = tasks.filter((t) => t.kind === "manual").slice(0, PLAN_LIMITS.manual - ticked.length);
  const others = tasks.filter((t) => t.kind !== "manual");
  return write(plan, { tasks: [...others, ...ticked, ...newManual].slice(0, PLAN_LIMITS.tasks), summary });
}

/** The tasks, edited — a draft by anyone who may edit, an approved plan by
 *  an approver. Cleaned like Koleex AI's; a hand task keeps its own tick
 *  (ticks are tickTask's), and the estimates are the server's again. */
export async function editPlan(tenantId: string, space: MarketingSpace, id: string, version: number, tasks: unknown, opts: { approver: boolean }): Promise<Change> {
  const plan = await current(tenantId, space, id, version);
  if ("error" in plan) return plan;
  if (plan.status === "closed" || (plan.status === "active" && !opts.approver)) return { error: "locked" };
  const accounts = await planAccounts(tenantId, space);
  const stored = new Map(plan.tasks.map((t) => [t.id, t]));
  const cleaned = cleanTasks(tasks, platformsOf(accounts)).map((t) => {
    if (t.kind !== "manual") return t;
    const was = stored.get(t.id);
    const mine = was?.kind === "manual" ? was : null;
    return { ...t, done_manual: !!mine?.done_manual, done_by: mine?.done_by ?? null, done_at: mine?.done_at ?? null };
  });
  return write(plan, { tasks: withEstimates(cleaned, await postStats(accounts, Date.now())) });
}

/** Approved: the draft becomes the week's plan. */
export async function approvePlan(tenantId: string, space: MarketingSpace, id: string, version: number, actorId: string): Promise<Change> {
  const plan = await current(tenantId, space, id, version);
  if ("error" in plan) return plan;
  if (plan.status !== "draft") return { error: "locked" };
  return write(plan, { status: "active", approved_by: actorId, approved_at: new Date().toISOString() });
}

/** A hand task ticked or unticked (a draft's or an approved plan's). */
export async function tickTask(tenantId: string, space: MarketingSpace, id: string, version: number, taskId: string, done: boolean, actorId: string): Promise<Change> {
  const plan = await current(tenantId, space, id, version);
  if ("error" in plan) return plan;
  if (plan.status === "closed") return { error: "locked" };
  const task = plan.tasks.find((t) => t.id === taskId);
  if (!task || task.kind !== "manual") return { error: "not_manual" };
  const at = new Date().toISOString();
  return write(plan, { tasks: plan.tasks.map((t) => (t.id === taskId ? { ...t, done_manual: done, done_by: done ? actorId : null, done_at: done ? at : null } : t)) });
}

/* ── The week turning (the cron's step 7) ── */

/** A plan whose week has ended, closed with its tally task by task (a draft
 *  nobody approved is closed too — its tally says what it came to). */
async function closePlan(plan: PlanRow): Promise<boolean> {
  const v = withProgress(plan, await weekData(await planAccounts(plan.tenant_id, plan.space), plan.week_start));
  const at = new Date().toISOString();
  const { data, error } = await supabaseServer.from("marketing_week_plans")
    .update({ status: "closed", closed_at: at, result: { done: v.done, total: v.total, tasks: v.progress }, version: plan.version + 1, updated_at: at })
    .eq("id", plan.id).eq("version", plan.version).select("id");
  if (error) throw new Error(`marketing week plans: ${error.message}`);
  if (data?.length) await settlePlan(plan.id);
  return !!data?.length;
}

/** Koleex AI is given at least this long in a cron run, else the draft
 *  waits for a run with more time left. */
const MIN_AI_MS = 15_000;

/** aiBudgetMs: how long Koleex AI may take now (the run's time left, less
 *  what the rest of the draft needs). */
export async function weekPlansStep(opts: { tenantId?: string; now?: number; aiBudgetMs: () => number }): Promise<{ closed: number; drafted: number }> {
  const now = opts.now ?? Date.now();
  const week = planWeekStart(now);
  let closed = 0, drafted = 0;
  /* Every plan of an ended week still open, whoever's accounts are left. */
  let openQ = supabaseServer.from("marketing_week_plans").select(COLUMNS).neq("status", "closed").lt("week_start", week);
  if (opts.tenantId) openQ = openQ.eq("tenant_id", opts.tenantId);
  const { data: open, error: oErr } = await openQ.order("week_start", { ascending: true }).limit(20);
  if (oErr) throw new Error(`marketing week plans: ${oErr.message}`);
  for (const plan of (open ?? []) as PlanRow[]) if (await closePlan(plan)) closed++;
  /* This week's draft, from Monday 09:00 Shanghai; Koleex AI is asked
     again on the next runs for PLAN_RETRY_H hours before the plain plan. */
  const draftFrom = weekRange(week).from + PLAN_DRAFT_HOUR * 3_600_000;
  if (now < draftFrom) return { closed, drafted };
  const fallback = now >= draftFrom + PLAN_RETRY_H * 3_600_000;
  let accQ = supabaseServer.from("marketing_accounts").select("tenant_id, space").eq("connection", "api")
    .in("platform", ["facebook", "instagram"]).in("status", ["connected", "error"]).in("space", [...PLAN_SPACES]);
  if (opts.tenantId) accQ = accQ.eq("tenant_id", opts.tenantId);
  const { data: accs, error: aErr } = await accQ.limit(500);
  if (aErr) throw new Error(`marketing accounts: ${aErr.message}`);
  const pairs = [...new Set(((accs ?? []) as Array<{ tenant_id: string; space: MarketingSpace }>).map((a) => `${a.tenant_id}|${a.space}`))];
  for (const pair of pairs) {
    const [tenantId, space] = pair.split("|") as [string, MarketingSpace];
    if (await loadRow(tenantId, space, week)) continue;
    /* Koleex AI may take a while: only with time left in the run. */
    const aiWithinMs = opts.aiBudgetMs();
    if (aiWithinMs < MIN_AI_MS) break;
    const r = await draftPlan(tenantId, space, week, { now, aiWithinMs, fallback });
    if ("plan" in r && r.created) {
      drafted++;
      const planId = r.plan.id;
      later(() => notifyPlanReady(tenantId, planId, null));
    }
  }
  return { closed, drafted };
}
