/* ---------------------------------------------------------------------------
   contacts-config — server-list contracts for the contacts directory
   (Customers pilot + Suppliers Wave 2A.2). Extracted from the route handler so
   the exact search/sort/filter allowlists + slim projection are importable by
   deterministic security tests (validate:suppliers-security).

   Framework-agnostic (no React / Supabase / server-only) so it can be imported
   from both the route and a plain Node test. NONE of these columns are
   sensitive — the row is still passed through sanitizeContactRows for
   column-level policy (credit / payment / commission / special pricing).
   --------------------------------------------------------------------------- */
import type { ServerListConfig } from "./types";

/* Customers / generic contacts config (unchanged from the 2A.1 pilot). */
export const CONTACTS_LIST_CONFIG: ServerListConfig = {
  defaultPageSize: 50,
  maxPageSize: 100,
  sortFields: {
    name: "first_name",
    company: "company_name",
    created: "created_at",
    updated: "updated_at",
    revenue: "total_revenue",
  },
  defaultSort: { field: "name", dir: "asc" },
  searchColumns: [
    "full_name", "display_name", "company_name", "first_name", "last_name",
    "company", "email", "phone", "mobile", "city", "country", "wechat_id", "customer_type",
  ],
  filters: {
    status: { column: "is_active", allowed: ["true", "false"] },
    entity: { column: "entity_type" },
    tier: { column: "customer_type" },
  },
  maxQueryLength: 100,
};

/* Wave 2A.2 — Suppliers config. Suppliers are companies, so name/sort is
   company_name, and the searchable/filterable columns are the supplier-
   appropriate NON-SENSITIVE ones (name variants incl. EN/CN, country/city,
   contact handles, supplier_type). Deliberately EXCLUDES every sensitive
   supplier field — no costs, payment_info, bank details, internal notes,
   ratings, or commercial terms are searchable/sortable/filterable here. */
export const SUPPLIERS_LIST_CONFIG: ServerListConfig = {
  defaultPageSize: 50,
  maxPageSize: 100,
  sortFields: {
    name: "company_name",
    company: "company_name",
    country: "country",
    created: "created_at",
    updated: "updated_at",
  },
  defaultSort: { field: "name", dir: "asc" },
  searchColumns: [
    "company_name", "company_name_en", "company_name_cn", "display_name",
    "full_name", "first_name", "last_name", "company",
    "email", "phone", "mobile", "city", "country", "wechat_id", "supplier_type",
  ],
  filters: {
    status: { column: "is_active", allowed: ["true", "false"] },
    entity: { column: "entity_type" },
    supplierType: { column: "supplier_type" },
  },
  maxQueryLength: 100,
};

/* Pick the server-list contract for the requested directory type. Suppliers get
   the supplier-flavoured config; everything else keeps the customer/contacts
   config, so the Customers pilot and legacy Contacts are untouched. */
export function configForType(type: string | null | undefined): ServerListConfig {
  return type === "supplier" ? SUPPLIERS_LIST_CONFIG : CONTACTS_LIST_CONFIG;
}

/* Slim projection for the paged directory: only the fields a list card renders
   + the sort/search columns. Contains NO sensitive columns (no bank / payment /
   cost / internal notes / KYC / commercial-terms fields). total_revenue /
   outstanding_balance / credit_limit are present for the Customers card but are
   stripped by sanitizeContactRows unless can_view_private. */
export const SLIM_LIST_COLUMNS =
  "id, entity_type, full_name, company_name, company_name_en, company_name_cn, display_name, first_name, last_name, company, photo_url, logo_url, phone, mobile, email, country, city, contact_type, is_active, customer_type, supplier_type, market_band, account_manager, total_revenue, outstanding_balance, credit_limit, currency, tags, created_at, updated_at, tenant_id, person_id";

/* The type-aware breakdown column for the ?summary=1 aggregate: suppliers group
   by supplier_type, everyone else by customer_type. Both are non-sensitive. */
export function summaryBreakdownColumn(type: string | null | undefined): "supplier_type" | "customer_type" {
  return type === "supplier" ? "supplier_type" : "customer_type";
}
