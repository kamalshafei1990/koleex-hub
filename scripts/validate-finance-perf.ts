#!/usr/bin/env node
/* validate:finance-perf — Phase 4 Wave 2B.1 Finance dashboard performance.
   Deterministic static guards (no DB):
   (A) primary /finance dashboard shows a section skeleton on first load
       instead of blanking below the control bar;
   (B) privacy-safe instrumentation is present and records ONLY durations —
       never balances/revenue/costs/amounts/filters/ids;
   (C) /finance/intelligence has a stale-response guard + timing;
   (D) every finance dashboard endpoint stays auth-gated + Finance-module-gated
       + tenant-scoped (no security regression);
   (E) dead AppHomeMenu import removed from FinanceHome;
   (F) the approvals queue (/api/approvals/**) lets in internal accounts with
       the Finance module only, before anything is read, and a decision stays
       in the caller's tenant and is claimed before it is applied;
   (G) cost data, bank balances, profit and approving come from Roles &
       Permissions only (never the department's name), and the executive
       snapshot and the operational reports open only to internal accounts
       with Finance.
   Run: tsx scripts/validate-finance-perf.ts */
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { stripComments } from "./lib/strip-comments";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p: string) => path.resolve(__dirname, "..", p);
const read = (p: string) => fs.readFileSync(R(p), "utf8");

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.error("  ✗ " + n)); };

const vs = read("src/components/finance/VisualStatements.tsx");
const fd = read("src/components/finance/FinanceDashboard.tsx");
const fh = read("src/components/finance/FinanceHome.tsx");

// ── (A) primary /finance first-load skeleton ──
check("VisualStatements defines a HeroSkeleton + BodySkeleton", /function HeroSkeleton/.test(vs) && /function BodySkeleton/.test(vs));
check("HeroSkeleton renders when snapshot is null (was blank below controls)", /!snap && !error && <HeroSkeleton/.test(vs));
check("BodySkeleton renders when snapshot is null", /!snap && !error && <BodySkeleton/.test(vs));
check("skeletons are reduced-motion-safe", /motion-reduce:animate-none/.test(vs));
check("stale snapshot still shown on refetch (not replaced by skeleton)", /opacity-60/.test(vs));

// ── (B) instrumentation present + privacy-safe ──
check("emits finance.dashboard.first_card_ms", /finance\.dashboard\.first_card_ms/.test(vs));
check("emits finance.dashboard.full_ready_ms", /finance\.dashboard\.full_ready_ms/.test(vs));
check("emits finance.filter.settled_ms", /finance\.filter\.settled_ms/.test(vs));
check("emits finance.dashboard.error", /finance\.dashboard\.error/.test(vs) && /finance\.dashboard\.error/.test(fd));
check("emits finance.dashboard.request_count", /finance\.dashboard\.request_count/.test(vs) && /finance\.dashboard\.request_count/.test(fd));
// no financial values leaked into metrics: the record()/event() call args must not
// reference balances/revenue/amounts/currency/filters as tags.
const metricCalls = [...vs.matchAll(/\b(record|event)\(([^;]*?)\)/g), ...fd.matchAll(/\b(record|event)\(([^;]*?)\)/g)].map((m) => m[2]);
// Drop the metric NAME (the leading quoted string) — only the DATA args (value +
// tags) can leak, and metric names legitimately contain words like "filter".
const dataArgs = metricCalls.map((a) => a.replace(/^\s*["'][^"']*["']\s*,?/, "").trim());
const FORBIDDEN = /revenue|balance|net_?income|net_?profit|amount|cost|payment|supplier|customer|account_number|currency|period_end|\bfilter\b|kpi\.|snap\.|totalRevenue/i;
check("metric DATA args never carry financial values / filters / ids", dataArgs.every((a) => !FORBIDDEN.test(a)));
check("metric DATA args are numeric durations, not record fields", dataArgs.every((a) => a === "" || !/\b(snap|kpi|orders|payments|expenses|treasury|accounts)\b/.test(a)));

// ── (C) intelligence dashboard guard + timing ──
check("FinanceDashboard has a monotonic stale-response guard (kpiSeq)", /kpiSeq/.test(fd) && /seq === kpiSeq\.current/.test(fd));
check("FinanceDashboard records total_ms on first mount", /finance\.dashboard\.total_ms/.test(fd));

// ── (D) security posture unchanged (endpoints gated + tenant-scoped) ──
const endpoints = [
  "src/app/api/finance/visual-statements/route.ts",
  "src/app/api/finance/dashboard/route.ts",
  "src/app/api/finance/orders/route.ts",
  "src/app/api/finance/payments/route.ts",
  "src/app/api/finance/expenses/route.ts",
  "src/app/api/finance/treasury/route.ts",
  "src/app/api/finance/reconciliation/candidates/route.ts",
  "src/app/api/finance/bank-imports/route.ts",
  "src/app/api/finance/treasury-plans/route.ts",
];
for (const e of endpoints) {
  const src = read(e);
  const name = e.split("/finance/")[1].replace("/route.ts", "");
  check(`endpoint ${name}: requireAuth`, /requireAuth\(\)/.test(src));
  check(`endpoint ${name}: Finance module gate`, /requireModuleAccess\(auth, "Finance"\)/.test(src));
  check(`endpoint ${name}: tenant-scoped`, /auth\.tenant_id/.test(src));
}

// ── (E) dead import removed ──
check("FinanceHome no longer imports the never-rendered AppHomeMenu", !/AppHomeMenu/.test(fh));

// ── (F) the approvals queue: internal accounts with Finance, door first ──
/* /api/approvals checked only that the caller was signed in: any account read
   the tenant's whole pending finance queue (amounts, references, parties) and
   its activity log, and could move any draft to 'submitted' (found 25 Sep
   2026). These rules hold the fix. Each passes on the real file AND catches a
   copy that breaks it, for the reason it names — a guard that never bites
   protects nothing (the shape of validate:attendance). Comments are stripped
   first, so a commented-out gate counts as no gate. */
const ROUTE = "src/app/api/approvals/route.ts";
const ACTIVITY = "src/app/api/approvals/activity/route.ts";
const GATE = "src/lib/approvals/gate.ts";
const LIB = "src/lib/approvals/index.ts";
const code = (src: string) => stripComments(src);
/** Replace exactly one occurrence. Anything else returns the source unchanged,
 *  which rule() reports: a mutation that silently misses is a test that lies. */
const once = (s: string, from: string, to: string) => {
  const parts = s.split(from);
  return parts.length === 2 ? parts.join(to) : s;
};
type Mutant = { label: string; mutate: (src: string) => string; caught: RegExp };
function rule(name: string, file: string, problemsOf: (c: string) => string[], mutants: Mutant[]) {
  const src = read(file);
  const real = problemsOf(code(src));
  check(`${name}${real.length ? ` — ${real.join("; ")}` : ""}`, real.length === 0);
  for (const m of mutants) {
    const mutated = m.mutate(src);
    if (mutated === src) { check(`    mutant "${m.label}" applies (if not, update the guard)`, false); continue; }
    const got = problemsOf(code(mutated));
    const hit = got.some((x) => m.caught.test(x));
    check(`    caught: ${m.label}${hit ? "" : ` — got ${JSON.stringify(got)}`}`, hit);
  }
}
/** Each exported handler: its verb, and its body up to the next handler. */
function handlers(c: string): Array<{ verb: string; body: string }> {
  const parts = c.split(/export async function (GET|POST|PATCH|PUT|DELETE)\b/).slice(1);
  const out: Array<{ verb: string; body: string }> = [];
  for (let i = 0; i < parts.length; i += 2) out.push({ verb: parts[i], body: parts[i + 1] ?? "" });
  return out;
}
const bodyOf = (c: string, verb: string) => handlers(c).find((h) => h.verb === verb)?.body ?? "";

/* Reads of the queue, the activity log, the caller's finance permissions or
   the request body. None may run before the door has said yes. */
const APPROVALS_DATA = /\b(listPending|listActivity|transitionApproval|getUserExperience|canApproveFinance|canSeeBankAndProfit)\(|\bsupabaseServer\.|\breq\.json\(/;
/** requireAuth → requireApprovalsAccess(view for GET, create for writes) →
 *  return if denied, in that order, before any read. Order within the handler,
 *  never adjacency, so an unrelated line added in between does not trip it. */
function doorProblems(c: string): string[] {
  const p: string[] = [];
  const hs = handlers(c);
  if (hs.length === 0) p.push("no handlers found");
  for (const { verb, body } of hs) {
    const want = verb === "GET" ? "view" : "create";
    const bounceAt = body.search(/^\s*if \(auth instanceof NextResponse\) return auth;/m);
    const gate = /^\s*const denied = await requireApprovalsAccess\(auth, "(\w+)"\);/m.exec(body);
    const deniedAt = body.search(/^\s*if \(denied\) return denied;/m);
    const dataAt = body.search(APPROVALS_DATA);
    if (!/^\s*const auth = await requireAuth\((req)?\);/m.test(body) || bounceAt < 0) p.push(`${verb} does not stop at requireAuth`);
    if (verb !== "GET" && !/requireAuth\(req\)/.test(body)) p.push(`${verb} does not pass req to requireAuth`);
    if (!gate) { p.push(`${verb} does not call requireApprovalsAccess`); continue; }
    if (gate[1] !== want) p.push(`${verb} asks the door for ${gate[1]}, not ${want}`);
    if (deniedAt < 0) { p.push(`${verb} ignores the door's answer`); continue; }
    if (!(bounceAt < gate.index && gate.index < deniedAt)) p.push(`${verb}: requireAuth → door → return is out of order`);
    if (dataAt >= 0 && dataAt < deniedAt) p.push(`${verb} reads before the door has said yes`);
  }
  return p;
}
/* Every route under the directory, so a route added there later is held to
   the same door without anyone remembering to list it. */
function routesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(R(dir))) {
    const rel = `${dir}/${name}`;
    if (fs.statSync(R(rel)).isDirectory()) out.push(...routesUnder(rel));
    else if (name === "route.ts") out.push(rel);
  }
  return out;
}
const APPROVALS_ROUTES = routesUnder("src/app/api/approvals");
check(`approvals routes found: ${APPROVALS_ROUTES.length} (the queue and its activity at least)`,
  APPROVALS_ROUTES.includes(ROUTE) && APPROVALS_ROUTES.includes(ACTIVITY));
for (const r of APPROVALS_ROUTES) {
  const p = doorProblems(code(read(r)));
  check(`${r}: every handler passes the door before it reads${p.length ? ` — ${p.join("; ")}` : ""}`, p.length === 0);
}
rule("the door check bites", ROUTE, doorProblems, [
  { label: "the queue's GET without the door", caught: /GET does not call requireApprovalsAccess/,
    mutate: (s) => once(s, '  const denied = await requireApprovalsAccess(auth, "view");\n  if (denied) return denied;\n', "") },
  { label: "a POST that asks only for view", caught: /POST asks the door for view, not create/,
    mutate: (s) => once(s, 'const denied = await requireApprovalsAccess(auth, "create");', 'const denied = await requireApprovalsAccess(auth, "view");') },
  { label: "a POST that reads the body before the door", caught: /POST reads before the door/,
    mutate: (s) => once(s,
      '  const denied = await requireApprovalsAccess(auth, "create");\n  if (denied) return denied;\n\n  const body = (await req.json().catch(() => null)) as PostBody | null;\n',
      '  const body = (await req.json().catch(() => null)) as PostBody | null;\n  const denied = await requireApprovalsAccess(auth, "create");\n  if (denied) return denied;\n\n') },
  { label: "a POST that does not pass req (view-as must stay read-only)", caught: /POST does not pass req/,
    mutate: (s) => once(s, "requireAuth(req)", "requireAuth()") },
]);
rule("the door check bites on the activity too", ACTIVITY, doorProblems, [
  { label: "a door that is commented out", caught: /GET does not call requireApprovalsAccess/,
    mutate: (s) => once(s, '  const denied = await requireApprovalsAccess(auth, "view");', '  // const denied = await requireApprovalsAccess(auth, "view");') },
  { label: "a door whose answer is ignored", caught: /GET ignores the door's answer/,
    mutate: (s) => once(s, "  if (denied) return denied;\n", "") },
]);

rule("the door refuses non-internal accounts, then asks Finance", GATE, (c) => {
  const at = c.indexOf("export async function requireApprovalsAccess(");
  if (at < 0) return ["requireApprovalsAccess is gone"];
  const fn = c.slice(at);
  const p: string[] = [];
  const refuseAt = fn.search(/^\s*if \(auth\.user_type !== "internal"\) \{\s*return NextResponse\.json\(/m);
  const viewAt = fn.indexOf('requireModuleAccess(auth, "Finance")');
  const actAt = fn.indexOf('requireModuleAction(auth, "Finance", action)');
  if (refuseAt < 0) p.push("a non-internal account is not refused");
  if (viewAt < 0) p.push('view does not ask requireModuleAccess(auth, "Finance")');
  if (actAt < 0) p.push('create does not ask requireModuleAction(auth, "Finance", action)');
  if (refuseAt >= 0 && [viewAt, actAt].some((i) => i >= 0 && i < refuseAt)) p.push("Finance is asked before non-internal accounts are refused");
  if ((c.match(/export async function/g) ?? []).length !== 1) p.push("gate.ts exports more than the one door");
  if (!/^import "server-only";/m.test(c)) p.push("gate.ts is not server-only");
  return p;
}, [
  { label: "customers let through", caught: /a non-internal account is not refused/,
    mutate: (s) => once(s, 'if (auth.user_type !== "internal") {', 'if (auth.user_type === "nobody") {') },
  { label: "a door that asks another module", caught: /view does not ask requireModuleAccess\(auth, "Finance"\)/,
    mutate: (s) => once(s, 'requireModuleAccess(auth, "Finance")', 'requireModuleAccess(auth, "Expenses")') },
]);

rule("can_approve asks the same door the POST will", ROUTE, (c) => {
  const get = bodyOf(c, "GET");
  const p: string[] = [];
  if (!/requireApprovalsAccess\(auth, "create"\)/.test(get)) p.push("GET does not ask the POST's door");
  if (!/^\s*canApproveFinance\(auth\),/m.test(get)) p.push("GET does not ask «Finance Approvals»");
  if (!/can_approve: approver && moveDenied === null/.test(get)) p.push("can_approve is not «Finance Approvals» AND the POST's door");
  return p;
}, [
  { label: "can_approve from the approver row alone", caught: /can_approve is not «Finance Approvals» AND/,
    mutate: (s) => once(s, " && moveDenied === null", "") },
]);

rule("a decision is checked before the write", ROUTE, (c) => {
  const post = bodyOf(c, "POST");
  const writeAt = post.search(/\btransitionApproval\(/);
  if (writeAt < 0) return ["POST no longer calls transitionApproval"];
  const p: string[] = [];
  const knownAt = post.search(/!isApprovalEntity\(body\.entity\) \|\| !isApprovalAction\(body\.action\)/);
  const costAt = post.search(/COST_SENSITIVE_KINDS\.has\(body\.entity\) && !canSeeCostData\(auth\)/);
  const approverAt = post.search(/\(body\.action === "approve" \|\| body\.action === "reject"\) && !\(await canApproveFinance\(auth\)\)/);
  if (knownAt < 0 || knownAt > writeAt) p.push("entity and action are not checked against the known lists before the write");
  if (costAt < 0 || costAt > writeAt) p.push("a role that cannot see cost data can move a bill or journal");
  if (approverAt < 0 || approverAt > writeAt) p.push("approve and reject do not both need «Finance Approvals» before the write");
  if (!/tenantId: auth\.tenant_id/.test(post)) p.push("the tenant does not come from the session");
  return p;
}, [
  { label: "reject without the approver check", caught: /approve and reject do not both need «Finance Approvals»/,
    mutate: (s) => once(s, '(body.action === "approve" || body.action === "reject")', '(body.action === "approve")') },
  { label: "a bill moved by a role that cannot see it", caught: /cannot see cost data can move/,
    mutate: (s) => once(s, "COST_SENSITIVE_KINDS.has(body.entity) && !canSeeCostData(auth)", "false") },
  { label: "the tenant taken from the body", caught: /the tenant does not come from the session/,
    mutate: (s) => once(s, "tenantId: auth.tenant_id", "tenantId: String(body.tenantId)") },
  { label: "any string accepted as an entity", caught: /not checked against the known lists/,
    mutate: (s) => once(s, "!isApprovalEntity(body.entity) || ", "") },
]);

rule("the queue and its activity hide what the caller cannot see", ROUTE, (c) =>
  /const kinds = new Set\(visibleKinds\(canSeeCostData\(auth\)\)\);/.test(bodyOf(c, "GET")) &&
  /items: items\.filter\(\(i\) => kinds\.has\(i\.kind\)\)/.test(bodyOf(c, "GET"))
    ? [] : ["the queue shows kinds the caller cannot see"], [
  { label: "the queue unfiltered", caught: /the queue shows kinds/,
    mutate: (s) => once(s, "items: items.filter((i) => kinds.has(i.kind)),", "items,") },
]);
rule("the activity is capped and filtered like the queue", ACTIVITY, (c) => {
  const get = bodyOf(c, "GET");
  const p: string[] = [];
  const max = Number(/const ACTIVITY_LIMIT_MAX = (\d+);/.exec(c)?.[1]);
  if (!(max > 0 && max <= 500)) p.push("no sane ACTIVITY_LIMIT_MAX");
  if (!/Math\.min\(asked, ACTIVITY_LIMIT_MAX\)/.test(get)) p.push("the limit is not capped");
  if (!/kinds: visibleKinds\(canSeeCostData\(auth\)\)/.test(get)) p.push("the activity shows kinds the caller cannot see");
  return p;
}, [
  { label: "an uncapped limit", caught: /the limit is not capped/,
    mutate: (s) => once(s, "Math.min(asked, ACTIVITY_LIMIT_MAX)", "asked") },
  { label: "every kind to every role", caught: /the activity shows kinds/,
    mutate: (s) => once(s, "    kinds: visibleKinds(canSeeCostData(auth)),\n", "") },
]);

rule("the cost-sensitive kinds are one list, applied in the query", LIB, (c) => {
  const p: string[] = [];
  if (!/COST_SENSITIVE_KINDS: ReadonlySet<ApprovalEntity> = new Set<ApprovalEntity>\(\["bill", "journal"\]\)/.test(c)) p.push("bills and journals are not both cost-sensitive");
  if (!/return APPROVAL_ENTITIES\.filter\(\(k\) => canSeeCostData \|\| !COST_SENSITIVE_KINDS\.has\(k\)\)/.test(c)) p.push("visibleKinds does not drop the cost-sensitive kinds");
  if (!/if \(opts\.kinds\)\s+q = q\.in\("entity_kind", opts\.kinds\);/.test(c)) p.push("listActivity does not filter by kinds in the query");
  if (!/export function isApprovalEntity\(v: unknown\): v is ApprovalEntity \{\s*return typeof v === "string" && Object\.hasOwn\(TABLE, v\);/.test(c)) p.push("isApprovalEntity is not an own-key check");
  return p;
}, [
  { label: "a bill no longer cost-sensitive", caught: /not both cost-sensitive/,
    mutate: (s) => once(s, '["bill", "journal"]', '["journal"]') },
  { label: "kinds dropped from the activity query", caught: /does not filter by kinds/,
    mutate: (s) => once(s, '  if (opts.kinds)    q = q.in("entity_kind", opts.kinds);\n', "") },
  { label: "an inherited key taken for a table", caught: /not an own-key check/,
    mutate: (s) => once(s, "Object.hasOwn(TABLE, v)", "v in TABLE") },
]);

rule("a transition stays in the tenant and claims the row", LIB, (c) => {
  const at = c.indexOf("export async function transitionApproval(");
  if (at < 0) return ["transitionApproval is gone"];
  const fn = c.slice(at, c.indexOf("\n}\n", at));
  const p: string[] = [];
  const guardAt = fn.search(/^\s*if \(!isApprovalEntity\(input\.entity\)\) return/m);
  const lookupAt = fn.indexOf("TABLE[input.entity]");
  if (guardAt < 0 || lookupAt < 0 || guardAt > lookupAt) p.push("the table lookup is not behind isApprovalEntity");
  if (!/\.select\("id, approval_status"\)\.eq\("id", input\.entityId\)\.eq\("tenant_id", input\.tenantId\)/.test(fn)) p.push("the read is not scoped to the caller's tenant");
  if (!/\.update\(patch\)\.eq\("id", input\.entityId\)\.eq\("tenant_id", input\.tenantId\)/.test(fn)) p.push("the write is not scoped to the caller's tenant");
  if (!/claim\.eq\("approval_status", readStatus\)/.test(fn) || !/claim\.is\("approval_status", null\)/.test(fn)) p.push("the write does not claim the status it was decided from");
  const lostAt = fn.search(/\(upd\.data \?\? \[\]\)\.length === 0\) \{\s*return \{ ok: false,[^}]*code: 409 \}/);
  const logAt = fn.search(/\blogActivity\(/);
  if (lostAt < 0) p.push("a lost claim is not a 409");
  else if (logAt >= 0 && logAt < lostAt) p.push("the activity is logged before the claim is checked");
  return p;
}, [
  { label: "a write outside the caller's tenant", caught: /the write is not scoped/,
    mutate: (s) => once(s, '.update(patch).eq("id", input.entityId).eq("tenant_id", input.tenantId)', '.update(patch).eq("id", input.entityId)') },
  { label: "two reviewers both deciding (no claim)", caught: /does not claim/,
    mutate: (s) => once(s, 'claim.eq("approval_status", readStatus)', "claim") },
  { label: "a lost claim logged as a decision", caught: /a lost claim is not a 409/,
    mutate: (s) => once(s, "  if ((upd.data ?? []).length === 0) {", "  if (false) {") },
  { label: "the lookup before the own-key check", caught: /not behind isApprovalEntity/,
    mutate: (s) => once(s, "  if (!isApprovalEntity(input.entity)) return", "  if (!input.entity) return") },
]);

// ── (G) cost, bank, profit and approving come from Roles & Permissions ──
/* `dashboard_role` — a label guessed from koleex_employees.department by
   keyword regexes tried in order — decided who saw cost data, bank balances
   and profit and who approved: "Executive Office" → ceo, "Administration &
   Office" → marketing (`\bad`), "Project Management" → ceo (`manag`). A
   text field HR fills in, and the Roles page said nothing about it. The
   role-mode preview also re-read the super admin's own account row and showed
   every role with super-admin visibility (found 25 Sep 2026; owner's pick
   26 Sep). What holds the replacement: cost is the role's «private records»
   switch, bank + profit is «Bank & Profit», approving is «Finance Approvals»,
   and the two routes that only checked a sign-in now pass the finance-numbers
   door (internal + Finance) first. Same shape as §F: each rule passes on the
   real file and catches a copy broken for the reason it names. */
const EXP = "src/lib/experience/index.ts";
const PMOD = "src/lib/permission-modules.ts";
const INV = "src/app/api/inventory/items/route.ts";
const WSP = "src/app/api/finance/workspace/route.ts";
const EXEC = "src/app/api/executive/snapshot/route.ts";
const OPS = "src/app/api/reports/operational/route.ts";
/** An exported function's text, from its signature to its closing brace. */
function fnBody(c: string, name: string): string {
  const at = c.search(new RegExp(`^export (?:async )?function ${name}(?:<[^>]*>)?\\(`, "m"));
  if (at < 0) return "";
  const end = c.indexOf("\n}\n", at);
  return c.slice(at, end < 0 ? undefined : end);
}

rule("cost, bank, profit and approving come from Roles & Permissions — never the department", EXP, (c) => {
  const p: string[] = [];
  if (/\bdepartment\b/.test(c)) p.push("the experience layer reads the department");
  if (/\bpreferences\b/.test(c)) p.push("the experience layer reads a preference");
  if (/\.from\(|\bsupabaseServer\b/.test(c)) p.push("the experience layer reads a row itself instead of the session context and requireModuleAccess");
  if (!c.includes('import { BANK_PROFIT_MODULE, FINANCE_APPROVALS_MODULE } from "@/lib/permission-modules";')) p.push("the rows' names do not come from the Roles registry");
  if (!/^export function canSeeCostData\(auth: ServerAuthContext\): boolean \{\s*return canViewPrivate\(auth\);\s*$/.test(fnBody(c, "canSeeCostData"))) p.push("cost is not the role's «private records» switch alone");
  if (!/^export async function canSeeBankAndProfit\(auth: ServerAuthContext\): Promise<boolean> \{\s*return auth\.is_super_admin \|\| \(await requireModuleAccess\(auth, BANK_PROFIT_MODULE\)\) === null;\s*$/.test(fnBody(c, "canSeeBankAndProfit"))) p.push("bank and profit do not ask «Bank & Profit» alone");
  if (!/^export async function canApproveFinance\(auth: ServerAuthContext\): Promise<boolean> \{\s*return auth\.is_super_admin \|\| \(await requireModuleAccess\(auth, FINANCE_APPROVALS_MODULE\)\) === null;\s*$/.test(fnBody(c, "canApproveFinance"))) p.push("approving does not ask «Finance Approvals» alone");
  const door = fnBody(c, "requireFinanceNumbers");
  const refuseAt = door.search(/^\s*if \(auth\.user_type !== "internal"\) \{\s*return NextResponse\.json\(/m);
  const financeAt = door.search(/^\s*return requireModuleAccess\(auth, "Finance"\);/m);
  if (refuseAt < 0) p.push("the finance-numbers door lets a non-internal account in");
  if (financeAt < 0) p.push("the finance-numbers door does not ask Finance");
  else if (refuseAt > financeAt) p.push("the finance-numbers door asks Finance before refusing a non-internal account");
  const all = fnBody(c, "getUserExperience");
  for (const line of ["canSeeBankAndProfit(auth),", "canApproveFinance(auth),", "can_see_cost_data: canSeeCostData(auth),", "can_see_bank_balances: bankAndProfit,", "can_see_profit: bankAndProfit,", "can_approve: approve,", "is_super_admin: auth.is_super_admin,"]) {
    if (!all.includes(line)) { p.push("getUserExperience does not report the helpers' answers"); break; }
  }
  return p;
}, [
  { label: "an approver by the department's name again", caught: /the experience layer reads the department/,
    mutate: (s) => once(s, "export async function canApproveFinance(auth: ServerAuthContext): Promise<boolean> {\n",
      'export async function canApproveFinance(auth: ServerAuthContext): Promise<boolean> {\n  if (/exec|manag/i.test(auth.department ?? "")) return true;\n') },
  { label: "a preview that re-reads the super admin's own row", caught: /reads a row itself/,
    mutate: (s) => once(s, "export async function getUserExperience(auth: ServerAuthContext): Promise<UserExperience> {\n",
      'export async function getUserExperience(auth: ServerAuthContext): Promise<UserExperience> {\n  const { data: row } = await supabaseServer.from("accounts").select("is_super_admin").eq("id", auth.account_id).maybeSingle();\n') },
  { label: "cost for everyone", caught: /cost is not the role's «private records» switch/,
    mutate: (s) => once(s, "  return canViewPrivate(auth);\n", "  return true;\n") },
  { label: "bank and profit behind the approvals row", caught: /bank and profit do not ask «Bank & Profit»/,
    mutate: (s) => once(s, "requireModuleAccess(auth, BANK_PROFIT_MODULE)", "requireModuleAccess(auth, FINANCE_APPROVALS_MODULE)") },
  { label: "an approver without the row", caught: /approving does not ask «Finance Approvals»/,
    mutate: (s) => once(s, "return auth.is_super_admin || (await requireModuleAccess(auth, FINANCE_APPROVALS_MODULE)) === null;", "return true;") },
  { label: "a customer through the finance-numbers door", caught: /lets a non-internal account in/,
    mutate: (s) => once(s, 'if (auth.user_type !== "internal") {', 'if (auth.user_type === "nobody") {') },
  { label: "profit reported from the cost switch", caught: /getUserExperience does not report/,
    mutate: (s) => once(s, "    can_see_profit: bankAndProfit,\n", "    can_see_profit: canSeeCostData(auth),\n") },
]);

rule("«Bank & Profit» and «Finance Approvals» are Roles rows, right under Finance", PMOD, (c) => {
  const p: string[] = [];
  if (!c.includes('export const BANK_PROFIT_MODULE = "Bank & Profit";')) p.push("«Bank & Profit» is not named in the registry");
  if (!c.includes('export const FINANCE_APPROVALS_MODULE = "Finance Approvals";')) p.push("«Finance Approvals» is not named in the registry");
  const at = c.indexOf("export const CAPABILITY_MODULES");
  const list = at < 0 ? "" : c.slice(at, c.indexOf("];", at));
  if (!list.includes('{ name: BANK_PROFIT_MODULE, app: "Finance" }')) p.push("«Bank & Profit» is not a Roles row under Finance");
  if (!list.includes('{ name: FINANCE_APPROVALS_MODULE, app: "Finance" }')) p.push("«Finance Approvals» is not a Roles row under Finance");
  return p;
}, [
  { label: "the approvals row dropped", caught: /«Finance Approvals» is not a Roles row/,
    mutate: (s) => once(s, '  { name: FINANCE_APPROVALS_MODULE, app: "Finance" },\n', "") },
  { label: "bank & profit filed under another app", caught: /«Bank & Profit» is not a Roles row under Finance/,
    mutate: (s) => once(s, '{ name: BANK_PROFIT_MODULE, app: "Finance" }', '{ name: BANK_PROFIT_MODULE, app: "Reports" }') },
]);

/* The executive snapshot and the operational reports checked only a sign-in:
   any account, a customer login included, read the revenue, receivables, top
   customers and the sales / customers / suppliers reports. requireAuth →
   requireFinanceNumbers → return, in that order, before anything is built. */
const NUMBERS_DATA = /\b(build\w+Report|buildExecutiveSnapshot|canSeeBankAndProfit|getUserExperience)\(|\bsupabaseServer\./;
function numbersDoorProblems(c: string): string[] {
  const p: string[] = [];
  const hs = handlers(c);
  if (hs.length === 0) p.push("no handlers found");
  for (const { verb, body } of hs) {
    const bounceAt = body.search(/^\s*if \(auth instanceof NextResponse\) return auth;/m);
    const gateAt = body.search(/^\s*const denied = await requireFinanceNumbers\(auth\);/m);
    const deniedAt = body.search(/^\s*if \(denied\) return denied;/m);
    const dataAt = body.search(NUMBERS_DATA);
    if (!/^\s*const auth = await requireAuth\(\);/m.test(body) || bounceAt < 0) p.push(`${verb} does not stop at requireAuth`);
    if (gateAt < 0) { p.push(`${verb} does not call requireFinanceNumbers`); continue; }
    if (deniedAt < 0) { p.push(`${verb} ignores the door's answer`); continue; }
    if (!(bounceAt < gateAt && gateAt < deniedAt)) p.push(`${verb}: requireAuth → door → return is out of order`);
    if (dataAt >= 0 && dataAt < deniedAt) p.push(`${verb} reads before the door has said yes`);
  }
  return p;
}
for (const r of [EXEC, OPS]) {
  const p = numbersDoorProblems(code(read(r)));
  check(`${r}: every handler passes the finance-numbers door before it reads${p.length ? ` — ${p.join("; ")}` : ""}`, p.length === 0);
}
rule("the finance-numbers door bites on the executive snapshot", EXEC, numbersDoorProblems, [
  { label: "the snapshot for anyone signed in", caught: /GET does not call requireFinanceNumbers/,
    mutate: (s) => once(s, "  const denied = await requireFinanceNumbers(auth);\n  if (denied) return denied;\n", "") },
  { label: "the snapshot built before the door", caught: /GET reads before the door/,
    mutate: (s) => once(s, "  const denied = await requireFinanceNumbers(auth);\n",
      "  const early = await buildExecutiveSnapshot(auth.tenant_id);\n  const denied = await requireFinanceNumbers(auth);\n") },
]);
rule("the finance-numbers door bites on the operational reports", OPS, numbersDoorProblems, [
  { label: "a door that is commented out", caught: /GET does not call requireFinanceNumbers/,
    mutate: (s) => once(s, "  const denied = await requireFinanceNumbers(auth);", "  // const denied = await requireFinanceNumbers(auth);") },
  { label: "a door whose answer is ignored", caught: /GET ignores the door's answer/,
    mutate: (s) => once(s, "  if (denied) return denied;\n", "") },
]);

rule("the inventory list masks cost unless the «private records» switch", INV, (c) => {
  const get = bodyOf(c, "GET");
  const p: string[] = [];
  if (!/const canSeeCost = canSeeCostData\(auth\);/.test(get)) p.push("the inventory list does not ask canSeeCostData");
  if (!/const masked = canSeeCost\s*\?\s*items\s*:\s*items\.map\(\(it\) => \(\{ \.\.\.it, cost_price: null, avg_cost: 0, inventory_value: 0 \}\)\);/.test(get)) p.push("the inventory list does not mask cost_price, avg_cost and inventory_value");
  if (!/\{ items: masked, can_see_cost_data: canSeeCost \}/.test(get)) p.push("the inventory list sends unmasked items");
  return p;
}, [
  { label: "cost for every Inventory viewer", caught: /does not ask canSeeCostData/,
    mutate: (s) => once(s, "const canSeeCost = canSeeCostData(auth);", "const canSeeCost = true;") },
  { label: "the average cost left on the wire", caught: /does not mask cost_price, avg_cost and inventory_value/,
    mutate: (s) => once(s, "cost_price: null, avg_cost: 0, inventory_value: 0", "cost_price: null, inventory_value: 0") },
]);

rule("the workspace hides bank balances unless «Bank & Profit»", WSP, (c) => {
  const get = bodyOf(c, "GET");
  const p: string[] = [];
  if (!/^\s*canSeeBankAndProfit\(auth\),/m.test(get)) p.push("the workspace does not ask «Bank & Profit»");
  if (!/if \(!bankAndProfit\) \{\s*snapshot\.banks = snapshot\.banks\.map\(\(b\) => \(\{ \.\.\.b, current_balance: 0 \}\)\);/.test(get)) p.push("the workspace sends bank balances to every Finance viewer");
  if (!/can_see_bank_balances: bankAndProfit,\s*can_see_profit: bankAndProfit,/.test(get)) p.push("the workspace reports other flags than it applied");
  return p;
}, [
  { label: "balances for every Finance viewer", caught: /sends bank balances to every Finance viewer/,
    mutate: (s) => once(s, "if (!bankAndProfit) {", "if (false) {") },
]);

rule("the executive snapshot hides profit, cash and the inventory value by the Roles answers", EXEC, (c) => {
  const get = bodyOf(c, "GET");
  const p: string[] = [];
  if (!/^\s*canSeeBankAndProfit\(auth\),/m.test(get)) p.push("the snapshot does not ask «Bank & Profit»");
  if (!/const cost = canSeeCostData\(auth\);/.test(get)) p.push("the snapshot does not ask canSeeCostData");
  const bp = /if \(!bankAndProfit\) \{([\s\S]*?)\n    \}/.exec(get)?.[1] ?? "";
  for (const f of ["kpis.gross_profit.value = 0", "kpis.net_profit.value = 0", "m.gross_profit = 0", "m.net_profit = 0", "m.cogs = 0", "kpis.cash_position.value = 0"]) {
    if (!bp.includes(f)) p.push(`the snapshot shows ${f.replace(/ = 0$/, "")} without «Bank & Profit»`);
  }
  const cb = /if \(!cost\) \{([\s\S]*?)\n    \}/.exec(get)?.[1] ?? "";
  for (const f of ["kpis.inventory.value = 0", "inventory_intel.highest_value = []"]) {
    if (!cb.includes(f)) p.push(`the snapshot shows ${f.replace(/ = (0|\[\])$/, "")} without cost data`);
  }
  if (!/can_see_profit: bankAndProfit,\s*can_see_cost_data: cost,\s*can_see_bank_balances: bankAndProfit,/.test(get)) p.push("the snapshot reports other flags than it applied");
  return p;
}, [
  { label: "the cash position for everyone", caught: /shows kpis\.cash_position\.value without «Bank & Profit»/,
    mutate: (s) => once(s, "      snapshot.kpis.cash_position.value = 0;\n", "") },
  { label: "the inventory value for everyone", caught: /shows kpis\.inventory\.value without cost data/,
    mutate: (s) => once(s, "      snapshot.kpis.inventory.value = 0;\n", "") },
]);

rule("the operational cost reports need the «private records» switch", OPS, (c) =>
  /if \(RESTRICTED\.has\(kind\) && !canSeeCostData\(auth\)\) \{/.test(bodyOf(c, "GET")) &&
  /const RESTRICTED = new Set\(\["purchases", "expenses", "inventory"\]\);/.test(c)
    ? [] : ["a cost report is open without cost data"], [
  { label: "the inventory report without the switch", caught: /a cost report is open/,
    mutate: (s) => once(s, '["purchases", "expenses", "inventory"]', '["purchases", "expenses"]') },
]);

/* Hub-wide: the guess's names are gone from every source file, so it cannot
   come back somewhere this section does not list. A comment may tell the
   story; code may not use it. */
const GUESS = /\b(dashboard_role|DashboardRole|inferDashboardRole|DEPARTMENT_KEYWORDS)\b/;
const guessProblems = (c: string) => { const m = GUESS.exec(c); return m ? [`uses ${m[1]}`] : []; };
function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const ent of fs.readdirSync(R(dir), { withFileTypes: true })) {
    const rel = `${dir}/${ent.name}`;
    if (ent.isDirectory()) out.push(...sourcesUnder(rel));
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(rel);
  }
  return out;
}
const SOURCES = sourcesUnder("src");
const guessUsers = SOURCES.filter((f) => { const raw = read(f); return GUESS.test(raw) && guessProblems(code(raw)).length > 0; });
check(`no source file decides from the department guess (${SOURCES.length} files)${guessUsers.length ? ` — ${guessUsers.join(", ")}` : ""}`,
  SOURCES.length > 500 && guessUsers.length === 0);
rule("the department guess cannot come back", EXEC, guessProblems, [
  { label: "a route that reads dashboard_role again", caught: /uses dashboard_role/,
    mutate: (s) => once(s, "    const cost = canSeeCostData(auth);\n",
      '    const cost = canSeeCostData(auth) || (auth as { dashboard_role?: string }).dashboard_role === "ceo";\n') },
]);

/* The same rule where the same numbers were still going out (owner, 26 Sep
   2026): the bank accounts sent every balance to anyone with Finance, and the
   valuations every cost to anyone with Inventory. A caller without the right
   now gets the rows with those fields at 0 and a flag (balances_hidden /
   cost_hidden) the screens turn into «•••». And because an edit form sends
   the whole row back, zeros included, the bank-account writers drop the
   balance fields for such a caller — can't read → can't write. */
const BA = "src/app/api/finance/bank-accounts/route.ts";
const BA_ID = "src/app/api/finance/bank-accounts/[id]/route.ts";
const BA_ARCHIVE = "src/app/api/finance/bank-accounts/[id]/archive/route.ts";
const BA_PRIMARY = "src/app/api/finance/bank-accounts/[id]/set-primary/route.ts";
const BA_DIALOG = "src/components/finance/FinanceBankAccounts.dialogs.tsx";
const VAL = "src/app/api/inventory/valuation/route.ts";
const VAL_ITEM = "src/app/api/inventory/items/[id]/valuation/route.ts";

rule("the hiding helpers zero every balance and cost field and say so", EXP, (c) => {
  const p: string[] = [];
  const list = (name: string) => /\[([^\]]*)\]/.exec(c.slice(c.indexOf(`export const ${name} =`)))?.[1] ?? "";
  for (const f of ["opening_balance", "current_balance", "available_balance", "pending_balance", "restricted_balance", "ledger_balance", "ledger_base", "ledger_difference"]) {
    if (!list("BANK_BALANCE_FIELDS").includes(`"${f}"`)) p.push(`the bank balance fields miss ${f}`);
  }
  for (const f of ["opening_balance", "available_balance", "pending_balance", "restricted_balance"]) {
    if (!list("BANK_BALANCE_INPUTS").includes(`"${f}"`)) p.push(`the bank balance inputs miss ${f}`);
  }
  for (const f of ["cost_price", "average_cost", "avg_cost", "weighted_avg_cost", "last_in_cost", "inventory_value", "total_value", "unit_cost", "total_cost"]) {
    if (!list("INVENTORY_COST_FIELDS").includes(`"${f}"`)) p.push(`the inventory cost fields miss ${f}`);
  }
  const bank = fnBody(c, "hideBankBalances");
  if (!/for \(const f of BANK_BALANCE_FIELDS\) if \(f in out\) out\[f\] = 0;/.test(bank) || !/out\.balances_hidden = true;/.test(bank)) p.push("hideBankBalances does not zero and flag the balances");
  const cost = fnBody(c, "hideInventoryCost");
  if (!/for \(const f of INVENTORY_COST_FIELDS\) if \(f in out\) out\[f\] = out\[f\] == null \? null : 0;/.test(cost) || !/out\.cost_hidden = true;/.test(cost)) p.push("hideInventoryCost does not zero and flag the cost");
  return p;
}, [
  { label: "an account with no ledger entries shows minus its balance", caught: /bank balance fields miss ledger_difference/,
    mutate: (s) => once(s, '"ledger_balance", "ledger_base", "ledger_difference",', '"ledger_balance", "ledger_base",') },
  { label: "a cost row that does not say it is hidden", caught: /hideInventoryCost does not zero and flag/,
    mutate: (s) => once(s, "if (f in out) out[f] = out[f] == null ? null : 0;\n  out.cost_hidden = true;\n  return out as T & { cost_hidden: true };\n}\n\n/** What an item", "if (f in out) out[f] = out[f] == null ? null : 0;\n  return out as T & { cost_hidden: true };\n}\n\n/** What an item") },
]);

rule("the bank-account list and create keep balances to «Bank & Profit»", BA, (c) => {
  const p: string[] = [];
  const get = bodyOf(c, "GET"), post = bodyOf(c, "POST");
  if (!/^\s*canSeeBankAndProfit\(auth\),/m.test(get)) p.push("the list does not ask «Bank & Profit»");
  if (!/accounts: bankAndProfit \? items : items\.map\(hideBankBalances\),/.test(get)) p.push("the list sends balances to every Finance viewer");
  if (!/ledger_gap: Math\.abs\(ledger_difference\) >= 0\.01,/.test(get)) p.push("the list loses whether the books agree once balances are hidden");
  const refuseAt = post.search(/if \(!bankAndProfit && BANK_BALANCE_INPUTS\.some\(\(f\) => Number\(body\[f\] \?\? 0\) !== 0\)\) \{\s*return NextResponse\.json\(/);
  const insertAt = post.search(/\.insert\(\{/);
  if (refuseAt < 0 || (insertAt >= 0 && refuseAt > insertAt)) p.push("a balance is set by a caller who cannot see it");
  if (!/account: bankAndProfit \? \(data as BankAccount\) : hideBankBalances\(data as BankAccount\)/.test(post)) p.push("create answers with the balances");
  return p;
}, [
  { label: "the list unmasked", caught: /the list sends balances to every Finance viewer/,
    mutate: (s) => once(s, "accounts: bankAndProfit ? items : items.map(hideBankBalances),", "accounts: items,") },
  { label: "an opening balance set without the right", caught: /a balance is set by a caller who cannot see it/,
    mutate: (s) => once(s, "if (!bankAndProfit && BANK_BALANCE_INPUTS.some(", "if (false && BANK_BALANCE_INPUTS.some(") },
]);

rule("an account's detail hides its balances, and an edit never writes one the caller never saw", BA_ID, (c) => {
  const p: string[] = [];
  const get = bodyOf(c, "GET"), patch = bodyOf(c, "PATCH");
  if (!/account: bankAndProfit \? account : hideBankBalances\(account\),/.test(get)) p.push("the detail sends the balances");
  const dropAt = patch.search(/^\s*if \(!bankAndProfit\) for \(const f of BANK_BALANCE_INPUTS\) delete body\[f\];/m);
  const buildAt = patch.search(/^\s*const patch: Record<string, unknown> = \{\};/m);
  if (dropAt < 0 || buildAt < 0 || dropAt > buildAt) p.push("an edit writes a balance the caller never saw");
  if (!/account: bankAndProfit \? saved : hideBankBalances\(saved\)/.test(patch)) p.push("an edit answers with the balances");
  return p;
}, [
  { label: "the edit form's zeros written over the balances", caught: /an edit writes a balance the caller never saw/,
    mutate: (s) => once(s, "  if (!bankAndProfit) for (const f of BANK_BALANCE_INPUTS) delete body[f];\n", "") },
  { label: "the balances dropped only after the patch is built", caught: /an edit writes a balance the caller never saw/,
    mutate: (s) => once(once(s, "  if (!bankAndProfit) for (const f of BANK_BALANCE_INPUTS) delete body[f];\n", ""),
      "  const patch: Record<string, unknown> = {};\n",
      "  const patch: Record<string, unknown> = {};\n  if (!bankAndProfit) for (const f of BANK_BALANCE_INPUTS) delete body[f];\n") },
  { label: "the detail unmasked", caught: /the detail sends the balances/,
    mutate: (s) => once(s, "account: bankAndProfit ? account : hideBankBalances(account),", "account,") },
]);

const answersMasked = (c: string) =>
  c.includes("(await canSeeBankAndProfit(auth)) ? (data as BankAccount) : hideBankBalances(data as BankAccount)") ? [] : ["it answers with the balances"];
rule("archiving answers without the balances", BA_ARCHIVE, answersMasked, [
  { label: "archive unmasked", caught: /answers with the balances/,
    mutate: (s) => once(s, "(await canSeeBankAndProfit(auth)) ? (data as BankAccount) : hideBankBalances(data as BankAccount)", "data as BankAccount") },
]);
rule("making an account primary answers without the balances", BA_PRIMARY, answersMasked, [
  { label: "set-primary unmasked", caught: /answers with the balances/,
    mutate: (s) => once(s, "(await canSeeBankAndProfit(auth)) ? (data as BankAccount) : hideBankBalances(data as BankAccount)", "data as BankAccount") },
]);

rule("the edit form offers no balance inputs to a caller who cannot see them", BA_DIALOG, (c) => {
  const at = c.search(/\{local\.balances_hidden \? \(/);
  const input = c.search(/value=\{local\.available_balance \?\? 0\}/);
  return at >= 0 && input > at ? [] : ["the edit form shows balance inputs to everyone"];
}, [
  { label: "the inputs for everyone", caught: /shows balance inputs to everyone/,
    mutate: (s) => once(s, "{local.balances_hidden ? (", "{false ? (") },
]);

rule("the valuations keep cost to the «private records» switch", VAL, (c) => {
  const p: string[] = [];
  const get = bodyOf(c, "GET");
  if (!/const cost = canSeeCostData\(auth\);/.test(get)) p.push("the valuation does not ask canSeeCostData");
  if (!/rows: cost \? filtered : filtered\.map\(hideInventoryCost\),/.test(get)) p.push("the drilled rows carry cost to everyone");
  if (!/rows: cost \? rows : rows\.map\(hideInventoryCost\),/.test(get)) p.push("the snapshot rows carry cost to everyone");
  if ((get.match(/totals: cost \? totals : hideTotalsCost\(totals\),/g) ?? []).length !== 2) p.push("the totals carry value to everyone");
  const hide = /function hideTotalsCost\([\s\S]*?\n\}/.exec(c)?.[0] ?? "";
  if (!/total_value: 0,/.test(hide) || !/top_holders: \[\],/.test(hide)) p.push("the hidden totals keep a value or the ranking by value");
  return p;
}, [
  { label: "the snapshot unmasked", caught: /the snapshot rows carry cost/,
    mutate: (s) => once(s, "rows: cost ? rows : rows.map(hideInventoryCost),", "rows,") },
  { label: "the top holders kept (a ranking by value)", caught: /keep a value or the ranking/,
    mutate: (s) => once(s, "    top_holders: [],\n", "") },
]);
rule("an item's valuation keeps cost to the «private records» switch", VAL_ITEM, (c) => {
  const get = bodyOf(c, "GET");
  const p: string[] = [];
  if (!/if \(canSeeCostData\(auth\)\) return NextResponse\.json\(\{ valuation: summary \}\);/.test(get)) p.push("the item valuation does not ask canSeeCostData");
  if (!/\.\.\.hideInventoryCost\(summary\),/.test(get) || !/locations: summary\.locations\.map\(hideInventoryCost\),/.test(get)
    || !/recent_movements: summary\.recent_movements\.map\(hideInventoryCost\),/.test(get)) p.push("the item valuation leaves a cost in the summary, a location or a movement");
  return p;
}, [
  { label: "the locations unmasked", caught: /leaves a cost in the summary, a location or a movement/,
    mutate: (s) => once(s, "locations: summary.locations.map(hideInventoryCost),", "locations: summary.locations,") },
]);

/* The same rule on the screens that ARE profit and cash, and on the sales
   orders (owner, 26 Sep 2026). The intelligence dashboard's feed and the
   financial statements answer 403 without «Bank & Profit» — a per-field mask
   would leave their alert engines reading zeros as facts — and each screen
   turns that 403 into one line, placed after every hook. The treasury feed
   hides the balances as the bank accounts do. An order hides its profit
   without «Bank & Profit» and what its suppliers cost without the private-
   records switch; what is still owed stays, and the engines read it from
   outstanding_amount, not cost − paid (both 0 once hidden). Can't read →
   can't write: the editor sends no supplier lines without the switch, the
   server keeps the lines as they are and refuses a cost, and expected_profit
   is written only when sent, by «Bank & Profit» (every edit used to null it). */
const DASH = "src/app/api/finance/dashboard/route.ts";
const VS_API = "src/app/api/finance/visual-statements/route.ts";
const TRE = "src/app/api/finance/treasury/route.ts";
const ORD = "src/app/api/finance/orders/route.ts";
const ORD_ID = "src/app/api/finance/orders/[id]/route.ts";
const CALC = "src/lib/finance/calc.ts";
const FD = "src/components/finance/FinanceDashboard.tsx";
const VS_UI = "src/components/finance/VisualStatements.tsx";
const FO = "src/components/finance/FinanceOrders.tsx";
const FBI = "src/components/finance/FinanceBankImports.tsx";
const ENGINES = [
  "src/lib/finance/intelligence.ts",
  "src/lib/intelligence/events.ts",
  "src/lib/intelligence/supplier.ts",
  "src/lib/intelligence/treasury.ts",
  "src/lib/intelligence/treasury-forecast.ts",
];

rule("an order hides its profit and its supplier cost, each with its own flag — never what is still owed", EXP, (c) => {
  const p: string[] = [];
  const list = (name: string) => /\[([^\]]*)\]/.exec(c.slice(c.indexOf(`export const ${name} =`)))?.[1] ?? "";
  for (const f of ["gross_profit", "net_profit", "net_profit_pct", "realized_cash_position", "expected_profit"]) {
    if (!list("ORDER_PROFIT_FIELDS").includes(`"${f}"`)) p.push(`the order profit fields miss ${f}`);
  }
  for (const f of ["total_supplier_cost", "paid_supplier_amount"]) {
    if (!list("ORDER_COST_FIELDS").includes(`"${f}"`)) p.push(`the order cost fields miss ${f}`);
  }
  for (const f of ["supplier_cost", "paid_amount"]) {
    if (!list("ORDER_SUPPLIER_COST_FIELDS").includes(`"${f}"`)) p.push(`the supplier line cost fields miss ${f}`);
  }
  if (/outstanding/.test(list("ORDER_PROFIT_FIELDS") + list("ORDER_COST_FIELDS") + list("ORDER_SUPPLIER_COST_FIELDS"))) p.push("what is still owed is hidden as if it were a cost");
  const h = fnBody(c, "hideOrderFigures");
  if (!/if \(!can\.profit\) \{\s*for \(const f of ORDER_PROFIT_FIELDS\) if \(f in out\) out\[f\] = out\[f\] == null \? null : 0;\s*out\.profit_hidden = true;\s*\}/.test(h)) p.push("hideOrderFigures does not zero and flag the profit");
  if (!/if \(!can\.cost\) \{\s*for \(const f of ORDER_COST_FIELDS\) if \(f in out\) out\[f\] = out\[f\] == null \? null : 0;/.test(h)
    || !/for \(const f of ORDER_SUPPLIER_COST_FIELDS\) if \(f in line\) line\[f\] = line\[f\] == null \? null : 0;/.test(h)
    || !/out\.cost_hidden = true;/.test(h)) p.push("hideOrderFigures does not zero and flag the supplier cost, lines included");
  const door = fnBody(c, "requireBankAndProfit");
  if (!/^\s*if \(await canSeeBankAndProfit\(auth\)\) return null;/m.test(door) || !/code: "needs_bank_profit"/.test(door) || !/status: 403/.test(door)) p.push("requireBankAndProfit does not close without «Bank & Profit»");
  return p;
}, [
  { label: "realized cash left out of the hidden profit", caught: /order profit fields miss realized_cash_position/,
    mutate: (s) => once(s, '"net_profit_pct", "realized_cash_position", "expected_profit"', '"net_profit_pct", "expected_profit"') },
  { label: "a hidden profit that does not say so", caught: /does not zero and flag the profit/,
    mutate: (s) => once(s, "    out.profit_hidden = true;\n", "") },
  { label: "the supplier lines keep their cost", caught: /does not zero and flag the supplier cost, lines included/,
    mutate: (s) => once(s, "for (const f of ORDER_SUPPLIER_COST_FIELDS) if (f in line) line[f] = line[f] == null ? null : 0;", "") },
  { label: "the payable hidden as a cost", caught: /still owed is hidden as if it were a cost/,
    mutate: (s) => once(s, '["total_supplier_cost", "paid_supplier_amount"]', '["total_supplier_cost", "paid_supplier_amount", "outstanding_payable"]') },
  { label: "the profit door open to everyone", caught: /requireBankAndProfit does not close/,
    mutate: (s) => once(s, "  if (await canSeeBankAndProfit(auth)) return null;\n", "  return null;\n") },
]);

/** requireAuth → Finance → «Bank & Profit» → return, in that order, before
 *  the handler reads anything. Order, never adjacency. */
function bankProfitDoorProblems(data: RegExp) {
  return (c: string): string[] => {
    const p: string[] = [];
    const body = bodyOf(c, "GET");
    if (!body) return ["no GET handler"];
    const bounceAt = body.search(/^\s*if \(auth instanceof NextResponse\) return auth;/m);
    const financeAt = body.search(/^\s*if \(deny\) return deny;/m);
    const gateAt = body.search(/^\s*const denied = await requireBankAndProfit\(auth, "[^"]+"\);/m);
    const deniedAt = body.search(/^\s*if \(denied\) return denied;/m);
    const dataAt = body.search(data);
    if (!/const deny = await requireModuleAccess\(auth, "Finance"\);/.test(body) || financeAt < 0) p.push("GET does not pass Finance first");
    if (gateAt < 0) { p.push("GET does not ask «Bank & Profit»"); return p; }
    if (deniedAt < 0) { p.push("GET ignores the «Bank & Profit» answer"); return p; }
    if (!(bounceAt >= 0 && bounceAt < financeAt && financeAt < gateAt && gateAt < deniedAt)) p.push("GET: requireAuth → Finance → «Bank & Profit» → return is out of order");
    if (dataAt >= 0 && dataAt < deniedAt) p.push("GET reads before «Bank & Profit» has said yes");
    return p;
  };
}

rule("the dashboard feed opens only with «Bank & Profit», its supplier cost only with the private-records switch", DASH, (c) => {
  const p = bankProfitDoorProblems(/\bsupabaseServer\.|\bbankLedgerBalances\(/)(c);
  const body = bodyOf(c, "GET");
  const maskAt = body.search(/if \(!canSeeCostData\(auth\)\) \{\s*out\.total_supplier_cost = 0;\s*out\.expected_vs_realized = \{ \.\.\.out\.expected_vs_realized, paid_supplier: 0 \};\s*out\.cost_hidden = true;\s*\}/);
  const sendAt = body.search(/return NextResponse\.json\(\{ kpi: out \}/);
  if (maskAt < 0 || sendAt < 0 || maskAt > sendAt) p.push("the feed sends the supplier cost to every «Bank & Profit» holder");
  return p;
}, [
  { label: "the dashboard without the «Bank & Profit» door", caught: /does not ask «Bank & Profit»/,
    mutate: (s) => once(s, "  const denied = await requireBankAndProfit(auth, \"The finance dashboard's figures\");\n  if (denied) return denied;\n", "") },
  { label: "the supplier cost left in the feed", caught: /sends the supplier cost/,
    mutate: (s) => once(s, "    out.total_supplier_cost = 0;\n", "") },
]);

rule("the financial statements open only with «Bank & Profit»", VS_API, bankProfitDoorProblems(/\bbuildVisualSnapshot\(/), [
  { label: "the statements without the door", caught: /does not ask «Bank & Profit»/,
    mutate: (s) => once(s, "  const denied = await requireBankAndProfit(auth, \"The financial statements\");\n", "") },
  { label: "the door asked only after the snapshot is built", caught: /reads before «Bank & Profit» has said yes/,
    mutate: (s) => once(once(s, "  const denied = await requireBankAndProfit(auth, \"The financial statements\");\n  if (denied) return denied;\n", ""),
      "      compareEnd,\n    });\n",
      "      compareEnd,\n    });\n  const denied = await requireBankAndProfit(auth, \"The financial statements\");\n  if (denied) return denied;\n") },
]);

/* Profit and cash in the accounting API (owner, 26/09/2026: «أيوه اقفلهم»):
   the P&L, the cash-flow statement and the cash-flow summary were Finance
   only — the same numbers the visual statements keep to «Bank & Profit». */
for (const [file, what, data] of [
  ["src/app/api/accounting/profit-loss/route.ts", "The profit and loss", /\bbuildProfitLoss\(/],
  ["src/app/api/accounting/cash-flow/route.ts", "The cash flow", /\bbuildCashFlow\(/],
  ["src/app/api/accounting/statements/cash-flow-summary/route.ts", "The cash flow", /\bbuildCashFlowSummary\(/],
] as const) {
  rule(`${file.split("/api/accounting/")[1].replace("/route.ts", "")} opens only with «Bank & Profit»`, file, bankProfitDoorProblems(data), [
    { label: `${file}: the door removed`, caught: /does not ask «Bank & Profit»/,
      mutate: (s) => once(s, `  const denied = await requireBankAndProfit(auth, "${what}");\n`, "") },
    { label: `${file}: the answer ignored`, caught: /ignores the «Bank & Profit» answer/,
      mutate: (s) => once(s, `  const denied = await requireBankAndProfit(auth, "${what}");\n  if (denied) return denied;\n`, `  const denied = await requireBankAndProfit(auth, "${what}");\n  void denied;\n`) },
  ]);
}

rule("the treasury feed keeps the balances to «Bank & Profit»", TRE, (c) => {
  const get = bodyOf(c, "GET");
  const p: string[] = [];
  if (!/^\s*canSeeBankAndProfit\(auth\),/m.test(get)) p.push("the treasury feed does not ask «Bank & Profit»");
  if (!/accounts: bankAndProfit \? accounts : accounts\.map\(hideBankBalances\),/.test(get)) p.push("the treasury feed sends the balances to every Finance viewer");
  return p;
}, [
  { label: "the treasury balances unmasked", caught: /sends the balances to every Finance viewer/,
    mutate: (s) => once(s, "accounts: bankAndProfit ? accounts : accounts.map(hideBankBalances),", "accounts,") },
]);

rule("an order list hides profit and supplier cost, and a save never writes what the caller could not see", ORD, (c) => {
  const p: string[] = [];
  const get = bodyOf(c, "GET"), post = bodyOf(c, "POST");
  if (!/^\s*canSeeBankAndProfit\(auth\),/m.test(get) || !/const can = \{ profit: bankAndProfit, cost: canSeeCostData\(auth\) \};/.test(get)) p.push("the list does not ask both rights");
  if (!/return NextResponse\.json\(\{ orders: out\.map\(\(o\) => hideOrderFigures\(o, can\)\) \}\);/.test(get)) p.push("the list sends profit and supplier cost to every Finance viewer");
  if (!/outstanding_amount: supplierOutstanding\(s\)/.test(get)) p.push("the list's supplier lines lose what is still owed once the cost is hidden");
  if (!/const can = \{ profit: await canSeeBankAndProfit\(auth\), cost: canSeeCostData\(auth\) \};/.test(post)) p.push("a save does not ask both rights");
  const refuseAt = post.search(/if \(!can\.cost && suppliers\.some\(\(s\) => \(Number\(s\.supplier_cost\) \|\| 0\) !== 0 \|\| \(Number\(s\.paid_amount\) \|\| 0\) !== 0\)\) \{\s*return NextResponse\.json\(/);
  const firstWriteAt = post.search(/\.from\("finance_orders"\)/);
  if (refuseAt < 0 || firstWriteAt < 0 || refuseAt > firstWriteAt) p.push("a supplier cost is set by a caller who cannot see it");
  const keepAt = post.search(/^\s*if \(!can\.cost\) return NextResponse\.json\(\{ order: hideOrderFigures\(updated, can\) \}\);/m);
  const replaceAt = post.search(/\.from\("finance_order_suppliers"\)\s*\.delete\(\)/);
  if (keepAt < 0 || replaceAt < 0 || keepAt > replaceAt) p.push("an edit writes the zeros it was sent over the real supplier costs");
  const upd = /\.update\(\{([\s\S]*?)\n\s*\}\)/.exec(post)?.[1] ?? "";
  if (!/const expectedProfit = can\.profit && o\.expected_profit !== undefined \? \{ expected_profit: o\.expected_profit \?\? null \} : \{\};/.test(post)
    || !/^\s*\.\.\.expectedProfit,$/m.test(upd) || /expected_profit/.test(upd)) p.push("an edit writes expected_profit it was not sent");
  const ins = /\.from\("finance_orders"\)\s*\.insert\(\{([\s\S]*?)\n\s*\}\)/.exec(post)?.[1] ?? "";
  if (!/expected_profit: can\.profit \? \(o\.expected_profit \?\? null\) : null,/.test(ins)) p.push("a new order takes expected_profit from a caller without «Bank & Profit»");
  const answers = [...post.matchAll(/NextResponse\.json\(\{ order: ([^}]*?) \}\)/g)].map((m) => m[1]);
  if (answers.length < 3 || answers.some((a) => !/^hideOrderFigures\((updated|created), can\)$/.test(a))) p.push("a save answers with the figures");
  return p;
}, [
  { label: "the order list unmasked", caught: /the list sends profit and supplier cost/,
    mutate: (s) => once(s, "orders: out.map((o) => hideOrderFigures(o, can))", "orders: out") },
  { label: "a supplier cost accepted from anyone", caught: /a supplier cost is set by a caller who cannot see it/,
    mutate: (s) => once(s, "if (!can.cost && suppliers.some(", "if (false && suppliers.some(") },
  { label: "the edit's zeros written over the real costs", caught: /writes the zeros it was sent/,
    mutate: (s) => once(s, "    if (!can.cost) return NextResponse.json({ order: hideOrderFigures(updated, can) });\n", "") },
  { label: "expected_profit nulled by every edit again", caught: /writes expected_profit it was not sent/,
    mutate: (s) => once(s, "        ...expectedProfit,\n", "        expected_profit: o.expected_profit ?? null,\n") },
  { label: "a new order answered unmasked", caught: /a save answers with the figures/,
    mutate: (s) => once(s, "NextResponse.json({ order: hideOrderFigures(created, can) })", "NextResponse.json({ order: created })") },
  { label: "the lines without what is owed", caught: /lose what is still owed/,
    mutate: (s) => once(s, "suppliers: (o.suppliers ?? []).map((s) => ({ ...s, outstanding_amount: supplierOutstanding(s) })),", "suppliers: o.suppliers ?? [],") },
]);

rule("one order's detail hides the same figures", ORD_ID, (c) => {
  const get = bodyOf(c, "GET");
  const p: string[] = [];
  if (!/return NextResponse\.json\(\{ order: hideOrderFigures\(order, \{ profit: await canSeeBankAndProfit\(auth\), cost: canSeeCostData\(auth\) \}\) \}\);/.test(get)) p.push("the detail sends profit or supplier cost unmasked");
  if (!/outstanding_amount: supplierOutstanding\(s\)/.test(get)) p.push("the detail's supplier lines lose what is still owed");
  return p;
}, [
  { label: "the order detail unmasked", caught: /the detail sends profit or supplier cost unmasked/,
    mutate: (s) => once(s, "hideOrderFigures(order, { profit: await canSeeBankAndProfit(auth), cost: canSeeCostData(auth) })", "order") },
]);

rule("what is owed on a supplier line reads the server's outstanding_amount first", CALC, (c) => {
  return /^\s*if \(typeof s\.outstanding_amount === "number"\) return s\.outstanding_amount;/m.test(fnBody(c, "supplierOutstanding")) ? [] : ["supplierOutstanding works it out from the hidden cost"];
}, [
  { label: "outstanding worked out from the zeros", caught: /works it out from the hidden cost/,
    mutate: (s) => once(s, '  if (typeof s.outstanding_amount === "number") return s.outstanding_amount;\n', "") },
]);

/* Cost − paid on a line is 0 − 0 for a caller without the switch: the AP
   aging and the payment timeline would say nothing is owed. */
const engineProblems = (c: string) => {
  const p: string[] = [];
  if (/supplier_cost[^;\n]*-[^;\n]*paid_amount/.test(c)) p.push("works out what is owed from cost − paid");
  if (!/\bsupplierOutstanding\(/.test(c)) p.push("does not read supplierOutstanding");
  return p;
};
for (const f of ENGINES) {
  const p = engineProblems(code(read(f)));
  check(`${f}: what is owed comes from supplierOutstanding, never cost − paid${p.length ? ` — ${p.join("; ")}` : ""}`, p.length === 0);
}
rule("the engines cannot go back to cost − paid", "src/lib/intelligence/supplier.ts", engineProblems, [
  { label: "the supplier engine's own subtraction", caught: /works out what is owed from cost − paid/,
    mutate: (s) => once(s, "prev.outstanding += supplierOutstanding(s);", "prev.outstanding += Math.max(0, (Number(s.supplier_cost) || 0) - (Number(s.paid_amount) || 0)); void supplierOutstanding;") },
]);

/** A component's text, from its signature to its closing brace. */
function componentBody(c: string, name: string): string {
  const at = c.search(new RegExp(`^export (?:default )?function ${name}\\(`, "m"));
  if (at < 0) return "";
  const end = c.indexOf("\n}\n", at);
  return c.slice(at, end < 0 ? undefined : end);
}
const HOOK_CALL = /\buse[A-Z]\w*\(/;

rule("the intelligence dashboard turns the 403 into one line, after every hook, and runs nothing on it", FD, (c) => {
  const p: string[] = [];
  const body = componentBody(c, "FinanceDashboard");
  const on403 = body.search(/if \(dashRes\.status === 403\) \{\s*if \(seq === kpiSeq\.current\) \{ setLocked\(true\);/);
  const parseAt = body.search(/await dashRes\.json\(\)/);
  if (on403 < 0 || parseAt < 0 || on403 > parseAt) p.push("a 403 from the feed does not lock the page");
  if (!/const stat = locked \? null :/.test(body) || !/const kpi = locked \? null :/.test(body)) p.push("a locked page still draws the cached figures");
  if (!/if \(!loading && !locked\) saveMemory\(/.test(body) || !/^\s*if \(locked\) return;/m.test(body)) p.push("a locked page still feeds the memory or the Copilot");
  const lockedAt = body.search(/^\s*if \(locked\) \{\s*return \(/m);
  if (lockedAt < 0) p.push("the page has no locked state");
  else if (HOOK_CALL.test(body.slice(lockedAt))) p.push("a hook runs below the locked return");
  return p;
}, [
  { label: "the 403 read as figures", caught: /does not lock the page/,
    mutate: (s) => once(s, "if (dashRes.status === 403) {", "if (dashRes.status === 499) {") },
  { label: "the Copilot fed from a locked page", caught: /still feeds the memory or the Copilot/,
    mutate: (s) => once(s, "    if (locked) return;\n", "") },
  { label: "a hook added below the locked return", caught: /a hook runs below the locked return/,
    mutate: (s) => once(s, "    );\n  }\n\n  return (\n    <div className=\"min-h-full bg-[var(--bg-primary)] text-[var(--text-primary)]\">\n      <div className=\"pb-5\">\n        <FinanceHeader\n",
      "    );\n  }\n  const late = useMemo(() => 0, []);\n\n  return (\n    <div className=\"min-h-full bg-[var(--bg-primary)] text-[var(--text-primary)]\">\n      <div className=\"pb-5\">\n        <FinanceHeader\n") },
]);

rule("the statements turn the 403 into one line, after every hook", VS_UI, (c) => {
  const p: string[] = [];
  const body = componentBody(c, "StatementsDashboard");
  const throwAt = body.search(/if \(r\.status === 403\) throw Object\.assign\(new Error\(.*?\{ name: STATEMENTS_LOCKED \}\);/);
  const genericAt = body.search(/if \(!r\.ok\) throw/);
  if (throwAt < 0 || genericAt < 0 || throwAt > genericAt) p.push("a 403 shows as a red failure");
  const lockedAt = body.search(/^\s*if \(loadError instanceof Error && loadError\.name === STATEMENTS_LOCKED\) \{\s*return \(/m);
  if (lockedAt < 0) p.push("the statements have no locked state");
  else if (HOOK_CALL.test(body.slice(lockedAt))) p.push("a hook runs below the locked return");
  return p;
}, [
  { label: "the 403 as a failure", caught: /a 403 shows as a red failure/,
    mutate: (s) => once(s, "if (r.status === 403) throw", "if (r.status === 499) throw") },
]);

rule("the order screen shows «•••» for what the role may not see, and its editor never sends it back", FO, (c) => {
  const p: string[] = [];
  if (!/const HIDDEN = "•••";/.test(c)) p.push("the hidden mark is not «•••»");
  if (!/const profitHidden = !!order\.profit_hidden;/.test(c) || !/const costHidden = !!order\.cost_hidden;/.test(c)) p.push("the order card does not read the flags");
  if (!/\{profitHidden \? HIDDEN : fmtMoney\(netProfit, ccy/.test(c) || !/v=\{profitHidden \? null : grossProfit\}/.test(c) || !/v=\{profitHidden \? null : realizedCash\}/.test(c)) p.push("the card prints a hidden profit as a figure");
  if ((c.match(/display=\{costHidden \? HIDDEN : undefined\}/g) ?? []).length !== 2) p.push("the card prints a hidden supplier cost as a figure");
  if (!/const lowMargin = !profitHidden && netPct < 8;/.test(c) || !/overdue \|\| \(!profitHidden && netPct < 0\)/.test(c)) p.push("the card judges the margin from a hidden zero");
  if (!/value=\{kpi\.profitHidden \? HIDDEN : kpi\.totalNet\}/.test(c)) p.push("the Net Profit total prints a hidden profit as a figure");
  if (!/const body = \{ order: draft\.order, suppliers: draft\.costHidden \? \[\] : draft\.suppliers \};/.test(c)) p.push("the editor posts the masked supplier lines back");
  const readOnlyAt = c.search(/\{draft\.costHidden \? \(/);
  const costInputAt = c.search(/value=\{s\.supplier_cost\}/);
  if (readOnlyAt < 0 || costInputAt < 0 || readOnlyAt > costInputAt) p.push("the editor offers the supplier cost inputs to everyone");
  const previewAt = c.search(/\{draft\.profitHidden \|\| draft\.costHidden \? \(/);
  const netRowAt = c.search(/label=\{t\("orders\.preview\.net"/);
  if (previewAt < 0 || netRowAt < 0 || previewAt > netRowAt) p.push("the editor previews a profit the role may not see");
  return p;
}, [
  { label: "the cost inputs for everyone", caught: /offers the supplier cost inputs to everyone/,
    mutate: (s) => once(s, "{draft.costHidden ? (", "{false ? (") },
  { label: "the masked lines posted back", caught: /posts the masked supplier lines back/,
    mutate: (s) => once(s, "suppliers: draft.costHidden ? [] : draft.suppliers", "suppliers: draft.suppliers") },
  { label: "a Low-margin chip read off a hidden zero", caught: /judges the margin from a hidden zero/,
    mutate: (s) => once(s, "const lowMargin = !profitHidden && netPct < 8;", "const lowMargin = netPct < 8;") },
  { label: "the profit preview for everyone", caught: /previews a profit the role may not see/,
    mutate: (s) => once(s, "{draft.profitHidden || draft.costHidden ? (", "{false ? (") },
  { label: "the Net Profit total printed", caught: /Net Profit total prints/,
    mutate: (s) => once(s, "value={kpi.profitHidden ? HIDDEN : kpi.totalNet}", "value={kpi.totalNet}") },
]);

rule("the statement-import picker shows «•••» for a hidden balance", FBI, (c) => {
  return /\{a\.balances_hidden \? "•••" : fmtMoney\(a\.available_balance, a\.currency/.test(c) ? [] : ["the picker prints a hidden balance as 0"];
}, [
  { label: "the picker's balance printed", caught: /prints a hidden balance as 0/,
    mutate: (s) => once(s, '{a.balances_hidden ? "•••" : fmtMoney(a.available_balance, a.currency, { compact: true })}', "{fmtMoney(a.available_balance, a.currency, { compact: true })}") },
]);

/* The last four (owner, 26 Sep 2026: «طبّق نفس القاعدة على الأربعة الباقيين»).
   Supplier accounts hide what was bought and paid (the switch) and keep what
   is owed, ranked by it; the drilled stock balances, an item's and a
   variant's cost follow the switch, and a caller without it never writes a
   cost (dropped from an edit, refused on a create). Opening balances: cash,
   capital, loans and other need «Bank & Profit», the inventory opening the
   switch; receivables, payables and fixed assets stay — a hidden line is
   shown as «•••», and neither added nor removed by such a caller. The setup
   cards total the same figures and hide the same way. */
const SUP = "src/app/api/finance/suppliers/route.ts";
const BAL = "src/app/api/inventory/balances/route.ts";
const ITEM_ID = "src/app/api/inventory/items/[id]/route.ts";
const VAR = "src/app/api/inventory/variants/route.ts";
const VAR_ID = "src/app/api/inventory/variants/[id]/route.ts";
const OB = "src/app/api/finance/setup/opening-balances/route.ts";
const OB_ID = "src/app/api/finance/setup/opening-balances/[id]/route.ts";
const SETUP_STATUS = "src/app/api/finance/setup/status/route.ts";
const FSUP = "src/components/finance/FinanceSuppliers.tsx";
const IBAL = "src/components/inventory/InventoryBalances.tsx";
const IITEMS = "src/components/inventory/InventoryItems.tsx";
const FSETUP = "src/components/finance/FinanceSetup.tsx";

rule("supplier totals, opening lines and setup cards hide by the same two answers — never what is owed", EXP, (c) => {
  const p: string[] = [];
  const list = (name: string) => /\[([^\]]*)\]/.exec(c.slice(c.indexOf(`export const ${name} =`)))?.[1] ?? "";
  for (const f of ["total_purchases", "paid_amount"]) if (!list("SUPPLIER_TOTAL_COST_FIELDS").includes(`"${f}"`)) p.push(`the supplier cost fields miss ${f}`);
  if (/outstanding|unpaid/.test(list("SUPPLIER_TOTAL_COST_FIELDS"))) p.push("what is owed to a supplier is hidden as if it were a cost");
  const sup = fnBody(c, "hideSupplierTotals");
  if (!/for \(const f of SUPPLIER_TOTAL_COST_FIELDS\) if \(f in out\) out\[f\] = out\[f\] == null \? null : 0;/.test(sup) || !/out\.cost_hidden = true;/.test(sup)) p.push("hideSupplierTotals does not zero and flag the totals");
  if (!list("INVENTORY_COST_INPUTS").includes('"cost_price"')) p.push("an item's cost_price is not a guarded input");
  for (const f of ["cash", "owner_capital", "loan", "other"]) if (!list("OPENING_BANK_PROFIT_CATEGORIES").includes(`"${f}"`)) p.push(`the «Bank & Profit» opening lines miss ${f}`);
  if (!list("OPENING_COST_CATEGORIES").includes('"inventory"')) p.push("the inventory opening is not a cost");
  if (/customer_receivable|supplier_payable/.test(list("OPENING_BANK_PROFIT_CATEGORIES") + list("OPENING_COST_CATEGORIES"))) p.push("what customers owe or is owed to suppliers is hidden");
  const refusal = fnBody(c, "openingCategoryRefusal");
  if (!/if \(!can\.bankAndProfit && \(OPENING_BANK_PROFIT_CATEGORIES as readonly string\[\]\)\.includes\(category\)\) return "needs_bank_profit";/.test(refusal)
    || !/if \(!can\.cost && \(OPENING_COST_CATEGORIES as readonly string\[\]\)\.includes\(category\)\) return "needs_private_data";/.test(refusal)) p.push("openingCategoryRefusal does not ask the two answers");
  const ob = fnBody(c, "hideOpeningAmount");
  if (!/out\.amount = out\.amount == null \? null : 0;/.test(ob) || !/out\.amount_hidden = true;/.test(ob)) p.push("hideOpeningAmount does not zero and flag the line");
  for (const k of ["bank_accounts", "cash_accounts", "loans", "equity"]) if (!list("SETUP_BANK_PROFIT_CARDS").includes(`"${k}"`)) p.push(`the setup card ${k} is not «Bank & Profit»`);
  const card = fnBody(c, "hideSetupCardTotal");
  if (!/card\.key === "opening_balances"\s*\? !\(can\.bankAndProfit && can\.cost\)/.test(card)) p.push("the starting-position total does not need both answers");
  if (!/\{ \.\.\.card, total: 0, total_hidden: true as const \}/.test(card)) p.push("a hidden card total is not zeroed and flagged");
  return p;
}, [
  { label: "a supplier's paid amount left in the clear", caught: /the supplier cost fields miss paid_amount/,
    mutate: (s) => once(s, '["total_purchases", "paid_amount"]', '["total_purchases"]') },
  { label: "cash left out of the hidden opening lines", caught: /the «Bank & Profit» opening lines miss cash/,
    mutate: (s) => once(s, '["cash", "owner_capital", "loan", "other"]', '["owner_capital", "loan", "other"]') },
  { label: "receivables hidden as if they were a bank balance", caught: /what customers owe or is owed to suppliers is hidden/,
    mutate: (s) => once(s, '["cash", "owner_capital", "loan", "other"]', '["cash", "owner_capital", "loan", "other", "customer_receivable"]') },
  { label: "the starting position shown to a role without the switch", caught: /starting-position total does not need both/,
    mutate: (s) => once(s, "? !(can.bankAndProfit && can.cost)", "? !can.bankAndProfit") },
  { label: "a hidden opening line that does not say so", caught: /hideOpeningAmount does not zero and flag/,
    mutate: (s) => once(s, "  out.amount_hidden = true;\n", "") },
]);

rule("supplier accounts hide what was bought and paid, ranked by what is owed", SUP, (c) => {
  const get = bodyOf(c, "GET");
  const p: string[] = [];
  const maskAt = get.search(/if \(!canSeeCostData\(auth\)\) \{\s*const hidden = out\.map\(hideSupplierTotals\);\s*hidden\.sort\(\(a, b\) => \(b\.outstanding_payable \?\? 0\) - \(a\.outstanding_payable \?\? 0\)\);\s*return NextResponse\.json\(\{ suppliers: hidden \}\);\s*\}/);
  const rankAt = get.search(/out\.sort\(\(a, b\) => \(b\.total_purchases \?\? 0\) - \(a\.total_purchases \?\? 0\)\);/);
  if (maskAt < 0) p.push("the supplier totals go to every Finance viewer, or ranked by the hidden purchases");
  else if (rankAt >= 0 && rankAt < maskAt) p.push("the list is ranked by purchases before the mask");
  return p;
}, [
  { label: "the supplier list unmasked", caught: /go to every Finance viewer/,
    mutate: (s) => once(s, "  if (!canSeeCostData(auth)) {\n    const hidden", "  if (false) {\n    const hidden") },
  { label: "the hidden list ranked by purchases", caught: /go to every Finance viewer, or ranked by the hidden purchases/,
    mutate: (s) => once(s, "hidden.sort((a, b) => (b.outstanding_payable ?? 0) - (a.outstanding_payable ?? 0));", "hidden.sort((a, b) => (b.total_purchases ?? 0) - (a.total_purchases ?? 0));") },
]);

rule("the drilled stock balances keep cost to the switch", BAL, (c) => {
  return /balances: canSeeCostData\(auth\) \? filtered : filtered\.map\(hideInventoryCost\),/.test(bodyOf(c, "GET")) ? [] : ["the drilled balances carry avg cost and value to everyone"];
}, [
  { label: "drilled balances unmasked", caught: /carry avg cost and value to everyone/,
    mutate: (s) => once(s, "balances: canSeeCostData(auth) ? filtered : filtered.map(hideInventoryCost),", "balances: filtered,") },
]);

/** Reads the cost to everyone? Writes one the caller never saw? */
function costWriterProblems(verbRead: string, readRe: RegExp, verbWrite: string, dropRe: RegExp, writerCall: RegExp, answerRe: RegExp) {
  return (c: string): string[] => {
    const p: string[] = [];
    if (!readRe.test(bodyOf(c, verbRead))) p.push("the read sends the cost to everyone");
    const w = bodyOf(c, verbWrite);
    const guardAt = w.search(dropRe);
    const writeAt = w.search(writerCall);
    if (guardAt < 0 || writeAt < 0 || guardAt > writeAt) p.push("a write takes a cost from a caller who cannot see it");
    if (!answerRe.test(w)) p.push("a write answers with the cost");
    return p;
  };
}
const REFUSE_COST = /if \(!cost && INVENTORY_COST_INPUTS\.some\(\(f\) => \(Number\(body\[f\]\) \|\| 0\) !== 0\)\) \{\s*return NextResponse\.json\(/;
const DROP_COST = /^\s*if \(!cost\) for \(const f of INVENTORY_COST_INPUTS\) delete patch\[f\];/m;

rule("an item's detail hides its cost, and an edit never writes one the caller never saw", ITEM_ID,
  costWriterProblems("GET", /item: canSeeCostData\(auth\) \? item : hideInventoryCost\(item\)/, "PATCH", DROP_COST, /updateInventoryItem\(/, /item: cost \|\| !r\.item \? r\.item : hideInventoryCost\(r\.item\)/), [
  { label: "the edit's 0 written over the item's cost", caught: /a write takes a cost/,
    mutate: (s) => once(s, "  if (!cost) for (const f of INVENTORY_COST_INPUTS) delete patch[f];\n", "") },
  { label: "the item detail unmasked", caught: /the read sends the cost to everyone/,
    mutate: (s) => once(s, "item: canSeeCostData(auth) ? item : hideInventoryCost(item)", "item") },
]);

rule("creating an item never takes a cost from a caller who cannot see it", INV, (c) => {
  const post = bodyOf(c, "POST");
  const p: string[] = [];
  const refuseAt = post.search(REFUSE_COST);
  const createAt = post.search(/createInventoryItem\(/);
  if (refuseAt < 0 || createAt < 0 || refuseAt > createAt) p.push("a new item takes a cost from a caller who cannot see it");
  if (!/item: cost \|\| !r\.item \? r\.item : hideInventoryCost\(r\.item\)/.test(post)) p.push("a new item answers with the cost");
  return p;
}, [
  { label: "a cost accepted on create from anyone", caught: /a new item takes a cost/,
    mutate: (s) => once(s, "if (!cost && INVENTORY_COST_INPUTS.some(", "if (false && INVENTORY_COST_INPUTS.some(") },
]);

rule("the variant list hides the cost and a new variant never takes one the caller cannot see", VAR,
  costWriterProblems("GET", /variants: canSeeCostData\(auth\) \? variants : variants\.map\(hideInventoryCost\)/, "POST", REFUSE_COST, /createVariant\(/, /variant: cost \|\| !r\.variant \? r\.variant : hideInventoryCost\(r\.variant\)/), [
  { label: "the variant list unmasked", caught: /the read sends the cost to everyone/,
    mutate: (s) => once(s, "variants: canSeeCostData(auth) ? variants : variants.map(hideInventoryCost)", "variants") },
  { label: "a variant cost accepted from anyone", caught: /a write takes a cost/,
    mutate: (s) => once(s, "if (!cost && INVENTORY_COST_INPUTS.some(", "if (false && INVENTORY_COST_INPUTS.some(") },
]);

rule("a variant's detail hides the cost and an edit never writes one", VAR_ID,
  costWriterProblems("GET", /variant: canSeeCostData\(auth\) \? variant : hideInventoryCost\(variant\)/, "PATCH", DROP_COST, /updateVariant\(/, /variant: cost \|\| !r\.variant \? r\.variant : hideInventoryCost\(r\.variant\)/), [
  { label: "the variant edit's 0 written over the cost", caught: /a write takes a cost/,
    mutate: (s) => once(s, "  if (!cost) for (const f of INVENTORY_COST_INPUTS) delete patch[f];\n", "") },
]);

rule("opening balances hide the lines the role may not see, and it adds none", OB, (c) => {
  const p: string[] = [];
  const get = bodyOf(c, "GET"), post = bodyOf(c, "POST");
  if (!/openingCategoryRefusal\(r\.category, can\) \? hideOpeningAmount\(r\) : r\)/.test(get)) p.push("the opening lines go to every Finance viewer");
  if (!/amounts_hidden: category \? openingCategoryRefusal\(category, can\) !== null : undefined/.test(get)) p.push("an empty drawer is not told its lines are hidden");
  const refuseAt = post.search(/const refusal = openingCategoryRefusal\(body\.category, \{ bankAndProfit: await canSeeBankAndProfit\(auth\), cost: canSeeCostData\(auth\) \}\);\s*if \(refusal\) \{\s*return NextResponse\.json\(/);
  const insertAt = post.search(/\.insert\(\{/);
  if (refuseAt < 0 || insertAt < 0 || refuseAt > insertAt) p.push("a hidden opening line is added by a caller who cannot see it");
  return p;
}, [
  { label: "the opening lines unmasked", caught: /go to every Finance viewer/,
    mutate: (s) => once(s, "openingCategoryRefusal(r.category, can) ? hideOpeningAmount(r) : r)", "r)") },
  { label: "a cash opening added without «Bank & Profit»", caught: /a hidden opening line is added/,
    mutate: (s) => once(s, "  if (refusal) {\n    return NextResponse.json({\n", "  if (false) {\n    return NextResponse.json({\n") },
]);

rule("a hidden opening line is not removed by a role that cannot see it", OB_ID, (c) => {
  const del = bodyOf(c, "DELETE");
  const p: string[] = [];
  if (!/\.select\("id, category, accounting_entry_id, accounting_status"\)/.test(del)) p.push("the line's category is not read before removing it");
  const refuseAt = del.search(/if \(refusal\) \{\s*return NextResponse\.json\(/);
  const voidAt = del.search(/voidJournalEntry\(/);
  if (refuseAt < 0 || voidAt < 0 || refuseAt > voidAt) p.push("a hidden line's journal is voided by a caller who cannot see it");
  return p;
}, [
  { label: "a hidden line removed by anyone", caught: /voided by a caller who cannot see it/,
    mutate: (s) => once(s, "  if (refusal) {\n", "  if (false) {\n") },
]);

rule("the setup cards hide the totals the role may not see", SETUP_STATUS, (c) => {
  return /cards: snapshot\.cards\.map\(\(c\) => hideSetupCardTotal\(c, can\)\)/.test(bodyOf(c, "GET")) ? [] : ["the setup cards total bank, cash, loans and capital for everyone"];
}, [
  { label: "the setup totals unmasked", caught: /total bank, cash, loans and capital for everyone/,
    mutate: (s) => once(s, "return NextResponse.json({ snapshot: { ...snapshot, cards: snapshot.cards.map((c) => hideSetupCardTotal(c, can)) } });", "return NextResponse.json({ snapshot });") },
]);

rule("the four screens show «•••» for what the role may not see and offer no input for it", FSUP, (c) => {
  const p: string[] = [];
  if (!/value=\{kpi\.costHidden \? HIDDEN : formatCompact\(kpi\.purchases\)\}/.test(c) || !/value=\{kpi\.costHidden \? HIDDEN : formatCompact\(kpi\.paid\)\}/.test(c)) p.push("the supplier totals print hidden zeros");
  if ((c.match(/value=\{r\.cost_hidden \? HIDDEN : fmtMoney\(r\.(total_purchases|paid_amount)/g) ?? []).length !== 2) p.push("a supplier card prints hidden zeros");
  if (!/\{!r\.cost_hidden && \(\s*<div className="mt-3">\s*<div className="flex items-center justify-between text-\[10px\]/.test(c)) p.push("the payment progress is drawn from hidden zeros");
  const bal = code(read(IBAL));
  if ((bal.match(/\{r\.cost_hidden \? "•••" : r\.avg_cost\.toFixed\(4\)\}/g) ?? []).length !== 2 || !/cur\.cost_hidden = cur\.cost_hidden \|\| !!r\.cost_hidden;/.test(bal)) p.push("the drilled balances print hidden zeros");
  const items = code(read(IITEMS));
  if (!/item\.cost_hidden \? "•••"/.test(items) || !/v\.cost_hidden \? "•••"/.test(items)) p.push("the item drawer prints a hidden cost");
  if (!/const \[costLocked, setCostLocked\] = useState\(!canSeeCost\);/.test(items) || !/\{!costLocked && <input type="number" placeholder="Cost price"/.test(items)) p.push("the quick-add offers a cost to a role that cannot see it");
  const setup = code(read(FSETUP));
  if (!/c\.total_hidden \? "•••" : fmtMoney\(c\.total, c\.currency\)/.test(setup) || !/r\.amount_hidden \? "•••"/.test(setup)) p.push("the setup screen prints hidden zeros");
  if (!/\{amountsHidden \? \(/.test(setup) || !/\{!r\.amount_hidden && \(/.test(setup)) p.push("the setup drawer offers to add or remove a hidden line");
  return p;
}, [
  { label: "the supplier purchases printed", caught: /the supplier totals print hidden zeros/,
    mutate: (s) => once(s, "value={kpi.costHidden ? HIDDEN : formatCompact(kpi.purchases)}", "value={formatCompact(kpi.purchases)}") },
]);

/* Finance reports & exports (owner, 26 Sep 2026: «طبّق نفس القاعدة على الـ
   Reports والـ exports»). A report is a document: opened whole or not at all.
   The treasury report needs «Bank & Profit», the supplier statement the
   switch, the executive summary both; the rest show what the Finance screens
   already do. ONE gate: every report route — preview, PDF, print and a stored
   export's print page, which rebuilds as its viewer — goes through
   buildAndAudit, and the refusal comes before anything is built or recorded. */
const RBUILD = "src/lib/reports/build.ts";
const RTEMPL = "src/app/api/reports/templates/route.ts";
const RPREV_HTML = "src/app/api/reports/preview-html/route.ts";
const REPORT_ROUTES = [
  "src/app/api/reports/preview/route.ts", RPREV_HTML, "src/app/api/reports/export/pdf/route.ts",
  "src/app/api/reports/export/print/route.ts", "src/app/api/reports/exports/[id]/html/route.ts",
];
const FREPORTS = "src/components/finance/FinanceReports.tsx";

rule("which report needs which right — treasury «Bank & Profit», supplier statement the switch, executive summary both", EXP, (c) => {
  const p: string[] = [];
  const list = (name: string) => /\[([^\]]*)\]/.exec(c.slice(c.indexOf(`export const ${name} =`)))?.[1] ?? "";
  for (const r of ["treasury_report", "executive_summary"]) if (!list("REPORTS_NEED_BANK_PROFIT").includes(`"${r}"`)) p.push(`${r} opens without «Bank & Profit»`);
  for (const r of ["supplier_statement", "executive_summary"]) if (!list("REPORTS_NEED_COST").includes(`"${r}"`)) p.push(`${r} opens without the switch`);
  if (/aging|customer_statement/.test(list("REPORTS_NEED_BANK_PROFIT") + list("REPORTS_NEED_COST"))) p.push("what is owed, or the customer's own statement, is locked");
  const f = fnBody(c, "reportRefusal");
  if (!/if \(!can\.bankAndProfit && \(REPORTS_NEED_BANK_PROFIT as readonly string\[\]\)\.includes\(type\)\) return "needs_bank_profit";/.test(f)
    || !/if \(!can\.cost && \(REPORTS_NEED_COST as readonly string\[\]\)\.includes\(type\)\) return "needs_private_data";/.test(f)) p.push("reportRefusal does not ask the two answers");
  return p;
}, [
  { label: "the treasury report left open", caught: /treasury_report opens without «Bank & Profit»/,
    mutate: (s) => once(s, '["treasury_report", "executive_summary"]', '["executive_summary"]') },
  { label: "the executive summary without the cost check", caught: /executive_summary opens without the switch/,
    mutate: (s) => once(s, '["supplier_statement", "executive_summary"]', '["supplier_statement"]') },
  { label: "the payables aging locked", caught: /what is owed, or the customer's own statement, is locked/,
    mutate: (s) => once(s, '["treasury_report", "executive_summary"]', '["treasury_report", "executive_summary", "ap_aging_ledger"]') },
]);

rule("every report is refused in buildAndAudit before it is built or recorded", RBUILD, (c) => {
  const p: string[] = [];
  const f = fnBody(c, "buildAndAudit");
  const refuseAt = f.search(/const refusal = reportRefusal\(input\.type, \{\s*bankAndProfit: await canSeeBankAndProfit\(input\.auth\),\s*cost: canSeeCostData\(input\.auth\),\s*\}\);\s*if \(refusal\) \{\s*return \{\s*ok: false,\s*status: 403,\s*code: refusal,/);
  const buildAt = f.search(/await entry\.build\(ctx\)/);
  const auditAt = f.search(/\.from\("finance_report_exports"\)/);
  if (refuseAt < 0) p.push("reports are built without asking who may open them");
  else if ((buildAt >= 0 && buildAt < refuseAt) || (auditAt >= 0 && auditAt < refuseAt)) p.push("a report is built or recorded before the refusal");
  return p;
}, [
  { label: "the report gate removed", caught: /built without asking/,
    mutate: (s) => once(s, "  if (refusal) {\n    return {\n      ok: false,\n      status: 403,", "  if (false) {\n    return {\n      ok: false,\n      status: 403,") },
  { label: "the gate asked after the build", caught: /built or recorded before the refusal/,
    mutate: (s) => once(once(s, "  let payload: ReportPayload;\n  try {\n    payload = await entry.build(ctx);\n", "  let payload: ReportPayload;\n  try {\n"),
      "  const refusal = reportRefusal(", "  let payload: ReportPayload = await entry.build(ctx);\n  const refusal = reportRefusal(") },
]);

for (const r of REPORT_ROUTES) {
  const c = code(read(r));
  const ok = /code: (res|built)\.code \}, \{ status: (res|built)\.status \}/.test(c) && /buildAndAudit\(\{/.test(c);
  check(`${r}: goes through buildAndAudit and passes the refusal code on`, ok);
}
rule("a report route hands the refusal code to the screen", RPREV_HTML, (c) => /code: res\.code \}, \{ status: res\.status \}/.test(c) ? [] : ["the refusal reaches the screen as a bare error"], [
  { label: "the code dropped", caught: /bare error/,
    mutate: (s) => once(s, "{ error: res.error, code: res.code }", "{ error: res.error }") },
]);

rule("the report list says which reports are closed to the caller", RTEMPL, (c) => {
  return /templates: listReportTemplates\(\)\.map\(\(t\) => \(\{ \.\.\.t, locked: reportRefusal\(t\.type, can\) \}\)\)/.test(bodyOf(c, "GET")) ? [] : ["the report list offers every report as open"];
}, [
  { label: "the list without locks", caught: /offers every report as open/,
    mutate: (s) => once(s, "templates: listReportTemplates().map((t) => ({ ...t, locked: reportRefusal(t.type, can) }))", "templates: listReportTemplates()") },
]);

rule("the reporting centre shows a closed report as one line and prints nothing", FREPORTS, (c) => {
  const p: string[] = [];
  if (!/disabled=\{!!t\.locked\}/.test(c)) p.push("a closed report can be picked");
  if (!/if \(!activeType \|\| activeLocked\) return;/.test(c)) p.push("a closed report is still previewed");
  const lockAt = c.search(/\{lockedCode \? \(/), errAt = c.search(/\) : previewError \? \(/);
  if (lockAt < 0 || errAt < 0 || lockAt > errAt) p.push("a closed report shows as a red failure");
  if ((c.match(/disabled=\{busy !== null \|\| locked\}/g) ?? []).length !== 2) p.push("a closed report can still be printed or downloaded");
  if ((c.match(/if \(j\.code === "needs_bank_profit" \|\| j\.code === "needs_private_data"\) \{ setServerLocked\(j\.code\); return; \}/g) ?? []).length !== 3) p.push("a 403 from preview, PDF or print is not turned into the closed line");
  const sup = code(read(FSUP));
  if (!/\{!r\.cost_hidden && \(\s*<div className="mt-3">\s*<button\s+type="button"\s+onClick=\{\(\) => void generateStatement/.test(sup)) p.push("the supplier card offers a statement the role may not open");
  return p;
}, [
  { label: "a closed report pickable", caught: /a closed report can be picked/,
    mutate: (s) => once(s, "disabled={!!t.locked}", "disabled={false}") },
  { label: "a closed report previewed", caught: /is still previewed/,
    mutate: (s) => once(s, "if (!activeType || activeLocked) return;", "if (!activeType) return;") },
]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
