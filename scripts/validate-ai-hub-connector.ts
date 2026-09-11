/* ---------------------------------------------------------------------------
   validate:ai-hub-connector — Phase 2H gate.

   The boundary between the AI Core and Hub data already existed: everything
   went through dispatchTool(), which owns the permission guard, the
   confirmation ledger and the audit trail. What it lacked was a NAME, and a
   boundary held together by convention is one an honest mistake walks around.

   The property worth guarding is therefore not "a connector file exists". It
   is that there is exactly ONE door, and that the door is a delegation rather
   than a reimplementation — a connector that re-implemented the guard would
   be a second security decision to keep in sync, which is worse than no
   connector at all.
   --------------------------------------------------------------------------- */

import { readFileSync, readdirSync } from "node:fs";
import type { UserContext } from "../src/lib/server/ai-agent/types";
import { koleexHub } from "../src/lib/server/ai/connectors/koleex-hub";
import { listTools, staticToolDenial } from "../src/lib/server/ai-agent/tool-registry";
import {
  generalLaneTools,
  runGeneralSearchHop,
  GENERAL_LANE_TOOL,
  GENERAL_SEARCH_MAX_CALLS,
  GENERAL_SEARCH_NOTE,
} from "../src/lib/server/ai/core/general-search";

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

const CONNECTOR = "src/lib/server/ai/connectors/koleex-hub/index.ts";
const read = (p: string) => readFileSync(p, "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function ctxOf(opts: { userType?: string; tenant?: string | null; superAdmin?: boolean }): UserContext {
  return {
    auth: {
      account_id: "11111111-1111-4111-8111-111111111111",
      tenant_id: opts.tenant === undefined ? "22222222-2222-4222-8222-222222222222" : opts.tenant,
      role_id: null,
      department: null,
      is_super_admin: !!opts.superAdmin,
      can_view_private: false,
      username: "tester",
      login_email: "t@example.com",
      status: "active",
      user_type: opts.userType ?? "internal",
      viewing_as: false,
      real_account_id: null,
      view_as_kind: null,
      view_as_role_id: null,
    },
    modulePermissions: {},
    allowedSensitiveFields: new Set<string>(),
    department: null,
    isSuperAdmin: !!opts.superAdmin,
    canViewPrivate: false,
    timezone: "Asia/Dubai",
    viewer: { name: null, username: "tester", role: null, department: null, isSuperAdmin: !!opts.superAdmin },
    memory: {},
  } as unknown as UserContext;
}

console.log("\n── 1. There is exactly ONE door ──");
{
  /* Every file in the AI core, minus the registry that defines dispatchTool
     and the connector that is allowed to call it. A direct call from anywhere
     else is a path around the guard, the ledger and the audit trail. */
  const CORE_DIRS = [
    "src/lib/server/ai-agent",
    "src/lib/server/ai/core",
    "src/lib/server/ai/seals",
    "src/lib/server/ai/prompts",
    "src/lib/server/ai/connectors",
  ];
  const ALLOWED = new Set([
    "src/lib/server/ai-agent/tool-registry.ts", // defines it
    CONNECTOR,                                   // the door
  ]);
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".ts") && !ALLOWED.has(full)) {
        if (/\bdispatchTool\s*\(/.test(stripComments(read(full)))) offenders.push(full);
      }
    }
  };
  for (const d of CORE_DIRS) walk(d);
  check(
    `nothing in the core calls dispatchTool directly${offenders.length ? ` — found in ${offenders.join(", ")}` : ""}`,
    offenders.length === 0,
  );
  check(
    "the orchestrator goes through the connector (so the check above is not vacuous)",
    /koleexHub\.invoke\(/.test(read("src/lib/server/ai-agent/orchestrator.ts")),
  );
}

console.log("\n── 2. The door DELEGATES; it does not reimplement the guard ──");
{
  const c = stripComments(read(CONNECTOR));
  check("invoke() calls dispatchTool", /dispatchTool\(ctx, toolName, args, opts\)/.test(c));
  check(
    "the connector does NOT re-implement the permission guard",
    !/checkModule\(/.test(c) && !/minRole/.test(c),
  );
  check(
    "the connector does NOT reach a tool handler directly",
    !/\.handler\(/.test(c) && !/getTool\(/.test(c),
  );
  check(
    "the connector does NOT touch the confirmation ledger itself",
    !/consumePendingAction|recordPendingAction/.test(c),
  );
  check(
    "the tool list is the registry's, not a second list",
    /toolsFor\(ctx\)/.test(c) && !/\[\s*"[a-zA-Z]+"\s*,/.test(c),
  );
}

console.log("\n── 3. isConnected reads the SERVER's context, never a client claim ──");
{
  const c = stripComments(read(CONNECTOR));
  check(
    "the connector never reads a request, body, header or cookie",
    !/\breq\b|\brequest\b|\bheaders\b|\bcookies\b|\bbody\b/i.test(c),
  );
  check("an internal account inside a tenant is connected", koleexHub.isConnected(ctxOf({})) === true);
  check(
    "an external account is NOT connected",
    koleexHub.isConnected(ctxOf({ userType: "customer" })) === false,
  );
  check(
    "an internal account with no tenant is NOT connected",
    koleexHub.isConnected(ctxOf({ tenant: null })) === false,
  );
  check(
    "an empty tenant string is NOT connected",
    koleexHub.isConnected(ctxOf({ tenant: "" })) === false,
  );
}

console.log("\n── 4. isConnected can only NARROW ──");
{
  /* The signal decides what is OFFERED. It must never be the thing that
     decides what may RUN — dispatchTool re-checks regardless, so a caller who
     is somehow marked connected still gets nothing they lack rights to. */
  const external = ctxOf({ userType: "customer" });
  const hubTools = listTools().filter((t) => t.requiredModule || t.minRole === "internal");
  check(`there are Hub-gated tools to test with (${hubTools.length})`, hubTools.length > 0);
  check(
    "an unconnected caller is denied every Hub-gated tool at dispatch, independent of the signal",
    hubTools.every((t) => staticToolDenial(external, t) !== null),
  );
  check(
    "the connector's available list for that caller contains no Hub-gated tool",
    koleexHub.availableTools(external).every((t) => !t.requiredModule && t.minRole !== "internal"),
  );
}

console.log("\n── 5. The connector's views agree with the registry ──");
{
  const ctx = ctxOf({ superAdmin: true });
  const names = koleexHub.availableTools(ctx).map((t) => t.name).sort();
  const schemaNames = koleexHub.toolSchemas(ctx).map((s) => s.function.name).sort();
  check("availableTools and toolSchemas describe the same set", JSON.stringify(names) === JSON.stringify(schemaNames));
  check("a super admin sees the full registry through the connector", names.length === listTools().length);
}

/* Async because the hop is awaited; tsx runs this file as CJS, where a
   top-level await is not allowed. The summary waits for it below. */
async function sectionSix() {
console.log("\n── 6. The general lane's ONE lookup goes through the door (plan A4, second slice) ──");
{
  /* The tool-less fast lane may now call search_web once. The property to
     hold: it is the only tool the lane can see, it is offered only through
     the connector's own list, every call is run through invoke() and every
     call — run or refused — gets a reply the model can read. */
  const ctx = ctxOf({});
  const offered = generalLaneTools(ctx);
  check("an internal caller is offered exactly one tool on the general lane", offered !== null && offered.length === 1);
  check("that tool is search_web", offered?.[0]?.name === GENERAL_LANE_TOOL);
  check("it is the connector's own definition, not a copy", offered?.[0]?.description === koleexHub.availableTools(ctx).find((t) => t.name === GENERAL_LANE_TOOL)?.description);
  check("the note names the tool and the one-lookup rule", GENERAL_SEARCH_NOTE.includes(GENERAL_LANE_TOOL) && /one lookup/i.test(GENERAL_SEARCH_NOTE));
  check("the note keeps explanations off the tool", /explanation.*definition/i.test(GENERAL_SEARCH_NOTE));
  check("the general lane never offers a Hub-gated tool", (offered ?? []).every((t) => t.name === GENERAL_LANE_TOOL));

  const seen: Array<{ name: string; args: Record<string, unknown> }> = [];
  const announced: number[] = [];
  const fake = async (_c: UserContext, name: string, args: Record<string, unknown>) => {
    seen.push({ name, args });
    return { ok: true, permissionStatus: "allowed" as const, data: { results: [{ title: "x" }] }, message: "Searched.", sources: ["web:tavily"] };
  };
  const base = [{ role: "system" as const, content: "sys" }, { role: "user" as const, content: "who founded Nestlé?" }];
  const hop = await runGeneralSearchHop({
    ctx,
    conversationId: "conv-1",
    calls: [{ id: "c1", name: GENERAL_LANE_TOOL, argumentsJson: JSON.stringify({ query: "Nestlé founder" }) }],
    priorContent: "Let me check",
    messages: base,
    invoke: fake,
    onStep: (steps) => announced.push(steps.length),
  });
  check("one search call runs exactly one lookup, through invoke", seen.length === 1 && seen[0].name === GENERAL_LANE_TOOL && seen[0].args.query === "Nestlé founder");
  check("the call is announced BEFORE the lookup runs (screen shows 'searching')", announced.length === 1 && announced[0] === 1);
  check("the steps are a tool-call then a tool-result carrying the sources", hop.steps.length === 2 && hop.steps[0].kind === "tool-call" && hop.steps[1].kind === "tool-result" && hop.steps[1].sources?.[0] === "web:tavily");
  check("the answer call's messages: the originals, the assistant's calls with its narration, then the tool reply",
    hop.messages.length === base.length + 2 &&
      hop.messages[base.length].role === "assistant" && hop.messages[base.length].content === "Let me check" && hop.messages[base.length].toolCalls?.[0]?.id === "c1" &&
      hop.messages[base.length + 1].role === "tool" && hop.messages[base.length + 1].toolCallId === "c1");
  const reply = JSON.parse(hop.messages[base.length + 1].content ?? "{}") as Record<string, unknown>;
  check("the tool reply is the LLM-safe projection (no raw result object)", reply.ok === true && "data" in reply && !("pendingAction" in reply));
  check("ran counts the lookups that went", hop.ran === 1);

  /* Refusals: a tool that is not search_web, and calls beyond the cap. Every
     call still gets a reply, so the provider's rule (a reply per call) holds. */
  seen.length = 0;
  const many = await runGeneralSearchHop({
    ctx,
    conversationId: "conv-1",
    calls: [
      { id: "a", name: "getCustomerDetails", argumentsJson: "{\"id\":\"1\"}" },
      { id: "b", name: GENERAL_LANE_TOOL, argumentsJson: "{\"query\":\"one\"}" },
      { id: "c", name: GENERAL_LANE_TOOL, argumentsJson: "not json" },
      { id: "d", name: GENERAL_LANE_TOOL, argumentsJson: "{\"query\":\"three\"}" },
    ],
    priorContent: "",
    messages: base,
    invoke: fake,
  });
  check("a Hub tool asked for on the general lane is NEVER run", seen.every((s) => s.name === GENERAL_LANE_TOOL));
  check(`at most ${GENERAL_SEARCH_MAX_CALLS} lookups run; the rest are refused`, seen.length === GENERAL_SEARCH_MAX_CALLS && many.ran === GENERAL_SEARCH_MAX_CALLS);
  check("unparseable arguments become an empty object, not a throw", seen.some((s) => Object.keys(s.args).length === 0));
  const replies = many.messages.filter((m) => m.role === "tool");
  check("every call gets a tool reply, run or refused", replies.length === 4 && replies.map((m) => m.toolCallId).join() === "a,b,c,d");
  const refused = JSON.parse(replies[0].content ?? "{}") as Record<string, unknown>;
  check("a refused call's reply says it was not run", refused.ok === false && /not run/i.test(String(refused.message)));
  check("a refused call leaves no step on the screen", many.steps.length === GENERAL_SEARCH_MAX_CALLS * 2);
  check("an empty narration is a null assistant content, as the IR requires", many.messages.find((m) => m.role === "assistant")?.content === null);

  /* The lane offers nothing to a caller the connector lists nothing for. */
  const src = stripComments(read("src/lib/server/ai/core/general-search.ts"));
  check("the tool list comes from koleexHub.availableTools, never from the registry directly", /koleexHub\s*\.availableTools\(/.test(src) && !/tool-registry/.test(src));
  check("the lookup runs through koleexHub.invoke, never dispatchTool", /koleexHub\.invoke\(/.test(src) && !/dispatchTool/.test(src));
  check("the module is server-only", /^import "server-only";/m.test(read("src/lib/server/ai/core/general-search.ts")));
}
}

void sectionSix().then(() => {
  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFAILED:");
    for (const f of failures) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log("One door, and it delegates — a connector that reimplemented the guard would be worse than none.");
});
