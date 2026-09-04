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

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("One door, and it delegates — a connector that reimplemented the guard would be worse than none.");
