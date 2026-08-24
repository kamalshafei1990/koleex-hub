import "server-only";

/* ---------------------------------------------------------------------------
   Trade-terms tool — read-only search over the Incoterms® 2020 rules and the
   methods-of-payment knowledge in ../trade-terms-knowledge.ts.

   UNGATED BY DESIGN. Unlike the catalog or customer tools, this holds no
   Koleex data at all — it is published standards knowledge (ICC Incoterms
   2020, UCP 600, URC 522). Anyone who can talk to the assistant may ask
   what CIF means, exactly as they could open a book. Gating it to a module
   would lock a salesperson out of the definition of the term they are
   quoting.

   BOUNDARY. This explains what a term MEANS. It says nothing about what
   Koleex charges, which terms Koleex offers, or what a given customer's
   terms are — those come from the pricing engine, Commercial Setup and the
   customer record via their own (gated) tools. Never let a definition be
   read as a Koleex commitment.
   --------------------------------------------------------------------------- */

import type { ToolDef, ToolResult } from "../types";
import { TRADE_TERMS_KNOWLEDGE, type TradeTermsSection } from "../trade-terms-knowledge";

/* Query words that should pull a section even when the user types the code
   rather than the prose around it. Incoterm codes are three letters, so a
   plain substring match on the body would fire on any word containing them
   ("cifr", "fobbing"); matching them as whole tokens keeps precision. */
const CODE_RE = /\b(exw|fca|fas|fob|cfr|cif|cpt|cip|dap|dpu|ddp|ucp|urc|urdg|isp98|sblc|t\/t|d\/p|d\/a|l\/c|lc)\b/gi;

const searchTradeTerms: ToolDef<
  { query: string; limit?: number },
  { total_matches: number; sections: TradeTermsSection[] }
> = {
  name: "searchTradeTerms",
  description:
    "Search international trade-terms knowledge: the Incoterms 2020 delivery rules (EXW, FCA, FAS, FOB, CFR, CIF, CPT, CIP, DAP, DPU, DDP) — what each covers, exactly where risk passes, who pays carriage/insurance/duty, and which rule suits containers vs bulk; and payment terms — cash in advance, T/T and staged deposits, letters of credit (sight, usance, confirmed, transferable, back-to-back, revolving, red clause, standby), documentary collections (D/P, D/A), open account, consignment, and bank guarantees. Sourced from ICC (which publishes Incoterms, UCP 600 and URC 522) and the US International Trade Administration. Use for any question about what a trade or payment term means, how it works, or which to choose. This is standards knowledge only — it never states Koleex's own prices, margins or the terms offered to a specific customer.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Trade term, code, or question keywords — e.g. 'FOB vs CIF', 'where does risk pass under CFR', 'what is a confirmed letter of credit', 'D/P or D/A', 'best incoterm for containers'.",
      },
      limit: { type: "integer", description: "Max sections to return. Default 2, cap 4." },
    },
    required: ["query"],
  },
  handler: async (
    _ctx,
    args,
  ): Promise<ToolResult<{ total_matches: number; sections: TradeTermsSection[] }>> => {
    const q = String(args.query ?? "").toLowerCase().trim();
    const limit = Math.min(Math.max(Number(args.limit ?? 2) || 2, 1), 4);
    if (!q) {
      return { ok: false, permissionStatus: "denied", data: null, message: "Provide a search query." };
    }

    const codes = new Set((q.match(CODE_RE) ?? []).map((c) => c.toLowerCase()));
    const words = q.split(/\s+/).filter((w) => w.length > 2);

    const scored = TRADE_TERMS_KNOWLEDGE.map((s) => {
      const title = s.title.toLowerCase();
      const body = s.content.toLowerCase();
      const keys = s.keywords.map((k) => k.toLowerCase());
      let score = 0;
      if (title.includes(q)) score += 60;

      /* Keywords rank above title words. A title word alone is a weak signal
         that mis-fires badly: "how many days does a BANK have to check
         documents" hit the *Bank guarantees* section purely on its title and
         buried the five-banking-day rule the asker wanted. A keyword is a
         curated statement that this section answers that phrasing. */
      for (const k of keys) {
        if (q.includes(k)) score += k.includes(" ") ? 45 : 30;
      }

      /* A named code is a strong signal — weight it above loose prose hits
         so "FOB vs CIF" lands on the risk-transfer and cost tables rather
         than on whichever section merely says "vs". */
      for (const c of codes) {
        const tok = new RegExp(`\\b${c.replace(/[/]/g, "\\/")}\\b`, "i");
        if (tok.test(s.title)) score += 30;
        if (keys.includes(c)) score += 20;
        if (tok.test(s.content)) score += 12;
      }

      for (const w of words) {
        if (title.includes(w)) score += 12;
        else if (body.includes(w)) score += 5;
      }
      return { s, score };
    })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    /* Sections here are reference tables meant to be quoted accurately, so
       they are returned whole rather than truncated the way machine-knowledge
       trims its prose — a half-delivered cost table would be worse than none. */
    const sections = scored.slice(0, limit).map((x) => x.s);

    return {
      ok: true,
      permissionStatus: "allowed",
      data: { total_matches: scored.length, sections },
      message:
        `${scored.length} trade-terms section(s) matched "${args.query}". ` +
        "Standards knowledge (ICC Incoterms 2020 / UCP 600 / URC 522). " +
        "Explain what the term means; do NOT state Koleex prices, margins, or " +
        "the terms offered to a specific customer from this source.",
      sources: ["trade-terms(ICC Incoterms 2020, UCP 600, URC 522; ITA)"],
    };
  },
};

export const tradeTermsTools: ToolDef[] = [
  searchTradeTerms as unknown as ToolDef,
];
