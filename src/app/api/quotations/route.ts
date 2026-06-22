import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { resolveBaseCurrency } from "@/lib/finance/currency";
import {
  applyScope,
  recordScopeShadow,
  resolveEffectiveScope,
  toScopeContext,
} from "@/lib/server/apply-scope";
import { getScopeMode } from "@/lib/server/scope-flags";
import { isCustomerEnforced } from "@/lib/server/customer-quotation-guard";

/* GET  /api/quotations — list (tenant-scoped)
     Query:
       status=draft|final|all         default: all
       customer_id=<uuid>
       search=<text>                  ilike on quote_no + doc->>customerName
   POST /api/quotations — upsert a doc-builder quote. Body:
       {
         id?: string,                 // if present → update
         quote_no?: string,           // if absent → server mints next KL<year>-NNNN
         customer_id?: string | null,
         currency?: string,
         status?: 'draft' | 'final',
         issue_date?: YYYY-MM-DD,
         valid_till?: YYYY-MM-DD | null,
         total?: number,              // client-computed grand total for list view
         doc: Record<string, unknown> // full UI snapshot
       } */

/* Date-based quote numbering: `KL{YYYY}-{MMDD}` derived from the
   issue date. A quote dated 24/10/2025 becomes `KL2025-1024`. When
   multiple quotes are minted on the same date the first keeps the
   bare form and subsequent ones get a `-A`, `-B`, `-C`… suffix in
   ASCII order. This replaced the prior monotonic-sequence scheme
   (KL2026-1520, -1521…) so the number reads as a date and stays
   meaningful at a glance. */
async function nextQuoteNumber(
  tenantId: string,
  issueDate?: string,
): Promise<string> {
  // Parse the issue date as a calendar date in the operator's intent,
  // not as a UTC instant. `new Date("2025-10-24")` would be UTC midnight
  // and slip a day in negative tz offsets, so split the YYYY-MM-DD
  // string directly.
  const iso = (issueDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const [yStr, mStr, dStr] = iso.split("-");
  const year = yStr || String(new Date().getFullYear());
  const mmdd = `${mStr ?? "01"}${dStr ?? "01"}`;
  const base = `KL${year}-${mmdd}`;

  // Pull every quote_no in this tenant that starts with the base. The
  // set is tiny (one date's worth), so an in-memory scan for the next
  // free letter is cheaper than a clever SQL ordering.
  const { data } = await supabaseServer
    .from("quotations")
    .select("quote_no")
    .eq("tenant_id", tenantId)
    .ilike("quote_no", `${base}%`);
  const taken = new Set(
    (data ?? [])
      .map((r) => (r as { quote_no: string | null }).quote_no)
      .filter((n): n is string => typeof n === "string"),
  );

  if (!taken.has(base)) return base;
  // Walk A, B, C … Z, then AA, AB, … on the off-chance a single date
  // overflows 26 quotes (extremely unlikely, but cheap to support).
  const letter = (n: number): string => {
    let s = "";
    let v = n;
    while (v >= 0) {
      s = String.fromCharCode(65 + (v % 26)) + s;
      v = Math.floor(v / 26) - 1;
    }
    return s;
  };
  for (let i = 0; i < 26 * 27; i++) {
    const candidate = `${base}-${letter(i)}`;
    if (!taken.has(candidate)) return candidate;
  }
  // Truly degenerate fallback — should never run in practice.
  return `${base}-${Date.now()}`;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Quotations");
  if (deny) return deny;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "all";
  const customerId = url.searchParams.get("customer_id");
  const search = url.searchParams.get("search")?.trim();

  let q = supabaseServer
    .from("quotations")
    .select(
      // created_by is selected for DS1a shadow scope evaluation only and is
      // STRIPPED from the response below (response shape unchanged).
      `id, tenant_id, quote_no, customer_id, status, currency, discount_percent,
       notes, doc, issue_date, valid_till, total, created_at, updated_at, created_by,
       version, updated_by, updated_by_name,
       customer:customer_id ( id, name, company_name )`,
    )
    .eq("tenant_id", auth.tenant_id);

  if (status !== "all") q = q.eq("status", status);
  if (customerId) q = q.eq("customer_id", customerId);
  if (search) {
    /* Use the typed .ilike() (with column + pattern as separate
       args) instead of interpolating the user's text into the raw
       PostgREST .or() filter string. The previous form let a
       search of `foo,bar.ilike.<anything>` inject additional
       filter clauses (PostgREST .or() parses commas + dots as
       separators). */
    q = q.ilike("quote_no", `%${search}%`);
  }

  q = q.order("updated_at", { ascending: false }).order("created_at", { ascending: false });

  /* CQE — Customer-only Quotations Enforcement (real filter, customer-only).
     When CUSTOMER_QUOTATIONS_ENFORCE is ON and this is an external/customer
     account (not super-admin), restrict to rows they created. This hides
     internal/SA-created AND null-owner quotes. Inert (no DB read) when the
     flag is off → internal/SA behaviour unchanged. Independent of the DS1a
     shadow flag below. */
  if (await isCustomerEnforced(auth, supabaseServer)) {
    q = q.eq("created_by", auth.account_id);
  }

  /* DS1a — data_scope SHADOW/OFF only. applyScope NEVER modifies the query
     (the enforce path is not built here), so rows + order + payload are
     byte-identical to before. When the Quotations flag is "shadow", we log
     counts-only after the fetch. Default flag is "off" → no logging. */
  const scopeMode = getScopeMode("Quotations");
  const scopeCtx = toScopeContext(auth);
  const effectiveScope =
    scopeMode === "off"
      ? "all"
      : await resolveEffectiveScope(scopeCtx, "Quotations", supabaseServer);
  const { query: scopedQ } = await applyScope(q, scopeCtx, "Quotations", {
    mode: scopeMode,
    effectiveScope,
  });

  const { data, error } = await scopedQ;
  if (error) {
    console.error("[api/quotations GET]", error.message);
    return NextResponse.json({ error: "Failed to load quotations" }, { status: 500 });
  }

  if (scopeMode === "shadow") {
    recordScopeShadow({
      module: "Quotations",
      endpoint: "GET /api/quotations",
      ctx: scopeCtx,
      rows: (data ?? []) as Record<string, unknown>[],
      effectiveScope,
    });
  }

  /* Strip the heavy `items` array (with base64 images) before
     shipping to the browser. Items can account for 99% of the list
     payload and are only needed when the user opens the editor —
     the /:id GET still returns the complete doc. */
  const slim = (data ?? []).map((row) => {
    const full = (row as { doc?: Record<string, unknown> }).doc ?? {};
    const { items: _items, ...rest } = full;
    // Strip created_by (selected only for DS1a shadow eval) so the response
    // shape is byte-identical to before DS1a.
    const { created_by: _createdBy, ...rowOut } = row as Record<string, unknown>;
    return { ...rowOut, doc: rest };
  });

  return NextResponse.json({ quotations: slim }, {
    headers: {
      // Private + short max-age so rapid back/forward navigation
      // doesn't re-fetch, but any write invalidates quickly.
      "Cache-Control": "private, max-age=30, stale-while-revalidate=180",
    },
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Quotations", "create");
  if (deny) return deny;

  const body = (await req.json()) as {
    id?: string;
    quote_no?: string;
    customer_id?: string | null;
    currency?: string;
    status?: "draft" | "final";
    issue_date?: string;
    valid_till?: string | null;
    total?: number;
    doc: Record<string, unknown>;
    /* Optimistic lock — the version the client loaded. When present, the
       update only succeeds if the DB row is still at this version; a mismatch
       means another user saved in the meantime → reject (409) so the stale
       client can never overwrite newer data. Omitted by legacy callers, in
       which case we fall back to last-write (but still increment version). */
    base_version?: number;
  };

  /* Server fallback for currency — tenant base instead of hardcoded
     USD. The doc-builder form always sends a currency; this guards
     legacy API consumers. */
  const baseCurrency = await resolveBaseCurrency(auth.tenant_id);

  // Upsert by id if given; else mint a new record with a fresh quote_no.
  if (body.id) {
    /* Read the current row first (tenant-scoped) so we can (a) detect a
       version conflict before overwriting, and (b) compute the next version.
       This does NOT modify any data. */
    const { data: cur, error: curErr } = await supabaseServer
      .from("quotations")
      .select("version, updated_by_name, updated_at")
      .eq("id", body.id)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle();
    if (curErr) return NextResponse.json({ error: curErr.message }, { status: 500 });
    if (!cur) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });

    const currentVersion = typeof cur.version === "number" ? cur.version : 1;

    // Optimistic-lock check: reject a stale save before it can overwrite.
    if (typeof body.base_version === "number" && body.base_version !== currentVersion) {
      return NextResponse.json(
        {
          status: "conflict",
          current: {
            version: currentVersion,
            updated_by_name: cur.updated_by_name ?? null,
            updated_at: cur.updated_at ?? null,
          },
        },
        { status: 409 },
      );
    }

    // The version we guard against: the one the client loaded, or (legacy
    // caller) the row's current version. The .eq("version", guard) makes the
    // write atomic against a concurrent writer slipping in between read & write.
    const guardVersion = typeof body.base_version === "number" ? body.base_version : currentVersion;

    const { data, error } = await supabaseServer
      .from("quotations")
      .update({
        quote_no: body.quote_no,
        customer_id: body.customer_id ?? null,
        currency: body.currency ?? baseCurrency,
        status: body.status ?? "draft",
        issue_date: body.issue_date ?? new Date().toISOString().slice(0, 10),
        valid_till: body.valid_till ?? null,
        total: body.total ?? 0,
        doc: body.doc ?? {},
        version: guardVersion + 1,
        updated_by: auth.account_id,
        updated_by_name: auth.username,
      })
      .eq("id", body.id)
      .eq("tenant_id", auth.tenant_id)
      .eq("version", guardVersion)
      .select("*")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // 0 rows updated → a concurrent writer changed the version between our
    // read and write. Re-report as a conflict (never a silent overwrite).
    if (!data) {
      const { data: latest } = await supabaseServer
        .from("quotations")
        .select("version, updated_by_name, updated_at")
        .eq("id", body.id)
        .eq("tenant_id", auth.tenant_id)
        .maybeSingle();
      return NextResponse.json(
        {
          status: "conflict",
          current: {
            version: latest?.version ?? currentVersion,
            updated_by_name: latest?.updated_by_name ?? null,
            updated_at: latest?.updated_at ?? null,
          },
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ quotation: data });
  }

  const quote_no =
    body.quote_no ??
    (await nextQuoteNumber(auth.tenant_id, body.issue_date));
  const { data, error } = await supabaseServer
    .from("quotations")
    .insert({
      tenant_id: auth.tenant_id,
      quote_no,
      customer_id: body.customer_id ?? null,
      currency: body.currency ?? baseCurrency,
      status: body.status ?? "draft",
      issue_date: body.issue_date ?? new Date().toISOString().slice(0, 10),
      valid_till: body.valid_till ?? null,
      total: body.total ?? 0,
      doc: body.doc ?? {},
      created_by: auth.account_id,
      updated_by: auth.account_id,
      updated_by_name: auth.username,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ quotation: data });
}
