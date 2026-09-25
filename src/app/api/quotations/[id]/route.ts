import "server-only";

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";
import { assertScopeShadowForRow, toScopeContext } from "@/lib/server/apply-scope";
import { getScopeMode } from "@/lib/server/scope-flags";
import { isCustomerEnforced, ownsQuotation } from "@/lib/server/customer-quotation-guard";
import { sanitizeQuotationDoc } from "@/lib/server/sensitive-columns";
import { normaliseQuoteStatus, QUOTE_STATUSES } from "@/lib/doc-status";
import { notifyQuotationStatus, settleQuotationDeleted } from "@/lib/server/commerce-notify";

type RouteCtx = { params: Promise<{ id: string }> };

/* GET    /api/quotations/[id]  — the full row (doc included), sanitized.
   PATCH  /api/quotations/[id]  — status change only. Body:
            { status: QuoteStatusValue, base_version?: number }
          Bumps `version` exactly like POST /api/quotations does, appends to
          doc.statusHistory when the status actually changes, and answers 409
          with the POST route's conflict shape when base_version is stale.
          The detail page used to push a status through the full upsert with
          a re-sent doc, which raced the builder for the same row.
   DELETE /api/quotations/[id]  — body { reason?: string } is optional; the
          reason lands in the audit row. */

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Quotations");
  if (deny) return deny;
  const { id } = await params;

  /* NOTE: the `customers` pricing-engine table has columns
     (id, name, company_name, ...) — NOT display_name. The embedded
     select previously asked for display_name which tripped PostgREST
     and made this endpoint return 500, which left the detail page
     stuck on the loading spinner forever. Keep the column list
     aligned with the real schema. */
  const { data, error } = await supabaseServer
    .from("quotations")
    .select(`*, customer:customer_id ( id, name, company_name )`)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (error) {
    console.error("[api/quotations/[id] GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  /* CQE — Customer-only enforcement: an external/customer account may only
     open a quotation it created. Returns the same 404 as "not found" (no
     existence leak). Inert when the flag is off → internal/SA unchanged. */
  if (
    await isCustomerEnforced(auth, supabaseServer) &&
    !ownsQuotation(data as { created_by?: string | null }, auth.account_id)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  /* DS1b-1 — single-row data_scope SHADOW (log-only). Runs only when the
     Quotations flag is "shadow"; never alters the response or status code,
     never hides the row. Reads created_by from the already-fetched row. */
  if (getScopeMode("Quotations") === "shadow") {
    await assertScopeShadowForRow({
      row: data as Record<string, unknown>,
      ctx: toScopeContext(auth),
      module: "Quotations",
      endpoint: "GET /api/quotations/[id]",
      db: supabaseServer,
      mode: "shadow",
    });
  }

  /* Column-level policy: the doc embeds supplier costs + pricing automation
     (costHead per line, standTablePrice, fxRate, margin defaults). Stripped
     unless the caller's role has can_view_private — the editor's cost gutter
     simply stays empty for them; a save merges existing costs back server-side. */
  return NextResponse.json({
    quotation: {
      ...(data as Record<string, unknown>),
      doc: sanitizeQuotationDoc(auth, (data as { doc?: Record<string, unknown> }).doc ?? {}),
    },
  });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Quotations", "edit");
  if (deny) return deny;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as
    | { status?: unknown; base_version?: unknown }
    | null;
  const next = normaliseQuoteStatus(body?.status);
  if (!next) {
    return NextResponse.json(
      { error: `Unknown status. Expected one of: ${QUOTE_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const { data: cur, error: curErr } = await supabaseServer
    .from("quotations")
    .select("id, quote_no, status, version, updated_by_name, updated_at, doc, created_by")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (curErr) {
    console.error("[api/quotations/[id] PATCH]", curErr.message);
    return NextResponse.json({ error: "Could not load the quotation" }, { status: 500 });
  }
  if (!cur) return NextResponse.json({ error: "Not found" }, { status: 404 });
  /* Same CQE rule as GET: a customer account only acts on its own rows, and
     a row it does not own is indistinguishable from a missing one. */
  if (
    await isCustomerEnforced(auth, supabaseServer) &&
    !ownsQuotation(cur as { created_by?: string | null }, auth.account_id)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const currentVersion = typeof cur.version === "number" ? cur.version : 1;
  const conflict = (latest: { version?: number | null; updated_by_name?: string | null; updated_at?: string | null } | null) =>
    NextResponse.json(
      {
        status: "conflict",
        error: "This quotation was updated by another user. Reload to see the latest version.",
        current: {
          version: latest?.version ?? currentVersion,
          updated_by_name: latest?.updated_by_name ?? null,
          updated_at: latest?.updated_at ?? null,
        },
      },
      { status: 409 },
    );

  if (typeof body?.base_version === "number" && body.base_version !== currentVersion) {
    return conflict(cur);
  }
  const guardVersion = typeof body?.base_version === "number" ? body.base_version : currentVersion;

  const prev = typeof cur.status === "string" ? cur.status : null;
  const changed = prev !== next;
  /* The doc is written back untouched (server copy, so no cost stripping is
     needed) apart from the history entry — the builder reads the same
     statusHistory shape and only appends on a real transition too. */
  const doc = ((cur as { doc?: Record<string, unknown> }).doc ?? {}) as Record<string, unknown>;
  const history = Array.isArray(doc.statusHistory) ? (doc.statusHistory as unknown[]) : [];
  const savedDoc = changed
    ? { ...doc, status: next, statusHistory: [...history, { status: next, at: new Date().toISOString() }] }
    : doc;

  const { data, error } = await supabaseServer
    .from("quotations")
    .update({
      status: next,
      doc: savedDoc,
      version: guardVersion + 1,
      updated_by: auth.account_id,
      updated_by_name: auth.username,
    })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .eq("version", guardVersion)
    .select("*, customer:customer_id ( id, name, company_name )")
    .maybeSingle();
  if (error) {
    console.error("[api/quotations/[id] PATCH]", error.message);
    return NextResponse.json({ error: "Could not update the status" }, { status: 500 });
  }
  if (!data) {
    // 0 rows → a concurrent writer moved the version between read and write.
    const { data: latest } = await supabaseServer
      .from("quotations")
      .select("version, updated_by_name, updated_at")
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle();
    return conflict(latest);
  }

  await logAudit({
    auth,
    action_type: "update",
    entity_type: "quotation",
    entity_id: id,
    entity_label: (cur as { quote_no?: string | null }).quote_no ?? null,
    old_values: { status: prev, version: currentVersion },
    new_values: { status: next, version: guardVersion + 1 },
    module: "Quotations",
    route: `/quotations/${id}`,
    req,
    metadata: changed
      ? { status_changed: true, from: prev, to: next }
      : { status_changed: false },
  });
  if (changed) {
    const q = cur as { quote_no?: string | null; created_by?: string | null };
    after(() => notifyQuotationStatus(auth, { id, quote_no: q.quote_no, created_by: q.created_by }, prev, next));
  }

  return NextResponse.json({
    quotation: {
      ...(data as Record<string, unknown>),
      doc: sanitizeQuotationDoc(auth, (data as { doc?: Record<string, unknown> }).doc ?? {}),
    },
  });
}

export async function DELETE(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Quotations", "delete");
  if (deny) return deny;
  const { id } = await params;

  /* The reason is optional: the builder's delete sends no body at all, and
     an empty or non-JSON body must not turn a delete into a 400. */
  const body = (await req.json().catch(() => null)) as { reason?: unknown } | null;
  const reason =
    typeof body?.reason === "string" && body.reason.trim()
      ? body.reason.trim().slice(0, 500)
      : null;

  const { data: row } = await supabaseServer
    .from("quotations")
    .select("quote_no, status")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();

  const { error } = await supabaseServer
    .from("quotations")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    auth,
    action_type: "delete",
    entity_type: "quotation",
    entity_id: id,
    entity_label: (row as { quote_no?: string | null } | null)?.quote_no ?? null,
    old_values: row ? { status: (row as { status?: string }).status ?? null } : null,
    severity: "critical",
    module: "Quotations",
    route: "/quotations",
    req,
    metadata: { reason },
  });
  after(() => settleQuotationDeleted(id));

  return NextResponse.json({ ok: true });
}
