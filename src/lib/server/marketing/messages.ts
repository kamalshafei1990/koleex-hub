import "server-only";

/* ---------------------------------------------------------------------------
   marketing/messages — the customers' private messages on the connected
   Facebook Page (Messenger) and Instagram account (owner, 29/09/2026: its
   own tab «Messages»; a number on the tab and ONE notification per
   conversation, never per message).

     · The read (every cron run, claimed per account with claimMessages):
       the conversations updated since the last read, each with its 20
       newest messages — all Meta shows. The FIRST read imports what is there
       silently; after it, a conversation that starts waiting for an answer
       tells the team once (notified_at), and answering (in the Hub or on
       the platform) or «No reply needed» clears it — the next wait tells
       them again.
     · An AUTOMATIC reply is not an answer: a Page message within 15 s of
       the customer's (an Instant Reply, an away message — message-types
       AUTO_REPLY_MS). A new rule re-decides the kept conversations once
       (applyRule, MESSAGES_RULE), silently.
     · Reply: anyone with "edit" on the account's space, inside the 24 hours
       Meta allows after the customer's last message (after that the Hub says
       so, and the answer is written on the platform). The reply is CLAIMED
       before Meta is called — a placeholder row whose key starts "pending:"
       — so it is sent once even when asked twice.
     · Without the permissions (lib/marketing/message-types) Meta is not
       asked. Until Meta's review grants Advanced Access only people with a
       role on the app appear, and answering a customer is refused — the
       person reads that plainly.
   --------------------------------------------------------------------------- */

import crypto from "node:crypto";
import { pageAccessRemoved } from "@/lib/marketing/spaces";
import { supabaseServer } from "@/lib/server/supabase-server";
import { inChunks } from "@/lib/server/in-chunks";
import { allRows } from "@/lib/server/all-rows";
import { MetaError } from "@/lib/server/marketing/meta";
import { customerPicture, isNotAllowedYet, isWindowClosed, pageConversations, sendMessage, type RemoteConversation } from "@/lib/server/marketing/meta-messages";
import { stopsRun } from "@/lib/server/marketing/meta-insights";
import { claimMessages, listAccounts, loadAccountForSync, recordSync, recordSyncState, type AccountForSync } from "@/lib/server/marketing/accounts";
import { later, notifyMessageWaiting, settleMessage } from "@/lib/server/marketing/notify";
import { namesOf } from "@/lib/server/marketing/posts";
import {
  MESSAGE_MAX, canReplyNow, conversationNeedsReply, lastCountedIndex, messageScopesFor, replyWindowEnd,
  type ConversationView, type MessageAttachment, type MessageFilter, type MessageView,
} from "@/lib/marketing/message-types";
import type { MarketingAccountView, MarketingSpace } from "@/lib/marketing/spaces";

/** Every cron run (5 minutes) reads each account again. */
export const MESSAGES_REFRESH_MS = 4 * 60_000;
/** The «Needs a reply» rule the stored conversations were decided with; a
 *  new one re-decides them once from the messages kept (applyRule). 2: an
 *  automatic reply is not an answer (29/09/2026). */
const MESSAGES_RULE = 2;
const PENDING = "pending:";
const CLAIM_MS = 120_000;
const PAGE = 30;
/** Conversations listed and counted: the last 90 days' (3,000 at most). */
const WINDOW_DAYS = 90;
const WINDOW_ROWS = 3000;
const MESSAGES_SHOWN = 60;
/** Customers' pictures read per read (newest conversations first), and how
 *  long one is kept before it is read again — Meta's links expire. */
const AVATARS_PER_RUN = 12;
const AVATAR_TTL_MS = 2 * 86_400_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONV_COLUMNS = "id, tenant_id, account_id, external_id, customer_external_id, customer_name, customer_username, customer_avatar_url, last_message_at, last_customer_at, last_from_us, snippet, handled_at, handled_by, notified_at";
type ConvRow = {
  id: string; tenant_id: string; account_id: string; external_id: string; customer_external_id: string | null;
  customer_name: string | null; customer_username: string | null; customer_avatar_url: string | null; last_message_at: string | null; last_customer_at: string | null;
  last_from_us: boolean; snippet: string | null; handled_at: string | null; handled_by: string | null; notified_at: string | null;
};
const MSG_COLUMNS = "id, conversation_id, external_id, from_us, text, attachments, sent_at, sent_by";
type MsgRow = { id: string; conversation_id: string; external_id: string; from_us: boolean; text: string | null; attachments: MessageAttachment[] | null; sent_at: string | null; sent_by: string | null };

export type Result<T = { ok: true }> = T | { error: string; status: number; code?: string };
export const isError = <T,>(r: Result<T>): r is { error: string; status: number; code?: string } => typeof r === "object" && r !== null && "error" in r;

const text = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);
const time = (s: string | null | undefined) => (s ? Date.parse(s) || 0 : 0);
const later_ = (a: string | null | undefined, b: string | null | undefined) => (time(a) >= time(b) ? a ?? null : b ?? null);

/* ── The read ── */

export interface MessagesSyncOutcome { ok: boolean; skipped?: "unavailable" | "fresh" | "no_permission"; conversations?: number; notified?: number; settled?: number }

/* Meta's ids can be long — an Instagram message id passes 100 characters —
   and every id of an .in() travels in the URL: each batch is sized by the
   longest id so its URL stays short (150 ids of that length made a 15 KB
   URL, refused as "Bad Request", 29/09/2026). */
const batchFor = (ids: readonly string[]): number =>
  Math.max(10, Math.min(150, Math.floor(4000 / Math.max(1, ...ids.map((x) => x.length)))));

/** The conversations saved, and those whose told wait ended on the platform
 *  (answered there): their notice is cleared. */
async function saveConversations(a: AccountForSync, remote: RemoteConversation[]): Promise<{ saved: ConvRow[]; ended: string[] }> {
  if (!remote.length) return { saved: [], ended: [] };
  const exts = remote.map((r) => r.external_id);
  const { data: existing, error: rErr } = await inChunks<ConvRow>(exts, (chunk) =>
    supabaseServer.from("marketing_conversations").select(CONV_COLUMNS).eq("account_id", a.id).in("external_id", chunk), batchFor(exts));
  if (rErr) throw new Error(`marketing conversations: ${rErr.message}`);
  const prev = new Map((existing ?? []).map((c) => [c.external_id, c]));
  /* Our messages a person sent from the Hub count however fast they came. */
  const ours = remote.flatMap((rc) => rc.messages.filter((m) => m.from_us).map((m) => m.external_id));
  const { data: hubSent, error: hErr } = ours.length
    ? await inChunks<{ external_id: string }>(ours, (chunk) =>
      supabaseServer.from("marketing_messages").select("external_id").eq("account_id", a.id).not("sent_by", "is", null).in("external_id", chunk), batchFor(ours))
    : { data: [], error: null };
  if (hErr) throw new Error(`marketing messages: ${hErr.message}`);
  const byPerson = new Set((hubSent ?? []).map((m) => m.external_id));
  const now = new Date().toISOString();
  const rows = remote.map((rc) => {
    const last = rc.messages[rc.messages.length - 1] ?? null;
    const lastCustomer = [...rc.messages].reverse().find((m) => !m.from_us) ?? null;
    const p = prev.get(rc.external_id);
    /* The last word that counts — an automatic reply does not (message-types). */
    const idx = lastCountedIndex(rc.messages.map((m) => ({ from_us: m.from_us, sent_at: m.sent_at, by_person: byPerson.has(m.external_id) })));
    const counted = idx >= 0 ? rc.messages[idx] : null;
    /* A reply sent from the Hub after Meta's page was read stays the last
       word until Meta shows it. */
    const fresh = !!last && !!counted && (!p || time(last.sent_at) >= time(p.last_message_at));
    const lastFromUs = fresh ? counted!.from_us : p?.last_from_us ?? false;
    const lastCustomerAt = later_(lastCustomer?.sent_at, p?.last_customer_at);
    const waiting = conversationNeedsReply({ last_from_us: lastFromUs, last_customer_at: lastCustomerAt, handled_at: p?.handled_at ?? null });
    return {
      tenant_id: a.tenant_id, account_id: a.id, external_id: rc.external_id,
      customer_external_id: rc.customer.external_id ?? p?.customer_external_id ?? null,
      customer_name: rc.customer.name ?? p?.customer_name ?? null,
      customer_username: rc.customer.username ?? p?.customer_username ?? null,
      last_message_at: later_(last?.sent_at ?? rc.updated_at, p?.last_message_at),
      last_customer_at: lastCustomerAt,
      last_from_us: lastFromUs,
      /* Words only; a picture or file alone reads as such on the screen. */
      snippet: fresh ? counted!.text : p?.snippet ?? null,
      /* Answered on the platform: the wait is over, and the next one tells
         the team again. Every row names it (a bulk upsert fills a missing
         column with null). */
      notified_at: waiting ? p?.notified_at ?? null : null,
      updated_at: now,
    };
  });
  const { data: saved, error } = await supabaseServer.from("marketing_conversations")
    .upsert(rows, { onConflict: "account_id,external_id" }).select(CONV_COLUMNS);
  if (error) throw new Error(`marketing conversations: ${error.message}`);
  const idOf = new Map(((saved ?? []) as ConvRow[]).map((c) => [c.external_id, c.id]));
  const ended = rows.filter((r) => r.notified_at === null && !!prev.get(r.external_id)?.notified_at)
    .map((r) => idOf.get(r.external_id)).filter((id): id is string => !!id);
  /* The messages: one statement may not touch a row twice. */
  const msgs = [...new Map(remote.flatMap((rc) => rc.messages.map((m) => [m.external_id, {
    tenant_id: a.tenant_id, account_id: a.id, conversation_id: idOf.get(rc.external_id)!, external_id: m.external_id,
    from_us: m.from_us, text: m.text, attachments: m.attachments, sent_at: m.sent_at,
  }]))).values()].filter((m) => !!m.conversation_id);
  for (let i = 0; i < msgs.length; i += 500) {
    const { error: mErr } = await supabaseServer.from("marketing_messages").upsert(msgs.slice(i, i + 500), { onConflict: "account_id,external_id" });
    if (mErr) throw new Error(`marketing messages: ${mErr.message}`);
  }
  return { saved: (saved ?? []) as ConvRow[], ended };
}

/** The current rule (MESSAGES_RULE) over the conversations the Hub already
 *  keeps for an account, from the messages it keeps — once per rule and
 *  silently (history never notifies). */
async function applyRule(a: AccountForSync): Promise<number> {
  const { data: convs, error } = await allRows<ConvRow>(
    supabaseServer.from("marketing_conversations").select(CONV_COLUMNS).eq("account_id", a.id).order("id"),
    "marketing conversations", WINDOW_ROWS,
  );
  if (error) throw new Error(`marketing conversations: ${error.message}`);
  let changed = 0;
  for (const c of convs ?? []) {
    const { data, error: mErr } = await supabaseServer.from("marketing_messages").select("from_us, text, sent_at, sent_by")
      .eq("conversation_id", c.id).not("external_id", "like", `${PENDING}%`).order("sent_at", { ascending: false }).order("id").limit(MESSAGES_SHOWN);
    if (mErr) throw new Error(`marketing messages: ${mErr.message}`);
    const list = ((data ?? []) as Array<{ from_us: boolean; text: string | null; sent_at: string | null; sent_by: string | null }>).reverse();
    const idx = lastCountedIndex(list.map((m) => ({ from_us: m.from_us, sent_at: m.sent_at, by_person: !!m.sent_by })));
    if (idx < 0 || (list[idx].from_us === c.last_from_us && list[idx].text === c.snippet)) continue;
    const { error: uErr } = await supabaseServer.from("marketing_conversations").update({ last_from_us: list[idx].from_us, snippet: list[idx].text }).eq("id", c.id);
    if (uErr) throw new Error(`marketing conversations: ${uErr.message}`);
    changed++;
  }
  return changed;
}

/** Customers' pictures, a few per read, newest conversations first; read
 *  again once Meta's link may have expired. A customer Meta refuses is tried
 *  again after the same wait; an expired key or a rate limit stops the pass. */
async function refreshAvatars(a: AccountForSync & { token: string }): Promise<number> {
  const stale = new Date(Date.now() - AVATAR_TTL_MS).toISOString();
  const { data, error } = await supabaseServer.from("marketing_conversations").select("id, customer_external_id")
    .eq("account_id", a.id).not("customer_external_id", "is", null)
    .or(`customer_avatar_at.is.null,customer_avatar_at.lt.${stale}`)
    .order("last_message_at", { ascending: false }).order("id").limit(AVATARS_PER_RUN);
  if (error) throw new Error(`marketing conversations: ${error.message}`);
  let read = 0;
  for (const c of (data ?? []) as Array<{ id: string; customer_external_id: string }>) {
    const patch: Record<string, unknown> = { customer_avatar_at: new Date().toISOString() };
    try {
      patch.customer_avatar_url = await customerPicture(a.token, c.customer_external_id);
    } catch (e) {
      if (stopsRun(e)) break;
    }
    const { error: uErr } = await supabaseServer.from("marketing_conversations").update(patch).eq("id", c.id);
    if (uErr) throw new Error(`marketing conversations: ${uErr.message}`);
    read++;
  }
  return read;
}

/** One account's conversations — see the header. */
export async function syncMessages(tenantId: string, accountId: string, opts: { minGapMs?: number } = {}): Promise<MessagesSyncOutcome> {
  const a = await loadAccountForSync(tenantId, accountId);
  /* Only Social Marketing's accounts: CEO Brand reads no private messages
     (owner, 29/09/2026). */
  if (!a || a.space !== "company" || (a.platform !== "facebook" && a.platform !== "instagram") || a.connection !== "api" || !a.token || !a.external_id
    || a.status === "disconnected" || a.status === "expired") {
    return { ok: false, skipped: "unavailable" };
  }
  /* Claimed first, even without the permissions: the account then waits its
     turn like the others. */
  if (!(await claimMessages(a, opts.minGapMs ?? MESSAGES_REFRESH_MS))) return { ok: true, skipped: "fresh" };
  if (!messageScopesFor(a.platform, a.scopes).every((s) => a.scopes.includes(s))) return { ok: true, skipped: "no_permission" };
  const first = typeof a.sync_state.messages_since !== "string";
  const ruleDue = a.sync_state.messages_rule !== MESSAGES_RULE;
  const readTo = typeof a.sync_state.messages_read_to === "string" ? a.sync_state.messages_read_to : null;
  const now = new Date().toISOString();
  try {
    if (ruleDue) await applyRule(a);
    const remote = await pageConversations(a.token, a.platform === "facebook" ? "messenger" : "instagram", a.external_id, readTo);
    const { saved, ended } = await saveConversations(a, remote);
    for (const id of ended) later(() => settleMessage(id));
    /* Only a wait that began after the first read tells the team: history
       is imported silently. */
    const since = first ? now : (a.sync_state.messages_since as string);
    let notified = 0;
    for (const c of saved) {
      if (first || c.notified_at || !conversationNeedsReply(c) || time(c.last_customer_at) <= time(since)) continue;
      const { data: marked, error } = await supabaseServer.from("marketing_conversations")
        .update({ notified_at: now }).eq("id", c.id).is("notified_at", null).select("id");
      if (error) throw new Error(`marketing conversations: ${error.message}`);
      if (!marked?.length) continue;
      later(() => notifyMessageWaiting(tenantId, c.id));
      notified++;
    }
    await refreshAvatars(a as AccountForSync & { token: string }).catch((e) => console.warn(`[marketing/messages] pictures ${a.id}: ${text(e)}`));
    const newest = remote.reduce<string | null>((m, r) => later_(m, r.updated_at), readTo);
    await recordSyncState(a, { messages_read_to: newest, messages_error: null, ...(first ? { messages_since: now } : {}), ...(ruleDue ? { messages_rule: MESSAGES_RULE } : {}) });
    return { ok: true, conversations: saved.length, notified, settled: ended.length };
  } catch (e) {
    if (e instanceof MetaError && e.code === 190) {
      await recordSync(a.id, { status: "expired", last_error: text(e), synced: false }).catch(() => {});
      return { ok: false };
    }
    await recordSyncState(a, { messages_error: text(e) }).catch(() => {});
    console.warn(`[marketing/messages] ${a.platform} ${a.id}: left for later: ${text(e)}`);
    return { ok: false };
  }
}

/* ── The screens ── */

async function messageAccounts(tenantId: string, space: MarketingSpace): Promise<MarketingAccountView[]> {
  return (await listAccounts(tenantId, space)).filter((a) => a.connection === "api" && (a.platform === "facebook" || a.platform === "instagram"));
}

async function windowRows(accountIds: string[]): Promise<ConvRow[]> {
  if (!accountIds.length) return [];
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await allRows<ConvRow>(
    supabaseServer.from("marketing_conversations").select(CONV_COLUMNS).in("account_id", accountIds)
      .gte("last_message_at", since).order("last_message_at", { ascending: false }).order("id"),
    "marketing conversations", WINDOW_ROWS,
  );
  if (error) throw new Error(`marketing conversations: ${error.message}`);
  return data ?? [];
}

function view(c: ConvRow, account: MarketingAccountView, names: Map<string, string>): ConversationView {
  const needs = conversationNeedsReply(c);
  return {
    id: c.id, account,
    customer: { name: c.customer_name, username: c.customer_username, avatar_url: c.customer_avatar_url },
    snippet: c.snippet, last_message_at: c.last_message_at, last_customer_at: c.last_customer_at, last_from_us: c.last_from_us,
    needs_reply: needs,
    handled_at: c.handled_at, handled_by_name: c.handled_by ? names.get(c.handled_by) || null : null,
    window_ends_at: replyWindowEnd(c.last_customer_at),
  };
}

/** How many conversations wait for an answer (the tab's number). */
export async function needsMessagesCount(tenantId: string, space: MarketingSpace): Promise<number> {
  const accounts = await messageAccounts(tenantId, space);
  return (await windowRows(accounts.map((a) => a.id))).filter(conversationNeedsReply).length;
}

/** One page of conversations, newest first. */
export async function listConversations(
  tenantId: string, space: MarketingSpace, opts: { filter: MessageFilter; accountId: string | null; cursor: number },
): Promise<{ conversations: ConversationView[]; next: number | null; counts: { needs: number } }> {
  const accounts = await messageAccounts(tenantId, space);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const ids = opts.accountId ? (byId.has(opts.accountId) ? [opts.accountId] : []) : [...byId.keys()];
  const rows = await windowRows(ids);
  const needs = rows.filter(conversationNeedsReply);
  const picked = opts.filter === "needs" ? needs : rows;
  const page = picked.slice(opts.cursor, opts.cursor + PAGE);
  const names = await namesOf(page.map((c) => c.handled_by).filter((x): x is string => !!x));
  return {
    conversations: page.map((c) => view(c, byId.get(c.account_id)!, names)).filter((v) => !!v.account),
    next: opts.cursor + PAGE < picked.length ? opts.cursor + PAGE : null,
    counts: { needs: needs.length },
  };
}

/** A conversation with its space (the gate reads it before anything else). */
export async function loadConversation(tenantId: string, id: string): Promise<(ConvRow & { space: MarketingSpace }) | null> {
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await supabaseServer.from("marketing_conversations").select(CONV_COLUMNS).eq("tenant_id", tenantId).eq("id", id).maybeSingle();
  if (error) throw new Error(`marketing conversations: ${error.message}`);
  if (!data) return null;
  const { data: acc, error: aErr } = await supabaseServer.from("marketing_accounts").select("space").eq("id", (data as ConvRow).account_id).maybeSingle();
  if (aErr) throw new Error(`marketing accounts: ${aErr.message}`);
  return acc ? { ...(data as ConvRow), space: (acc as { space: MarketingSpace }).space } : null;
}

function messageView(m: MsgRow, names: Map<string, string>): MessageView {
  return {
    id: m.id, from_us: m.from_us, text: m.text, attachments: Array.isArray(m.attachments) ? m.attachments : [],
    sent_at: m.sent_at, sent_by_name: m.sent_by ? names.get(m.sent_by) || null : null,
  };
}

/** A conversation and its newest messages, oldest first. */
export async function conversationDetail(tenantId: string, c: ConvRow & { space: MarketingSpace }): Promise<{ conversation: ConversationView; messages: MessageView[] }> {
  const [{ data, error }, accounts] = await Promise.all([
    supabaseServer.from("marketing_messages").select(MSG_COLUMNS).eq("conversation_id", c.id)
      .not("external_id", "like", `${PENDING}%`).order("sent_at", { ascending: false }).order("id").limit(MESSAGES_SHOWN),
    messageAccounts(tenantId, c.space),
  ]);
  if (error) throw new Error(`marketing messages: ${error.message}`);
  const rows = ((data ?? []) as MsgRow[]).reverse();
  const names = await namesOf([c.handled_by, ...rows.map((m) => m.sent_by)].filter((x): x is string => !!x));
  const account = accounts.find((a) => a.id === c.account_id)!;
  return { conversation: view(c, account, names), messages: rows.map((m) => messageView(m, names)) };
}

/** The last words of a conversation, for Koleex AI to draft an answer. */
export async function conversationContext(c: ConvRow): Promise<Array<{ ours: boolean; text: string }>> {
  const { data, error } = await supabaseServer.from("marketing_messages").select("from_us, text, sent_at")
    .eq("conversation_id", c.id).not("external_id", "like", `${PENDING}%`).order("sent_at", { ascending: false }).limit(8);
  if (error) throw new Error(`marketing messages: ${error.message}`);
  return ((data ?? []) as Array<{ from_us: boolean; text: string | null }>).reverse()
    .filter((m) => m.text?.trim()).map((m) => ({ ours: m.from_us, text: m.text!.trim() }));
}

/* ── Answering ── */

async function usableAccount(tenantId: string, accountId: string): Promise<Result<{ a: AccountForSync & { token: string } }>> {
  const a = await loadAccountForSync(tenantId, accountId);
  if (!a || a.connection !== "api" || !a.token || a.status === "disconnected") return { error: "This account is not connected any more.", status: 409, code: "account" };
  if (a.status === "expired") return pageAccessRemoved(a.last_error) ? REMOVED : EXPIRED;
  return { a: a as AccountForSync & { token: string } };
}

const EXPIRED = { error: "The account's key has expired. Reconnect it in Accounts.", status: 409, code: "expired" } as const;
/* A later Facebook sign-in left it out: Meta no longer shares it. */
const REMOVED = { error: "Meta no longer shares this account with the Hub: sign in with Facebook again in Accounts and keep it selected.", status: 409, code: "removed" } as const;

async function refused(a: AccountForSync, e: unknown): Promise<{ error: string; status: number; code: string }> {
  if (e instanceof MetaError && e.code === 190) {
    await recordSync(a.id, { status: "expired", last_error: text(e), synced: false }).catch(() => {});
    return pageAccessRemoved(text(e)) ? REMOVED : EXPIRED;
  }
  if (isWindowClosed(e)) return { error: "More than 24 hours have passed since the customer's last message: Meta allows answering only on the platform now.", status: 409, code: "window" };
  if (isNotAllowedYet(e)) return { error: "Meta has not allowed answering customers from the Hub yet — that needs Meta's review of the app.", status: 403, code: "not_allowed" };
  if (e instanceof MetaError) return { error: e.message, status: 502, code: "platform" };
  throw e;
}

/** Answer a conversation, as the account — see the header. */
export async function replyToConversation(tenantId: string, id: string, actorId: string, words0: string): Promise<Result<{ message: MessageView }>> {
  const words = words0.trim();
  if (!words) return { error: "Write the message first.", status: 400 };
  if (Array.from(words).length > MESSAGE_MAX) return { error: `A message can have up to ${MESSAGE_MAX} characters.`, status: 400 };
  const c = await loadConversation(tenantId, id);
  if (!c) return { error: "Conversation not found.", status: 404 };
  if (!c.customer_external_id) return { error: "The customer of this conversation is not known yet.", status: 409, code: "recipient" };
  if (!canReplyNow(c.last_customer_at)) return { error: "More than 24 hours have passed since the customer's last message: Meta allows answering only on the platform now.", status: 409, code: "window" };
  const usable = await usableAccount(tenantId, c.account_id);
  if (isError(usable)) return usable;
  const { a } = usable;
  /* The same words in the last two minutes — a retry after the first one
     went through — are that message, not a new one. */
  const since = new Date(Date.now() - CLAIM_MS).toISOString();
  const { data: same, error: sErr } = await supabaseServer.from("marketing_messages").select("id")
    .eq("conversation_id", c.id).eq("from_us", true).eq("text", words).gte("sent_at", since).limit(1);
  if (sErr) throw new Error(`marketing messages: ${sErr.message}`);
  if (same?.length) return { error: "This message was just sent.", status: 409, code: "duplicate" };
  const key = `${PENDING}${crypto.createHash("sha256").update(`${c.id}|${words}`).digest("hex").slice(0, 32)}:${Math.floor(Date.now() / CLAIM_MS)}`;
  const now = new Date().toISOString();
  const { data: claimed, error: cErr } = await supabaseServer.from("marketing_messages").insert({
    tenant_id: tenantId, account_id: a.id, conversation_id: c.id, external_id: key, from_us: true, text: words, sent_at: now, sent_by: actorId,
  }).select(MSG_COLUMNS).single();
  if (cErr) {
    if (cErr.code === "23505") return { error: "This message was just sent.", status: 409, code: "duplicate" };
    throw new Error(`marketing messages: ${cErr.message}`);
  }
  const placeholder = claimed as MsgRow;
  let mid: string;
  try {
    mid = await sendMessage(a.token, c.customer_external_id, words);
  } catch (e) {
    await supabaseServer.from("marketing_messages").delete().eq("id", placeholder.id);
    return refused(a, e);
  }
  let saved = placeholder;
  const { data: done, error: uErr } = await supabaseServer.from("marketing_messages").update({ external_id: mid }).eq("id", placeholder.id).select(MSG_COLUMNS).single();
  if (uErr && uErr.code === "23505") {
    /* A read brought the sent message in first: that row is the message. */
    await supabaseServer.from("marketing_messages").delete().eq("id", placeholder.id);
    const { data: synced } = await supabaseServer.from("marketing_messages").update({ sent_by: actorId }).eq("account_id", a.id).eq("external_id", mid).select(MSG_COLUMNS).single();
    if (synced) saved = synced as MsgRow;
  } else if (uErr) {
    throw new Error(`marketing messages: ${uErr.message}`);
  } else {
    saved = done as MsgRow;
  }
  const { error: convErr } = await supabaseServer.from("marketing_conversations")
    .update({ last_from_us: true, last_message_at: now, snippet: words, notified_at: null, updated_at: now }).eq("id", c.id);
  if (convErr) throw new Error(`marketing conversations: ${convErr.message}`);
  later(() => settleMessage(c.id));
  return { message: messageView(saved, await namesOf([actorId])) };
}

/** «No reply needed» — or waiting again. */
export async function setConversationHandled(tenantId: string, id: string, handled: boolean, actorId: string): Promise<Result<{ handled_at: string | null; handled_by_name: string | null }>> {
  const c = await loadConversation(tenantId, id);
  if (!c) return { error: "Conversation not found.", status: 404 };
  const at = handled ? new Date().toISOString() : null;
  const { error } = await supabaseServer.from("marketing_conversations")
    .update({ handled_at: at, handled_by: handled ? actorId : null, ...(handled ? { notified_at: null } : {}), updated_at: new Date().toISOString() }).eq("id", c.id);
  if (error) throw new Error(`marketing conversations: ${error.message}`);
  if (handled) later(() => settleMessage(c.id));
  return { handled_at: at, handled_by_name: handled ? (await namesOf([actorId])).get(actorId) || null : null };
}
