"use client";

/* ---------------------------------------------------------------------------
   hr-client — browser-side query builder that executes through the
   permission-gated /api/hr/data gateway.

   It mirrors the exact slice of the supabase-js builder surface that
   src/lib/hr-admin.ts uses (select/insert/update/delete + eq/gte/lte/in/
   not/is/order/limit/single/maybeSingle/count-head), and resolves to the
   same `{ data, error, count }` shape — so swapping hr-admin's dead anon
   client for this one is a one-line import change, not a 65-call rewrite.

   Why not keep the anon client: every hr_* table is RLS deny-all (HR data is
   sensitive, no anon policies on purpose), so those queries always returned
   empty reads and failed writes. The gateway runs them server-side with the
   service role behind the caller's HR module permission.
   --------------------------------------------------------------------------- */

type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "is" | "not_is";

interface Descriptor {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  columns?: string;
  filters: Array<{ col: string; op: FilterOp; value: unknown }>;
  order?: { col: string; ascending?: boolean };
  limit?: number;
  count?: boolean;
  single?: "single" | "maybeSingle";
  values?: unknown;
}

/* `data` is deliberately `any`, matching the untyped supabase-admin client
   hr-admin.ts was written against — its call sites cast rows themselves. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface HrResult {
  data: any;
  error: { message: string } | null;
  count: number | null;
}

class HrQuery implements PromiseLike<HrResult> {
  private d: Descriptor;

  constructor(table: string) {
    this.d = { table, op: "select", filters: [] };
  }

  /* ── verbs ── */
  select(columns?: string, opts?: { count?: "exact"; head?: boolean }): this {
    /* insert(...).select() keeps the insert op — mirrors supabase-js, where
       .select() after a write only asks for the rows back (the gateway
       already returns them). */
    if (this.d.op === "select") {
      this.d.columns = columns;
      if (opts?.head) this.d.count = true;
    }
    return this;
  }
  insert(values: unknown): this { this.d.op = "insert"; this.d.values = values; return this; }
  update(values: unknown): this { this.d.op = "update"; this.d.values = values; return this; }
  delete(): this { this.d.op = "delete"; return this; }

  /* ── filters ── */
  eq(col: string, value: unknown): this { this.d.filters.push({ col, op: "eq", value }); return this; }
  neq(col: string, value: unknown): this { this.d.filters.push({ col, op: "neq", value }); return this; }
  gt(col: string, value: unknown): this { this.d.filters.push({ col, op: "gt", value }); return this; }
  gte(col: string, value: unknown): this { this.d.filters.push({ col, op: "gte", value }); return this; }
  lt(col: string, value: unknown): this { this.d.filters.push({ col, op: "lt", value }); return this; }
  lte(col: string, value: unknown): this { this.d.filters.push({ col, op: "lte", value }); return this; }
  in(col: string, values: unknown[]): this { this.d.filters.push({ col, op: "in", value: values }); return this; }
  is(col: string, value: null | boolean): this { this.d.filters.push({ col, op: "is", value }); return this; }
  /** Only the `.not(col, "is", null)` form is used by the HR lib. */
  not(col: string, operator: string, value: unknown): this {
    if (operator === "is") this.d.filters.push({ col, op: "not_is", value });
    else console.warn(`[hr-client] unsupported not(${operator}) ignored`);
    return this;
  }

  /* ── modifiers ── */
  order(col: string, opts?: { ascending?: boolean }): this {
    this.d.order = { col, ascending: opts?.ascending ?? true };
    return this;
  }
  limit(n: number): this { this.d.limit = n; return this; }
  single(): this { this.d.single = "single"; return this; }
  maybeSingle(): this { this.d.single = "maybeSingle"; return this; }

  /* ── execution (thenable, like the supabase builder) ── */
  private async run(): Promise<HrResult> {
    try {
      const res = await fetch("/api/hr/data", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.d),
      });
      const json = (await res.json().catch(() => null)) as
        | { data: unknown; error: string | null; count: number | null }
        | { error?: string }
        | null;
      if (!res.ok || !json) {
        const msg = (json as { error?: string } | null)?.error || `HTTP ${res.status}`;
        return { data: null, error: { message: msg }, count: null };
      }
      const body = json as { data: unknown; error: string | null; count: number | null };
      /* `.single()` on a write returns the row, not an array — unwrap to
         match what hr-admin expects from supabase-js. */
      let data = body.data;
      if (this.d.single && Array.isArray(data)) data = data[0] ?? null;
      return {
        data: data ?? null,
        error: body.error ? { message: body.error } : null,
        count: body.count,
      };
    } catch (e) {
      return {
        data: null,
        error: { message: e instanceof Error ? e.message : "Network error" },
        count: null,
      };
    }
  }

  then<R1 = HrResult, R2 = never>(
    onfulfilled?: ((value: HrResult) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

/** Drop-in for the tiny supabase surface hr-admin uses. */
export const hrdb = {
  from(table: string): HrQuery {
    return new HrQuery(table);
  },
};
