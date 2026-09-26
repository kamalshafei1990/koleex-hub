import "server-only";

/* GET /api/planning/workload?accounts=<uuid,…>&from=YYYY-MM-DD&to=YYYY-MM-DD[&tz=Area/City]

   Planned hours per person per day — the allocation feed for Projects (and
   Planning's own Workload tab). `from`/`to` are inclusive local days in
   `tz` (default UTC), at most 62 days. `accounts` is optional (≤ 200); when
   omitted every employee resource of the tenant is reported.

   Tenant + access: the Planning module is required; every query is tenant-
   filtered, and a non-super-admin's hours are summed ONLY over items they
   may read (created by them, on their own resource, open shifts — the
   planning-access rule), so the feed never reveals a colleague's schedule
   that the Planning board itself would hide.

   Hours: an item's overlap with each day; when the item carries
   allocated_hours, those are spread over its span in proportion instead.
   Cancelled items never count. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { callerResourceIds, planningReadScopeOr, PLANNING_ERR } from "@/lib/server/planning-access";
import { isPlanningUuid } from "@/lib/planning-validate";
import { parsePlanningTz } from "@/lib/planning-recurrence";
import { zonedToUtc } from "@/lib/calendar-tz";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 62;
const MAX_ACCOUNTS = 200;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const tzParam = url.searchParams.get("tz");
  const tz = tzParam ? parsePlanningTz(tzParam) : "UTC";
  const accountsParam = url.searchParams.get("accounts");
  const accounts = accountsParam ? [...new Set(accountsParam.split(",").map((s) => s.trim()).filter(Boolean))] : null;
  const bad = () => NextResponse.json({ error: PLANNING_ERR[400] }, { status: 400 });
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from || !tz) return bad();
  if (accounts && (accounts.length === 0 || accounts.length > MAX_ACCOUNTS || !accounts.every(isPlanningUuid))) return bad();

  const [fy, fm, fd] = from.split("-").map(Number);
  const dayKeys: string[] = [];
  const bounds: number[] = [];
  for (let i = 0; i <= MAX_DAYS; i++) {
    const d = new Date(Date.UTC(fy, fm - 1, fd + i));
    const key = d.toISOString().slice(0, 10);
    bounds.push(zonedToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 0, 0, 0, 0, tz));
    if (key > to) break;
    dayKeys.push(key);
  }
  if (dayKeys[dayKeys.length - 1] !== to) return bad(); // span over MAX_DAYS
  const windowStart = bounds[0];
  const windowEnd = bounds[dayKeys.length];
  const fail = (where: string, msg: string) => {
    console.error(`[api/planning/workload] ${where}:`, msg);
    return NextResponse.json({ error: PLANNING_ERR[500] }, { status: 500 });
  };

  let rq = supabaseServer
    .from("planning_resources")
    .select("id, account_id, name, capacity_hours_per_day")
    .eq("tenant_id", auth.tenant_id)
    .eq("type", "employee")
    .not("account_id", "is", null);
  if (accounts) rq = rq.in("account_id", accounts);
  const { data: resRows, error: resErr } = await rq.limit(2000);
  if (resErr) return fail("resources", resErr.message);
  const resources = (resRows ?? []) as Array<{ id: string; account_id: string; name: string; capacity_hours_per_day: number | null }>;

  type Person = { account_id: string; name: string; resource_ids: string[]; capacity_hours_per_day: number; days: Record<string, number>; total: number };
  const people = new Map<string, Person>();
  const accountByRes = new Map<string, string>();
  for (const r of resources) {
    accountByRes.set(r.id, r.account_id);
    const p = people.get(r.account_id) ?? {
      account_id: r.account_id,
      name: r.name,
      resource_ids: [],
      capacity_hours_per_day: Number(r.capacity_hours_per_day ?? 8),
      days: Object.fromEntries(dayKeys.map((k) => [k, 0])),
      total: 0,
    };
    p.resource_ids.push(r.id);
    people.set(r.account_id, p);
  }
  const body = (list: Person[]) =>
    NextResponse.json({ from, to, tz, days: dayKeys, people: list }, { headers: { "Cache-Control": "private, no-store" } });
  if (resources.length === 0) return body([]);

  let iq = supabaseServer
    .from("planning_items")
    .select("resource_id, start_at, end_at, allocated_hours")
    .eq("tenant_id", auth.tenant_id)
    .in("resource_id", [...accountByRes.keys()])
    .neq("status", "cancelled")
    .gt("end_at", new Date(windowStart).toISOString())
    .lt("start_at", new Date(windowEnd).toISOString());
  if (!auth.is_super_admin) {
    try {
      iq = iq.or(planningReadScopeOr(auth.account_id, await callerResourceIds(auth)));
    } catch (e) {
      return fail("scope", e instanceof Error ? e.message : String(e));
    }
  }
  const { data: items, error: itErr } = await iq.limit(5000);
  if (itErr) return fail("items", itErr.message);

  for (const it of (items ?? []) as Array<{ resource_id: string; start_at: string; end_at: string; allocated_hours: number | null }>) {
    const p = people.get(accountByRes.get(it.resource_id) ?? "");
    if (!p) continue;
    const s = Date.parse(it.start_at);
    const e = Date.parse(it.end_at);
    const span = e - s;
    if (!(span > 0)) continue;
    for (let i = 0; i < dayKeys.length; i++) {
      const overlap = Math.min(e, bounds[i + 1]) - Math.max(s, bounds[i]);
      if (overlap <= 0) continue;
      const h = it.allocated_hours != null ? Number(it.allocated_hours) * (overlap / span) : overlap / 3_600_000;
      p.days[dayKeys[i]] += h;
    }
  }
  const list = [...people.values()].map((p) => {
    for (const k of dayKeys) p.days[k] = Math.round(p.days[k] * 100) / 100;
    p.total = Math.round(dayKeys.reduce((s, k) => s + p.days[k], 0) * 100) / 100;
    return p;
  });
  list.sort((a, b) => a.name.localeCompare(b.name));
  return body(list);
}
