/* ---------------------------------------------------------------------------
   validate:trade-terms — exercises the REAL searchTradeTerms handler against
   the questions a salesperson actually asks, and asserts the answer contains
   the fact that makes it correct.

   Two things this guards that a typecheck cannot:
     1. Retrieval — asking "FOB vs CIF" must surface the risk-transfer and
        cost sections, not whichever section merely contains the word "vs".
     2. Accuracy of the content itself — most importantly that the obsolete
        "ship's rail" wording never reappears as the stated rule. That phrase
        was deleted from Incoterms in 2010 but is still copied widely,
        including by a US government page, so it is exactly the kind of error
        that creeps back in on an edit.
   --------------------------------------------------------------------------- */

import { getTool } from "../src/lib/server/ai-agent/tool-registry";
import { TRADE_TERMS_KNOWLEDGE } from "../src/lib/server/ai-agent/trade-terms-knowledge";
import { isBusinessDataQuery } from "../src/lib/server/ai-agent/orchestrator";

type Case = {
  q: string;
  /** every fragment must appear somewhere in the returned sections */
  expect: string[];
  limit?: number;
};

const CASES: Case[] = [
  { q: "FOB vs CIF", expect: ["on board the vessel", "Cost, Insurance and Freight"], limit: 3 },
  { q: "where does risk pass under CFR", expect: ["on board the vessel"], limit: 3 },
  { q: "what insurance must the seller buy under CIP", expect: ["Institute Cargo Clauses (A)", "110%"] },
  { q: "CIF insurance level", expect: ["Institute Cargo Clauses (C)", "110%"] },
  { q: "best incoterm for containers", expect: ["FCA"], limit: 3 },
  { q: "which incoterm makes the seller unload", expect: ["DPU"], limit: 3 },
  { q: "DDP duty", expect: ["import clearance"], limit: 3 },
  { q: "what is a confirmed letter of credit", expect: ["confirming bank"], limit: 3 },
  { q: "difference between D/P and D/A", expect: ["Documents against Payment", "Documents against Acceptance"], limit: 3 },
  { q: "how many days does a bank have to check documents", expect: ["five banking days"], limit: 3 },
  { q: "transferable credit", expect: ["second beneficiaries"], limit: 3 },
  { q: "standby letter of credit", expect: ["SBLC"], limit: 3 },
  { q: "30% deposit 70% before shipment", expect: ["deposit"], limit: 3 },
  { q: "open account risk", expect: ["High seller risk", "30/60/90"], limit: 4 },
  { q: "what does EXW mean", expect: ["Ex Works"], limit: 3 },
];

async function main() {
  let failed = 0;

  const tool = getTool("searchTradeTerms");
  if (!tool) {
    console.error("FAIL  searchTradeTerms is not registered in the tool registry");
    process.exit(1);
  }

  /* Ungated on purpose — published standards, no Koleex data. If someone
     later adds a module gate, this catches it, because a salesperson would
     silently lose the ability to look up the term they are quoting. */
  if (tool.requiredModule !== undefined) {
    console.error(`FAIL  expected searchTradeTerms to be ungated, got requiredModule=${String(tool.requiredModule)}`);
    failed++;
  }

  for (const c of CASES) {
    const res = await tool.handler(
      {} as Parameters<typeof tool.handler>[0],
      { query: c.q, limit: c.limit ?? 2 } as Parameters<typeof tool.handler>[1],
    );
    if (!res.ok || !res.data) {
      console.error(`FAIL  "${c.q}" → tool returned not-ok`);
      failed++;
      continue;
    }
    const blob = (res.data as { sections: { title: string; content: string }[] }).sections
      .map((s) => `${s.title}\n${s.content}`)
      .join("\n")
      .toLowerCase();
    const missing = c.expect.filter((e) => !blob.includes(e.toLowerCase()));
    if (missing.length) {
      const titles = (res.data as { sections: { title: string }[] }).sections.map((s) => s.title);
      console.error(`FAIL  "${c.q}" → missing ${JSON.stringify(missing)}; got sections: ${JSON.stringify(titles)}`);
      failed++;
    } else {
      console.log(`ok    "${c.q}"`);
    }
  }

  /* Routing guard. The knowledge base is useless if the question never
     reaches the tool lane: the fast lane carries NO tools, so the model
     answers from its own memory. Verified live — before these patterns
     existed, "which Institute Cargo Clauses apply to CIP vs CIF" came back
     with steps:['answer'] and never touched the sourced text. The negatives
     matter just as much: routing "tea or coffee" through the tool loop would
     be a regression in both cost and answer quality. */
  const ROUTES: Array<[string, boolean]> = [
    ["What is the difference between FOB and CIF?", true],
    ["Under Incoterms 2020, which clauses apply to CIP versus CIF?", true],
    ["explain a transferable letter of credit", true],
    ["what is a standby LC", true],
    ["explain D/P vs D/A", true],
    ["what payment terms should I offer a new customer", true],
    ["What does DDP mean?", true],
    ["ما هي شروط الدفع الأفضل لعميل جديد؟", true],
    ["信用证是什么", true],
    ["which is better, tea or coffee?", false],
    ["hello", false],
    ["what is the weather in Cairo", false],
  ];
  for (const [q, want] of ROUTES) {
    const got = isBusinessDataQuery(q);
    if (got !== want) {
      console.error(
        `FAIL  routing "${q}" → expected ${want ? "tool lane" : "fast lane"}, got ${got ? "tool lane" : "fast lane"}`,
      );
      failed++;
    } else {
      console.log(`ok    route ${want ? "→tools" : "→fast "} "${q.slice(0, 46)}"`);
    }
  }

  /* Content guard: the deleted Incoterms wording must never be presented as
     the rule. It may appear ONLY where the file explicitly warns against it. */
  for (const s of TRADE_TERMS_KNOWLEDGE) {
    const lines = s.content.split("\n");
    for (const line of lines) {
      if (!/ship's rail/i.test(line)) continue;
      const isWarning = /never|obsolete|removed|deleted|outdated|not pass|does NOT/i.test(line);
      if (!isWarning) {
        console.error(`FAIL  "${s.title}" states "ship's rail" without marking it obsolete:\n      ${line.trim()}`);
        failed++;
      }
    }
  }

  /* Every one of the eleven rules must be documented — a partial set would
     quietly answer "I don't know that term" for a real Incoterm. */
  const all = TRADE_TERMS_KNOWLEDGE.map((s) => s.content).join("\n");
  for (const code of ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"]) {
    if (!new RegExp(`\\b${code}\\b`).test(all)) {
      console.error(`FAIL  Incoterm ${code} is not covered anywhere in the knowledge base`);
      failed++;
    }
  }

  console.log(
    failed === 0
      ? `\nPASS  ${CASES.length} retrieval + ${ROUTES.length} routing cases + content guards`
      : `\n${failed} FAILURE(S)`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

void main();
