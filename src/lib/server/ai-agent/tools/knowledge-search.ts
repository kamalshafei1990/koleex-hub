import "server-only";

/* ---------------------------------------------------------------------------
   knowledge-search — the pre-Phase-2 retrieval BRIDGE.

   Phase 2 of the platform brings real hybrid retrieval (pgvector +
   FTS + evidence bundles). Until then this tool gives the agent honest
   access to the APPROVED knowledge plane with plain keyword scoring:
   the corpus is a few hundred units, so ILIKE-candidates + in-process
   scoring answers well inside the hop budget. Every hit returns its
   source title and page so the model can say where a fact came from.

   Approved units ONLY — drafts are invisible to the AI by law. */

import type { ToolDef, ToolResult } from "../types";
import { searchApprovedUnits } from "../../ai-knowledge";

interface Hit { title: string | null; body: string; source: string; page: number | null; domain: string | null }


const searchKnowledge: ToolDef<{ query: string }, { hits: Hit[] }> = {
  name: "search_knowledge",
  description:
    "Search Koleex's approved internal knowledge base (ingested catalogs, China trade/logistics references, garment-industry material, owner-taught notes). Call this whenever the user asks about machines, fabrics/interlining, China sourcing, ports, shipping/containers, Incoterms, letters of credit, Canton Fair, factory seasons, or anything the company may have taught — BEFORE answering from general memory. Returns the most relevant approved knowledge units with their source and page.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "The user's question or key phrase, any language." },
    },
    required: ["query"],
  },
  /* No module of its own — the knowledge plane is not a Hub module — so the
     bar is expressed as a ROLE tier instead. It has to be expressed somehow:
     `requiredModule: undefined` means dispatchTool's module guard is skipped
     entirely, and this tool was reaching the whole approved corpus for any
     internal user while /ai/knowledge redirects non-super-admins and every
     one of its API routes answers 403. A person who cannot open Knowledge
     could still read it, with source title and page, by asking the agent.
     Same bar as the plane it reads from — and expressed as a MODULE rather
     than a role tier, so the super admin can grant it to named accounts
     instead of the choice being his-only-or-everyone. Deny-by-default: a
     role with no row gets nothing; super admins short-circuit to allowed. */
  requiredModule: "AI Knowledge",
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<{ hits: Hit[] }>> => {
    const q = String(args.query ?? "").trim();
    if (!q) return { ok: false, permissionStatus: "denied", data: null, message: "query required" };
    const found = await searchApprovedUnits(ctx.auth.tenant_id ?? null, q, 6);
    const hits: Hit[] = found.map((h) => ({
      title: h.title, body: h.body.slice(0, 700), source: h.source, page: h.page, domain: h.domain,
    }));
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { hits },
      message: hits.length
        ? `Found ${hits.length} approved knowledge unit(s). Ground your answer in them and mention the source naturally (e.g. "according to our Incoterms reference"). Supplier identities stay internal-only per the confidentiality rule.`
        : "No approved knowledge matched — answer from general knowledge and say the knowledge base has nothing specific.",
    };
  },
};

export const knowledgeSearchTools = [
  searchKnowledge as unknown as ToolDef,
];
