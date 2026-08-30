/* ---------------------------------------------------------------------------
   validate:ai-skills — Phase 6A gate.

   §L's rules 1 and 5 say every tool declares its risk class, with no default,
   and that a tool without one fails registry validation. Prose in a plan
   cannot enforce either. This suite is the enforcement.

   The important check is the BIJECTION: every registered tool is declared, and
   every declaration corresponds to a registered tool. One direction catches a
   new tool that nobody classified — the failure §L rule 5 names. The other
   catches a declaration left behind by a deleted tool, which is how a
   catalogue silently drifts out of date until nobody trusts it.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import { toolsFor } from "../src/lib/server/ai-agent/tool-registry";
import {
  SKILL_CATALOG,
  RISK_CLASSES,
  DOMAINS,
  skillMeta,
  toolsInDomain,
  requiresLedger,
  isWrite,
  type RiskClass,
} from "../src/lib/server/ai/skills/catalog";
import { riskClassFor } from "../src/lib/server/ai/security/pending-actions";
import { deepseekEnabled, streamingFastLaneEnabled } from "../src/lib/server/ai/router/provider-policy";
import { validateArgs, validationMode, isBlocking, formatValidationLine } from "../src/lib/server/ai/skills/validate";
import { timeoutFor, raceTimeout, DEFAULT_TOOL_TIMEOUT_MS } from "../src/lib/server/ai/skills/timeout";
import type { UserContext } from "../src/lib/server/ai-agent/types";

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

/* A context that can see everything, so toolsFor() returns the FULL registry
   rather than one role's slice. Classifying only the tools a particular role
   happens to see is how a tool escapes the catalogue. */
const ALL: UserContext = {
  auth: { is_super_admin: true, tenant_id: "t", account_id: "a", role: "super_admin" },
  modulePermissions: new Proxy(
    {},
    { get: () => ({ can_view: true, can_create: true, can_edit: true, can_delete: true }) },
  ),
  allowedSensitiveFields: new Set<string>(),
  department: null,
  isSuperAdmin: true,
  canViewPrivate: true,
} as unknown as UserContext;

const registered = toolsFor(ALL);
const registeredNames = registered.map((t) => t.name);

console.log("\n── 1. Every tool is declared, and every declaration is a tool ──");
{
  check(
    `the registry is fully visible to this check (${registeredNames.length} tools)`,
    registeredNames.length >= 40,
  );

  const undeclared = registeredNames.filter((n) => !skillMeta(n));
  check(
    `every registered tool declares a domain and a risk class${undeclared.length ? ` — UNDECLARED: ${undeclared.join(", ")}` : ""}`,
    undeclared.length === 0,
  );

  const orphaned = Object.keys(SKILL_CATALOG).filter((n) => !registeredNames.includes(n));
  check(
    `every declaration corresponds to a registered tool${orphaned.length ? ` — ORPHANED: ${orphaned.join(", ")}` : ""}`,
    orphaned.length === 0,
  );

  const badRisk = Object.entries(SKILL_CATALOG).filter(
    ([, m]) => !(RISK_CLASSES as ReadonlyArray<string>).includes(m.risk),
  );
  const badDomain = Object.entries(SKILL_CATALOG).filter(
    ([, m]) => !(DOMAINS as ReadonlyArray<string>).includes(m.domain),
  );
  check("no declaration uses a class outside §L", badRisk.length === 0);
  check("no declaration uses a domain outside the list", badDomain.length === 0);
  check("skillMeta returns NULL for an unknown tool rather than inventing read_only", skillMeta("noSuchTool") === null);
}

console.log("\n── 2. The classes match what the tools actually do ──");
{
  /* Cross-check the declaration against the registry's OWN metadata, which is
     independent of the catalogue. A tool whose requiredAction is "delete" but
     which is declared read_only is a contradiction one of the two sides has
     wrong, and either way somebody must look. */
  const contradictions: string[] = [];
  for (const t of registered) {
    const m = skillMeta(t.name);
    if (!m) continue;
    const action = (t as { requiredAction?: string }).requiredAction;
    if (action === "delete" && m.risk !== "destructive") {
      contradictions.push(`${t.name}: requiredAction=delete but risk=${m.risk}`);
    }
    if (action === "view" && isWrite(m.risk)) {
      contradictions.push(`${t.name}: requiredAction=view but risk=${m.risk} (a write)`);
    }
  }
  check(
    `no tool's declared class contradicts its registered action${contradictions.length ? ` — ${contradictions.join("; ")}` : ""}`,
    contradictions.length === 0,
  );

  /* Every delete-shaped tool must be destructive. Named individually rather
     than pattern-matched, so renaming one does not quietly drop it. */
  for (const n of ["deleteTodo", "deleteProjectTask", "deletePlanningItem", "deleteCalendarEvent"]) {
    check(`${n} is destructive`, skillMeta(n)?.risk === "destructive");
  }
  check("createQuotationDraft is financial — it writes a commercial document", skillMeta("createQuotationDraft")?.risk === "financial");
  check("search_web is an external side effect, not a write", skillMeta("search_web")?.risk === "external_side_effect");
  check("remember_about_user is a low-risk, self-scoped write", skillMeta("remember_about_user")?.risk === "low_risk_write");
  check("searchProducts is read-only", skillMeta("searchProducts")?.risk === "read_only");

  /* The count is a shape check, not a rule: it fails loudly if a sweeping
     re-classification happens without anyone saying so. */
  const byClass = Object.fromEntries(
    RISK_CLASSES.map((c) => [c, Object.values(SKILL_CATALOG).filter((m) => m.risk === c).length]),
  ) as Record<RiskClass, number>;
  console.log(`      distribution: ${RISK_CLASSES.map((c) => `${c}=${byClass[c]}`).join(" ")}`);
  check(
    "most tools are read-only, and every write class has at least the tools §L names",
    byClass.read_only > 20 && byClass.destructive === 4 && byClass.financial === 1 && byClass.external_side_effect === 1,
  );
}

console.log("\n── 3. The declaration is what the ledger now reads ──");
{
  /* Phase 6A repointed riskClassFor at the catalogue. These are the cases the
     old name-based inference got WRONG — they are the reason the change was
     worth making, so they are asserted individually. */
  check("search_web is no longer misreported as a write", riskClassFor("search_web", "view") === "external_side_effect");
  check("remember_about_user is no longer misreported as high risk", riskClassFor("remember_about_user", "edit") === "low_risk_write");
  check("a delete is still destructive", riskClassFor("deleteTodo", "delete") === "destructive");
  check("a quotation draft is still financial", riskClassFor("createQuotationDraft", "create") === "financial");
  /* calculateQuotationPricing matched /price/i and came back "financial" from
     the old inference, despite writing nothing. It is read_only now. */
  check(
    "a pure pricing CALCULATION is read-only, not financial — it has nothing to confirm",
    riskClassFor("calculateQuotationPricing", "view") === "read_only",
  );

  /* The fallback must stay STRICT. An undeclared tool has to come back as a
     write, never as harmless — that is what makes the catalogue safe to add
     to. */
  check("an UNDECLARED tool falls back to high_risk_write, never read_only", riskClassFor("someBrandNewTool", "create") === "high_risk_write");
  check("and an undeclared delete still falls back to destructive", riskClassFor("deleteSomethingNew", "delete") === "destructive");
}

console.log("\n── 4. §L's confirmation rule, as a function rather than prose ──");
{
  check("high-risk writes require the ledger", requiresLedger("high_risk_write"));
  check("destructive requires the ledger", requiresLedger("destructive"));
  check("financial requires the ledger", requiresLedger("financial"));
  check("security-sensitive requires the ledger", requiresLedger("security_sensitive"));
  check("read-only does NOT", !requiresLedger("read_only"));
  check("low-risk writes do NOT — that is what makes them low risk", !requiresLedger("low_risk_write"));
  check("an external side effect is guarded by egress scanning, not the ledger", !requiresLedger("external_side_effect"));
  check("isWrite separates state changes from reads and egress", isWrite("high_risk_write") && !isWrite("read_only") && !isWrite("external_side_effect"));
}

console.log("\n── 5. Domains partition the registry ──");
{
  const covered = DOMAINS.flatMap((d) => toolsInDomain(d));
  check("every declared tool lands in exactly one domain", covered.length === Object.keys(SKILL_CATALOG).length);
  check("no domain is empty — an unused domain is a taxonomy nobody asked for", DOMAINS.every((d) => toolsInDomain(d).length > 0));
  check("domain filtering returns a real subset, not everything", toolsInDomain("web").length === 1 && toolsInDomain("work").length > 5);
  console.log(`      by domain: ${DOMAINS.map((d) => `${d}=${toolsInDomain(d).length}`).join(" ")}`);
}

console.log("\n── 6. Behaviour is unchanged where it must be ──");
{
  /* 6A moved risk from inference to declaration. That is only safe because
     nothing BRANCHES on risk class — it is written to a column. If a later
     change makes the ledger match on it, this assertion is where that is
     caught. */
  const ledger = readFileSync("src/lib/server/ai/security/pending-actions.ts", "utf8");
  const code = ledger.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const consume = code.slice(code.indexOf("export async function consumePendingAction"));
  check(
    "consumePendingAction does not match on risk_class — so a re-classification cannot invalidate a pending row",
    consume.length > 0 && !/risk_class/.test(consume),
  );
  check(
    "it still matches on the args hash, which is what makes a confirmation unforgeable",
    /args_hash/.test(consume),
  );
}

/* Section 11 awaits. tsx compiles to CJS, where top-level await is
   unavailable, so the remaining sections run inside one async function and the
   summary waits on it — a suite that printed "0 failed" before its async
   checks ran would be the worst possible bug in a test. */
async function asyncChecks() {
  console.log("\n── 7. Per-tool timeouts ──");
  {
    check("every tool has a bound", registeredNames.every((n) => timeoutFor(n) > 0));
    check("the default is generous enough not to trip on a slow day", DEFAULT_TOOL_TIMEOUT_MS >= 10_000);
    check("the only tool that leaves our network gets longer, and is still bounded", timeoutFor("search_web") > DEFAULT_TOOL_TIMEOUT_MS && timeoutFor("search_web") <= 30_000);
    check("an unlisted tool gets the default, never MORE time by accident", timeoutFor("someUnlistedTool") === DEFAULT_TOOL_TIMEOUT_MS);
  }

  console.log("\n── 8. Validation accepts what the tools actually declare ──");
  /* THE CHECK THAT MATTERS MOST BEFORE ENFORCEMENT. If a tool's schema lists a
     property in `required` that is NOT in `properties`, the model is never told
     to send it, never sends it, and the validator reports missing_required on
     EVERY call. Under enforcement that tool would be dead. Reading 45 schemas
     and believing them is not a check; this is. */
  {
    const broken: string[] = [];
    for (const t of registered) {
      const declared = Object.keys(t.parameters?.properties ?? {});
      for (const req of t.parameters?.required ?? []) {
        if (!declared.includes(req)) broken.push(`${t.name}.${req}`);
      }
    }
    check(
      `no tool requires a property it never declares${broken.length ? ` — WOULD REJECT EVERY CALL: ${broken.join(", ")}` : ""}`,
      broken.length === 0,
    );

    /* Same trap one level down, inside array items. */
    const brokenItems: string[] = [];
    for (const t of registered) {
      for (const [pname, prop] of Object.entries(t.parameters?.properties ?? {})) {
        const items = (prop as { items?: { properties?: Record<string, unknown>; required?: string[] } }).items;
        if (!items?.required) continue;
        const declared = Object.keys(items.properties ?? {});
        for (const req of items.required) {
          if (!declared.includes(req)) brokenItems.push(`${t.name}.${pname}[].${req}`);
        }
      }
    }
    check(
      `no array item requires a property it never declares${brokenItems.length ? ` — ${brokenItems.join(", ")}` : ""}`,
      brokenItems.length === 0,
    );

    /* A tool with NO required properties must accept an empty call — several
       tools are invoked with {} and would break under enforcement otherwise. */
    const noRequired = registered.filter((t) => (t.parameters?.required ?? []).length === 0);
    const rejectsEmpty = noRequired.filter((t) => !validateArgs(t.parameters, {}).valid);
    check(
      `every tool with no required arguments accepts an empty call (${noRequired.length} tools)${rejectsEmpty.length ? ` — ${rejectsEmpty.map((t) => t.name).join(", ")}` : ""}`,
      rejectsEmpty.length === 0,
    );

    /* The confirm flag the ledger reads must be ACCEPTED by every tool that can
       receive one, or enforcement would reject the confirmation step itself. */
    const writeTools = registered.filter((t) => {
      const m = skillMeta(t.name);
      return m ? requiresLedger(m.risk) : false;
    });
    const confirmRejected = writeTools.filter((t) => {
      const args: Record<string, unknown> = { confirm: true };
      for (const r of t.parameters?.required ?? []) args[r] = "x";
      return validateArgs(t.parameters, args).issues.some((i) => i.path === "confirm" && isBlocking(i));
    });
    check(
      `confirm:true is never a BLOCKING issue on a ledger-bearing tool (${writeTools.length} checked)${confirmRejected.length ? ` — ${confirmRejected.map((t) => t.name).join(", ")}` : ""}`,
      confirmRejected.length === 0,
    );
  }

  console.log("\n── 9. Validation semantics ──");
  {
    const schema = {
      type: "object" as const,
      properties: {
        name: { type: "string" as const },
        qty: { type: "integer" as const },
        mode: { type: "string" as const, enum: ["a", "b"] },
        lines: {
          type: "array" as const,
          items: { type: "object", properties: { id: { type: "string" as const } }, required: ["id"] },
        },
      },
      required: ["name"],
    };

    check("a valid call passes", validateArgs(schema, { name: "x" }).valid);
    check("a missing required property is blocking", !validateArgs(schema, {}).valid);
    check("a null required property counts as missing", !validateArgs(schema, { name: null }).valid);
    check("a wrong type is blocking", !validateArgs(schema, { name: 5 }).valid);
    check("a non-integer number is caught where an integer is declared", !validateArgs(schema, { name: "x", qty: 1.5 }).valid);
    check("a value outside an enum is blocking", !validateArgs(schema, { name: "x", mode: "z" }).valid);
    check("a value inside the enum passes", validateArgs(schema, { name: "x", mode: "b" }).valid);
    check("array items are checked against their declared shape", !validateArgs(schema, { name: "x", lines: [{}] }).valid);
    check("a valid array item passes", validateArgs(schema, { name: "x", lines: [{ id: "1" }] }).valid);
    check("an absent OPTIONAL property is fine", validateArgs(schema, { name: "x" }).issues.length === 0);

    /* Unknown keys are reported and must NEVER block — models add stray keys,
       and rejecting them would break working calls to fix nothing. */
    const stray = validateArgs(schema, { name: "x", somethingElse: 1 });
    check("an unknown property is reported", stray.issues.some((i) => i.code === "unknown_property"));
    check("but it does NOT make the call invalid", stray.valid);

    /* Nothing is coerced: the checker reports, it does not repair. */
    const args = { name: "x", qty: "5" };
    validateArgs(schema, args);
    check("validation does not mutate or coerce the arguments", args.qty === "5");

    check("a wrong type does not also report every child as broken", validateArgs(schema, { name: "x", lines: "not-an-array" }).issues.length === 1);
  }

  console.log("\n── 10. Mode, and what the log may contain ──");
  {
    check("the default mode is log-only — this phase measures, it does not protect", validationMode() === "log");
    const r = validateArgs(
      { type: "object", properties: { secret: { type: "string" } }, required: ["secret"] },
      { secret: null, extra: "CONFIDENTIAL-CUSTOMER-NAME" },
    );
    const line = formatValidationLine("someTool", r, "log");
    /* The single most important property of this log line. Tool arguments carry
       customer names, product codes and free text; the standing rule against
       logging prompt or reply content applies to them just as much. */
    check(
      `the log line contains NO argument values: ${line.slice(0, 90)}`,
      !line.includes("CONFIDENTIAL-CUSTOMER-NAME"),
    );
    check("it reports the path and the reason, which is what fixes a schema", /secret:missing_required/.test(line));
    check("and it separates blocking issues from advisory ones", /blocking=1/.test(line) && /total=2/.test(line));
    /* Same rule one level in: an issue's own detail must not echo a value
       either, or a caller logging the full list leaks what this line does not. */
    check(
      "no issue's detail echoes an argument value",
      r.issues.every((i) => !i.detail.includes("CONFIDENTIAL-CUSTOMER-NAME")),
    );
  }

  console.log("\n── 11. A timeout behaves like a normal tool failure ──");
  {
    /* Injected timer, so this proves the behaviour without waiting 15 seconds. */
    const fireNow = { set: (fn: () => void) => { fn(); return 1; }, clear: () => {}, now: () => 0 };
    const never = new Promise<string>(() => {});
    const timedOut = await raceTimeout(never, 15_000, fireNow);
    check("a hanging handler times out rather than holding the turn", timedOut.timedOut && timedOut.value === null);

    const neverFires = { set: () => 1, clear: () => {}, now: () => 0 };
    const fast = await raceTimeout(Promise.resolve("done"), 15_000, neverFires);
    check("a fast handler returns its value untouched", !fast.timedOut && fast.value === "done");

    /* An abandoned promise that rejects later must not surface as an unhandled
       rejection — on some runtimes that kills the process. */
    let unhandled = false;
    const onUnhandled = () => { unhandled = true; };
    process.on("unhandledRejection", onUnhandled);
    const rejectsLate = new Promise<string>((_, rej) => setTimeout(() => rej(new Error("late")), 5));
    await raceTimeout(rejectsLate, 15_000, fireNow);
    await new Promise((r) => setTimeout(r, 40));
    process.off("unhandledRejection", onUnhandled);
    check("an abandoned handler that rejects later does not become an unhandled rejection", !unhandled);

    const reg = readFileSync("src/lib/server/ai-agent/tool-registry.ts", "utf8");
    const regCode = reg.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    check("the dispatcher races the handler rather than awaiting it unbounded", /raceTimeout\(tool\.handler\(/.test(regCode));
    check("a timeout produces the same denied ToolResult shape a thrown handler does", /timed out after/.test(reg) && /permissionStatus: "denied"/.test(regCode));
    check("validation runs BEFORE the confirmation ledger, so a malformed confirm never consumes a pending row", regCode.indexOf("validateArgs(tool.parameters") < regCode.indexOf("consumePendingAction({"));
  }

  console.log("\n── 12. The kill-switch, proved by behaviour not by grep (Phase 7) ──");
  /* 4D found that USE_DEEPSEEK did not do what its name says: with the flag
     unset the agent still called DeepSeek. It was left alone because the OLD
     test — `=== "true"` — made an UNSET variable mean DISABLED, so honouring
     it everywhere would have taken the product down wherever the key was set
     without the flag.

     Inverting the default removes that risk without knowing production's
     value, so the switch is global now. The table below is every state an
     environment can be in, and the middle row is a BUG this also fixes. */
  {
    const original = process.env.USE_DEEPSEEK;
    const set = (v: string | undefined) => {
      if (v === undefined) delete process.env.USE_DEEPSEEK;
      else process.env.USE_DEEPSEEK = v;
    };
    try {
      set(undefined);
      check("UNSET means ENABLED — so no environment is newly broken", deepseekEnabled() === true);
      set("");
      check("empty means enabled too — a blank variable is not a decision", deepseekEnabled() === true);
      set("true");
      check('"true" means enabled — the value production almost certainly holds', deepseekEnabled() === true);
      for (const off of ["false", "FALSE", "0", "off", "no", " Off "]) {
        set(off);
        check(`${JSON.stringify(off)} means DISABLED — case and spacing insensitive`, deepseekEnabled() === false);
      }
      set("yes");
      check("an unrecognised value means enabled — a typo must not silently disable the product", deepseekEnabled() === true);
      set(undefined);
      check("the streaming fast lane follows the same one switch", streamingFastLaneEnabled() === deepseekEnabled());
    } finally {
      set(original);
    }
  }
}

void asyncChecks().then(() => {
  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFAILED:");
    for (const f of failures) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log("A new tool without a declared domain and risk class fails this suite — §L rule 5, enforced.");
});
