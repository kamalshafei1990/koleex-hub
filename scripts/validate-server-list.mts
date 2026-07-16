#!/usr/bin/env node
/* ===========================================================================
   validate:server-list — security + correctness guards for the shared
   server-list contract (Phase 4 Wave 2A.1).

   Proves parseListParams / normalizeQuery / buildListResponse enforce the
   allowlists and normalization the endpoint relies on: page-size cap, approved
   sort-field allowlist, approved filter allowlist (+ value allowlist), query
   normalization (whitespace, length) with Chinese/Arabic/English preserved,
   and pagination metadata. Pure unit test (no DB, no network).
   Run: node --import tsx scripts/validate-server-list.mts
   ========================================================================== */
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mod = await import(path.resolve(__dirname, "../src/lib/server-list/types.ts"));
const { parseListParams, normalizeQuery, buildListResponse } = mod as typeof import("../src/lib/server-list/types.js");

const CFG = {
  defaultPageSize: 50,
  maxPageSize: 100,
  sortFields: { name: "first_name", company: "company_name", created: "created_at" },
  defaultSort: { field: "name", dir: "asc" as const },
  searchColumns: ["first_name", "company_name", "email"],
  filters: {
    status: { column: "is_active", allowed: ["true", "false"] as const },
    tier: { column: "customer_type" },
  },
  maxQueryLength: 20,
};
const P = (qs: string) => parseListParams(new URLSearchParams(qs), CFG);

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

/* ── page-size cap ── */
check("pageSize above max is clamped", P("pageSize=9999").pageSize === 100);
check("pageSize missing → default", P("").pageSize === 50);
check("pageSize invalid → default", P("pageSize=abc").pageSize === 50);
check("pageSize negative → default", P("pageSize=-5").pageSize === 50);
check("page invalid → 1", P("page=xyz").page === 1);
check("page 0 → 1", P("page=0").page === 1);
check("page valid preserved", P("page=3").page === 3);

/* ── sort-field allowlist ── */
check("approved sort kept", P("sort=company").sort === "company");
check("unknown sort → default field", P("sort=credit_limit; DROP TABLE").sort === "name");
check("unknown sort never leaks raw value", P("sort=ssn_no").sort === "name");
check("dir asc/desc kept", P("sort=company&dir=desc").dir === "desc");
check("invalid dir → asc for non-default field", P("sort=company&dir=sideways").dir === "asc");

/* ── filter allowlist (key + value) ── */
check("approved filter+value kept", P("status=true").filters.status === "true");
check("disallowed filter value dropped", P("status=maybe").filters.status === undefined);
check("unknown filter key dropped", P("credit_limit=999").filters.credit_limit === undefined);
check("free-value filter kept", P("tier=Diamond").filters.tier === "Diamond");
check("empty filter value dropped", P("tier=").filters.tier === undefined);

/* ── query normalization ── */
check("whitespace collapsed + trimmed", P("q=%20%20a%20%20%20b%20").q === "a b");
check("query length capped", P("q=" + encodeURIComponent("x".repeat(50))).q.length === 20);
check("empty query → empty string", P("").q === "");
check("Chinese query preserved", normalizeQuery("  上海  纺织  ", 20) === "上海 纺织");
check("Arabic query preserved", normalizeQuery("  شركة  ", 20) === "شركة");
check("English query preserved", normalizeQuery("  Acme  Corp ", 20) === "Acme Corp");
check("NFC normalization applied", normalizeQuery("é", 20) === "é"); // e + combining acute → é

/* ── pagination metadata ── */
const full = buildListResponse(new Array(50).fill({}), P("pageSize=50&page=2"), 137);
check("hasMore true when page is full", full.hasMore === true);
check("total echoed", full.total === 137);
check("page echoed", full.page === 2);
const partial = buildListResponse(new Array(7).fill({}), P("pageSize=50"), 7);
check("hasMore false when page not full", partial.hasMore === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
