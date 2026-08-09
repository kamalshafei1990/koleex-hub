import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET /api/customers/[id]/activity
   The cross-app snapshot on a customer's profile: CRM opportunities,
   quotations, invoices, projects, and the open tasks on those projects.

   These five queries used to run in the BROWSER with the anon key. Every one
   of those tables has RLS on with no anon policy, and the client wrapper
   swallowed a failing bucket and reported an empty one — so the panel showed
   zeros without ever saying why. Five cross-border round trips are now one,
   and a bucket that fails is logged by name.

   `?resolve=` on the same path answers the other question the profile asks:
   is there a commercial `customers` row for this contact? That was three
   sequential browser queries (email, then company name, then display name)
   against a table the browser cannot read either. */

const LIMIT = 5;

interface ActivityItem {
  id: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  href?: string | null;
  createdAt: string | null;
}
interface ActivityBucket { count: number; recent: ActivityItem[] }
const EMPTY: ActivityBucket = { count: 0, recent: [] };

type Row = Record<string, unknown>;
const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const n = (v: unknown): number | null => (typeof v === "number" ? v : null);

async function bucket<T>(
  name: string,
  /* PromiseLike: a PostgREST builder is a thenable, not a Promise. */
  run: () => PromiseLike<{ data: T[] | null; count: number | null; error: { message: string } | null }>,
  map: (row: T) => ActivityItem,
): Promise<ActivityBucket> {
  try {
    const { data, count, error } = await run();
    if (error) {
      console.error(`[api/customers/activity] ${name}:`, error.message);
      return EMPTY;
    }
    const rows = data ?? [];
    return { count: count ?? rows.length, recent: rows.map(map) };
  } catch (e) {
    console.error(`[api/customers/activity] ${name} threw:`, e);
    return EMPTY;
  }
}

const LINKED_SELECT =
  "id, name, customer_code, preferred_pricing_tier, assigned_salesperson, " +
  "currency_code, payment_terms, last_contact_date, next_followup_date, status, is_active";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: contactId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Customers");
  if (deny) return deny;

  const url = new URL(req.url);

  /* ── ?resolve=1 — find the commercial customers row for this contact ──
     Strongest signal first: email, then company name, then display name.
     Tenant-scoped, which the browser version was not. */
  if (url.searchParams.get("resolve") === "1") {
    const attempts: [string, string | null][] = [
      ["email", url.searchParams.get("email")],
      ["company_name", url.searchParams.get("company_name")],
      ["name", url.searchParams.get("display_name")],
    ];
    for (const [col, val] of attempts) {
      if (!val) continue;
      const { data, error } = await supabaseServer
        .from("customers")
        .select(LINKED_SELECT)
        .eq("tenant_id", auth.tenant_id)
        .eq(col, val)
        .limit(1)
        .maybeSingle();
      if (error) { console.error(`[api/customers/resolve] ${col}:`, error.message); continue; }
      if (data) return NextResponse.json({ customer: data });
    }
    return NextResponse.json({ customer: null });
  }

  const [opportunities, quotations, invoices, projects] = await Promise.all([
    /* expected_revenue, not `value`, and crm_opportunities has no currency
       column — the browser version asked for both, so this bucket errored on
       every load and reported zero opportunities. */
    bucket<Row>("crm_opportunities", () =>
      supabaseServer
        .from("crm_opportunities")
        .select("id, name, stage_id, expected_revenue, expected_close_date, created_at", { count: "exact" })
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      (r) => ({
        id: String(r.id),
        title: s(r.name) ?? "Opportunity",
        subtitle: s(r.expected_close_date) ? `Close ${s(r.expected_close_date)}` : null,
        amount: n(r.expected_revenue), currency: null, status: null,
        createdAt: s(r.created_at), href: "/crm",
      })),

    bucket<Row>("quotations", () =>
      supabaseServer
        .from("quotations")
        .select("id, quote_no, status, total, currency, issue_date, created_at", { count: "exact" })
        .eq("customer_id", contactId)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      (r) => ({
        id: String(r.id),
        title: s(r.quote_no) ?? "Quotation",
        subtitle: s(r.issue_date), status: s(r.status),
        amount: n(r.total), currency: s(r.currency),
        createdAt: s(r.created_at), href: `/quotations/${r.id}`,
      })),

    bucket<Row>("invoices", () =>
      supabaseServer
        .from("invoices")
        .select("id, inv_no, status, total, currency, issue_date, amount_paid, balance, created_at", { count: "exact" })
        .eq("customer_id", contactId)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      (r) => ({
        id: String(r.id),
        title: s(r.inv_no) ?? "Invoice",
        subtitle: s(r.issue_date), status: s(r.status),
        amount: n(r.total), currency: s(r.currency),
        createdAt: s(r.created_at), href: `/invoices/${r.id}`,
      })),

    bucket<Row>("projects", () =>
      supabaseServer
        .from("projects")
        .select("id, name, code, status, planned_end, created_at", { count: "exact" })
        .eq("customer_id", contactId)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      (r) => ({
        id: String(r.id),
        title: s(r.name) ?? "Project", subtitle: s(r.code),
        status: s(r.status), createdAt: s(r.created_at), href: `/projects/${r.id}`,
      })),
  ]);

  /* Open tasks across the projects just fetched — the same scope the browser
     version used (the recent page, not every project this customer ever had). */
  const projectIds = projects.recent.map((p) => p.id);
  const tasks = projectIds.length === 0
    ? EMPTY
    : await bucket<Row>("project_tasks", () =>
        supabaseServer
          .from("project_tasks")
          .select("id, title, status, priority, due_date, project_id, created_at", { count: "exact" })
          .in("project_id", projectIds)
          .neq("status", "done")
          .order("created_at", { ascending: false })
          .limit(LIMIT),
        (r) => ({
          id: String(r.id),
          title: s(r.title) ?? "Task",
          subtitle: s(r.due_date) ? `Due ${s(r.due_date)}` : null,
          status: s(r.status), createdAt: s(r.created_at), href: `/projects/${r.project_id}`,
        }));

  return NextResponse.json(
    { activity: { opportunities, quotations, invoices, projects, tasks } },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
