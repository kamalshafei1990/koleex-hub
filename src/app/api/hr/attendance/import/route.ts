import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/hr/attendance/import — a fingerprint / turnstile export as CSV.

   Body: { csv: string, dryRun?: boolean }
   Columns (header names matched loosely, any order):
     employee | employee_number | emp_no | id      → koleex_employees.employee_number
     date                                          → YYYY-MM-DD (also D/M/Y, D.M.Y)
     in | clock_in | time_in | first               → HH:MM (or a full timestamp)
     out | clock_out | time_out | last             → HH:MM (or a full timestamp)
     break | break_minutes                         → minutes, optional
   A time of day is read in the employee's policy timezone. One row per
   employee per day; a later row for the same day REPLACES the earlier one
   (the device export is the truth for that day). source = "import". Status
   derives from the policy (late) — the sheet re-derives it anyway.

   dryRun returns the parsed rows and problems without writing.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { lateMinutes, loadPolicy, resolveEmployeeCountry, type AttendancePolicy } from "@/lib/server/work-calendar";

const MAX_ROWS = 5000;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === "," || c === ";" || c === "\t") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const norm = (h: string) => h.trim().toLowerCase().replace(/[\s_-]+/g, "");
const COLS: Record<string, string[]> = {
  employee: ["employee", "employeenumber", "empno", "employeeno", "id", "userid", "badge"],
  date: ["date", "day"],
  in: ["in", "clockin", "timein", "first", "checkin", "start"],
  out: ["out", "clockout", "timeout", "last", "checkout", "end"],
  brk: ["break", "breakminutes", "breakmin"],
};

function isoDate(v: string): string | null {
  const s = v.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
/** A time cell → instant. "HH:MM[:SS]" is wall-clock in `tz` on `date`; a
 *  full ISO timestamp is taken as-is. */
function toInstant(v: string, date: string, tz: string): string | null {
  const s = v.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) { const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s.includes(" ") ? s.split(" ").pop()! : s);
  if (!m) return null;
  const local = new Date(`${date}T${m[1].padStart(2, "0")}:${m[2]}:${m[3] ?? "00"}Z`);
  /* Zone offset at that instant, from Intl — no library needed for one shift. */
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(local);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
    const offset = asUtc - local.getTime();
    return new Date(local.getTime() - offset).toISOString();
  } catch { return local.toISOString(); }
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as { csv?: unknown; dryRun?: unknown } | null;
  if (!body || typeof body.csv !== "string" || !body.csv.trim()) return NextResponse.json({ error: "csv is required" }, { status: 400 });
  const dryRun = body.dryRun === true;

  const rows = parseCsv(body.csv);
  if (rows.length < 2) return NextResponse.json({ error: "no_rows" }, { status: 400 });
  if (rows.length > MAX_ROWS + 1) return NextResponse.json({ error: `too_many_rows (max ${MAX_ROWS})` }, { status: 400 });
  const header = rows[0].map(norm);
  const idx = (key: string) => header.findIndex((h) => COLS[key].includes(h));
  const col = { employee: idx("employee"), date: idx("date"), in: idx("in"), out: idx("out"), brk: idx("brk") };
  if (col.employee < 0 || col.date < 0) return NextResponse.json({ error: "missing_columns", need: ["employee", "date"], found: rows[0] }, { status: 400 });

  /* Employee numbers → ids (tenant's employees only). */
  /* tenant OR null — most employee rows carry no tenant_id (see /api/employees). */
  const { data: emps } = await supabaseServer.from("koleex_employees").select("id, employee_number")
    .or(auth.tenant_id ? `tenant_id.eq.${auth.tenant_id},tenant_id.is.null` : "tenant_id.is.null");
  const byNumber = new Map<string, string>();
  for (const e of (emps ?? []) as Array<{ id: string; employee_number: string | null }>) if (e.employee_number) byNumber.set(e.employee_number.trim().toLowerCase(), e.id);

  const problems: Array<{ line: number; problem: string }> = [];
  const parsed = new Map<string, { employee_id: string; date: string; clock_in: string | null; clock_out: string | null; break_minutes: number; line: number }>();
  const policyCache = new Map<string, AttendancePolicy>();
  const policyFor = async (employeeId: string) => {
    let p = policyCache.get(employeeId);
    if (!p) { p = await loadPolicy(await resolveEmployeeCountry(employeeId)); policyCache.set(employeeId, p); }
    return p;
  };

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const num = (r[col.employee] ?? "").trim().toLowerCase();
    const employeeId = byNumber.get(num);
    if (!employeeId) { problems.push({ line: i + 1, problem: `unknown employee "${r[col.employee] ?? ""}"` }); continue; }
    const date = isoDate(r[col.date] ?? "");
    if (!date) { problems.push({ line: i + 1, problem: `bad date "${r[col.date] ?? ""}"` }); continue; }
    const policy = await policyFor(employeeId);
    const clockIn = col.in >= 0 ? toInstant(r[col.in] ?? "", date, policy.timezone) : null;
    const clockOut = col.out >= 0 ? toInstant(r[col.out] ?? "", date, policy.timezone) : null;
    if (!clockIn && !clockOut) { problems.push({ line: i + 1, problem: "no clock-in or clock-out" }); continue; }
    if (clockIn && clockOut && clockOut < clockIn) { problems.push({ line: i + 1, problem: "clock-out before clock-in" }); continue; }
    const brk = col.brk >= 0 ? Math.max(0, Number(r[col.brk]) || 0) : 0;
    parsed.set(`${employeeId}|${date}`, { employee_id: employeeId, date, clock_in: clockIn, clock_out: clockOut, break_minutes: brk, line: i + 1 });
  }

  const records = await Promise.all(Array.from(parsed.values()).map(async (p) => {
    const policy = await policyFor(p.employee_id);
    const totalHours = p.clock_in && p.clock_out ? Math.max(0, Math.round((((Date.parse(p.clock_out) - Date.parse(p.clock_in)) / 60000 - p.break_minutes) / 60) * 100) / 100) : null;
    return {
      employee_id: p.employee_id, date: p.date, clock_in: p.clock_in, clock_out: p.clock_out, break_minutes: p.break_minutes,
      total_hours: totalHours, status: lateMinutes(p.clock_in, policy) > 0 ? "late" : "present", source: "import", notes: null,
      updated_at: new Date().toISOString(),
    };
  }));

  if (dryRun) return NextResponse.json({ dryRun: true, rows: records.length, problems, sample: records.slice(0, 10) });
  if (records.length === 0) return NextResponse.json({ imported: 0, problems });

  const { error } = await supabaseServer.from("hr_attendance_records").upsert(records, { onConflict: "employee_id,date" });
  if (error) {
    console.error("[api/hr/attendance/import]", error.message);
    return NextResponse.json({ error: "Import failed.", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ imported: records.length, problems });
}
