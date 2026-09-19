#!/usr/bin/env node
/* validate:me-hr — the employee self-service surface can only ever act on
 * the CALLER's own record.
 *
 * /api/me/hr/* needs no HR permission; the whole safety of that rests on one
 * invariant: the employee id is derived from the session (resolveMyEmployee)
 * and never read from the request. This guard pins that, plus the profile
 * whitelist and the registry wiring, in both directions — the real files
 * pass, and a mutated copy that breaks each rule must fail.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string, why?: string) => { failed++; console.error(`  ✗ ${m}${why ? `\n      ${why}` : ""}`); };
const expect = (cond: boolean, m: string, why?: string) => (cond ? ok(m) : fail(m, why));
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, name);
    if (fs.statSync(path.join(ROOT, rel)).isDirectory()) out.push(...walk(rel));
    else if (name === "route.ts") out.push(rel);
  }
  return out;
}
const ROUTES = walk("src/app/api/me/hr");
const REFERENCE_TABLES = new Set(["hr_leave_types"]);

/** Rule violations in one route source, as messages. */
function routeProblems(src: string): string[] {
  const c = code(src);
  const problems: string[] = [];
  if (!/resolveMyEmployee\(auth\)/.test(c)) problems.push("does not call resolveMyEmployee(auth)");
  if (!/requireAuth\(/.test(c)) problems.push("does not call requireAuth");
  if (/(body|params|form|searchParams)[.[]\s*"?employee_id/.test(c) || /get\("employee_id"\)/.test(c)) problems.push("reads employee_id from the request");
  /* Every hr_* query except reference tables must be pinned to me.id. */
  const chains = c.split(/supabaseServer\s*\.from\(/).slice(1);
  for (const chain of chains) {
    const table = chain.match(/^"([a-z_]+)"/)?.[1] ?? "?";
    if (!table.startsWith("hr_") || REFERENCE_TABLES.has(table)) continue;
    /* Pinned to me — or, for the manager's view, to my reports (teamIds,
       which the same file must derive from manager_id = me.id). */
    const pinned = /employee_id"?\s*[,:]\s*me\.id/.test(chain)
      || (/\.in\("employee_id", teamIds\)/.test(chain) && /\.eq\("manager_id", me\.id\)/.test(c));
    if (!pinned) problems.push(`${table} query not pinned to employee_id = me.id`);
  }
  return problems;
}

console.log("\n§1 every /api/me/hr route is identity-scoped");
expect(ROUTES.length >= 7, `${ROUTES.length} routes found under src/app/api/me/hr`, "expected the bundle GET + leave/leave[id]/approvals[id]/attendance/profile/upload");
for (const r of ROUTES) {
  const p = routeProblems(read(r));
  expect(p.length === 0, r, p.join("; "));
}
{
  const leave = read("src/app/api/me/hr/leave/route.ts");
  const stolen = leave.replace("employee_id: me.id,", 'employee_id: String(body.employee_id),');
  expect(routeProblems(stolen).length > 0, "failure direction: a route taking employee_id from the body is flagged");
  const unpinned = leave.replace('.eq("employee_id", me.id).in("status"', '.in("status"');
  expect(routeProblems(unpinned).some((m) => m.includes("not pinned")), "failure direction: an hr_ query without employee_id = me.id is flagged");
  const noResolve = leave.replace("resolveMyEmployee(auth)", "resolveMyEmployee(auth as never, body)");
  expect(routeProblems(noResolve).length > 0, "failure direction: a route that bypasses resolveMyEmployee(auth) is flagged");
}

console.log("\n§1b the manager's step acts only as ME, only as a manager");
{
  const r = code(read("src/app/api/me/hr/approvals/[id]/route.ts"));
  expect(/as:\s*"manager"/.test(r) && /reviewerEmployeeId:\s*me\.id/.test(r), "approvals route reviews as manager with reviewerEmployeeId = me.id");
  expect(!/as:\s*"hr"/.test(r), "approvals route can never review as HR");
  const lib = code(read("src/lib/server/leave-review.ts"));
  expect(/emp\.manager_id !== opts\.reviewerEmployeeId\) return \{ ok: false, error: "not_your_report" \}/.test(lib), "leave-review refuses a manager who is not the requester's manager_id");
  expect(/\.eq\("status", req\.status\)/.test(lib), "leave-review update is compare-and-set on status");
  const hr = code(read("src/app/api/hr/leave/[id]/review/route.ts"));
  expect(/requireModuleAction\(auth, "HR", "edit"\)/.test(hr) && /as:\s*"hr"/.test(hr), "HR review route is gated on HR·edit and reviews as hr");
  const bundle = read("src/app/api/me/hr/route.ts");
  expect(routeProblems(bundle.replace('.eq("manager_id", me.id)', '.eq("manager_id", String(body?.manager_id))')).length > 0, "failure direction: a team query not derived from manager_id = me.id is flagged");
}

console.log("\n§2 resolveMyEmployee takes only the session");
{
  const me = code(read("src/lib/server/me-hr.ts"));
  expect(/export async function resolveMyEmployee\(auth: ServerAuthContext\)/.test(me), "signature is (auth: ServerAuthContext) — no id parameter");
  expect(/\.eq\("account_id", auth\.account_id\)/.test(me), "direct link keyed on auth.account_id");
  expect(/\.eq\("id", auth\.account_id\)/.test(me) && /\.eq\("person_id", personId\)/.test(me), "person fallback keyed on the account's own person_id");
  expect(!/params|searchParams|req\./.test(me), "never touches a request");
}

console.log("\n§3 profile PATCH is a whitelist of contact fields only");
{
  const types = code(read("src/lib/me-hr-types.ts"));
  const lists = [...types.matchAll(/MY_PROFILE_(PERSON|EMPLOYEE)_FIELDS = \[([\s\S]*?)\] as const/g)].map((m) => m[2]).join(",");
  const fields = lists.split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
  const FORBIDDEN = /full_name|first_name|last_name|email|bank|iban|salary|tax|identification|passport|visa|hire_date|employment|status|department|position|manager|account|employee_number|birth/i;
  const bad = fields.filter((f) => FORBIDDEN.test(f));
  expect(fields.length >= 10 && bad.length === 0, `${fields.length} editable fields, none HR-owned`, bad.join(", "));
  expect(FORBIDDEN.test("bank_account") && FORBIDDEN.test("hire_date"), "failure direction: the forbidden pattern catches bank_account / hire_date");
  const route = code(read("src/app/api/me/hr/profile/route.ts"));
  expect(/for \(const k of MY_PROFILE_PERSON_FIELDS\)/.test(route) && /for \(const k of MY_PROFILE_EMPLOYEE_FIELDS\)/.test(route), "route iterates the whitelists, never the body's keys");
  expect(!/Object\.keys\(body\)|\.\.\.body/.test(route), "route never spreads or enumerates the body");
}

console.log("\n§4 one working-day counter");
{
  const admin = code(read("src/lib/hr-admin.ts"));
  expect(/from "@\/lib\/hr\/leave-days"/.test(admin) && !/function computeBusinessDays/.test(admin), "hr-admin imports computeBusinessDays from leave-days and no longer defines its own");
  const leave = code(read("src/app/api/me/hr/leave/route.ts"));
  expect(/from "@\/lib\/hr\/leave-days"/.test(leave), "self-service leave route uses the same counter");
}

console.log("\n§4b the working calendar is the employee's country's (Phase C)");
{
  const leave = code(read("src/app/api/me/hr/leave/route.ts"));
  expect(/computeBusinessDays\(start, end, calendar\)/.test(leave) && /loadWorkCalendar\(auth\.tenant_id, country/.test(leave), "self-service leave counts days with loadWorkCalendar(country)");
  expect(!/computeBusinessDays\(start, end\)(?!,)/.test(leave.replace(/computeBusinessDays\(start, end\) > 260/, "")), "no bare Sat/Sun count remains on the request path");
  const punch = code(read("src/app/api/me/hr/attendance/route.ts"));
  expect(/lateMinutes\(now, policy\)/.test(punch) && /loadPolicy\(await resolveEmployeeCountry\(me\.id\)\)/.test(punch), "self punch judges late against the employee's country policy");
  const sheet = code(read("src/lib/server/attendance-sheet.ts"));
  expect(/\.eq\("employee_id", opts\.employeeId\)/.test(sheet) && (sheet.match(/\.eq\("employee_id", opts\.employeeId\)/g) ?? []).length >= 2, "sheet builder pins records AND leave to the one employee");
  expect(!/insert\(|upsert\(|update\(/.test(sheet), "sheet builder never writes — derived, not stored");
}

console.log("\n§5 registry wiring");
{
  const nav = code(read("src/lib/navigation.ts"));
  const entry = nav.match(/\{\s*id:\s*"me"[^}]*\}/)?.[0] ?? "";
  expect(/route:\s*"\/me"/.test(entry) && /active:\s*true/.test(entry) && /openAccess:\s*true/.test(entry), 'APP_REGISTRY has { id: "me", route: "/me", active, openAccess }');
  expect(/appIds:\s*\[[^\]]*"me"/.test(nav), 'sidebar People group lists "me"');
  expect(/"app\.me"/.test(read("src/lib/translations/hub.ts")), "hub dictionary names the app (app.me)");
  expect(fs.existsSync(path.join(ROOT, "src/app/me/page.tsx")), "src/app/me/page.tsx exists");
  expect(/"src\/components\/me"/.test(read("scripts/validate-hr-translations.mjs")), "validate:hr-translations scans src/components/me");
}

console.log(failed ? `\nvalidate:me-hr FAILED (${failed})` : "\nvalidate:me-hr passed");
process.exit(failed ? 1 : 0);
