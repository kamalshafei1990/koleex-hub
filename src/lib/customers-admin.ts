"use client";

/* ---------------------------------------------------------------------------
   customers-admin — per-customer reads for the /customers app.

   The UI's /customers view lives on the `contacts` table (filtered to
   rows where contact_type = 'customer'). A separate legacy `customers`
   table is used by the pricing engine, AI agent, and Markets. Those
   two aren't linked by FK, so this module provides:

     · fetchCustomerContact(contactId)       → row from `contacts`
     · fetchCustomerActivity(contactId)      → cross-app recent items +
                                               counts (CRM, Quotations,
                                               Invoices, Projects, Tasks)
     · findLinkedCommercialCustomer(…)       → best-effort match against
                                               the pricing-engine's
                                               `customers` table by
                                               customer_code → email →
                                               company_name → name
     · normalizeTier(value)                  → one canonical tier enum
                                               regardless of which column
                                               the row came from

   Every Supabase call is wrapped in safeBucket so a missing column in
   one module can't blow up the whole profile page.
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";

/* ═══════════════════════════════════════════════════
   TIER NORMALISATION
   ═══════════════════════════════════════════════════ */

/** The UI tier enum used on contacts.customer_type. Includes `end_user`
 *  which the commercial policy + companies table don't define — it's a
 *  pre-tier state. */
export type CustomerTier = "end_user" | "silver" | "gold" | "platinum" | "diamond";

export const CUSTOMER_TIERS: Array<{ value: CustomerTier; label: string; sort: number }> = [
  { value: "end_user", label: "End User", sort: 0 },
  { value: "silver", label: "Silver", sort: 1 },
  { value: "gold", label: "Gold", sort: 2 },
  { value: "platinum", label: "Platinum", sort: 3 },
  { value: "diamond", label: "Diamond", sort: 4 },
];

/** Collapse every customer-tier synonym the codebase uses into one
 *  enum. Accepts values from:
 *     · contacts.customer_type      (end_user|silver|gold|platinum|diamond)
 *     · companies.customer_level    (silver|gold|platinum|diamond)
 *     · customers.preferred_pricing_tier  (free text — we normalise
 *                                          capitalisation and common
 *                                          abbreviations)
 *  Returns null when the value is genuinely missing. */
export function normalizeTier(raw: unknown): CustomerTier | null {
  if (!raw) return null;
  const v = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
  if (v === "end_user" || v === "enduser" || v === "consumer" || v === "retail") return "end_user";
  if (v === "silver" || v === "s") return "silver";
  if (v === "gold" || v === "g") return "gold";
  if (v === "platinum" || v === "plat" || v === "p") return "platinum";
  if (v === "diamond" || v === "dia" || v === "d" || v === "vip") return "diamond";
  return null;
}

/* ═══════════════════════════════════════════════════
   CONTACT FETCH
   ═══════════════════════════════════════════════════ */

/** Full contact row, typed loosely because the `contacts` table has
 *  ~100 columns and typing every one here would outlive the actual
 *  schema. The profile page reads specific fields it cares about. */
export type CustomerContactRow = Record<string, unknown> & {
  id: string;
  contact_type: string | null;
  customer_type: string | null;
  display_name: string | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

export async function fetchCustomerContact(contactId: string): Promise<CustomerContactRow | null> {
  if (!contactId) return null;
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .maybeSingle();
  if (error) {
    console.error("[customers-admin] fetchCustomerContact:", error.message);
    return null;
  }
  return data as CustomerContactRow | null;
}

/* ═══════════════════════════════════════════════════
   LINK TO COMMERCIAL `customers` TABLE
   ═══════════════════════════════════════════════════ */

/** Best-effort match between a UI contact and a pricing-engine
 *  customers row. Tries progressively looser joins:
 *
 *   1. exact customer_code match (if the contact stores one)
 *   2. email match
 *   3. company_name match (for B2B)
 *   4. display_name match (for B2C)
 *
 *  Returns null when no match is found — the profile page treats
 *  this as "no linked commercial record yet" and shows a nudge to
 *  create one. */
export interface LinkedCommercialCustomer {
  id: string;
  name: string | null;
  customer_code: string | null;
  preferred_pricing_tier: string | null;
  assigned_salesperson: string | null;
  currency_code: string | null;
  payment_terms: string | null;
  last_contact_date: string | null;
  next_followup_date: string | null;
  status: string | null;
  is_active: boolean | null;
}

export async function findLinkedCommercialCustomer(
  contact: CustomerContactRow,
): Promise<LinkedCommercialCustomer | null> {
  const SELECT = "id, name, customer_code, preferred_pricing_tier, assigned_salesperson, " +
    "currency_code, payment_terms, last_contact_date, next_followup_date, status, is_active";

  const tryQuery = async (col: string, val: string) => {
    try {
      const { data } = await supabase
        .from("customers")
        .select(SELECT)
        .eq(col, val)
        .limit(1)
        .maybeSingle();
      return (data as LinkedCommercialCustomer | null) || null;
    } catch {
      return null;
    }
  };

  /* Try strongest signal first. `customer_code` isn't on contacts
     today, so start with email and names. */
  const email = contact.email as string | undefined;
  if (email) {
    const hit = await tryQuery("email", email);
    if (hit) return hit;
  }

  const companyName = contact.company_name as string | undefined;
  if (companyName) {
    const hit = await tryQuery("company_name", companyName);
    if (hit) return hit;
  }

  const displayName = contact.display_name as string | undefined;
  if (displayName) {
    const hit = await tryQuery("name", displayName);
    if (hit) return hit;
  }

  return null;
}

/* ═══════════════════════════════════════════════════
   ACTIVITY AGGREGATOR
   ═══════════════════════════════════════════════════ */

export interface ActivityItem {
  id: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  href?: string | null;
  createdAt: string | null;
}

export interface ActivityBucket {
  count: number;
  recent: ActivityItem[];
}

export interface CustomerActivity {
  opportunities: ActivityBucket;
  quotations: ActivityBucket;
  invoices: ActivityBucket;
  projects: ActivityBucket;
  tasks: ActivityBucket;
}

const EMPTY_BUCKET: ActivityBucket = { count: 0, recent: [] };
const RECENT_LIMIT = 5;

async function safeBucket<T>(
  run: () => Promise<{ rows: T[]; count: number | null }>,
  map: (r: T) => ActivityItem,
): Promise<ActivityBucket> {
  try {
    const { rows, count } = await run();
    return { count: count ?? rows.length, recent: rows.map(map) };
  } catch (e) {
    console.warn("[customers-admin activity bucket]", e);
    return EMPTY_BUCKET;
  }
}

/** Cross-app activity snapshot for one customer (contact). Buckets:
 *    · CRM opportunities   (crm_opportunities.contact_id)
 *    · Quotations          (quotations.customer_id)
 *    · Invoices            (invoices.customer_id)
 *    · Projects            (projects.customer_id)
 *    · Open tasks          (project_tasks on those projects) */
export async function fetchCustomerActivity(contactId: string): Promise<CustomerActivity> {
  if (!contactId) {
    return {
      opportunities: EMPTY_BUCKET,
      quotations: EMPTY_BUCKET,
      invoices: EMPTY_BUCKET,
      projects: EMPTY_BUCKET,
      tasks: EMPTY_BUCKET,
    };
  }

  const [opportunities, quotations, invoices, projects] = await Promise.all([
    safeBucket<Record<string, unknown>>(
      async () => {
        const { data, count } = await supabase
          .from("crm_opportunities")
          .select("id, name, stage_id, value, currency, expected_close_date, created_at", { count: "exact" })
          .eq("contact_id", contactId)
          .order("created_at", { ascending: false })
          .limit(RECENT_LIMIT);
        return { rows: (data || []) as Record<string, unknown>[], count };
      },
      (r) => ({
        id: String(r.id),
        title: (r.name as string) || "Opportunity",
        subtitle: r.expected_close_date ? `Close ${r.expected_close_date}` : null,
        amount: (r.value as number) ?? null,
        currency: (r.currency as string) ?? null,
        status: null,
        createdAt: (r.created_at as string) ?? null,
        href: "/crm",
      }),
    ),
    safeBucket<Record<string, unknown>>(
      async () => {
        const { data, count } = await supabase
          .from("quotations")
          .select("id, quote_no, status, total, currency, issue_date, created_at", { count: "exact" })
          .eq("customer_id", contactId)
          .order("created_at", { ascending: false })
          .limit(RECENT_LIMIT);
        return { rows: (data || []) as Record<string, unknown>[], count };
      },
      (r) => ({
        id: String(r.id),
        title: (r.quote_no as string) || "Quotation",
        subtitle: (r.issue_date as string) || null,
        status: (r.status as string) || null,
        amount: (r.total as number) ?? null,
        currency: (r.currency as string) ?? null,
        createdAt: (r.created_at as string) ?? null,
        href: `/quotations/${r.id}`,
      }),
    ),
    safeBucket<Record<string, unknown>>(
      async () => {
        const { data, count } = await supabase
          .from("invoices")
          .select("id, inv_no, status, total, currency, issue_date, amount_paid, balance, created_at", { count: "exact" })
          .eq("customer_id", contactId)
          .order("created_at", { ascending: false })
          .limit(RECENT_LIMIT);
        return { rows: (data || []) as Record<string, unknown>[], count };
      },
      (r) => ({
        id: String(r.id),
        title: (r.inv_no as string) || "Invoice",
        subtitle: (r.issue_date as string) || null,
        status: (r.status as string) || null,
        amount: (r.total as number) ?? null,
        currency: (r.currency as string) ?? null,
        createdAt: (r.created_at as string) ?? null,
        href: `/invoices/${r.id}`,
      }),
    ),
    safeBucket<Record<string, unknown>>(
      async () => {
        const { data, count } = await supabase
          .from("projects")
          .select("id, name, code, status, planned_end, created_at", { count: "exact" })
          .eq("customer_id", contactId)
          .order("created_at", { ascending: false })
          .limit(RECENT_LIMIT);
        return { rows: (data || []) as Record<string, unknown>[], count };
      },
      (r) => ({
        id: String(r.id),
        title: (r.name as string) || "Project",
        subtitle: (r.code as string) || null,
        status: (r.status as string) || null,
        createdAt: (r.created_at as string) ?? null,
        href: `/projects/${r.id}`,
      }),
    ),
  ]);

  /* Open tasks across this customer's projects. Piggyback on the
     projects bucket we just fetched so we don't hit Supabase a
     second time for IDs. */
  const projectIds = projects.recent.map((r) => r.id);
  const tasks = projectIds.length === 0
    ? EMPTY_BUCKET
    : await safeBucket<Record<string, unknown>>(
        async () => {
          const { data, count } = await supabase
            .from("project_tasks")
            .select("id, title, status, priority, due_date, project_id, created_at", { count: "exact" })
            .in("project_id", projectIds)
            .neq("status", "done")
            .order("created_at", { ascending: false })
            .limit(RECENT_LIMIT);
          return { rows: (data || []) as Record<string, unknown>[], count };
        },
        (r) => ({
          id: String(r.id),
          title: (r.title as string) || "Task",
          subtitle: r.due_date ? `Due ${r.due_date}` : null,
          status: (r.status as string) || null,
          createdAt: (r.created_at as string) ?? null,
          href: `/projects/${r.project_id}`,
        }),
      );

  return { opportunities, quotations, invoices, projects, tasks };
}

/* ═══════════════════════════════════════════════════
   CSV EXPORT
   ═══════════════════════════════════════════════════ */

/** Escape one CSV cell per RFC 4180: wrap in quotes if the value
 *  contains a comma, newline, or double-quote; double any internal
 *  quotes. Nulls become empty strings. */
function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const CSV_HEADERS = [
  "id", "display_name", "company_name", "customer_type", "entity_type",
  "is_active", "email", "phone", "whatsapp", "country", "city",
  "sales_rep", "payment_terms", "credit_limit", "currency",
  "first_contact_date", "last_contacted", "follow_up_date", "created_at",
] as const;

/** Build a CSV string for the given list of customer contact rows.
 *  Caller is responsible for download — we stay framework-free. */
export function customersToCsv(rows: CustomerContactRow[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(CSV_HEADERS.map((h) => csvCell(r[h])).join(","));
  }
  return lines.join("\n");
}
