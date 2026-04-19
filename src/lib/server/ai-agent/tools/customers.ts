import "server-only";

/* ---------------------------------------------------------------------------
   Customer tools — agent-facing read operations on the customers table.

   Every tool:
   - checks module permission ("Customers" + view)
   - filters to the caller's tenant_id
   - strips sensitive fields (credit_limit, payment_terms, internal notes)
     via filterFields before returning
   - returns a typed ToolResult — the LLM gets permissionStatus +
     filteredFields so it can explain the shape of the data honestly
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";
import type { ToolDef, ToolResult } from "../types";
import { filterFieldsMany } from "../permissions";

const CUSTOMER_MODULE = "Customers";

/* Fields returned to the agent/UI. Sensitive ones (notes, payment_terms)
   are included in the select but stripped via filterFields when the
   caller lacks can_view_private — so the AI never even receives them. */
const CUSTOMER_SELECT = `id, name, customer_code, customer_type, country, city,
  email, phone, whatsapp, status, is_active, assigned_salesperson,
  preferred_pricing_tier, currency_code, last_contact_date, next_followup_date,
  payment_terms, notes, updated_at`;

const getCustomerByName: ToolDef<
  { query: string; limit?: number },
  Array<Record<string, unknown>>
> = {
  name: "getCustomerByName",
  description: "Find Koleex customers by name/company/code. Returns up to 5 matches.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search text." },
      limit: { type: "integer", description: "Max rows. Default 5, cap 20." },
    },
    required: ["query"],
  },
  requiredModule: CUSTOMER_MODULE,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<Array<Record<string, unknown>>>> => {
    const q = String(args.query ?? "").trim();
    if (!q) {
      return {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: "Please provide a search query.",
      };
    }
    const limit = Math.min(Math.max(Number(args.limit ?? 5) || 5, 1), 20);

    /* PostgREST `.or()` uses `,` as the separator and parentheses for
       grouping. If the raw query text contains any of those Supabase
       builds a malformed URL and the browser throws
       "The string did not match the expected pattern" — looks like a
       generic error but the root cause is injection into the filter
       string. Strip the problem characters before embedding. */
    const safeQ = sanitizePostgrestLike(q);
    const { data, error } = await supabaseServer
      .from("customers")
      .select(CUSTOMER_SELECT)
      .eq("tenant_id", ctx.auth.tenant_id)
      .or(
        `name.ilike.%${safeQ}%,company_name.ilike.%${safeQ}%,customer_code.ilike.%${safeQ}%`,
      )
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[tool.getCustomerByName]", error);
      return {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: "Couldn't search customers right now.",
      };
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const { filtered, stripped } = filterFieldsMany(ctx, "customers", rows);

    return {
      ok: true,
      permissionStatus: stripped.length > 0 ? "limited" : "allowed",
      data: filtered as Array<Record<string, unknown>>,
      message: `Found ${filtered.length} customer(s) matching "${q}".`,
      sources: [`customers(tenant=${ctx.auth.tenant_id.slice(0, 8)}…)`],
      filteredFields: stripped,
    };
  },
};

const getCustomerByCode: ToolDef<
  { code: string },
  Record<string, unknown> | null
> = {
  name: "getCustomerByCode",
  description: "Fetch one customer by exact code (e.g. CUS-0012). Returns null if no match.",
  parameters: {
    type: "object",
    properties: {
      code: { type: "string", description: "Exact customer code." },
    },
    required: ["code"],
  },
  requiredModule: CUSTOMER_MODULE,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | null>> => {
    const code = String(args.code ?? "").trim();
    if (!code) {
      return {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: "Please provide a customer code.",
      };
    }
    const { data, error } = await supabaseServer
      .from("customers")
      .select(CUSTOMER_SELECT)
      .eq("tenant_id", ctx.auth.tenant_id)
      .eq("customer_code", code)
      .maybeSingle();

    if (error) {
      console.error("[tool.getCustomerByCode]", error);
      return {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: "Couldn't fetch that customer right now.",
      };
    }
    if (!data) {
      return {
        ok: true,
        permissionStatus: "allowed",
        data: null,
        message: `No customer found with code "${code}".`,
      };
    }
    const { filtered, stripped } = filterFieldsMany(ctx, "customers", [
      data as Record<string, unknown>,
    ]);
    return {
      ok: true,
      permissionStatus: stripped.length > 0 ? "limited" : "allowed",
      data: filtered[0] as Record<string, unknown>,
      message: `Customer "${code}" found.`,
      sources: [`customers(code=${code})`],
      filteredFields: stripped,
    };
  },
};

/** Strip PostgREST metacharacters before embedding user input into a
 *  .or() filter. Comma / parens / quotes are structural in PostgREST
 *  syntax; `?` and `#` can confuse URL parsers. Replaces them with
 *  spaces, collapses whitespace, and caps length so a model that
 *  pastes a paragraph as the "query" never blows the URL up. */
function sanitizePostgrestLike(input: string, maxLen = 80): string {
  return input
    .replace(/[,()"'?#]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export const customerTools: ToolDef[] = [
  getCustomerByName as ToolDef,
  getCustomerByCode as ToolDef,
];
