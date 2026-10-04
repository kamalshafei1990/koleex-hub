import "server-only";

/* ---------------------------------------------------------------------------
   marketing/posts — posts written in the Hub and the accounts they go to.

   The life of a post (marketing_posts.status):
     draft → (Send for approval) in_review → (Approve) approved → publishing
     → published / partly_published / failed;  in_review → (Send back)
     rejected → edited → draft again.
   Who approves: lib/server/marketing/approvals. An approver's own draft is
   approved and published in one step.

   Every change a PERSON makes carries the version they read and bumps it
   (optimistic lock): two people editing the same post never overwrite each
   other silently — the second one is told to reload. The publishing engine
   (./publish) moves statuses on its own without touching the version.

   Pictures and videos must be uploads of this tenant in the public `media`
   bucket (marketing/<tenant>/…): nothing else can be published through here.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { inChunks } from "@/lib/server/in-chunks";
import { allSpaceAccounts, listAccounts } from "@/lib/server/marketing/accounts";
import {
  DECISION_NOTE_MAX, FB_TEXT_MAX, IMAGE_MAX_BYTES, IMAGE_MIMES, MAX_MEDIA, MAX_TARGETS, VIDEO_MAX_BYTES, VIDEO_MIMES,
  targetIssues, type Issue,
} from "@/lib/marketing/post-rules";
import type {
  PostFilter, PostInput, PostMedia, PostStatus, PostSummary, PostTargetView, PostView, TargetStatus,
} from "@/lib/marketing/post-types";
import type { MarketingAccountView, MarketingSpace } from "@/lib/marketing/spaces";
import { CEO_MONTHLY_APPROVED, CEO_WEEKLY_POSTS, contentState, type ContentCheck } from "@/lib/marketing/ceo-rules";
import { planWeekStart, weekRange } from "@/lib/marketing/week-plan";
import { contentSig } from "@/lib/server/marketing/content-check";
import type { CaptureRecord } from "@/lib/marketing/capture";

export const EDITABLE: readonly PostStatus[] = ["draft", "in_review", "rejected"];

/** A CEO Brand quick capture is a SHARED draft: the CEO speaks it, whoever
 *  writes for CEO Brand finishes and sends it (owner, 30/09/2026) — so
 *  besides its author and the approvers, any CEO Brand writer may edit and
 *  send it (never delete it). */
export const sharedDraft = (p: { space: MarketingSpace; capture?: CaptureRecord | null }): boolean => p.space === "ceo" && !!p.capture;
const LIST_COLUMNS = "id, space, status, body, media, created_by, submitted_at, decided_by, decided_at, decision_note, scheduled_at, published_at, version, created_at, updated_at";
/* One post adds its content check and its capture (CEO Brand); the list
   does without. */
const POST_COLUMNS = `${LIST_COLUMNS}, content_check, capture`;
/* A scheduled time must leave the publisher (every 5 minutes) room to
   pick it up; and nothing is planned more than a year ahead. */
export const SCHEDULE_LEAD_MS = 2 * 60_000;
const SCHEDULE_MAX_MS = 366 * 86_400_000;
const TARGET_COLUMNS = "id, post_id, account_id, body_override, status, permalink, error, published_at";
const PAGE = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Result<T = { ok: true }> = T | { error: string; status: number; code?: string; issues?: Record<string, Issue[]> };
export const isError = <T,>(r: Result<T>): r is { error: string; status: number; code?: string; issues?: Record<string, Issue[]> } =>
  typeof r === "object" && r !== null && "error" in r;

const CONFLICT = { error: "Someone else changed this post. Reload to see their version.", status: 409, code: "conflict" } as const;
const LOCKED = { error: "This post can no longer be changed.", status: 409, code: "locked" } as const;

/** Where this tenant's uploads go, and the public link they must start with. */
export const uploadPrefix = (tenantId: string) => `marketing/${tenantId}/`;
export function mediaUrlPrefix(tenantId: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/media/${uploadPrefix(tenantId)}`;
}

type PostRow = {
  id: string; space: MarketingSpace; status: PostStatus; body: string; media: PostMedia[] | null;
  created_by: string; submitted_at: string | null; decided_by: string | null; decided_at: string | null;
  decision_note: string | null; scheduled_at: string | null; published_at: string | null; version: number; created_at: string; updated_at: string;
  content_check?: ContentCheck | null;
  capture?: CaptureRecord | null;
};
type TargetRow = {
  id: string; post_id: string; account_id: string; body_override: string | null; status: TargetStatus;
  permalink: string | null; error: string | null; published_at: string | null;
};

const num = (v: unknown, max: number): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null);

/** A post as a person sent it, checked and trimmed to what may be stored. */
export function cleanInput(tenantId: string, raw: unknown): Result<{ input: PostInput }> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const body = typeof b.body === "string" ? b.body : "";
  if (Array.from(body).length > FB_TEXT_MAX) return { error: "The text is too long.", status: 400 };

  const rawMedia = Array.isArray(b.media) ? b.media : [];
  if (rawMedia.length > MAX_MEDIA) return { error: `Up to ${MAX_MEDIA} pictures or videos.`, status: 400 };
  const urlPrefix = mediaUrlPrefix(tenantId);
  const pathPrefix = uploadPrefix(tenantId);
  const media: PostMedia[] = [];
  for (const m of rawMedia as Array<Record<string, unknown>>) {
    const kind = m?.kind === "video" ? "video" : m?.kind === "image" ? "image" : null;
    const url = typeof m?.url === "string" ? m.url : "";
    const path = typeof m?.path === "string" ? m.path : "";
    const mime = typeof m?.mime === "string" ? m.mime : "";
    const size = num(m?.size, kind === "video" ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES);
    const okMime = kind === "image" ? (IMAGE_MIMES as readonly string[]).includes(mime) : (VIDEO_MIMES as readonly string[]).includes(mime);
    if (!kind || !okMime || size === null) return { error: "A picture or video is not one the Hub accepts.", status: 400 };
    /* The link is rebuilt from the path, never taken from the caller: only
       this tenant's uploads, only at their real public address. */
    if (!path.startsWith(pathPrefix) || path.includes("..") || !/^[A-Za-z0-9/_.-]+$/.test(path) || !url) {
      return { error: "Pictures and videos must be uploaded from the composer.", status: 400 };
    }
    media.push({ kind, url: `${urlPrefix}${path.slice(pathPrefix.length)}`, path, mime, size, width: num(m?.width, 20000), height: num(m?.height, 20000), duration: num(m?.duration, 7200) });
  }

  const rawTargets = Array.isArray(b.targets) ? b.targets : [];
  if (rawTargets.length > MAX_TARGETS) return { error: `Up to ${MAX_TARGETS} accounts per post.`, status: 400 };
  const seen = new Set<string>();
  const targets: PostInput["targets"] = [];
  for (const t of rawTargets as Array<Record<string, unknown>>) {
    const id = typeof t?.account_id === "string" ? t.account_id : "";
    if (!UUID_RE.test(id) || seen.has(id)) return { error: "An account is listed twice or not valid.", status: 400 };
    seen.add(id);
    const override = typeof t?.body_override === "string" ? t.body_override : null;
    if (override !== null && Array.from(override).length > FB_TEXT_MAX) return { error: "The text is too long.", status: 400 };
    targets.push({ account_id: id, body_override: override });
  }

  let scheduled_at: string | null = null;
  if (b.scheduled_at !== null && b.scheduled_at !== undefined) {
    const t = typeof b.scheduled_at === "string" ? Date.parse(b.scheduled_at) : NaN;
    if (Number.isNaN(t)) return { error: "The scheduled time is not valid.", status: 400 };
    if (t > Date.now() + SCHEDULE_MAX_MS) return { error: "Schedule within a year.", status: 400 };
    scheduled_at = new Date(t).toISOString();
  }
  return { input: { body, media, targets, scheduled_at } };
}

/** The accounts of the space a post may go to, by id. */
async function spaceAccounts(tenantId: string, space: MarketingSpace): Promise<Map<string, MarketingAccountView>> {
  return new Map((await listAccounts(tenantId, space)).map((a) => [a.id, a]));
}

/** Display names of accounts (people's full names, else the username). */
export async function namesOf(ids: string[]): Promise<Map<string, string>> {
  const want = [...new Set(ids.filter((i) => UUID_RE.test(i)))];
  const out = new Map<string, string>();
  if (!want.length) return out;
  const { data: accs, error } = await supabaseServer.from("accounts").select("id, username, person_id").in("id", want).limit(want.length);
  if (error) throw new Error(`accounts: ${error.message}`);
  const rows = (accs ?? []) as Array<{ id: string; username: string | null; person_id: string | null }>;
  const personIds = [...new Set(rows.map((r) => r.person_id).filter((p): p is string => !!p))];
  const people = new Map<string, string>();
  if (personIds.length) {
    const { data: ppl, error: pErr } = await supabaseServer.from("people").select("id, full_name").in("id", personIds).limit(personIds.length);
    if (pErr) throw new Error(`people: ${pErr.message}`);
    for (const p of (ppl ?? []) as Array<{ id: string; full_name: string | null }>) if (p.full_name) people.set(p.id, p.full_name);
  }
  for (const r of rows) out.set(r.id, (r.person_id && people.get(r.person_id)) || r.username || "");
  return out;
}

async function targetsOf(postIds: string[]): Promise<TargetRow[]> {
  const { data, error } = await inChunks<TargetRow>(postIds, (chunk) =>
    supabaseServer.from("marketing_post_targets").select(TARGET_COLUMNS).in("post_id", chunk).order("created_at", { ascending: true }).limit(chunk.length * MAX_TARGETS));
  if (error) throw new Error(`marketing post targets: ${error.message}`);
  return data ?? [];
}

async function readPost(tenantId: string, id: string): Promise<PostRow | null> {
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await supabaseServer.from("marketing_posts").select(POST_COLUMNS).eq("tenant_id", tenantId).eq("id", id).maybeSingle();
  if (error) throw new Error(`marketing posts: ${error.message}`);
  return (data as PostRow | null) ?? null;
}

export async function loadPost(tenantId: string, id: string): Promise<PostView | null> {
  const row = await readPost(tenantId, id);
  if (!row) return null;
  const [targets, accounts] = await Promise.all([targetsOf([row.id]), spaceAccountsWithRemoved(tenantId, row.space)]);
  const names = await namesOf([row.created_by, row.decided_by ?? ""]);
  const media = Array.isArray(row.media) ? row.media : [];
  const overrides = [...new Set(targets.map((t) => t.body_override).filter((x): x is string => !!x && !!x.trim()))];
  const check = row.content_check ?? null;
  return {
    ...row,
    media,
    content_check: check,
    content_state: contentState(check, contentSig(row.body, overrides, media), Date.now()),
    capture: row.capture ?? null,
    author: names.get(row.created_by) || null,
    decider: row.decided_by ? names.get(row.decided_by) || null : null,
    targets: targets
      .map((t): PostTargetView | null => {
        const account = accounts.get(t.account_id);
        return account ? { id: t.id, account, body_override: t.body_override, status: t.status, permalink: t.permalink, error: t.error, published_at: t.published_at } : null;
      })
      .filter((t): t is PostTargetView => !!t),
  };
}

/* A post's accounts include ones removed since (their row stays, their
   history too) — never their keys. */
async function spaceAccountsWithRemoved(tenantId: string, space: MarketingSpace): Promise<Map<string, MarketingAccountView>> {
  return new Map((await allSpaceAccounts(tenantId, space)).map((a) => [a.id, a]));
}

/** What stops this post going to each of its accounts (by target account). */
export async function postIssues(tenantId: string, space: MarketingSpace, input: PostInput): Promise<Record<string, Issue[]>> {
  const accounts = await spaceAccounts(tenantId, space);
  const out: Record<string, Issue[]> = {};
  for (const t of input.targets) {
    const a = accounts.get(t.account_id);
    if (!a) continue;
    const issues = targetIssues(a, t.body_override ?? input.body, input.media);
    if (issues.length) out[t.account_id] = issues;
  }
  return out;
}

async function checkAccounts(tenantId: string, space: MarketingSpace, input: PostInput): Promise<Result> {
  if (input.targets.length === 0) return { error: "Choose at least one account.", status: 400 };
  const accounts = await spaceAccounts(tenantId, space);
  if (input.targets.some((t) => !accounts.has(t.account_id))) return { error: "One of the accounts is no longer connected.", status: 400, code: "account_gone" };
  return { ok: true };
}

async function writeTargets(tenantId: string, postId: string, input: PostInput): Promise<void> {
  const keep = input.targets.map((t) => t.account_id);
  const { data: existing, error } = await supabaseServer.from("marketing_post_targets").select("id, account_id").eq("post_id", postId).limit(MAX_TARGETS * 2);
  if (error) throw new Error(`marketing post targets: ${error.message}`);
  const drop = ((existing ?? []) as Array<{ id: string; account_id: string }>).filter((t) => !keep.includes(t.account_id)).map((t) => t.id);
  if (drop.length) {
    const { error: dErr } = await supabaseServer.from("marketing_post_targets").delete().in("id", drop);
    if (dErr) throw new Error(`marketing post targets: ${dErr.message}`);
  }
  if (input.targets.length) {
    const now = new Date().toISOString();
    const rows = input.targets.map((t) => ({ tenant_id: tenantId, post_id: postId, account_id: t.account_id, body_override: t.body_override, updated_at: now }));
    const { error: uErr } = await supabaseServer.from("marketing_post_targets").upsert(rows, { onConflict: "post_id,account_id" });
    if (uErr) throw new Error(`marketing post targets: ${uErr.message}`);
  }
}

export async function createPost(tenantId: string, space: MarketingSpace, authorId: string, input: PostInput): Promise<Result<{ id: string }>> {
  const ok = await checkAccounts(tenantId, space, input);
  if (isError(ok)) return ok;
  const { data, error } = await supabaseServer
    .from("marketing_posts")
    .insert({ tenant_id: tenantId, space, status: "draft", body: input.body, media: input.media, scheduled_at: input.scheduled_at, created_by: authorId })
    .select("id")
    .single();
  if (error) throw new Error(`marketing posts: ${error.message}`);
  const id = (data as { id: string }).id;
  await writeTargets(tenantId, id, input);
  return { id };
}

/** Save a person's edit. An author's edit of a post in review, or of one
 *  sent back, returns it to draft (it must be sent again); an approver's
 *  edit keeps it where it is. */
export async function updatePost(
  tenantId: string, id: string, version: number, input: PostInput,
  who: { accountId: string; approver: boolean },
): Promise<Result<{ version: number }>> {
  const row = await readPost(tenantId, id);
  if (!row) return { error: "Post not found.", status: 404 };
  if (!EDITABLE.includes(row.status)) return LOCKED;
  if (row.created_by !== who.accountId && !who.approver && !sharedDraft(row)) return { error: "Only the author or an approver can edit this post.", status: 403 };
  const ok = await checkAccounts(tenantId, row.space, input);
  if (isError(ok)) return ok;
  const status: PostStatus = row.status === "rejected" || (row.status === "in_review" && !who.approver) ? "draft" : row.status;
  const { data, error } = await supabaseServer
    .from("marketing_posts")
    .update({ body: input.body, media: input.media, scheduled_at: input.scheduled_at, status, version: version + 1, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .eq("version", version)
    .in("status", EDITABLE as PostStatus[])
    .select("id");
  if (error) throw new Error(`marketing posts: ${error.message}`);
  if (!data?.length) return CONFLICT;
  await writeTargets(tenantId, id, input);
  return { version: version + 1 };
}

/** One person-made status change, only from the given statuses and only if
 *  nobody changed the post since `version`. */
async function transition(tenantId: string, id: string, version: number, from: readonly PostStatus[], patch: Record<string, unknown>): Promise<Result<{ version: number }>> {
  const { data, error } = await supabaseServer
    .from("marketing_posts")
    .update({ ...patch, version: version + 1, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .eq("version", version)
    .in("status", from as PostStatus[])
    .select("id");
  if (error) throw new Error(`marketing posts: ${error.message}`);
  if (!data?.length) {
    const row = await readPost(tenantId, id);
    if (!row) return { error: "Post not found.", status: 404 };
    return row.version !== version ? CONFLICT : LOCKED;
  }
  return { version: version + 1 };
}

/* A post that cannot go to one of its accounts is not sent on. */
async function readyToGo(tenantId: string, row: PostRow): Promise<Result> {
  const targets = await targetsOf([row.id]);
  const input: PostInput = {
    body: row.body,
    media: Array.isArray(row.media) ? row.media : [],
    targets: targets.map((t) => ({ account_id: t.account_id, body_override: t.body_override })),
    scheduled_at: row.scheduled_at,
  };
  const ok = await checkAccounts(tenantId, row.space, input);
  if (isError(ok)) return ok;
  const issues = await postIssues(tenantId, row.space, input);
  if (Object.keys(issues).length) return { error: "The post cannot go to every account it lists yet.", status: 422, code: "issues", issues };
  return { ok: true };
}

/** Send for approval. A CEO Brand post goes to the CEO only once its sender
 *  confirmed it shows none of the JD's not-allowed content (`confirmedBy`);
 *  the confirmation is kept with it, and Koleex AI's check is queued (the
 *  route runs it after its response). */
export async function submitPost(tenantId: string, id: string, version: number, opts: { confirmedBy?: string | null } = {}): Promise<Result<{ version: number }>> {
  const row = await readPost(tenantId, id);
  if (!row) return { error: "Post not found.", status: 404 };
  if (row.space === "ceo" && !opts.confirmedBy) return { error: "Confirm the content rules before sending the post.", status: 400, code: "confirm" };
  const ready = await readyToGo(tenantId, row);
  if (isError(ready)) return ready;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: "in_review", submitted_at: now, decision_note: null };
  if (row.space === "ceo") {
    const targets = await targetsOf([row.id]);
    const overrides = [...new Set(targets.map((t) => t.body_override).filter((x): x is string => !!x && !!x.trim()))];
    const sig = contentSig(row.body, overrides, Array.isArray(row.media) ? row.media : []);
    const check: ContentCheck = { confirmed_by: opts.confirmedBy ?? null, confirmed_at: now, ai: { status: "queued", at: now, sig } };
    patch.content_check = check;
  }
  return transition(tenantId, id, version, ["draft", "rejected"], patch);
}

export async function rejectPost(tenantId: string, id: string, version: number, deciderId: string, note: string): Promise<Result<{ version: number }>> {
  const text = note.trim();
  if (!text) return { error: "Say what should change.", status: 400 };
  if (text.length > DECISION_NOTE_MAX) return { error: `Up to ${DECISION_NOTE_MAX} characters.`, status: 400 };
  return transition(tenantId, id, version, ["in_review"], {
    status: "rejected", decided_by: deciderId, decided_at: new Date().toISOString(), decision_note: text,
  });
}

/** Approve (an approver's own draft included). A post with a time still
 *  ahead waits for it ("scheduled", published by the cron); otherwise it is
 *  "approved" and the caller publishes it now. */
export async function approvePost(tenantId: string, id: string, version: number, deciderId: string): Promise<Result<{ version: number; scheduled: boolean }>> {
  const row = await readPost(tenantId, id);
  if (!row) return { error: "Post not found.", status: 404 };
  const ready = await readyToGo(tenantId, row);
  if (isError(ready)) return ready;
  const scheduled = !!row.scheduled_at && Date.parse(row.scheduled_at) > Date.now() + SCHEDULE_LEAD_MS;
  const r = await transition(tenantId, id, version, ["draft", "in_review", "rejected"], {
    status: scheduled ? "scheduled" : "approved", decided_by: deciderId, decided_at: new Date().toISOString(), decision_note: null,
  });
  return isError(r) ? r : { version: r.version, scheduled };
}

/** Move a scheduled post to another time (approvers). */
export async function reschedulePost(tenantId: string, id: string, version: number, at: string): Promise<Result<{ version: number }>> {
  const t = Date.parse(at);
  if (Number.isNaN(t)) return { error: "The scheduled time is not valid.", status: 400 };
  if (t <= Date.now() + SCHEDULE_LEAD_MS) return { error: "Pick a time at least a few minutes ahead.", status: 400, code: "too_soon" };
  if (t > Date.now() + SCHEDULE_MAX_MS) return { error: "Schedule within a year.", status: 400 };
  return transition(tenantId, id, version, ["scheduled"], { scheduled_at: new Date(t).toISOString() });
}

/** Take a scheduled post off the schedule: back to draft, to be edited and
 *  approved again (its time is kept as a suggestion). */
export async function unschedulePost(tenantId: string, id: string, version: number): Promise<Result<{ version: number }>> {
  return transition(tenantId, id, version, ["scheduled"], { status: "draft", decided_by: null, decided_at: null });
}

/** Publish a scheduled post now instead of at its time; the caller publishes. */
export async function publishScheduledNow(tenantId: string, id: string, version: number, deciderId: string): Promise<Result<{ version: number }>> {
  return transition(tenantId, id, version, ["scheduled"], { status: "approved", decided_by: deciderId, decided_at: new Date().toISOString(), scheduled_at: null });
}

export async function deletePost(tenantId: string, id: string, version: number, who: { accountId: string; approver: boolean }): Promise<Result> {
  const row = await readPost(tenantId, id);
  if (!row) return { error: "Post not found.", status: 404 };
  if (!EDITABLE.includes(row.status)) return LOCKED;
  if (row.created_by !== who.accountId && !who.approver) return { error: "Only the author or an approver can delete this post.", status: 403 };
  const { data, error } = await supabaseServer
    .from("marketing_posts")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .eq("version", version)
    .in("status", EDITABLE as PostStatus[])
    .select("id");
  if (error) throw new Error(`marketing posts: ${error.message}`);
  return data?.length ? { ok: true } : CONFLICT;
}

/** The space and author of a post — what a route checks before acting. */
export async function postMeta(tenantId: string, id: string): Promise<{ space: MarketingSpace; created_by: string; status: PostStatus; version: number; shared: boolean } | null> {
  const row = await readPost(tenantId, id);
  return row ? { space: row.space, created_by: row.created_by, status: row.status, version: row.version, shared: sharedDraft(row) } : null;
}

/** Failed accounts go back in line; the caller then publishes again. */
export async function retryFailed(tenantId: string, id: string): Promise<Result> {
  const row = await readPost(tenantId, id);
  if (!row) return { error: "Post not found.", status: 404 };
  if (!["failed", "partly_published"].includes(row.status)) return LOCKED;
  const { error } = await supabaseServer
    .from("marketing_post_targets")
    .update({ status: "pending", error: null, publish_state: {}, next_attempt_at: null, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("post_id", id)
    .eq("status", "failed");
  if (error) throw new Error(`marketing post targets: ${error.message}`);
  const { error: pErr } = await supabaseServer.from("marketing_posts").update({ status: "publishing", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId).eq("id", id).in("status", ["failed", "partly_published"]);
  if (pErr) throw new Error(`marketing posts: ${pErr.message}`);
  return { ok: true };
}

const FILTERS: Record<PostFilter, readonly PostStatus[] | null> = {
  all: null,
  drafts: ["draft", "rejected"],
  review: ["in_review"],
  scheduled: ["scheduled"],
  published: ["published", "partly_published"],
  problems: ["failed", "partly_published"],
};

export async function listPosts(tenantId: string, space: MarketingSpace, filter: PostFilter, cursor: string | null): Promise<{ posts: PostSummary[]; next: string | null; counts: { drafts: number; review: number; scheduled: number; problems: number } }> {
  let q = supabaseServer.from("marketing_posts").select(LIST_COLUMNS).eq("tenant_id", tenantId).eq("space", space).neq("status", "archived");
  const only = FILTERS[filter];
  if (only) q = q.in("status", only as PostStatus[]);
  if (cursor) {
    const cut = cursor.lastIndexOf("|");
    const at = cursor.slice(0, cut);
    const id = cursor.slice(cut + 1);
    if (cut > 0 && UUID_RE.test(id) && !Number.isNaN(Date.parse(at))) {
      const iso = new Date(at).toISOString();
      q = q.or(`updated_at.lt."${iso}",and(updated_at.eq."${iso}",id.lt.${id})`);
    }
  }
  const { data, error } = await q.order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(PAGE + 1);
  if (error) throw new Error(`marketing posts: ${error.message}`);
  const rows = ((data ?? []) as PostRow[]).slice(0, PAGE);
  const more = (data ?? []).length > PAGE;

  const [targets, accounts, names, counts] = await Promise.all([
    targetsOf(rows.map((r) => r.id)),
    spaceAccountsWithRemoved(tenantId, space),
    namesOf(rows.map((r) => r.created_by)),
    Promise.all((["drafts", "review", "scheduled", "problems"] as const).map(async (f) => {
      const { count, error: cErr } = await supabaseServer.from("marketing_posts").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("space", space).in("status", FILTERS[f] as PostStatus[]);
      if (cErr) throw new Error(`marketing posts: ${cErr.message}`);
      return count ?? 0;
    })),
  ]);
  const byPost = new Map<string, TargetRow[]>();
  for (const t of targets) byPost.set(t.post_id, [...(byPost.get(t.post_id) ?? []), t]);

  const posts = rows.map((r): PostSummary => {
    const media = Array.isArray(r.media) ? r.media : [];
    const ts = byPost.get(r.id) ?? [];
    const text = r.body.trim();
    const chars = Array.from(text);
    return {
      id: r.id,
      status: r.status,
      excerpt: text ? (chars.length > 200 ? `${chars.slice(0, 200).join("").trimEnd()}…` : text) : null,
      thumb: media[0] ? { kind: media[0].kind, url: media[0].url } : null,
      media_count: media.length,
      accounts: ts.map((t) => accounts.get(t.account_id)).filter((a): a is MarketingAccountView => !!a).map((a) => ({ id: a.id, platform: a.platform, name: a.name })),
      author: names.get(r.created_by) || null,
      updated_at: r.updated_at,
      scheduled_at: r.scheduled_at,
      published_at: r.published_at,
      failed: ts.filter((t) => t.status === "failed").length,
      to_share: ["approved", "publishing", "published", "partly_published"].includes(r.status)
        ? ts.filter((t) => t.status === "pending" && accounts.get(t.account_id)?.connection === "assisted").length
        : 0,
    };
  });
  const last = rows[rows.length - 1];
  return { posts, next: more && last ? `${last.updated_at}|${last.id}` : null, counts: { drafts: counts[0], review: counts[1], scheduled: counts[2], problems: counts[3] } };
}

/** Posts the CEO approved (and did not take back): approved, going out, out,
 *  or failed on the way. */
const APPROVED: readonly PostStatus[] = ["approved", "scheduled", "publishing", "published", "partly_published", "failed"];
/** Posts going out or out. */
const GOING: readonly PostStatus[] = ["approved", "scheduled", "publishing", "published", "partly_published"];

/** CEO Brand's KPIs (the JD): this week's posts — out, or approved to go
 *  out this week (Monday to Sunday) — against 3, and this month's approved
 *  posts against 12, Shanghai time. A post counts in the week of its going
 *  out (published, else its time, else its approval), in the month of its
 *  approval. */
export async function ceoKpis(tenantId: string, now: number = Date.now()): Promise<{
  week: { count: number; target: number }; month: { count: number; target: number };
}> {
  const wk = weekRange(planWeekStart(now));
  const s = new Date(now + 8 * 3_600_000);
  const y = s.getUTCFullYear();
  const m = s.getUTCMonth();
  const monthFrom = Date.UTC(y, m, 1) - 8 * 3_600_000;
  const monthTo = Date.UTC(y, m + 1, 1) - 8 * 3_600_000;
  const iso = (t: number) => new Date(t).toISOString();
  const [month, week] = await Promise.all([
    supabaseServer.from("marketing_posts").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("space", "ceo").in("status", APPROVED as PostStatus[])
      .gte("decided_at", iso(monthFrom)).lt("decided_at", iso(monthTo)),
    supabaseServer.from("marketing_posts").select("id, status, decided_at, scheduled_at, published_at")
      .eq("tenant_id", tenantId).eq("space", "ceo").in("status", GOING as PostStatus[])
      .or(["published_at", "scheduled_at", "decided_at"].map((c) => `and(${c}.gte.${iso(wk.from)},${c}.lt.${iso(wk.to)})`).join(","))
      .limit(500),
  ]);
  if (month.error) throw new Error(`marketing posts: ${month.error.message}`);
  if (week.error) throw new Error(`marketing posts: ${week.error.message}`);
  const inWeek = ((week.data ?? []) as Array<{ decided_at: string | null; scheduled_at: string | null; published_at: string | null }>).filter((r) => {
    const at = Date.parse(r.published_at ?? r.scheduled_at ?? r.decided_at ?? "");
    return at >= wk.from && at < wk.to;
  }).length;
  return { week: { count: inWeek, target: CEO_WEEKLY_POSTS }, month: { count: month.count ?? 0, target: CEO_MONTHLY_APPROVED } };
}
