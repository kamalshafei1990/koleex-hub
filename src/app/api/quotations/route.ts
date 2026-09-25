import "server-only";

import { NextResponse, after } from "next/server";
import { notifyQuotationStatus } from "@/lib/server/commerce-notify";
import { notifyLite } from "@/lib/server/notify-lite";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { stageTimer } from "@/lib/server/perf";
import { preserveQuotationDocCosts, sanitizeQuotationDoc } from "@/lib/server/sensitive-columns";
import { resolveBaseCurrency } from "@/lib/finance/currency";
import {
  applyScope,
  recordScopeShadow,
  resolveEffectiveScope,
  toScopeContext,
} from "@/lib/server/apply-scope";
import { getScopeMode } from "@/lib/server/scope-flags";
import { isCustomerEnforced } from "@/lib/server/customer-quotation-guard";
import { logAudit } from "@/lib/server/audit";
import { normaliseQuoteStatus, QUOTE_STATUSES } from "@/lib/doc-status";

/* GET  /api/quotations — list (tenant-scoped)
     Query:
       status=draft|sent|accepted|rejected|expired|all   default: all
       customer_id=<uuid>
       search=<text>                  case-insensitive substring on quote_no
                                      + doc.customerName (applied in memory)
   POST /api/quotations — upsert a doc-builder quote. Body:
       {
         id?: string,                 // if present → update (needs can_edit)
         quote_no?: string,           // if absent → server mints KL-QU-<deal>
         customer_id?: string | null,
         currency?: string,
         status?: QuoteStatusValue,   // legacy 'final' → 'sent'; else 400
         issue_date?: YYYY-MM-DD,
         valid_till?: YYYY-MM-DD | null,
         total?: number,              // client-computed grand total for list view
         doc: Record<string, unknown> // full UI snapshot
       }
     On update, a column is only written when its key is in the body: the
     builder never sends customer_id, and writing `body.customer_id ?? null`
     unlinked the customer on every save. */

/* ── Quote numbering ────────────────────────────────────────────────────────
   One counter issues the number for the whole DEAL; each document prefixes it
   with its own two letters:

       KL-QU-12349   quotation
       KL-IN-12349   invoice for the same deal
       KL-CN-12349   sales contract
       KL-PL-12349 / KL-PO-12349

   This replaces a date-derived scheme (KL{YYYY}-{MMDD} plus -A/-B on
   collision), which identified the DAY a quote was raised rather than the
   deal, and so could not be shared with the invoice that follows it. Owner
   asked for the linked form 2026-08-24; note it reverses an earlier
   deliberate move away from sequential numbers.

   `next_deal_number` increments under a row lock, so two documents opened at
   the same moment cannot collide — verified with 10 concurrent calls. A
   read-then-write here in application code would not hold that guarantee,
   which is exactly why the counter lives in the database.

   Owner decisions: the counter never resets, and a number is reserved when a
   document is opened, so gaps from abandoned drafts are expected. */
async function nextDealNumber(tenantId: string): Promise<number> {
  const { data, error } = await supabaseServer.rpc("next_deal_number", {
    p_tenant: tenantId,
  });
  if (error || data == null) {
    /* Deliberately fatal. A duplicate or malformed document number is worse
       than a failed create: it corrupts the link between a quotation and
       every document that follows it, and only shows up later. */
    throw new Error(`Could not allocate a document number: ${error?.message ?? "no value returned"}`);
  }
  return Number(data);
}

export async function GET(req: Request) {
  const _t = stageTimer("quotations.list");
  const auth = await requireAuth();
  if (auth instanceof NextResponse) { _t.done({ status: 401 }); return auth; }
  const deny = await requireModuleAccess(auth, "Quotations");
  if (deny) { _t.done({ status: 403 }); return deny; }
  _t.mark("auth");

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "all";
  /* Legacy callers still ask for status=final; that is the "sent" family. An
     unknown value is treated as "all" rather than matching nothing. */
  const status =
    statusParam === "all" ? "all" : (normaliseQuoteStatus(statusParam) ?? "all");
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
  /* `search` is applied AFTER the fetch, in memory (see below). The list
     query is already unbounded per tenant, so this costs nothing extra, and
     it is the only way to match doc->>customerName without interpolating
     the user's text into a raw PostgREST .or() filter string — where a
     search of `foo,bar.ilike.<anything>` injects extra clauses (commas and
     dots are separators there). The typed .ilike() that used to cover
     quote_no alone could not reach into the JSON doc. */

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
  _t.mark("db");
  if (error) {
    console.error("[api/quotations GET]", error.message);
    _t.done({ status: 500 });
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
  const needle = search ? search.toLowerCase() : "";
  const matched = needle
    ? (data ?? []).filter((row) => {
        const r = row as { quote_no?: string | null; doc?: Record<string, unknown> | null };
        const quoteNo = (r.quote_no ?? "").toLowerCase();
        const name = r.doc?.customerName;
        const customerName = typeof name === "string" ? name.toLowerCase() : "";
        return quoteNo.includes(needle) || customerName.includes(needle);
      })
    : (data ?? []);

  const slim = matched.map((row) => {
    const full = (row as { doc?: Record<string, unknown> }).doc ?? {};
    const { items: _items, ...rest } = full;
    // Strip created_by (selected only for DS1a shadow eval) so the response
    // shape is byte-identical to before DS1a.
    const { created_by: _createdBy, ...rowOut } = row as Record<string, unknown>;
    /* Column-level policy: the doc embeds supplier costs / pricing automation
       (standTablePrice, fxRate, default pricing) — can_view_private only. */
    return { ...rowOut, doc: sanitizeQuotationDoc(auth, rest) };
  });

  const { header } = _t.done({ status: 200, status_filter: status, rows: slim.length });
  return NextResponse.json({ quotations: slim }, {
    headers: {
      // Private + short max-age so rapid back/forward navigation
      // doesn't re-fetch, but any write invalidates quickly.
      "Cache-Control": "private, max-age=30, stale-while-revalidate=180",
      "Server-Timing": header,
    },
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    quote_no?: string;
    customer_id?: string | null;
    currency?: string;
    status?: unknown;
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
  } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  /* Update needs can_edit, insert needs can_create — a role that may only
     edit existing quotations used to be refused here, and one that may only
     create could rewrite any row. */
  const deny = await requireModuleAction(auth, "Quotations", body.id ? "edit" : "create");
  if (deny) return deny;

  /* Status is validated once, against the shared list. Absent on an update
     means "keep what the row has"; absent on an insert means draft. */
  const requestedStatus = "status" in body ? normaliseQuoteStatus(body.status) : undefined;
  if (requestedStatus === null) {
    return NextResponse.json(
      { error: `Unknown status. Expected one of: ${QUOTE_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

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
      .select("version, updated_by_name, updated_at, doc, created_by, quote_no, status")
      .eq("id", body.id)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle();
    if (curErr) return NextResponse.json({ error: curErr.message }, { status: 500 });
    if (!cur) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });

    /* Can't-read → can't-write for the doc's embedded cost keys: a caller
       without can_view_private got a stripped doc on load, so merge the
       existing row's cost data back into their save instead of losing it. */
    const savedDoc = preserveQuotationDocCosts(
      auth,
      (body.doc ?? {}) as Record<string, unknown>,
      (cur as { doc?: Record<string, unknown> }).doc ?? null,
    );

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

    const prevStatus = typeof cur.status === "string" ? cur.status : null;
    const nextStatus = requestedStatus ?? prevStatus ?? "draft";

    /* Only columns whose key the caller sent are written. A key that is
       absent is not "null" — it is "not this caller's to change". */
    const { data, error } = await supabaseServer
      .from("quotations")
      .update({
        quote_no: body.quote_no,
        ...("customer_id" in body ? { customer_id: body.customer_id ?? null } : {}),
        ...("currency" in body ? { currency: body.currency ?? baseCurrency } : {}),
        status: nextStatus,
        ...("issue_date" in body
          ? { issue_date: body.issue_date ?? new Date().toISOString().slice(0, 10) }
          : {}),
        ...("valid_till" in body ? { valid_till: body.valid_till ?? null } : {}),
        ...("total" in body ? { total: body.total ?? 0 } : {}),
        doc: savedDoc,
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
    const quoteNo = body.quote_no || (cur as { quote_no?: string }).quote_no || "";
    /* Quotation activity is a REAL notification family: the quotation's
       creator hears when someone ELSE saves changes to their quotation.
       A save that also moves the status says so instead (one notice, the
       more telling one — notifyQuotationStatus below). */
    if (data && cur.created_by && cur.created_by !== auth.account_id && prevStatus === nextStatus) {
      void notifyLite({
        tenantId: auth.tenant_id,
        recipients: [cur.created_by as string],
        senderId: auth.account_id,
        tpl: { k: "quotation_updated", p: { no: quoteNo, actor: auth.username } },
        /* The builder opens ?doc=<id> straight into the editor. */
        link: `/quotations?doc=${encodeURIComponent(body.id)}`,
        type: "quotation_updated",
        metadata: { source: "quotations", quotation_id: body.id },
        tag: `quotation:${body.id}`,
        /* Five saves were five unread rows about one quotation: the newest replaces them. */
        supersede: { type: "quotation_updated", quotation_id: body.id },
      });
    }
    if (data) {
      const statusChanged = prevStatus !== nextStatus;
      await logAudit({
        auth,
        action_type: "update",
        entity_type: "quotation",
        entity_id: body.id,
        entity_label: quoteNo || null,
        old_values: { status: prevStatus, version: currentVersion },
        new_values: { status: nextStatus, version: guardVersion + 1 },
        module: "Quotations",
        route: "/quotations",
        req,
        metadata: statusChanged
          ? { status_changed: true, from: prevStatus, to: nextStatus }
          : { status_changed: false },
      });
      if (statusChanged) {
        const id = body.id;
        const createdBy = (cur.created_by as string | null) ?? null;
        after(() => notifyQuotationStatus(auth, { id, quote_no: quoteNo, created_by: createdBy }, prevStatus, nextStatus));
      }
    }
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
    return NextResponse.json({
      quotation: {
        ...(data as Record<string, unknown>),
        doc: sanitizeQuotationDoc(auth, (data as { doc?: Record<string, unknown> }).doc ?? {}),
      },
    });
  }

  /* An explicit quote_no in the payload (an import, or a duplicate carrying
     its source number) skips the counter and therefore has no deal_no. */
  const dealNo = body.quote_no ? null : await nextDealNumber(auth.tenant_id);
  const quote_no = body.quote_no ?? `KL-QU-${dealNo}`;
  const { data, error } = await supabaseServer
    .from("quotations")
    .insert({
      tenant_id: auth.tenant_id,
      quote_no,
      deal_no: dealNo,
      customer_id: body.customer_id ?? null,
      currency: body.currency ?? baseCurrency,
      status: requestedStatus ?? "draft",
      issue_date: body.issue_date ?? new Date().toISOString().slice(0, 10),
      valid_till: body.valid_till ?? null,
      total: body.total ?? 0,
      /* Create by a non-private caller: no existing doc to preserve, but any
         cost keys in the payload are untrusted — strip them. */
      doc: preserveQuotationDocCosts(auth, (body.doc ?? {}) as Record<string, unknown>, null),
      created_by: auth.account_id,
      updated_by: auth.account_id,
      updated_by_name: auth.username,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    auth,
    action_type: "create",
    entity_type: "quotation",
    entity_id: (data as { id?: string }).id ?? null,
    entity_label: quote_no,
    new_values: { status: requestedStatus ?? "draft", version: 1, deal_no: dealNo },
    module: "Quotations",
    route: "/quotations",
    req,
    metadata: { status_changed: false },
  });
  return NextResponse.json({
    quotation: {
      ...(data as Record<string, unknown>),
      doc: sanitizeQuotationDoc(auth, (data as { doc?: Record<string, unknown> }).doc ?? {}),
    },
  });
}
