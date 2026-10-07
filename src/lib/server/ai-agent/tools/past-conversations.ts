import "server-only";

/* ---------------------------------------------------------------------------
   past-conversations — let the agent search the user's OWN chat history.

   Phase 3 of cross-conversation memory (owner, 2026-10-07: "like ChatGPT,
   it should remember everything from my conversations"). Phase 0–2 remember
   FACTS (ai_memories); this recalls CONTEXT — the discussion itself, when no
   fact was saved. On purpose a TOOL, not an always-on retrieval layer:
     · zero cost on turns that never reference the past (speed is the
       owner's standing constraint);
     · the model decides when history is relevant and calls it, the same
       way it decides to search the web.

   Scope: the caller's own conversations only (account + tenant, defence in
   depth like the notes tools), gated by the same Settings → Koleex AI
   memory switch — off means the past is not searched either.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";
import { readPersonalization } from "@/lib/server/ai/personalization-prompt";
import { ilikeAny } from "@/lib/notes-server";
import { resourceRef, type ResourceRef } from "@/lib/server/ai/core/resource-ref";
import type { ToolDef, ToolResult } from "../types";

const MAX_RESULTS = 8;
const RAW_ROWS = 40;          // fetched before snippet-trimming
const SNIPPET = 280;
const MAX_TERM_LEN = 40;
const MAX_TERMS = 6;

/* Words that carry no search signal. English + the Arabic equivalents; the
   CJK paths match whole strings, which never split here. */
const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are",
  "was", "were", "did", "do", "we", "i", "you", "my", "me", "about", "what",
  "when", "that", "this", "it", "we", "talk", "talked", "discuss", "discussed",
  "tell", "told", "say", "said", "remember", "last", "time", "before",
  "previously", "ago", "conversation", "chat", "في", "من", "عن", "على", "إلى",
  "ما", "ماذا", "هل", "أنا", "انت", "إحنا", "لما", "اللي", "ده", "دي", "قبل",
  "الماضي", "المرة", "قلت", "قولت", "اتكلمنا", "اتكلمت",
]);

function termsOf(q: string): string[] {
  const out: string[] = [];
  for (const raw of q.toLowerCase().split(/[^\p{L}\p{N}_]+/u)) {
    const t = raw.trim().slice(0, MAX_TERM_LEN);
    if (t.length < 2 || STOP.has(t)) continue;
    if (!out.includes(t)) out.push(t);
    if (out.length >= MAX_TERMS) break;
  }
  return out;
}

/** ~SNIPPET chars centred on the first keyword hit, so the model sees the
 *  sentence that matched, not the message's first line. */
function snippetOf(content: string, terms: string[]): string {
  const lower = content.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return content.slice(0, SNIPPET);
  const start = Math.max(0, at - Math.floor(SNIPPET / 3));
  const cut = content.slice(start, start + SNIPPET);
  return (start > 0 ? "…" : "") + cut + (start + SNIPPET < content.length ? "…" : "");
}

type Hit = {
  conversation_id: string;
  title: string;
  date: string;
  role: string;
  snippet: string;
  /** The Hub's own deep link, and a client-neutral ref beside it — the
      client-neutral validator's rule for every tool link. */
  link: string;
  resource: ResourceRef;
};

const searchPastConversations: ToolDef<{ q?: string; limit?: number }, { hits: Hit[] }> = {
  name: "search_past_conversations",
  description:
    "Search the CURRENT user's own past conversations with you — every chat they have had with Koleex AI, not just this one. Use it whenever they reference something discussed before: 'last time', 'did I tell you', 'we talked about', 'previously', 'في المرة اللي فاتت', or when an answer depends on an older conversation. Returns dated snippets with a link to open the conversation. This searches THEIR history only. Without q, lists their most recent conversations.",
  parameters: {
    type: "object",
    properties: {
      q: { type: "string", description: "Words from the topic they mention (case-insensitive). Optional." },
      limit: { type: "integer", description: "Max results. Default 5, cap 8." },
    },
    required: [],
  },
  /* The caller's own history, like their own notes — no module gate. */
  requiredModule: undefined,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<{ hits: Hit[] }>> => {
    /* The memory switch governs history too: off means the past is not
       searched, not that it is erased. */
    const { data: acct } = await supabaseServer
      .from("accounts").select("preferences").eq("id", ctx.auth.account_id).maybeSingle();
    if (!readPersonalization((acct?.preferences ?? {}) as Record<string, unknown>).memory) {
      return { ok: false, permissionStatus: "allowed", data: null,
        message: "Memory is turned off in Settings → Koleex AI, so past conversations are not searched. Tell the user they can turn it on there." };
    }

    const limit = Math.min(Math.max(Number(args.limit ?? 5) || 5, 1), MAX_RESULTS);
    const q = typeof args.q === "string" ? args.q.trim().slice(0, 120) : "";
    const terms = termsOf(q);

    /* No query: their recent conversations — answers "what have we been
       talking about lately?" without pretending to search. */
    if (terms.length === 0) {
      const { data: recent, error } = await supabaseServer
        .from("ai_conversations")
        .select("id, title, updated_at, last_preview")
        .eq("account_id", ctx.auth.account_id)
        .eq("tenant_id", ctx.auth.tenant_id)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (error) return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't read past conversations." };
      const hits: Hit[] = (recent ?? []).map((c) => ({
        conversation_id: c.id,
        title: c.title,
        date: c.updated_at,
        role: "conversation",
        snippet: (c.last_preview ?? "").slice(0, SNIPPET),
        link: `/ai?c=${c.id}`,
        resource: resourceRef("conversation", c.id),
      }));
      return { ok: true, permissionStatus: "allowed", data: { hits } };
    }

    /* Messages matched on content, joined to their conversation so the
       account + tenant filter is enforced inside one query. */
    const { data, error } = await supabaseServer
      .from("ai_messages")
      .select("role, content, created_at, conversation_id, ai_conversations!inner(title, account_id, tenant_id)")
      .eq("ai_conversations.account_id", ctx.auth.account_id)
      .eq("ai_conversations.tenant_id", ctx.auth.tenant_id)
      .or(terms.map((t) => ilikeAny(["content"], t)).join(","))
      .order("created_at", { ascending: false })
      .limit(RAW_ROWS);
    if (error) return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't search past conversations." };

    /* One hit per conversation — five snippets from one chat tell less than
       one snippet each from five chats. */
    const seen = new Set<string>();
    const hits: Hit[] = [];
    type Row = {
      role: string; content: string; created_at: string; conversation_id: string;
      ai_conversations: { title: string } | Array<{ title: string }>;
    };
    for (const row of (data ?? []) as unknown as Row[]) {
      if (seen.has(row.conversation_id)) continue;
      seen.add(row.conversation_id);
      const conv = Array.isArray(row.ai_conversations) ? row.ai_conversations[0] : row.ai_conversations;
      hits.push({
        conversation_id: row.conversation_id,
        title: conv?.title ?? "Conversation",
        date: row.created_at,
        role: row.role,
        snippet: snippetOf(row.content, terms),
        link: `/ai?c=${row.conversation_id}`,
        resource: resourceRef("conversation", row.conversation_id),
      });
      if (hits.length >= limit) break;
    }

    return { ok: true, permissionStatus: "allowed", data: { hits },
      message: hits.length === 0 ? "Nothing in past conversations matches that." : undefined };
  },
};

export const pastConversationTools: ToolDef[] = [searchPastConversations as unknown as ToolDef];
