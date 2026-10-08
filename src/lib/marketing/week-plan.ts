/* ---------------------------------------------------------------------------
   marketing/week-plan — the weekly plan, shared by the server and the screen:
   the week (Monday to Sunday, Shanghai time), the task kinds, and the ONE
   way a task's progress and a post's expected views are worked out.

   A task is STRUCTURED — publish N posts on a platform (optionally of one
   format), answer the comments, or a task done by hand — so the screen
   draws its title in the reader's language. Only Koleex AI's reasons (and a
   hand task's title) are text, in en / zh / ar. Koleex AI's answer is never
   trusted as it comes: cleanTasks keeps only known kinds, connected
   platforms, known formats and sane targets.
   --------------------------------------------------------------------------- */

import { POST_FORMATS, formatOf, type PostFormat } from "@/lib/marketing/insights";
import { groupThreads, needsReply, type ThreadRow } from "@/lib/marketing/comment-types";

const DAY_MS = 86_400_000;
/** Shanghai has no daylight saving: always UTC+8. */
const SHANGHAI_MS = 8 * 3_600_000;

/** The Monday (Shanghai) that starts the week of `now`, as YYYY-MM-DD. */
export function planWeekStart(now: number = Date.now()): string {
  const local = new Date(now + SHANGHAI_MS);
  const dow = (local.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - dow * DAY_MS).toISOString().slice(0, 10);
}

/** The week's instants: Monday 00:00 Shanghai, and the next Monday 00:00. */
export function weekRange(weekStart: string): { from: number; to: number } {
  const from = Date.parse(`${weekStart}T00:00:00Z`) - SHANGHAI_MS;
  return { from, to: from + 7 * DAY_MS };
}

export const addWeeks = (weekStart: string, n: number): string =>
  new Date(Date.parse(`${weekStart}T00:00:00Z`) + n * 7 * DAY_MS).toISOString().slice(0, 10);

export type PlanStatus = "draft" | "active" | "closed";
export type PlanTaskKind = "publish" | "reply" | "manual";
export type PlanPlatform = "facebook" | "instagram";
export const PLAN_PLATFORMS: readonly PlanPlatform[] = ["facebook", "instagram"];

export interface Localized { en: string; zh: string; ar: string }

export interface PlanTask {
  id: string;
  kind: PlanTaskKind;
  /** publish: where, and optionally which format (null = any). */
  platform?: PlanPlatform;
  format?: PostFormat | null;
  /** publish: how many posts; reply and manual: 1. */
  target: number;
  why?: Localized | null;
  /** manual only: what to do. */
  title?: Localized | null;
  /** publish: a post's expected views (the server's, from our own posts). */
  estimate?: { low: number; high: number } | null;
  done_manual?: boolean;
  done_by?: string | null;
  done_at?: string | null;
}

export interface TaskProgress { value: number; target: number; done: boolean }

/** Limits on what a plan may hold (Koleex AI's or a person's). */
export const PLAN_LIMITS = { tasks: 7, manual: 2, publishTarget: 5, text: 220 } as const;

/** A post as the plan counts it. */
export interface PlanPost { platform: string; posted_at: string | null; media: ReadonlyArray<{ kind?: string }> | null }

/** A task's progress in its week — see the header. Replies: of the comment
 *  threads a customer wrote in this week, how many no longer need a reply
 *  (answered, or marked «No reply needed»); none written counts as done. */
export function taskProgress(
  task: PlanTask, weekStart: string,
  posts: readonly PlanPost[], threads: ReadonlyArray<{ first: ThreadRow; replies: ThreadRow[] }>,
): TaskProgress {
  const { from, to } = weekRange(weekStart);
  const within = (at: string | null | undefined) => { const t = at ? Date.parse(at) : NaN; return t >= from && t < to; };
  if (task.kind === "publish") {
    const value = posts.filter((p) => p.platform === task.platform && within(p.posted_at) && (!task.format || formatOf(p.media) === task.format)).length;
    return { value, target: task.target, done: value >= task.target };
  }
  if (task.kind === "reply") {
    const theirs = threads.filter((t) => [t.first, ...t.replies].some((r) => !r.is_ours && !r.hidden && within(r.commented_at)));
    const answered = theirs.filter((t) => !needsReply(t.first, t.replies)).length;
    return { value: answered, target: theirs.length, done: answered >= theirs.length };
  }
  return { value: task.done_manual ? 1 : 0, target: 1, done: !!task.done_manual };
}

/** Comment rows into threads for taskProgress (the Comments tab's rule). */
export const planThreads = <R extends ThreadRow>(rows: R[]) => groupThreads(rows);

/** A post's expected views: the middle half of our own posts' views (the
 *  25th to 75th percentile, like Meta's range). null with too few posts. */
export function viewsEstimate(views: readonly number[]): { low: number; high: number } | null {
  const v = views.filter((x) => Number.isFinite(x) && x >= 0).slice().sort((a, b) => a - b);
  if (v.length < 3) return null;
  const at = (q: number) => { const i = (v.length - 1) * q; const lo = Math.floor(i); const hi = Math.ceil(i); return v[lo] + (v[hi] - v[lo]) * (i - lo); };
  const low = Math.round(at(0.25)), high = Math.round(at(0.75));
  return high > 0 ? { low, high: Math.max(low, high) } : null;
}

const text = (v: unknown): string => (typeof v === "string" ? v.trim().slice(0, PLAN_LIMITS.text) : "");

/** Koleex AI's (or a person's) text in three languages; a missing one takes
 *  the English. null when there is no English. */
export function localized(v: unknown): Localized | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const en = text(o.en);
  if (!en) return null;
  return { en, zh: text(o.zh) || en, ar: text(o.ar) || en };
}

let seq = 0;
const newId = () => `t${Date.now().toString(36)}${(seq++ % 1296).toString(36).padStart(2, "0")}`;

/** Only what the Hub can act on — see the header. */
export function cleanTasks(raw: unknown, platforms: readonly PlanPlatform[]): PlanTask[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: PlanTask[] = [];
  const seen = new Set<string>();
  let manual = 0, reply = 0;
  for (const r of list) {
    if (out.length >= PLAN_LIMITS.tasks || !r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const why = localized(o.why);
    const id = typeof o.id === "string" && /^[\w-]{1,40}$/.test(o.id) ? o.id : newId();
    const base = { done_manual: o.done_manual === true, done_by: typeof o.done_by === "string" ? o.done_by : null, done_at: typeof o.done_at === "string" ? o.done_at : null };
    if (o.kind === "publish") {
      const platform = o.platform as PlanPlatform;
      if (!platforms.includes(platform)) continue;
      const format = typeof o.format === "string" && (POST_FORMATS as readonly string[]).includes(o.format) ? (o.format as PostFormat) : null;
      const key = `${platform}|${format ?? "any"}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const n = Math.round(Number(o.target));
      out.push({ id, kind: "publish", platform, format, target: Math.min(PLAN_LIMITS.publishTarget, Math.max(1, Number.isFinite(n) ? n : 1)), why, estimate: null, done_manual: false, done_by: null, done_at: null });
    } else if (o.kind === "reply") {
      if (reply++) continue;
      out.push({ id, kind: "reply", target: 1, why, done_manual: false, done_by: null, done_at: null });
    } else if (o.kind === "manual") {
      const title = localized(o.title);
      if (!title || manual >= PLAN_LIMITS.manual) continue;
      manual++;
      out.push({ id, kind: "manual", target: 1, title, why, ...base });
    }
  }
  return out;
}

/** When Koleex AI cannot answer: a plain plan from the connected platforms. */
export function defaultTasks(platforms: readonly PlanPlatform[], hasComments: boolean): PlanTask[] {
  const why: Record<string, Localized> = {
    publish: { en: "Regular posting keeps the account in its followers' feeds.", zh: "定期发布能让账号保持在粉丝的动态中。", ar: "النشر المنتظم يُبقي الحساب في صفحات متابعيه." },
    reply: { en: "A quick answer turns a question into a conversation.", zh: "及时回复能把提问变成对话。", ar: "الرد السريع يحوّل السؤال إلى محادثة." },
  };
  const tasks: unknown[] = platforms.map((platform) => ({ kind: "publish", platform, format: null, target: 3, why: why.publish }));
  if (hasComments) tasks.push({ kind: "reply", why: why.reply });
  return cleanTasks(tasks, platforms);
}
