/* ---------------------------------------------------------------------------
   validate:ai-client-neutral — Phase 2I gate (finding N6).

   A tool that has just created something wants to tell the client "here it
   is". A Hub-relative path does that only for the Hub: on an iPhone
   `/quotations/abc` is not a destination, it is a string. So a navigation
   pointer that travels back in a ToolResult must be a ResourceRef, which says
   WHAT the record is rather than WHERE the Hub keeps it.

   NOT every Hub-relative path in the tool layer is a defect, and the audit's
   "six places" figure counted several that are not. Verified before writing
   this: every `/todo?task=` string in the tool layer is an `inbox_messages`
   row or a push-notification payload — Hub features, consumed by the Hub,
   which never travel in a ToolResult. Rewriting those would break a working
   feature to fix a problem they do not have.

   So this suite does not ban Hub paths. It requires each one to be DECLARED:
   either it is on the list below with a reason, or it is accompanied by a
   ResourceRef. Same pattern as SHARED_BY_DESIGN in the tenant-isolation
   validator — a named exception a human agreed to, not a blanket exemption.
   --------------------------------------------------------------------------- */

import { readFileSync, readdirSync } from "node:fs";
import { resourceRef, type ResourceKind } from "../src/lib/server/ai/core/resource-ref";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✗ ${label}`);
  }
}

const TOOL_DIR = "src/lib/server/ai-agent/tools";

/* Hub-relative links that are correct as they are, each with the reason it is
   not an AI-surface link. A new entry here is a decision someone has to make
   deliberately — which is the point. */
const HUB_INTERNAL_BY_DESIGN: Array<{ file: string; contains: string; why: string }> = [
  {
    file: "todos.ts",
    contains: "inbox_messages",
    why: "the Hub inbox renders these; they are written to a Hub table and never returned to the AI client",
  },
  {
    file: "todos.ts",
    contains: "sendPushToAccounts",
    why: "a Hub push notification opens the Hub app; it is not a ToolResult field",
  },
];

/** Every Hub-relative path literal in the tool layer, with its line. */
function hubPathSites(): Array<{ file: string; line: number; text: string }> {
  const out: Array<{ file: string; line: number; text: string }> = [];
  for (const name of readdirSync(TOOL_DIR)) {
    if (!name.endsWith(".ts")) continue;
    const lines = readFileSync(`${TOOL_DIR}/${name}`, "utf8").split("\n");
    lines.forEach((text, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(text)) return; // comments are not code
      /* A Hub-relative path inside a string or template literal: "/x", `/x…`.
         Storage URLs are absolute (https://…) and do not match. */
      if (/["'`]\/[a-z][a-z0-9-]*(\/|\?|\$\{|["'`])/.test(text)) {
        out.push({ file: name, line: i + 1, text: text.trim() });
      }
    });
  }
  return out;
}

/** Is this line inside a block that the allowlist covers? Judged by a small
 *  window ABOVE the line, since the insert/push call opens the block. */
function coveredByAllowlist(site: { file: string; line: number }): string | null {
  const lines = readFileSync(`${TOOL_DIR}/${site.file}`, "utf8").split("\n");
  const window = lines.slice(Math.max(0, site.line - 15), site.line).join("\n");
  for (const entry of HUB_INTERNAL_BY_DESIGN) {
    if (entry.file === site.file && window.includes(entry.contains)) return entry.why;
  }
  return null;
}

console.log("\n── 1. Every Hub-relative path in the tool layer is accounted for ──");
{
  const sites = hubPathSites();
  console.log(`  · ${sites.length} Hub-relative path literal(s) found in ${TOOL_DIR}`);
  const undeclared: string[] = [];
  for (const s of sites) {
    const why = coveredByAllowlist(s);
    if (why) {
      console.log(`    · ${s.file}:${s.line} — allowed: ${why}`);
      continue;
    }
    /* Not allowlisted: it may be an AI-surface link, and then it must carry a
       ResourceRef in the same returned payload. */
    const lines = readFileSync(`${TOOL_DIR}/${s.file}`, "utf8").split("\n");
    const near = lines.slice(Math.max(0, s.line - 4), s.line + 4).join("\n");
    if (/resourceRef\(/.test(near)) {
      console.log(`    · ${s.file}:${s.line} — paired with a ResourceRef`);
      continue;
    }
    undeclared.push(`${s.file}:${s.line}  ${s.text}`);
  }
  check(
    `no undeclared Hub-relative link in a tool result${undeclared.length ? `:\n      ${undeclared.join("\n      ")}` : ""}`,
    undeclared.length === 0,
  );
  check("the scan found sites at all (it is not silently matching nothing)", sites.length > 0);
}

console.log("\n── 2. The quotation draft is resolvable by any client ──");
{
  const q = readFileSync(`${TOOL_DIR}/quotations.ts`, "utf8");
  check("createQuotationDraft returns a ResourceRef", /resource: resourceRef\("quotation", quote\.id\)/.test(q));
  check(
    "it ALSO still returns review_url — removing it would break the Hub UI that reads it",
    /review_url: `\/quotations\/\$\{quote\.id\}`/.test(q),
  );
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  check("the Hub UI still reads review_url, which is why it is kept", /review_url/.test(app));
}

console.log("\n── 3. The reference itself behaves ──");
{
  const r = resourceRef("quotation", "abc");
  check("resourceRef returns the kind and id it was given", r.kind === "quotation" && r.id === "abc");
  check("a ResourceRef carries no Hub path", !JSON.stringify(r).includes("/"));
  /* The union is closed on purpose: a client receiving an unknown kind cannot
     navigate anywhere useful, so widening it should be a decision. */
  const kinds: ResourceKind[] = [
    "quotation", "customer", "product", "todo", "project", "planning_item", "calendar_event",
  ];
  const declared = readFileSync("src/lib/server/ai/core/resource-ref.ts", "utf8");
  check(
    "every declared kind is in the exported union",
    kinds.every((k) => new RegExp(`"${k}"`).test(declared)),
  );
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log(
  "Hub paths are not banned — they are declared. A new one must be allowlisted with a reason or paired with a ResourceRef.",
);
