import "server-only";

/* ---------------------------------------------------------------------------
   marketing/notify — the notifications of Social Marketing's posts (owner,
   28/09/2026).

     · Sent for approval → every approver is asked (marketing_approval_
       request). No buttons in the bell, the owner's pick: the notification
       opens the post, and its preview — the text and pictures the public
       will see — is what the approver is approving.
     · Decided → the author hears: approved and going out, scheduled for
       when (Shanghai time), sent back with what should change, or taken off
       the schedule.
     · Publishing failed, on every account or on some → the author and the
       approver who let it go.
     · Published with nobody watching (a scheduled post at its time, a video
       Instagram took longer to prepare) → the author hears it went out.
     · The weekly plan (29/09/2026): Koleex AI's draft for the week → every
       approver is asked to review and approve it; the request stops asking
       once it is approved or its week ends (settlePlan).

   A person never hears of their own act (notifyLite drops the sender), and
   a request stops asking once nobody can answer it any more: approved, sent
   back, edited back to a draft by its author, or deleted. One that waits a
   day comes back to the approvers (lib/server/approval-reminders).

   Only the Social Marketing space for now: CEO Brand has no screens yet, so
   a link there would open nothing; its notifications come with its screens.

   Fire-and-forget: the routes run these after their response, the
   publisher through later(), and nothing here can fail the change that
   triggered it. Templates: translations/notif-templates/marketing.ts.
   --------------------------------------------------------------------------- */

import { after } from "next/server";
import { notifyLite } from "@/lib/server/notify-lite";
import { clearUnreadByMeta, clearUnreadByMetaIn } from "@/lib/server/inbox-lifecycle";
import { superAdminAccountIds } from "@/lib/server/sa-notify";
import { supabaseServer } from "@/lib/server/supabase-server";
import { loadPost } from "@/lib/server/marketing/posts";
import { SOCIAL_APPROVALS_MODULE, isOpenAccessModule } from "@/lib/permission-modules";
import { SPACE_MODULE, type MarketingPlatform } from "@/lib/marketing/spaces";
import { dmyHm } from "@/lib/marketing/format";
import type { PostStatus, PostTargetView } from "@/lib/marketing/post-types";

type Actor = { account_id: string; tenant_id: string };

/** What a person decided about a post. "approved" also covers "publish it
 *  now" on a scheduled one: either way it is going out now. */
export type PostDecision = "approved" | "scheduled" | "rejected" | "unscheduled";

/** After the response inside a request; directly in a script, which has no
 *  after(). */
export function later(run: () => Promise<void>): void {
  try { after(run); } catch { void run(); }
}

/** Nothing here may fail the change that triggered it: an error is logged
 *  and swallowed, so a caller's after() never sees a rejection. */
function quiet<A extends unknown[]>(name: string, fn: (...args: A) => Promise<void>): (...args: A) => Promise<void> {
  return async (...args: A) => {
    try {
      await fn(...args);
    } catch (e) {
      console.error(`[marketing/notify.${name}]`, e instanceof Error ? e.message : e);
    }
  };
}

const postLink = (id: string) => `/social-marketing/posts/${encodeURIComponent(id)}`;

const PLATFORM_NAME: Record<MarketingPlatform, string> = {
  facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube", tiktok: "TikTok",
  x: "X", wechat: "WeChat", whatsapp: "WhatsApp", douyin: "Douyin",
};

/** "Facebook · Instagram" — with the account's own name when a post goes to
 *  two accounts on the same platform. */
export function accountsLabel(targets: PostTargetView[]): string {
  const per = new Map<string, number>();
  for (const t of targets) per.set(t.account.platform, (per.get(t.account.platform) ?? 0) + 1);
  const names = targets.map((t) => {
    const p = PLATFORM_NAME[t.account.platform] ?? t.account.platform;
    return (per.get(t.account.platform) ?? 0) > 1 ? `${p} (${t.account.name})` : p;
  });
  return [...new Set(names)].join(" · ") || "—";
}

/** The post's first line, short enough for a notification. */
export function excerpt(body: string): string | undefined {
  const line = body.split("\n").map((l) => l.trim()).find(Boolean);
  if (!line) return undefined;
  return line.length > 80 ? `${line.slice(0, 79).trimEnd()}…` : line;
}

/** Who may approve a Social Marketing post — exactly whom the approve route
 *  lets through: the Super Admins, and active internal accounts holding
 *  «Social Marketing Approvals» (canApprovePosts) AND "edit" on Social
 *  Marketing (the route's gate), a per-account override winning over the
 *  role the way requireModuleAccess and requireModuleAction read them.
 *  Nobody is asked to decide what the server would refuse them. A failed
 *  read of the grants still asks the Super Admins. */
export async function marketingApproverIds(tenantId: string): Promise<string[]> {
  type Perm = { role_id?: string; account_id?: string; module_name?: string; module_key?: string; can_view?: boolean | null; can_edit?: boolean | null };
  const APPROVALS = SOCIAL_APPROVALS_MODULE;
  const APP = SPACE_MODULE.company;
  const ids = new Set(await superAdminAccountIds(tenantId));
  const [roleGrants, accountGrants] = await Promise.all([
    supabaseServer.from("koleex_permissions").select("role_id").ilike("module_name", APPROVALS).eq("can_view", true),
    supabaseServer.from("account_permission_overrides").select("account_id").ilike("module_key", APPROVALS).eq("can_view", true),
  ]);
  if (roleGrants.error || accountGrants.error) {
    console.error("[marketing/notify.approvers]", roleGrants.error?.message ?? accountGrants.error?.message);
    return [...ids];
  }
  const roles = [...new Set(((roleGrants.data ?? []) as Perm[]).map((p) => p.role_id!))];
  const granted = [...new Set(((accountGrants.data ?? []) as Perm[]).map((p) => p.account_id!))];
  const or = [roles.length ? `role_id.in.(${roles.join(",")})` : null, granted.length ? `id.in.(${granted.join(",")})` : null].filter(Boolean).join(",");
  if (!or) return [...ids];
  const { data: accts, error } = await supabaseServer
    .from("accounts")
    .select("id, role_id")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .eq("user_type", "internal")
    .not("role_id", "is", null)
    .or(or)
    .limit(200);
  if (error) {
    console.error("[marketing/notify.approvers]", error.message);
    return [...ids];
  }
  const cands = ((accts ?? []) as Array<{ id: string; role_id: string }>).filter((c) => !ids.has(c.id));
  if (!cands.length) return [...ids];
  const roleIds = [...new Set(cands.map((c) => c.role_id))];
  const either = (col: string) => `${col}.ilike."${APPROVALS}",${col}.ilike."${APP}"`;
  const [rolePerms, overrides] = await Promise.all([
    supabaseServer.from("koleex_permissions").select("role_id, module_name, can_view, can_edit").in("role_id", roleIds).or(either("module_name")),
    supabaseServer.from("account_permission_overrides").select("account_id, module_key, can_view, can_edit").in("account_id", cands.map((c) => c.id)).or(either("module_key")),
  ]);
  if (rolePerms.error || overrides.error) {
    console.error("[marketing/notify.approvers]", rolePerms.error?.message ?? overrides.error?.message);
    return [...ids];
  }
  const norm = (m?: string) => (m ?? "").toLowerCase();
  const find = (rows: Perm[] | null, match: (r: Perm) => boolean) => (rows ?? []).find(match) ?? null;
  for (const c of cands) {
    const rA = find(rolePerms.data as Perm[], (r) => r.role_id === c.role_id && norm(r.module_name) === norm(APPROVALS));
    const rM = find(rolePerms.data as Perm[], (r) => r.role_id === c.role_id && norm(r.module_name) === norm(APP));
    const oA = find(overrides.data as Perm[], (r) => r.account_id === c.id && norm(r.module_key) === norm(APPROVALS));
    const oM = find(overrides.data as Perm[], (r) => r.account_id === c.id && norm(r.module_key) === norm(APP));
    /* requireModuleAccess(«Social Marketing Approvals») */
    const mayApprove = typeof oA?.can_view === "boolean" ? oA.can_view : rA?.can_view === true;
    if (!mayApprove) continue;
    /* requireModuleAction(Social Marketing, "edit") */
    if (oM?.can_view === false) continue;
    const edit = typeof oM?.can_edit === "boolean" ? oM.can_edit : rM?.can_edit;
    if (edit === true || (!oM && !rM && isOpenAccessModule(APP))) ids.add(c.id);
  }
  return [...ids];
}

/** Sent for approval: every approver but the sender is asked; an unread
 *  request about the same post is replaced. */
export const notifyPostSubmitted = quiet("notifyPostSubmitted", async (a: Actor, postId: string): Promise<void> => {
  const post = await loadPost(a.tenant_id, postId);
  if (!post || post.space !== "company" || post.status !== "in_review") return;
  await notifyLite({
    tenantId: a.tenant_id,
    recipients: await marketingApproverIds(a.tenant_id),
    senderId: a.account_id,
    tpl: { k: "marketing_approval_request", p: { who: post.author || "—", accounts: accountsLabel(post.targets), text: excerpt(post.body) } },
    link: postLink(post.id),
    type: "marketing_approval_request",
    metadata: { source: "social-marketing", post_id: post.id },
    tag: `mkt-post:${post.id}`,
    supersede: { type: "marketing_approval_request", post_id: post.id },
  });
});

/** A person decided on a post: the request is answered for every approver,
 *  and the author hears — unless they decided it themselves. */
export const notifyPostDecided = quiet("notifyPostDecided", async (a: Actor, postId: string, decision: PostDecision): Promise<void> => {
  await clearUnreadByMeta({ type: "marketing_approval_request", post_id: postId });
  const post = await loadPost(a.tenant_id, postId);
  if (!post || post.space !== "company") return;
  const accounts = accountsLabel(post.targets);
  await notifyLite({
    tenantId: a.tenant_id,
    recipients: [post.created_by],
    senderId: a.account_id,
    tpl: decision === "scheduled" ? { k: "marketing_post_decided.scheduled", p: { when: dmyHm(post.scheduled_at), accounts } }
      : decision === "rejected" ? { k: "marketing_post_decided.rejected", p: { note: post.decision_note ?? undefined } }
      : decision === "unscheduled" ? { k: "marketing_post_decided.unscheduled" }
      : { k: "marketing_post_decided", p: { accounts } },
    link: postLink(post.id),
    type: "marketing_post_decided",
    metadata: { source: "social-marketing", post_id: post.id, decision },
    tag: `mkt-post:${post.id}`,
    supersede: { type: "marketing_post_decided", post_id: post.id },
  });
});

/** The publisher moved a post to a settled status. `actorId`: whose request
 *  ran the publishing — they watched it on their screen — or null for the
 *  cron. Failed (on all accounts or some) → the author and its approver;
 *  published with nobody watching → the author. */
export const notifyPublishOutcome = quiet("notifyPublishOutcome", async (tenantId: string, postId: string, to: PostStatus, actorId: string | null): Promise<void> => {
  const post = await loadPost(tenantId, postId);
  if (!post || post.space !== "company") return;
  if (to === "published") {
    if (actorId) return;
    const out = post.targets.filter((t) => t.status === "published" || t.status === "shared");
    await notifyLite({
      tenantId,
      recipients: [post.created_by],
      senderId: null,
      tpl: { k: "marketing_post_published", p: { accounts: accountsLabel(out.length ? out : post.targets) } },
      link: postLink(post.id),
      type: "marketing_post_published",
      metadata: { source: "social-marketing", post_id: post.id },
      tag: `mkt-post:${post.id}`,
    });
    return;
  }
  if (to !== "failed" && to !== "partly_published") return;
  const failed = post.targets.filter((t) => t.status === "failed");
  /* The platform's own words; a rule the Hub checks ("rule:<code>") is
     explained on the post itself, in the reader's language. */
  const said = failed.map((t) => t.error).find((e): e is string => !!e && !e.startsWith("rule:"));
  const reason = said && said.length > 140 ? `${said.slice(0, 139).trimEnd()}…` : said;
  await notifyLite({
    tenantId,
    recipients: [post.created_by, post.decided_by],
    senderId: actorId,
    tpl: to === "failed"
      ? { k: "marketing_publish_failed", p: { accounts: accountsLabel(failed.length ? failed : post.targets), reason } }
      : { k: "marketing_publish_failed.partly", p: { accounts: accountsLabel(failed), reason } },
    link: postLink(post.id),
    type: "marketing_publish_failed",
    metadata: { source: "social-marketing", post_id: post.id, status: to },
    tag: `mkt-post:${post.id}`,
    supersede: { type: "marketing_publish_failed", post_id: post.id },
  });
});

/** An edit may have taken the post out of review (an author's edit makes it
 *  a draft again): the request stops asking unless the post still waits.
 *  Asked of the post itself, never guessed from the edit. */
export const settleReview = quiet("settleReview", async (tenantId: string, postId: string): Promise<void> => {
  const { data, error } = await supabaseServer.from("marketing_posts").select("status").eq("tenant_id", tenantId).eq("id", postId).maybeSingle();
  if (error) throw new Error(`marketing posts: ${error.message}`);
  if ((data as { status: PostStatus } | null)?.status === "in_review") return;
  await clearUnreadByMeta({ type: "marketing_approval_request", post_id: postId });
});

/** A deleted post has nothing left to open: its unread notifications go. */
export const settleDeleted = quiet("settleDeleted", async (postId: string): Promise<void> => {
  await clearUnreadByMetaIn({ post_id: postId }, "type", ["marketing_approval_request", "marketing_post_decided", "marketing_publish_failed"]);
});

/** The accounts that failed are being sent again: the failure is no longer
 *  the news (a new one replaces it; a success needs none). */
export const settleFailure = quiet("settleFailure", async (postId: string): Promise<void> => {
  await clearUnreadByMeta({ type: "marketing_publish_failed", post_id: postId });
});

/** A week's plan was drafted: every approver is asked to review it (the
 *  person who drafted it by hand hears nothing of their own act). Only a
 *  draft of Social Marketing's space asks. */
export const notifyPlanReady = quiet("notifyPlanReady", async (tenantId: string, planId: string, senderId: string | null): Promise<void> => {
  const { data, error } = await supabaseServer.from("marketing_week_plans").select("id, space, status").eq("tenant_id", tenantId).eq("id", planId).maybeSingle();
  if (error) throw new Error(`marketing week plans: ${error.message}`);
  const plan = data as { id: string; space: string; status: string } | null;
  if (!plan || plan.space !== "company" || plan.status !== "draft") return;
  await notifyLite({
    tenantId,
    recipients: await marketingApproverIds(tenantId),
    senderId,
    tpl: { k: "marketing_plan_approval_request" },
    link: "/social-marketing/plan",
    type: "marketing_plan_approval_request",
    metadata: { source: "social-marketing", plan_id: plan.id },
    tag: `mkt-plan:${plan.id}`,
    supersede: { type: "marketing_plan_approval_request", plan_id: plan.id },
  });
});

/** The plan was approved, or its week ended: nobody is asked any more. */
export const settlePlan = quiet("settlePlan", async (planId: string): Promise<void> => {
  await clearUnreadByMeta({ type: "marketing_plan_approval_request", plan_id: planId });
});
