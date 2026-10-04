#!/usr/bin/env node
/* validate:attendance — the owner's attendance rules (Phase 1, approved
 * 23 Sep 2026) stay true.
 *
 *   §1 time math — overtime is only the time after the policy's end; a day
 *      auto-closed at the end time has none; wall-clock ↔ instant in the
 *      policy zone (Cairo's summer time included); the zone's "today".
 *   §2 money — payroll pays APPROVED overtime only; a workday before
 *      tracking starts (or before the hire date) is not_tracked, never absent.
 *   §3 routes — every HR attendance route is HR-gated (view to read, edit or
 *      create to write); decisions claim the row first so two reviewers cannot
 *      both apply; the self punch refuses device-only staff; the cron is
 *      secret-guarded and its writes are conditional.
 *   §4 the HR screen edits a day — it no longer clocks out "on behalf".
 *   §5 wiring — the cron in vercel.json, the migration.
 *   §6 payroll totals per currency (26 Sep 2026) — a run never adds EGP and
 *      USD together, on its row, on its screen or in its ledger entry.
 *
 * Source rules are checked in both directions, like validate:me-hr: the real
 * files pass, and a mutated copy that breaks each rule must fail.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  overtimeMinutes, wallClockToIso, todayInZone, dayEndIso, lateMinutes, workedHours, DEFAULT_POLICY,
  type AttendancePolicy,
} from "../src/lib/server/work-calendar";
import { stripComments } from "./lib/strip-comments";
import { employerTotal, payrollLines, runColumns, totalsByCurrency } from "../src/lib/hr/payroll-totals";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string, why?: string) => { failed++; console.error(`  ✗ ${m}${why ? `\n      ${why}` : ""}`); };
const expect = (cond: boolean, m: string, why?: string) => (cond ? ok(m) : fail(m, why));
const eq = (got: unknown, want: unknown, m: string) => expect(got === want, m, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (src: string) => stripComments(src);

/** A rule is a function from source to problems; it must pass on the real
 *  file and fail on the mutation. */
function rule(name: string, file: string, check: (c: string) => string[], mutate: (src: string) => string) {
  const src = read(file);
  const real = check(code(src));
  expect(real.length === 0, `${name} (${file})`, real.join("; "));
  const mutated = mutate(src);
  if (mutated === src) { fail(`${name}: the mutation did not apply — update the guard`); return; }
  expect(check(code(mutated)).length > 0, `${name}: a copy that breaks it fails`);
}

/* ── §1 time math ─────────────────────────────────────────────────────── */
console.log("\n§1 time math (China policy 09:00–18:00, grace 15)");
const CN: AttendancePolicy = { ...DEFAULT_POLICY, timezone: "Asia/Shanghai", workStart: "09:00", workEnd: "18:00", lateThresholdMin: 15 };
const EG: AttendancePolicy = { ...CN, timezone: "Africa/Cairo" };
const D = "2026-09-22";
const cn = (hhmm: string) => wallClockToIso(D, hhmm, "Asia/Shanghai");
eq(cn("18:00"), "2026-09-22T10:00:00.000Z", "18:00 China = 10:00 UTC");
eq(wallClockToIso(D, "18:00", "Africa/Cairo"), "2026-09-22T15:00:00.000Z", "18:00 Cairo in September = 15:00 UTC (summer time)");
eq(wallClockToIso("2026-12-01", "18:00", "Africa/Cairo"), "2026-12-01T16:00:00.000Z", "18:00 Cairo in December = 16:00 UTC");
eq(wallClockToIso(D, "25:00", "Asia/Shanghai"), null, "an impossible time is rejected");
eq(dayEndIso(D, CN), cn("18:00"), "the day ends at the policy's end time");
const lateNight = new Date("2026-09-22T17:00:00Z");
eq(todayInZone("Asia/Shanghai", lateNight), "2026-09-23", "01:00 in China is already the next day there");
eq(todayInZone("Africa/Cairo", lateNight), "2026-09-22", "…while it is still the same day in Cairo");

eq(overtimeMinutes(cn("09:00"), cn("18:00"), D, CN), 0, "09:00 → 18:00 has no overtime");
eq(overtimeMinutes(cn("09:00"), cn("19:30"), D, CN), 90, "09:00 → 19:30 = 90 minutes after 18:00");
eq(overtimeMinutes(cn("10:30"), cn("19:30"), D, CN), 90, "a late arrival still counts only the time after 18:00");
eq(overtimeMinutes(cn("08:00"), cn("17:00"), D, CN), 0, "coming early is not overtime");
eq(overtimeMinutes(cn("19:00"), cn("21:00"), D, CN), 120, "a day started after 18:00 counts from the clock-in");
eq(overtimeMinutes(cn("09:00"), null, D, CN), 0, "an open day has no overtime");
eq(overtimeMinutes(cn("09:00"), dayEndIso(D, CN), D, CN), 0, "a day auto-closed at the end time has no overtime");
eq(overtimeMinutes(wallClockToIso(D, "09:00", "Africa/Cairo"), wallClockToIso(D, "19:00", "Africa/Cairo"), D, EG), 60, "the Cairo policy counts after 18:00 Cairo time");

eq(lateMinutes(cn("09:15"), CN), 0, "09:15 is within the grace");
eq(lateMinutes(cn("09:20"), CN), 5, "09:20 is 5 minutes late");
eq(lateMinutes(null, CN), 0, "no clock-in, no lateness");
eq(workedHours(cn("09:00")!, cn("18:00")!, 60), 8, "09:00 → 18:00 with a 60-minute break = 8 h");
eq(workedHours(cn("09:00")!, cn("08:00")!, 0), 0, "hours are never negative");

/* ── §2 money ─────────────────────────────────────────────────────────── */
console.log("\n§2 payroll and the monthly sheet");
rule("payroll pays approved overtime only", "src/lib/server/payroll-run.ts",
  (c) => {
    const p: string[] = [];
    if (!/overtimeHours:\s*sheet\.summary\.overtimeApprovedH\b/.test(c)) p.push("overtimeHours is not sheet.summary.overtimeApprovedH");
    if (/overtimeHours:\s*sheet\.summary\.overtimeH\b/.test(c)) p.push("overtimeHours reads the unapproved overtimeH");
    return p;
  },
  (s) => s.replace("overtimeHours: sheet.summary.overtimeApprovedH", "overtimeHours: sheet.summary.overtimeH"));

rule("days before tracking / hire are not_tracked, never absent", "src/lib/server/attendance-sheet.ts",
  (c) => {
    const p: string[] = [];
    if (!/if \(!trackingFrom \|\| date < trackingFrom\)[^\n]*status: "not_tracked"/.test(c)) p.push("an unpunched workday before trackingFrom is not marked not_tracked");
    if (!/hireDate && hireDate > policy\.trackingFrom \? hireDate : policy\.trackingFrom/.test(c)) p.push("trackingFrom does not start at the later of the hire date and the policy date");
    if (!/overtimeState === "approved"/.test(c)) p.push("approved overtime is not read from the decision");
    return p;
  },
  (s) => s.replace('return { ...base, status: "not_tracked" }', 'return { ...base, status: "absent" }'));

rule("approved overtime comes from the stored decision", "src/lib/server/attendance-sheet.ts",
  (c) => (/overtime_approved_minutes/.test(c) ? [] : ["the sheet never reads overtime_approved_minutes"]),
  (s) => s.replace(/overtime_approved_minutes/g, "overtime_minutes_x"));

/* ── §3 routes ────────────────────────────────────────────────────────── */
console.log("\n§3 routes");
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, name);
    if (fs.statSync(path.join(ROOT, rel)).isDirectory()) out.push(...walk(rel));
    else if (name === "route.ts") out.push(rel);
  }
  return out;
}
/** Every exported handler authenticates and asks HR for the right action. */
function gatingProblems(c: string): string[] {
  const p: string[] = [];
  const parts = c.split(/export async function (GET|POST|PATCH|PUT|DELETE)\b/).slice(1);
  if (parts.length === 0) p.push("no handlers found");
  for (let i = 0; i < parts.length; i += 2) {
    const method = parts[i];
    const body = parts[i + 1] ?? "";
    if (!/requireAuth\(/.test(body)) p.push(`${method} does not call requireAuth`);
    const action = body.match(/requireModuleAction\(auth,\s*"HR",\s*"(\w+)"\)/)?.[1];
    if (!action) p.push(`${method} is not HR-gated`);
    else if (method === "GET" ? action !== "view" : !["edit", "create"].includes(action)) p.push(`${method} asks HR·${action}`);
  }
  return p;
}
const HR_ROUTES = walk("src/app/api/hr/attendance");
expect(HR_ROUTES.length >= 7, `${HR_ROUTES.length} HR attendance routes found`, "expected import, sheet, record, corrections, corrections/[id], overtime, employees");
for (const r of HR_ROUTES) {
  const p = gatingProblems(code(read(r)));
  expect(p.length === 0, `HR-gated: ${r}`, p.join("; "));
}
rule("a write that asks only HR·view is caught", "src/app/api/hr/attendance/record/route.ts",
  gatingProblems, (s) => s.replace('requireModuleAction(auth, "HR", "edit")', 'requireModuleAction(auth, "HR", "view")'));

rule("a correction is claimed before it is applied", "src/app/api/hr/attendance/corrections/[id]/route.ts",
  (c) => {
    const claim = c.search(/\.eq\("id", id\)\.eq\("status", "pending"\)/);
    const apply = c.search(/setDayTimes\(\{/);
    if (claim < 0) return ["the decision update is not conditional on status = pending"];
    if (apply < 0) return ["an approved request is not applied through setDayTimes"];
    return claim < apply ? [] : ["setDayTimes runs before the claim"];
  },
  (s) => s.replace('.eq("id", id).eq("status", "pending")', '.eq("id", id)'));

rule("overtime is decided once, never above the punches", "src/app/api/hr/attendance/overtime/route.ts",
  (c) => {
    const p: string[] = [];
    if (!/\.is\("overtime_status", null\)\.select\("id"\)/.test(c)) p.push("the decision update is not conditional on overtime_status IS NULL");
    if (!/Math\.min\(Math\.round\(asked\), x\.minutes\)/.test(c)) p.push("approved minutes are not capped at the punched overtime");
    return p;
  },
  (s) => s.replace('.is("overtime_status", null).select("id")', '.select("id")'));

rule("the self punch refuses device-only staff", "src/app/api/me/hr/attendance/route.ts",
  (c) => {
    const refuse = c.search(/if \(method === "device"\) return NextResponse\.json\(\{ error: "device_only" \}/);
    const insert = c.search(/\.from\("hr_attendance_records"\)\s*\.insert\(/);
    if (refuse < 0) return ["no device_only refusal"];
    return insert < 0 || refuse < insert ? [] : ["the refusal comes after the insert"];
  },
  (s) => s.replace('if (method === "device") return NextResponse.json({ error: "device_only" }, { status: 403 });', ""));

rule("the cron is secret-guarded and never double-closes", "src/app/api/cron/attendance/route.ts",
  (c) => {
    const p: string[] = [];
    if (!/req\.headers\.get\("authorization"\) !== `Bearer \$\{secret\}`/.test(c)) p.push("no CRON_SECRET bearer check");
    /* The close's own statement (no ";" inside it) must carry the condition —
       the reminder's clock_out filter further down does not count. */
    if (!/auto_closed: true,[^;]*\}\)\.eq\("id", r\.id\)\.is\("clock_out", null\)/.test(c)) p.push("the auto-close is not conditional on clock_out IS NULL");
    if (!/\.is\("reminded_at", null\)/.test(c)) p.push("the reminder is not conditional on reminded_at IS NULL");
    if (!/r\.date < todayInZone\(policy\.timezone, now\)/.test(c)) p.push("days are closed by the server date, not the policy zone's");
    if (!/dayEndIso\(r\.date, policy\)/.test(c)) p.push("the close time is not the policy's end time");
    return p;
  },
  (s) => s.replace('}).eq("id", r.id).is("clock_out", null).select("id").maybeSingle();', '}).eq("id", r.id).select("id").maybeSingle();'));

rule("one writer marks a changed day corrected and re-opens its overtime decision", "src/lib/server/attendance-records.ts",
  (c) => {
    const p: string[] = [];
    if (!/corrected: true/.test(c)) p.push("setDayTimes does not mark the day corrected");
    if (!/overtime_status: null/.test(c)) p.push("setDayTimes keeps an old overtime decision for new times");
    if (!/auto_closed: false/.test(c)) p.push("a corrected day stays flagged auto-closed");
    return p;
  },
  (s) => s.replace("overtime_status: null", "overtime_status: undefined"));

/* ── §4 the HR screen ─────────────────────────────────────────────────── */
console.log("\n§4 the HR screen");
rule("the HR screen edits a day instead of clocking out on behalf", "src/components/hr/modules/Attendance.tsx",
  (c) => {
    const p: string[] = [];
    if (/\bclockOut\s*[,}]/.test(c.match(/import \{[\s\S]*?\} from "@\/lib\/hr-admin";/)?.[0] ?? "")) p.push("imports clockOut from hr-admin");
    if (/hr\.clockOutBtn/.test(c)) p.push("still renders the clock-out-on-behalf button");
    if (!/editAttendanceDay\(/.test(c)) p.push("no edit-day save");
    if (!/new Intl\.DateTimeFormat\("en-CA"/.test(c)) p.push("today is computed from the UTC date");
    return p;
  },
  (s) => s.replace("fetchAttendanceRecords, fetchAttendanceSheet,", "fetchAttendanceRecords, clockOut, fetchAttendanceSheet,"));

/* ── §5 wiring ────────────────────────────────────────────────────────── */
console.log("\n§5 wiring");
const vercel = JSON.parse(read("vercel.json")) as { crons?: Array<{ path: string; schedule: string }> };
const cron = vercel.crons?.find((c) => c.path === "/api/cron/attendance");
expect(!!cron, "vercel.json schedules /api/cron/attendance", "the forgotten-clock-out reminder and auto-close would never run");
expect(!!cron && /^\*\/(5|10|15) \* \* \* \*$/.test(cron.schedule), `…every few minutes (${cron?.schedule ?? "none"})`, "a reminder 30 minutes after the end needs a run at least every 15 minutes");
// SQL, not TS: its -- comments go too, so a commented-out statement cannot pass
const mig = stripComments(read("supabase/migrations/20260923_attendance_phase1.sql"), { lang: "sql" });
for (const col of ["tracking_from", "punch_method", "works_remote", "auto_closed", "corrected", "reminded_at", "overtime_status", "overtime_approved_minutes"]) {
  expect(new RegExp(`ADD COLUMN IF NOT EXISTS ${col}\\b`).test(mig), `migration adds ${col}`);
}
expect(/CREATE TABLE IF NOT EXISTS hr_attendance_corrections/.test(mig), "migration creates hr_attendance_corrections");
expect(/ALTER TABLE hr_attendance_corrections ENABLE ROW LEVEL SECURITY/.test(mig), "…with RLS on (server routes only)");

console.log("\n§6 payroll totals per currency (26 Sep 2026)");
{
  const slips = [
    { currency: "EGP", gross: 10000, net: 8600, employer: 1875 },
    { currency: "USD", gross: 2000, net: 1800, employer: 0 },
    { currency: "egp", gross: 5000, net: 4300, employer: 937.5 },
    { currency: null, gross: 100, net: 100, employer: 0 },
  ];
  const lines = totalsByCurrency(slips);
  expect(JSON.stringify(lines.map((l) => [l.currency, l.employees, l.gross, l.net, l.employer])) === JSON.stringify([["EGP", 2, 15000, 12900, 2812.5], ["USD", 2, 2100, 1900, 0]]),
    "a run's totals are one line per currency — EGP and USD never added together; a slip with no currency counts as USD, the engine's default",
    JSON.stringify(lines));
  const one = runColumns(totalsByCurrency([slips[0], slips[2]]));
  expect(one.currency === "EGP" && one.total_gross === 15000 && one.employees === 2, "a run that pays one currency keeps its totals on its row");
  const many = runColumns(lines);
  expect(many.currency === null && many.total_gross === null && many.total_net === null && many.employees === 4, "…and one that pays several keeps NO total (no sum of EGP and USD) and no currency", JSON.stringify(many));
  expect(employerTotal({ "Social insurance": 1875.25, Other: "10" }) === 1885.25, "a slip's employer share adds its contributions");
  const ledger = payrollLines(lines, { salaries: "5500", employer: "5510", netOwed: "2300", deductionsOwed: "2310" }, "2026-09");
  const byCur = new Map<string, { dr: number; cr: number }>();
  for (const l of ledger) { const c = byCur.get(l.currency) ?? { dr: 0, cr: 0 }; c.dr += l.debit; c.cr += l.credit; byCur.set(l.currency, c); }
  expect([...byCur.values()].every((c) => Math.abs(c.dr - c.cr) < 0.005) && byCur.size === 2, "the ledger entry is one balanced group of lines per currency — so it balances at any rate",
    JSON.stringify([...byCur]));
  expect(ledger.filter((l) => l.account_id === "5500").map((l) => `${l.currency}:${l.debit}`).join() === "EGP:15000,USD:2100", "…salaries are debited in each currency, never as one sum");
}
rule("the payroll run saves its totals per currency", "src/lib/server/payroll-run.ts",
  (c) => (c.includes("result.totals.byCurrency = totalsByCurrency(paid);") && c.includes("...runColumns(result.totals.byCurrency)") && !/currency = currency \?\? breakdown\.currency/.test(c) ? [] : ["the run adds every currency under the first slip's"]),
  (src) => src.replace("...runColumns(result.totals.byCurrency)", "currency: paid[0]?.currency ?? null, total_gross: paid.reduce((a, p) => a + Number(p.gross), 0)"));
rule("the payroll ledger entry is drafted per currency from the run's own slips", "src/lib/accounting/posting.ts",
  (c) => (c.includes('.from("hr_payslips")') && c.includes("const lines: DraftLine[] = payrollLines(groups, {") && !/const gross = r2\(run\.total_gross \?\? 0\);/.test(c) ? [] : ["the ledger posts one sum in one currency"]),
  (src) => src.replace("const lines: DraftLine[] = payrollLines(groups, {", "const lines: DraftLine[] = payrollLines(groups.slice(0, 1), {"));
rule("the run screen shows each currency's total", "src/components/hr/modules/PayrollRun.tsx",
  (c) => (c.includes('["hr.pay.totalGross", perCurrency(runLines, (l) => l.gross)]') && !c.includes("money(selected.run.total_gross, selected.run.currency)") ? [] : ["the screen shows one mixed total"]),
  (src) => src.replace('["hr.pay.totalGross", perCurrency(runLines, (l) => l.gross)]', '["hr.pay.totalGross", money(selected.run.total_gross, selected.run.currency)]'));

console.log(failed ? `\nvalidate:attendance FAILED (${failed})` : "\nvalidate:attendance passed");
process.exit(failed ? 1 : 0);
