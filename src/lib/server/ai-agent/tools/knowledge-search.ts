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
import { searchApprovedUnits, searchTaughtAnswers, type TaughtHit } from "../../ai-knowledge";

interface Hit { title: string | null; body: string; source: string; page: number | null; domain: string | null }

/* WHAT THE MODEL GETS BACK FOR A TAUGHT PAIR, and why it is not folded into
   `Hit`. A taught answer is not a document excerpt: it has no page, its
   "source" is the owner, and the instruction attached to it is the opposite
   one. An excerpt is EVIDENCE — cite it. A taught answer is a REFERENCE REPLY
   — compose from it, keep its facts exact, and never read out a citation for
   it, because "according to unknown source" is what citing it produces.

   Kept as its own field so that difference survives the trip to the model
   instead of being flattened into a list where both look like documents. */
interface TaughtOut { question: string; answers: string[] }


const searchKnowledge: ToolDef<{ query: string }, { taught: TaughtOut[]; hits: Hit[] }> = {
  name: "search_knowledge",
  description:
    "Search Koleex's approved internal knowledge base AND the answers the owner has personally taught Koleex AI (ingested catalogs, China trade/logistics references, garment-industry material, taught Q&A). Call this whenever the user asks about machines, fabrics/interlining, China sourcing, ports, shipping/containers, Incoterms, letters of credit, Canton Fair, factory seasons, company policy, or anything the company may have taught — BEFORE answering from general memory. Returns taught answers first, then the most relevant approved knowledge units with their source and page.",
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
  handler: async (ctx, args): Promise<ToolResult<{ taught: TaughtOut[]; hits: Hit[] }>> => {
    const q = String(args.query ?? "").trim();
    if (!q) return { ok: false, permissionStatus: "allowed", data: null, message: "query required" };
    const tenantId = ctx.auth.tenant_id ?? null;

    /* Both planes, in parallel — they are independent reads and the caller of
       this tool is mid-sentence, on a call, waiting. */
    const [taughtHits, found] = await Promise.all([
      searchTaughtAnswers(tenantId, q, 3),
      searchApprovedUnits(tenantId, q, 6),
    ]);

    const taught: TaughtOut[] = (taughtHits as TaughtHit[]).map((t) => ({
      question: t.question,
      answers: t.answers.map((a) => a.slice(0, 400)),
    }));
    const hits: Hit[] = found.map((h) => ({
      title: h.title, body: h.body.slice(0, 700), source: h.source, page: h.page, domain: h.domain,
    }));

    /* TWO DIFFERENT INSTRUCTIONS, because the two planes are different kinds
       of thing and telling the model to treat them alike is how a taught
       answer ends up quoted verbatim with a citation to nobody.

       The taught wording is the SAME instruction the written lanes carry in
       their system prompt — learn from it, keep the facts exact, answer in the
       caller's language. That is deliberate: this tool is the only route a
       voice call has to taught knowledge, and a call that reached the same
       answer under a different rule would still be a different assistant. */
    const parts: string[] = [];
    if (taught.length) {
      parts.push(
        `${taught.length} TAUGHT ANSWER(S) from the owner — these outrank everything else here. ` +
        "LEARN from them, don't recite them: every fact, number and policy stays EXACTLY as taught, " +
        "but compose the reply in your own words, in the language the user is speaking. " +
        "The answer variants show acceptable tone and level of detail. " +
        "Do NOT cite a source for these — they are Koleex's own position, not a document.",
      );
    }
    if (hits.length) {
      parts.push(
        `${hits.length} approved knowledge unit(s). Ground your answer in them and mention the source ` +
        'naturally (e.g. "according to our Incoterms reference").',
      );
    }
    if (!parts.length) {
      return {
        ok: true,
        permissionStatus: "allowed",
        data: { taught, hits },
        message: "No taught answer and no approved knowledge matched — answer from general knowledge and say the knowledge base has nothing specific.",
      };
    }
    parts.push("Supplier identities stay internal-only per the confidentiality rule.");
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { taught, hits },
      message: parts.join(" "),
    };
  },
};

export const knowledgeSearchTools = [
  searchKnowledge as unknown as ToolDef,
];
