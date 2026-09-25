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
       in the caller's tenant and is claimed before it is applied.
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

/* Reads of the queue, the activity log, the caller's finance flags or the
   request body. None may run before the door has said yes. */
const APPROVALS_DATA = /\b(listPending|listActivity|transitionApproval|getUserExperience)\(|\bsupabaseServer\.|\breq\.json\(/;
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
  if (!/can_approve: canApprove\(exp\.dashboard_role, exp\.is_super_admin\) && moveDenied === null/.test(get)) p.push("can_approve is not canApprove AND the POST's door");
  return p;
}, [
  { label: "can_approve from the department alone", caught: /can_approve is not canApprove AND/,
    mutate: (s) => once(s, " && moveDenied === null", "") },
]);

rule("a decision is checked before the write", ROUTE, (c) => {
  const post = bodyOf(c, "POST");
  const writeAt = post.search(/\btransitionApproval\(/);
  if (writeAt < 0) return ["POST no longer calls transitionApproval"];
  const p: string[] = [];
  const knownAt = post.search(/!isApprovalEntity\(body\.entity\) \|\| !isApprovalAction\(body\.action\)/);
  const costAt = post.search(/COST_SENSITIVE_KINDS\.has\(body\.entity\) && !exp\.can_see_cost_data/);
  const approverAt = post.search(/\(body\.action === "approve" \|\| body\.action === "reject"\) && !canApprove\(exp\.dashboard_role, exp\.is_super_admin\)/);
  if (knownAt < 0 || knownAt > writeAt) p.push("entity and action are not checked against the known lists before the write");
  if (costAt < 0 || costAt > writeAt) p.push("a role that cannot see cost data can move a bill or journal");
  if (approverAt < 0 || approverAt > writeAt) p.push("approve and reject do not both need canApprove before the write");
  if (!/tenantId: auth\.tenant_id/.test(post)) p.push("the tenant does not come from the session");
  return p;
}, [
  { label: "reject without the approver check", caught: /approve and reject do not both need canApprove/,
    mutate: (s) => once(s, '(body.action === "approve" || body.action === "reject")', '(body.action === "approve")') },
  { label: "a bill moved by a role that cannot see it", caught: /cannot see cost data can move/,
    mutate: (s) => once(s, "COST_SENSITIVE_KINDS.has(body.entity) && !exp.can_see_cost_data", "false") },
  { label: "the tenant taken from the body", caught: /the tenant does not come from the session/,
    mutate: (s) => once(s, "tenantId: auth.tenant_id", "tenantId: String(body.tenantId)") },
  { label: "any string accepted as an entity", caught: /not checked against the known lists/,
    mutate: (s) => once(s, "!isApprovalEntity(body.entity) || ", "") },
]);

rule("the queue and its activity hide what the caller cannot see", ROUTE, (c) =>
  /const kinds = new Set\(visibleKinds\(exp\.can_see_cost_data\)\);/.test(bodyOf(c, "GET")) &&
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
  if (!/kinds: visibleKinds\(exp\.can_see_cost_data\)/.test(get)) p.push("the activity shows kinds the caller cannot see");
  return p;
}, [
  { label: "an uncapped limit", caught: /the limit is not capped/,
    mutate: (s) => once(s, "Math.min(asked, ACTIVITY_LIMIT_MAX)", "asked") },
  { label: "every kind to every role", caught: /the activity shows kinds/,
    mutate: (s) => once(s, "    kinds: visibleKinds(exp.can_see_cost_data),\n", "") },
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
