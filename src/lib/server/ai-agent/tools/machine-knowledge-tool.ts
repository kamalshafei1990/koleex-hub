import "server-only";

/* ---------------------------------------------------------------------------
   Machine-knowledge tool — read-only search over the brand-free machinery
   domain knowledge (../machine-knowledge.ts): what machine types do, how
   they work, features, typical spec ranges, applications.

   BRAND RULE: the knowledge base was scrubbed of every manufacturer name
   and model code at build time. Answers built on it describe machine
   TYPES generically; when tied to sellable machines, only Koleex models
   (via searchCatalog) may be named.
   --------------------------------------------------------------------------- */

import type { ToolDef, ToolResult } from "../types";
import { MACHINE_KNOWLEDGE, type MachineKnowledgeSection } from "../machine-knowledge";

const PRODUCT_MODULE = "Products";

const searchMachineKnowledge: ToolDef<
  { query: string; limit?: number },
  { total_matches: number; sections: MachineKnowledgeSection[] }
> = {
  name: "searchMachineKnowledge",
  description:
    "Search the machinery domain knowledge base: how machine types work, functions, features, technologies, typical spec ranges, applications and selection guidance (e.g. 'how does an overlock machine work', 'lockstitch vs chainstitch', 'what to look for in a cutting machine'). Generic engineering knowledge — pair with searchCatalog to point at concrete Koleex models.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Machine type, function, feature or question keywords." },
      limit: { type: "integer", description: "Max sections. Default 3, cap 6." },
    },
    required: ["query"],
  },
  requiredModule: PRODUCT_MODULE,
  requiredAction: "view",
  handler: async (
    _ctx,
    args,
  ): Promise<ToolResult<{ total_matches: number; sections: MachineKnowledgeSection[] }>> => {
    const q = String(args.query ?? "").toLowerCase().trim();
    const limit = Math.min(Math.max(Number(args.limit ?? 3) || 3, 1), 6);
    if (!q) {
      return { ok: false, permissionStatus: "denied", data: null, message: "Provide a search query." };
    }
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    const scored = MACHINE_KNOWLEDGE.map((s) => {
      const title = s.title.toLowerCase();
      const body = s.content.toLowerCase();
      let score = 0;
      if (title.includes(q)) score += 60;
      for (const w of words) {
        if (title.includes(w)) score += 20;
        else if (body.includes(w)) score += 5;
      }
      return { s, score };
    })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    const sections = scored.slice(0, limit).map((x) => x.s);
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { total_matches: scored.length, sections },
      message: `${scored.length} knowledge section(s) matched "${args.query}". Generic machine-type knowledge — name only Koleex models when recommending machines.`,
      sources: ["machine-knowledge(base)"],
    };
  },
};

export const machineKnowledgeTools: ToolDef[] = [
  searchMachineKnowledge as unknown as ToolDef,
];
