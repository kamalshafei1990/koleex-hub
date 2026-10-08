#!/usr/bin/env tsx

/* ===========================================================================
   Document generation (the PDF counterpart of validate-ai-image-gen).

   generate_document WRITES to the same public bucket and renders with our
   own Chromium, so what is proved here is mostly what must NOT happen:

     · the SANITISER — wrong types dropped, fields clamped, totals capped,
       a doc with no real content rejected;
     · the RENDER — the HTML carries NO raw model markup: injected tags
       arrive escaped, and the page loads zero external assets;
     · the TOOL — registered, the note beside the url, failure said
       plainly, never a "denied" for an ordinary failure;
     · the PROMPT and ROUTING — the system prompt carries the rule (call
       the tool EVERY time, never invent a link), and a document request
       leaves the tool-less lanes in three languages, at BOTH gates
       (orchestrator and route short-circuit);
     · the STORE — generated files are served from the Hub's own domain
       through the /ai/files rewrite, never the raw storage host.

   Runs with --conditions=react-server: the modules are server-only.
   The render check is HTML-level only (no browser launched here — the
   real-Chromium proof is scripts/test-doc-gen.ts).
   ========================================================================== */

import { readFileSync } from "node:fs";
import { sanitizeDocInput, renderDocHtml, MAX_DOC_CHARS } from "../src/lib/server/ai/doc-gen";
import { docGenTools, GENERATED_DOC_NOTE, DOC_FAILED_MESSAGE } from "../src/lib/server/ai-agent/tools/doc-gen";
import { listTools } from "../src/lib/server/ai-agent/tool-registry";
import { DOC_GEN_RULE } from "../src/lib/server/ai/prompt-builder";
import { buildSystemPrompt } from "../src/lib/server/ai/prompts";
import { isDocCreationRequest } from "../src/lib/server/ai/core/decide-turn";
import { appOrigin } from "../src/lib/server/ai/generated-storage";
import { BUDGETS } from "../src/lib/server/ai/security/rate-limit";

let pass = 0, fail = 0;
function check(label: string, ok: boolean): void {
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.error(`  ✗ ${label}`); }
}

async function main() {
  console.log("\n── 1. The sanitiser ──");
  {
    check("a doc without a title is rejected", sanitizeDocInput({ sections: [{ paragraphs: ["x"] }] }) === null);
    check("a doc without real sections is rejected",
      sanitizeDocInput({ title: "T", sections: [] }) === null &&
      sanitizeDocInput({ title: "T", sections: [{ heading: "" }] }) === null);
    const doc = sanitizeDocInput({
      title: "T",
      sections: [{ paragraphs: ["hello"], bullets: ["a", "b"], table: { columns: ["C1"], rows: [["1"]] } }],
    });
    check("a well-formed doc survives intact",
      !!doc && doc.sections.length === 1 && doc.sections[0].paragraphs?.[0] === "hello" && doc.sections[0].table?.rows[0][0] === "1");
    const huge = sanitizeDocInput({
      title: "T",
      sections: [{ paragraphs: ["x".repeat(MAX_DOC_CHARS * 2)] }],
    });
    check("oversized content is clamped to the budget", !!huge && JSON.stringify(huge).length < MAX_DOC_CHARS * 2);
    const junk = sanitizeDocInput({ title: "T", sections: [{ paragraphs: [42, null, "ok"] }] });
    check("non-string members are dropped, not crashed on", !!junk && junk.sections[0].paragraphs?.join() === "ok");
  }

  console.log("\n── 2. The render (HTML level): escaping and self-containment ──");
  {
    const evil = sanitizeDocInput({
      title: "<script>alert(1)</script>",
      sections: [{ paragraphs: ["<img src=x onerror=alert(1)>"] }],
    })!;
    const html = renderDocHtml(evil);
    check("injected markup arrives ESCAPED, never raw",
      !html.includes("<script>alert(1)</script>") && !html.includes("<img src=x") && html.includes("&lt;script&gt;"));
    const good = renderDocHtml(sanitizeDocInput({ title: "T", sections: [{ paragraphs: ["x"] }] })!);
    check("no external asset is ever referenced (no render can hang on a fetch)",
      !/src="http|href="http|@import|url\(http/.test(good));
    const ar = renderDocHtml(sanitizeDocInput({ title: "ت", lang: "ar", sections: [{ paragraphs: ["x"] }] })!);
    check("lang=ar flips direction and picks an Arabic-capable stack", ar.includes('dir="rtl"') && ar.includes("Tahoma"));
    check("the printed page is opaque white (headless transparency composites to black)",
      good.includes("background: #fff"));
  }

  console.log("\n── 3. The tool ──");
  {
    const tool = docGenTools[0];
    check("registered in the agent's flat registry", listTools().some((t) => t.name === "generate_document"));
    check("a title and sections are required by the schema",
      !!tool.parameters.required?.includes("title") && !!tool.parameters.required?.includes("sections"));
    check("no module gate, internal role, view action — like the image tool",
      tool.requiredModule === undefined && tool.minRole === "internal" && tool.requiredAction === "view");
    check("the note says what it is NOT (never an official business document)",
      /NEVER present it as an official/.test(GENERATED_DOC_NOTE) && /quotations, invoices and invitations/i.test(GENERATED_DOC_NOTE));
    check("failure is a plain message, not a denial and not an invented file",
      /could not be made/.test(DOC_FAILED_MESSAGE));
    check("doc budgets exist above the paid-image ceilings",
      BUDGETS.docPerAccount().max > 0 && BUDGETS.docPerTenant().max > BUDGETS.imagePerAccount().max);
  }

  console.log("\n── 4. The prompt and the routing ──");
  {
    const promptCtx = {
      auth: { account_id: "a", tenant_id: "t" },
      modulePermissions: {}, allowedSensitiveFields: new Set<string>(), department: "Sales", isSuperAdmin: false, canViewPrivate: false, timezone: "Asia/Dubai",
      viewer: { name: "Test User", username: "test", role: "Sales Rep", department: "Sales", isSuperAdmin: false }, memory: {},
    } as never;
    const prompt = buildSystemPrompt(promptCtx, "en" as never, { dialect: "egyptian" } as never);
    check("the system prompt carries the document rule",
      DOC_GEN_RULE.length > 100 && prompt.includes("generate_document"));
    const idx = readFileSync("src/lib/server/ai/prompts/index.ts", "utf8");
    check("  …placed beside the picture rules on the same line", /\$\{WEB_IMAGE_RULE\}\$\{IMAGE_GEN_RULE\}\$\{DOC_GEN_RULE\}/.test(idx));
    check("the rule forbids reusing or inventing a link — THIS turn or nothing",
      /CALL THE TOOL EVERY TIME/.test(DOC_GEN_RULE) && /never invent a document url/.test(DOC_GEN_RULE));
    check("a document request leaves the tool-less lane — en, ar, zh",
      isDocCreationRequest("make me a PDF packing list for the Hamburg shipment") &&
      isDocCreationRequest("can you generate a pdf of this?") &&
      isDocCreationRequest("redesign this document as a clean pdf") &&
      isDocCreationRequest("اعملي مستند pdf لقائمة التعبئة") &&
      isDocCreationRequest("حولها pdf") &&
      isDocCreationRequest("导出一个装箱单pdf"));
    check("…a verb without a document noun, or a noun without a verb, does not fire",
      !isDocCreationRequest("make a task for tomorrow") &&
      !isDocCreationRequest("what did the report say") &&
      !isDocCreationRequest("the pdf you sent is clear") &&
      !isDocCreationRequest("start my daily report") &&
      !isDocCreationRequest("اعمل ميتنج بكرة") &&
      !isDocCreationRequest("安排会议"));
    const orch = readFileSync("src/lib/server/ai-agent/orchestrator.ts", "utf8");
    const route = readFileSync("src/app/api/ai/agent/route.ts", "utf8");
    check("…and BOTH gates honour it — the orchestrator's and the route's short-circuit",
      /isDocCreationRequest\(userMessage\)/.test(orch) && /isDocCreationRequest\(normalizedContent\)/.test(route));
  }

  console.log("\n── 5. The store: Hub-domain links ──");
  {
    check("the store module builds links on the app origin, not the storage host",
      !appOrigin().includes("supabase"));
    const cfg = readFileSync("next.config.ts", "utf8");
    check("the /ai/files rewrite proxies ONLY the ai-generated prefix",
      /source:\s*"\/ai\/files\/:path\*"/.test(cfg) && /media\/ai-generated\/:path\*/.test(cfg));
    for (const f of ["src/lib/server/ai-agent/tools/image-gen.ts", "src/lib/server/ai-agent/tools/doc-gen.ts"]) {
      const src = readFileSync(f, "utf8");
      check(`${f.split("/").pop()} stores through the shared helper`, /storeGeneratedFile\(/.test(src) && !/getPublicUrl/.test(src));
    }
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
