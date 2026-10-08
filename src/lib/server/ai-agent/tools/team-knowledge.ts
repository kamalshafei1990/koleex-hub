import "server-only";

/* ---------------------------------------------------------------------------
   team-knowledge — the ORG tier of "learn from conversations".

   The ratified platform law (architecture-spec-v1, memory tiers): what a
   conversation teaches may benefit everyone, but NOTHING is promoted to
   shared knowledge automatically — it lands as a DRAFT Knowledge Unit in
   the super-admin approval bench (/ai/knowledge), exactly like a page
   from an ingested catalog. The model calls this when a chat produces a
   durable, team-useful fact (a corrected spec, a China-logistics insight,
   a recurring answer); the owner remains the gate.

   All suggestions collect under one rolling per-tenant source
   ("Learned from conversations") so the bench shows them as a single
   reviewable stream.
   --------------------------------------------------------------------------- */

import type { ToolDef, ToolResult } from "../types";
import { supabaseServer } from "../../supabase-server";

const SOURCE_TITLE = "Learned from conversations";
const MAX_FACT = 1200;
const MAX_TITLE = 90;

async function rollingSourceId(tenantId: string | null, accountId: string | null): Promise<string> {
  const q = supabaseServer
    .from("ai_sources")
    .select("id")
    .eq("kind", "note")
    .eq("title", SOURCE_TITLE)
    .limit(1);
  const { data } = tenantId === null ? await q.is("tenant_id", null) : await q.eq("tenant_id", tenantId);
  if (data && data[0]) return data[0].id as string;
  const { data: created, error } = await supabaseServer
    .from("ai_sources")
    .insert({
      tenant_id: tenantId,
      title: SOURCE_TITLE,
      kind: "note",
      origin: "koleex-ai conversations",
      status: "ready",
      created_by: accountId,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message || "source create failed");
  return created.id as string;
}

const suggestTeamKnowledge: ToolDef<
  { title: string; fact: string; tags?: string[] },
  { queued: true }
> = {
  name: "suggest_team_knowledge",
  description:
    "Propose a DURABLE, team-useful fact learned in this conversation (a corrected machine fact, a China sourcing/logistics insight, a policy answer people keep asking) for the company knowledge base. It is NOT saved as live knowledge — it enters the super-admin approval queue as a draft. Never include personal data about individuals, and never call it for chit-chat or one-off details.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short headline for the fact (≤90 chars)." },
      fact: { type: "string", description: "The knowledge itself, self-contained and specific (≤1200 chars)." },
      tags: { type: "array", items: { type: "string" }, description: "Optional topic tags, e.g. ['china','shipping']." },
    },
    required: ["title", "fact"],
  },
  requiredModule: undefined,
  requiredAction: "edit",
  handler: async (ctx, args): Promise<ToolResult<{ queued: true }>> => {
    if (ctx.auth.viewing_as) {
      return { ok: false, permissionStatus: "denied", data: null, message: "Not while viewing as another user." };
    }
    const title = String(args.title ?? "").trim().slice(0, MAX_TITLE);
    const fact = String(args.fact ?? "").trim().slice(0, MAX_FACT);
    if (!title || fact.length < 20) {
      return { ok: false, permissionStatus: "allowed", data: null, message: "A title and a substantial fact are required." };
    }
    const tags = Array.isArray(args.tags)
      ? args.tags.map((x) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, 6)
      : [];
    try {
      const tenantId = ctx.auth.tenant_id ?? null;
      const sourceId = await rollingSourceId(tenantId, ctx.auth.account_id ?? null);
      /* Next seq = current count (append-only stream). */
      const { count } = await supabaseServer
        .from("ai_knowledge_units")
        .select("id", { count: "exact", head: true })
        .eq("source_id", sourceId);
      const { error } = await supabaseServer.from("ai_knowledge_units").insert({
        tenant_id: tenantId,
        source_id: sourceId,
        seq: count ?? 0,
        kind: "fact",
        title,
        body: fact,
        locator: { section: "conversation" },
        tags: ["from-conversation", ...tags],
        sensitivity: "internal",
        trust_score: 0.4,
        status: "draft",
        meta: { suggested_by: ctx.auth.account_id ?? null },
      });
      if (error) throw new Error(error.message);
      return {
        ok: true,
        permissionStatus: "allowed",
        data: { queued: true },
        message: "Queued for the knowledge approval bench — it becomes shared knowledge only after the super admin approves it.",
      };
    } catch (e) {
      return { ok: false, permissionStatus: "allowed", data: null, message: `Could not queue: ${String(e)}` };
    }
  },
};

export const teamKnowledgeTools = [
  suggestTeamKnowledge as unknown as ToolDef,
];
