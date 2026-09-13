/* ---------------------------------------------------------------------------
   validate:ai-tool-exposure — Phase 2F gate.

   Until 2F the model was offered all 45 tool schemas no matter who was asking.
   A Sales user saw every schema, tried the ones they could not use, and burned
   a turn being denied. Exposure is now permission-scoped.

   The danger in that change is not the filtering — it is DISAGREEMENT. If the
   filter and the dispatcher ever decide differently, both directions are bugs:
   hiding a permitted tool silently breaks a feature, and offering a forbidden
   one wastes a turn and teaches the model to try things that never work.

   So the central property here is not "fewer tools appear". It is that for
   EVERY tool and EVERY profile, `exposed` and `dispatch would allow` are the
   same boolean. That holds by construction because both read
   staticToolDenial() — this suite exists to keep it true if someone later
   reintroduces a second list.
   --------------------------------------------------------------------------- */

import { readFileSync, readdirSync } from "node:fs";
import type { UserContext } from "../src/lib/server/ai-agent/types";
import {
  listTools,
  staticToolDenial,
  openAiToolSchemas,
  toolsFor,
} from "../src/lib/server/ai-agent/tool-registry";

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

type Mod = { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean };
const grant = (v = true, c = false, e = false, d = false): Mod => ({
  can_view: v, can_create: c, can_edit: e, can_delete: d,
});

function makeCtx(opts: {
  superAdmin?: boolean;
  userType?: string;
  modules?: Record<string, Mod>;
}): UserContext {
  return {
    auth: {
      account_id: "11111111-1111-4111-8111-111111111111",
      tenant_id: "22222222-2222-4222-8222-222222222222",
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
    /* checkModule lowercases the lookup key — mirror that here so the fixture
       exercises the real code path rather than a convenient one. */
    modulePermissions: Object.fromEntries(
      Object.entries(opts.modules ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    ),
    allowedSensitiveFields: new Set<string>(),
    department: null,
    isSuperAdmin: !!opts.superAdmin,
    canViewPrivate: false,
    timezone: "Asia/Dubai",
    viewer: { name: "Tester", username: "tester", role: null, department: null, isSuperAdmin: !!opts.superAdmin },
    memory: {},
  } as unknown as UserContext;
}

const PROFILES: Array<[string, UserContext]> = [
  ["super admin", makeCtx({ superAdmin: true })],
  [
    "sales rep (Customers + Products + Quotations view, Quotations create)",
    makeCtx({
      modules: {
        Customers: grant(true),
        Products: grant(true),
        Quotations: grant(true, true),
      },
    }),
  ],
  [
    "planner (To-do + Projects full)",
    makeCtx({
      modules: {
        "To-do": grant(true, true, true, true),
        Projects: grant(true, true, true, true),
      },
    }),
  ],
  ["internal user with no module grants", makeCtx({ modules: {} })],
  ["external user (customer account, no grants)", makeCtx({ userType: "customer", modules: {} })],
];

const ALL = listTools();

console.log("\n── 1. The registry is intact ──");
check("all 47 tools are still registered", ALL.length === 47);
check("every tool has a name and a description", ALL.every((t) => !!t.name && !!t.description));

console.log("\n── 2. Exposure and dispatch agree, for every tool × every profile ──");
/* The load-bearing property. Asserted per profile as a single check over all
   45 tools, with the offending tool named if it fails. */
for (const [label, ctx] of PROFILES) {
  const exposedNames = new Set(openAiToolSchemas(ctx).map((s) => s.function.name));
  const disagreements = ALL.filter((t) => {
    const allowedByDispatch = staticToolDenial(ctx, t) === null;
    return exposedNames.has(t.name) !== allowedByDispatch;
  }).map((t) => t.name);
  check(
    `${label}: exposed set === runnable set${disagreements.length ? ` — differs on ${disagreements.join(", ")}` : ""}`,
    disagreements.length === 0,
  );
}

console.log("\n── 3. The filter actually filters (it is not a no-op) ──");
{
  const sa = openAiToolSchemas(PROFILES[0][1]).length;
  const sales = openAiToolSchemas(PROFILES[1][1]).length;
  const none = openAiToolSchemas(PROFILES[3][1]).length;
  console.log(`  · offered — super admin ${sa}, sales ${sales}, no grants ${none} (of ${ALL.length})`);
  check("a super admin is offered every tool", sa === ALL.length);
  check("a sales rep is offered fewer than a super admin", sales < sa);
  check("a user with no grants is offered fewer than a sales rep", none < sales);
  check("a user with no grants still gets the ungated tools, not zero", none > 0);
}

console.log("\n── 4. Specific grants produce specific tools ──");
{
  const sales = new Set(openAiToolSchemas(PROFILES[1][1]).map((s) => s.function.name));
  const planner = new Set(openAiToolSchemas(PROFILES[2][1]).map((s) => s.function.name));
  const salesOnly = [...sales].filter((n) => !planner.has(n));
  const plannerOnly = [...planner].filter((n) => !sales.has(n));
  check("the sales profile gets tools the planner does not", salesOnly.length > 0);
  check("the planner gets tools the sales profile does not", plannerOnly.length > 0);
  check(
    "a Customers-view tool reaches the sales rep but not the planner",
    sales.has("getCustomerByName") && !planner.has("getCustomerByName"),
  );
  check(
    "a To-do tool reaches the planner but not the sales rep",
    planner.has("listMyTodos") && !sales.has("listMyTodos"),
  );
}

console.log("\n── 5. Action level is respected, not just module access ──");
/* A view grant must not open a create/edit/delete tool. This is the case a
   naive "does the user have the module?" filter gets wrong. */
{
  const viewOnly = makeCtx({ modules: { "To-do": grant(true, false, false, false) } });
  const names = new Set(openAiToolSchemas(viewOnly).map((s) => s.function.name));
  const todoTools = ALL.filter((t) => t.requiredModule === "To-do");
  const viewTools = todoTools.filter((t) => (t.requiredAction ?? "view") === "view");
  const writeTools = todoTools.filter((t) => (t.requiredAction ?? "view") !== "view");
  check(`view-only grant exposes the To-do read tools (${viewTools.length} of them)`, viewTools.some((t) => names.has(t.name)));
  check(
    `view-only grant exposes NO To-do write tool (${writeTools.length} checked)`,
    writeTools.every((t) => !names.has(t.name)),
  );
}

console.log("\n── 6. Role tier is respected ──");
{
  const internal = makeCtx({ userType: "internal", modules: {} });
  const external = makeCtx({ userType: "customer", modules: {} });
  const gated = ALL.filter((t) => t.minRole === "internal" && !t.requiredModule);
  check(`there are internal-only ungated tools to test with (${gated.length})`, gated.length > 0);
  const iNames = new Set(openAiToolSchemas(internal).map((s) => s.function.name));
  const eNames = new Set(openAiToolSchemas(external).map((s) => s.function.name));
  check("an internal user is offered the internal-only tools", gated.every((t) => iNames.has(t.name)));
  check("an external account is offered none of them", gated.every((t) => !eNames.has(t.name)));
}

console.log("\n── 7. Defence in depth is intact ──");
/* Filtering exposure must NARROW, never replace, the dispatch guard: a model
   can name a tool it was never handed. toolsFor() and the denial function are
   the same decision, so a tool absent from toolsFor() is one dispatch denies. */
for (const [label, ctx] of PROFILES) {
  const runnable = new Set(toolsFor(ctx).map((t) => t.name));
  const hidden = ALL.filter((t) => !runnable.has(t.name));
  check(
    `${label}: every hidden tool is still denied at dispatch (${hidden.length} hidden)`,
    hidden.every((t) => staticToolDenial(ctx, t) !== null),
  );
}

console.log("\n── 8. The payload claim, measured rather than asserted ──");
{
  const bytes = (ctx: UserContext) => JSON.stringify(openAiToolSchemas(ctx)).length;
  const sa = bytes(PROFILES[0][1]);
  const sales = bytes(PROFILES[1][1]);
  const none = bytes(PROFILES[3][1]);
  console.log(
    `  · schema bytes — super admin ${sa}, sales ${sales} (−${(((sa - sales) / sa) * 100).toFixed(0)}%), no grants ${none} (−${(((sa - none) / sa) * 100).toFixed(0)}%)`,
  );
  check("a scoped user's tool payload is genuinely smaller", sales < sa && none < sales);
}

console.log("\n── 9. \"denied\" is a permission, never a failure ──");
{
  /* THE DEFECT, from the saved transcript of a super admin's call: a product
     lookup failed (the code did not exist), the tool answered
     `permissionStatus: "denied"`, and the model told the owner he was not
     allowed to see the product. 111 of the 120 "denied" returns in the tools
     were failures — not found, could not load, missing argument — wearing a
     permission label. They are "allowed" + ok:false now, and this holds the
     line: every "denied" a tool writes must READ as a permission. */
  const dir = "src/lib/server/ai-agent/tools";
  const PERMISSION_WORDS = /(only|yours\b|your own|own calendar|viewing as another user|in your workspace|permission|not allowed|access)/i;
  const FAILURE_WORDS = /(couldn'?t|can'?t find|right now|try again|provide a|which |what'?s the|when is|required|need a|nothing to change)/i;
  let denied = 0;
  const mislabelled: string[] = [];
  let failuresAllowed = 0;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
    const src = readFileSync(`${dir}/${f}`, "utf8");
    const re = /permissionStatus:\s*"(denied|allowed)"[\s\S]{0,260}?message:\s*(`[^`]*`|"[^"]*")/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const status = m[1];
      const msg = m[2];
      if (status === "denied") {
        denied++;
        if (!PERMISSION_WORDS.test(msg)) mislabelled.push(`${f}: ${msg.slice(0, 60)}`);
      } else if (FAILURE_WORDS.test(msg)) {
        failuresAllowed++;
      }
    }
  }
  check(`every "denied" a tool writes reads as a permission${mislabelled.length ? ` — not these: ${mislabelled.join(" | ")}` : ""}`,
    mislabelled.length === 0);
  check("the genuine ones survive — ownership and view-as, in the files that have them",
    denied >= 8 && denied <= 12);
  check("and the failures now answer allowed + ok:false, in numbers, not by accident",
    failuresAllowed >= 60);
  /* The sites that actually bit the owner, by name. */
  const products = readFileSync(`${dir}/products.ts`, "utf8");
  check("a product that cannot be fetched is not a permission denial",
    /permissionStatus: "allowed",[\s\S]{0,120}?Couldn't fetch that product right now/.test(products) &&
    !/permissionStatus: "denied",[\s\S]{0,120}?Couldn't fetch that product right now/.test(products));
  check("nor is a product that is simply not in the catalogue",
    !/permissionStatus: "denied",[\s\S]{0,400}?not published in the catalogue/.test(products));
  const calendar = readFileSync(`${dir}/calendar.ts`, "utf8");
  check("but someone else's calendar still is",
    /permissionStatus: "denied", data: null, message: "You can only edit events on your own calendar."/.test(calendar));
  check("the contract says so where the type lives",
    /"DENIED" MEANS A PERMISSION, NOT A FAILURE/.test(readFileSync("src/lib/server/ai-agent/types.ts", "utf8")));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("Exposure and dispatch are one predicate; this suite exists to keep it that way.");
