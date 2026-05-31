import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/suppliers/[id] — Supplier 360.

   Returns the supplier (contacts row) plus everything linked to it:
   purchase orders, vendor bills, payments, and products supplied. Each
   linked dataset is fetched INDEPENDENTLY and fault-tolerantly — if a table
   or column doesn't exist in this deployment, that slice degrades to an
   empty array instead of failing the whole page. All queries are tenant
   scoped; access requires the Suppliers module.

   Response:
     200 { supplier, purchaseOrders[], bills[], payments[], products[] }
     401 { error } · 403 { error } · 404 { error } · 500 { error }
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { computeReadiness, resolveCallerTier, visibleTiers, certIsTrusted, computeSourcingScore, STRATEGIC_STATUS_LABELS } from "@/lib/suppliers/intelligence";
import { PRIVATE_BUCKETS } from "@/lib/server/storage-tenant";
import { logSupplierEvent, actorName } from "@/lib/suppliers/timeline";

type Row = Record<string, unknown>;

/* Best-effort fetch: never throws. A missing table/column (or any query
   error) resolves to [] so one broken slice can't break the 360 page. */
async function safe(build: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[]> {
  try {
    const r = await build();
    if (!r || r.error || !Array.isArray(r.data)) return [];
    return r.data as Row[];
  } catch {
    return [];
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  // Communication intelligence (contacts + QR) is visibility-gated by the
  // caller's resolved tier. Finance/management-tier records never reach
  // lower-tier callers.
  const callerTier = resolveCallerTier(auth);
  const tiers = visibleTiers(callerTier);

  const { data: supplier, error: supErr } = await supabaseServer
    .from("contacts")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tid)
    .maybeSingle();

  if (supErr) {
    console.error("[api/suppliers/:id]", supErr.message);
    return NextResponse.json({ error: "Failed to load supplier" }, { status: 500 });
  }
  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  const profileGated = callerTier === "public" || callerTier === "internal";
  const [purchaseOrders, bills, payments, products, receipts, returns, classifications, contactPersons, media, qrCodes, statusHistory, factoryRows, timeline, riskProfileRows, riskItems, negotiations, negotiationIntelRows, sourcingProfileRows, sourcingLinks, specializations] = await Promise.all([
    safe(() =>
      supabaseServer
        .from("purchase_orders")
        .select("*")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .limit(200),
    ),
    safe(() =>
      supabaseServer
        .from("vendor_bills")
        .select("*")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .limit(200),
    ),
    safe(() =>
      supabaseServer
        .from("finance_payments")
        .select("*")
        .eq("tenant_id", tid)
        .eq("party_type", "supplier")
        .eq("party_id", id)
        .limit(200),
    ),
    safe(() =>
      supabaseServer
        .from("products")
        .select("id, name, primary_model, photo_url, slug, supplier_id")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .limit(200),
    ),
    safe(() =>
      supabaseServer
        .from("purchase_receipts")
        .select("*")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .limit(200),
    ),
    safe(() =>
      supabaseServer
        .from("returns")
        .select("*")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .limit(200),
    ),
    // ── Supplier Intelligence (contacts-keyed) ──
    safe(() =>
      supabaseServer
        .from("supplier_classifications")
        .select("classification, is_primary")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .limit(50),
    ),
    safe(() =>
      supabaseServer
        .from("supplier_contact_persons")
        .select(
          "id, full_name, name_cn, role, role_category, department, position, is_primary, is_decision_maker, " +
          "email, mobile, whatsapp, telegram, wechat_id, wecom_id, line_id, skype_id, " +
          "preferred_channel, preferred_language, timezone, available_hours, " +
          "reliability, reliability_score, response_speed, avg_response_hours, " +
          "last_interaction_at, notes, visibility_tier",
        )
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .eq("is_active", true)
        .in("visibility_tier", tiers)
        .order("is_primary", { ascending: false })
        .limit(100),
    ),
    // Governed media (documents/photos/certifications) — tier-aware; QR excluded.
    safe(() =>
      supabaseServer
        .from("supplier_media")
        .select(
          "id, media_class, category, title, description, file_url, preview_url, " +
          "storage_bucket, storage_path, file_name, mime_type, file_size, file_ext, " +
          "visibility, lifecycle_status, is_primary, is_downloadable, language, doc_number, " +
          "issuer, issued_date, expiry_date, cert_type, markets_covered, " +
          "verified_at, verified_by, contact_id, product_id, tags, created_at, uploaded_by",
        )
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .is("deleted_at", null)
        .neq("media_class", "qr_code")
        .in("visibility", tiers)
        .order("created_at", { ascending: false })
        .limit(300),
    ),
    // Communication QR codes — governed media, tier-aware, may link a contact.
    safe(() =>
      supabaseServer
        .from("supplier_media")
        .select("id, category, title, description, file_url, preview_url, visibility, contact_id, is_downloadable, created_at, uploaded_by")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .eq("media_class", "qr_code")
        .is("deleted_at", null)
        .in("visibility", tiers)
        .order("created_at", { ascending: false })
        .limit(100),
    ),
    safe(() =>
      supabaseServer
        .from("supplier_status_history")
        .select("from_status, to_status, changed_at")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .order("changed_at", { ascending: false })
        .limit(20),
    ),
    safe(() =>
      supabaseServer
        .from("supplier_factory_profile")
        .select("*")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .limit(1),
    ),
    // Unified operational timeline — tier-aware, newest first.
    safe(() =>
      supabaseServer
        .from("supplier_timeline_events")
        .select("id, event_type, event_category, title, description, actor_id, actor_name, source_module, visibility_tier, importance, is_manual, related_entity_id, related_entity_type, metadata, created_at")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .in("visibility_tier", tiers)
        .order("created_at", { ascending: false })
        .limit(200),
    ),
    // ── Risk / Negotiation Intelligence (most sensitive; RLS + tier-gated) ──
    // The 1:1 scorecards (Foundation tables) are procurement+ only.
    profileGated ? Promise.resolve([] as Row[]) : safe(() =>
      supabaseServer.from("supplier_risk_profile").select("*")
        .eq("tenant_id", tid).eq("supplier_id", id).limit(1)),
    safe(() =>
      supabaseServer.from("supplier_risk_items")
        .select("id, dimension, severity, status, title, description, mitigation, visibility_tier, raised_by, resolved_at, created_at")
        .eq("tenant_id", tid).eq("supplier_id", id)
        .in("visibility_tier", tiers)
        .order("created_at", { ascending: false }).limit(200)),
    safe(() =>
      supabaseServer.from("supplier_negotiation_rounds")
        .select("id, round_no, topic, outcome, price_concession, moq_concession, payment_terms_concession, discount_pct, exclusivity_discussed, territory_discussed, leverage_notes, red_flags, behavior_notes, visibility_tier, occurred_on, created_by, created_at")
        .eq("tenant_id", tid).eq("supplier_id", id)
        .in("visibility_tier", tiers)
        .order("created_at", { ascending: false }).limit(100)),
    profileGated ? Promise.resolve([] as Row[]) : safe(() =>
      supabaseServer.from("supplier_negotiation_intel").select("*")
        .eq("tenant_id", tid).eq("supplier_id", id).limit(1)),
    // ── Sourcing intelligence ──
    profileGated ? Promise.resolve([] as Row[]) : safe(() =>
      supabaseServer.from("supplier_sourcing_profile").select("*")
        .eq("tenant_id", tid).eq("supplier_id", id).limit(1)),
    safe(() =>
      supabaseServer.from("supplier_product_links")
        .select("id, product_id, sourcing_role, sourcing_priority, target_price, quality_level, lead_time_days, moq, risk_notes, notes, products(product_name, category_slug)")
        .eq("tenant_id", tid).eq("supplier_id", id).not("sourcing_role", "is", null)
        .order("sourcing_priority", { ascending: true, nullsFirst: false }).limit(200)),
    safe(() =>
      supabaseServer.from("supplier_product_specializations")
        .select("id, category_label, specialization_rank, strength_score, is_primary, notes")
        .eq("tenant_id", tid).eq("supplier_id", id)
        .order("specialization_rank", { ascending: true, nullsFirst: false }).limit(100)),
  ]);

  const factory = factoryRows[0] ?? null;
  const riskProfile = riskProfileRows[0] ?? null;
  const negotiationIntel = negotiationIntelRows[0] ?? null;
  const openHighRisks = riskItems.filter(
    (r) => r.resolved_at == null && r.status !== "resolved" && (r.severity === "high" || r.severity === "critical"),
  ).length;
  const risk = {
    level: riskProfile && typeof riskProfile.risk_level === "string" ? riskProfile.risk_level : null,
    score: riskProfile && typeof riskProfile.internal_evaluation_score === "number" ? riskProfile.internal_evaluation_score : null,
    trustLevel: riskProfile && typeof riskProfile.trust_level === "string" ? riskProfile.trust_level : null,
    openItems: riskItems.filter((r) => r.status !== "resolved").length,
    openHighRisks,
  };

  // Communication-intelligence completeness signals (drive the Contacts dim).
  const hasChannel = (c: Row) =>
    !!(c.wechat_id || c.wecom_id || c.whatsapp || c.telegram || c.mobile);
  const hasPrefs = (c: Row) => !!(c.preferred_channel || c.preferred_language);
  const contactsWithChannel = contactPersons.filter(hasChannel).length;
  const contactsWithPreferences = contactPersons.filter(hasPrefs).length;

  // ── Sensitive assets in private buckets get short-lived signed URLs so
  //    governance never depends on frontend filtering alone. Public-bucket
  //    assets keep their direct file_url. (Best-effort: a failed mint leaves
  //    the row without a usable URL rather than leaking it.)
  const privateRows = media.filter(
    (m) => typeof m.storage_bucket === "string" && PRIVATE_BUCKETS.has(m.storage_bucket) && typeof m.storage_path === "string",
  );
  if (privateRows.length) {
    const byBucket = new Map<string, Row[]>();
    for (const m of privateRows) {
      const b = m.storage_bucket as string;
      (byBucket.get(b) ?? byBucket.set(b, []).get(b)!).push(m);
    }
    await Promise.all(
      [...byBucket.entries()].map(async ([bucket, rows]) => {
        try {
          const paths = rows.map((r) => r.storage_path as string);
          const { data } = await supabaseServer.storage.from(bucket).createSignedUrls(paths, 3600);
          const signed = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
          for (const r of rows) {
            const u = signed.get(r.storage_path as string) ?? null;
            r.file_url = u;
            r.preview_url = u;
          }
        } catch {
          for (const r of rows) { r.file_url = null; r.preview_url = null; }
        }
      }),
    );
  }

  // ── Evidence-asset readiness signals ──
  const today = new Date().toISOString().slice(0, 10);
  const FACTORY_CATS = new Set([
    "factory_photo", "factory_video", "production_line", "qc_photo",
    "warehouse_photo", "showroom_photo", "production_video",
  ]);
  const PROC_DOC_CATS = new Set(["audit_report", "inspection_report", "sample_report"]);
  const certRows = media.filter((m) => m.category === "certification");
  const certsActive = certRows.filter((m) => certIsTrusted(m, today)).length;
  const certsExpired = certRows.filter(
    (m) => typeof m.expiry_date === "string" && (m.expiry_date as string) < today,
  ).length;
  const factoryMediaCount = media.filter((m) => FACTORY_CATS.has(String(m.category))).length;
  const docsVerified = media.filter(
    (m) => PROC_DOC_CATS.has(String(m.category)) && !!m.verified_at,
  ).length;

  const readiness = computeReadiness({
    supplier: supplier as Record<string, unknown>,
    classifications: classifications.length,
    contactPersons: contactPersons.length,
    media: media.length,
    purchaseOrders: purchaseOrders.length,
    bills: bills.length,
    receipts: receipts.length,
    factory,
    contactsWithChannel,
    contactsWithPreferences,
    qrCodes: qrCodes.length,
    certsActive,
    certsExpired,
    factoryMediaCount,
    docsVerified,
  });

  // ── Sourcing intelligence summary (computed; manual override wins) ──
  const sourcingProfile = sourcingProfileRows[0] ?? null;
  const sourcingScore = computeSourcingScore({
    override: sourcingProfile && typeof sourcingProfile.sourcing_score_override === "number" ? sourcingProfile.sourcing_score_override : null,
    readiness: readiness.score,
    riskLevel: riskProfile && typeof riskProfile.risk_level === "string" ? riskProfile.risk_level : null,
    negotiationScore: negotiationIntel && typeof negotiationIntel.negotiation_score === "number" ? negotiationIntel.negotiation_score : null,
    certsActive,
    trustLevel: riskProfile && typeof riskProfile.trust_level === "string" ? riskProfile.trust_level : null,
  });
  const sourcing = {
    score: sourcingScore,
    priority: sourcingProfile && typeof sourcingProfile.sourcing_priority === "number" ? sourcingProfile.sourcing_priority : null,
    preferredProducts: sourcingLinks.filter((l) => l.sourcing_role === "preferred").length,
    blockedProducts: sourcingLinks.filter((l) => l.sourcing_role === "blocked").length,
    soleSource: !!(riskProfile && riskProfile.dependency_level === "critical") || !!(riskProfile && riskProfile.backup_supplier_exists === false && riskProfile.dependency_level === "high"),
  };

  // ── Readiness-milestone timeline event ── fires at most once per 25-point
  //    threshold crossed upward (guarded by the persisted readiness_milestone
  //    marker, so a GET never re-emits). Idempotent + non-spammy.
  const milestone = Math.floor(readiness.score / 25) * 25;
  const prevMilestone = Number((supplier as Row).readiness_milestone ?? 0);
  if (milestone > prevMilestone && milestone >= 25) {
    try {
      await supabaseServer.from("contacts").update({ readiness_milestone: milestone }).eq("id", id).eq("tenant_id", tid);
      await logSupplierEvent({
        tenant_id: tid, supplier_id: id,
        event_type: "readiness_milestone", event_category: "system",
        title: `Supplier readiness reached ${milestone}%`,
        actor_id: null, actor_name: "System", source_module: "readiness",
        visibility_tier: "internal", importance: milestone >= 75 ? "high" : "normal",
        metadata: { milestone, score: readiness.score },
      });
    } catch { /* best-effort */ }
  }

  return NextResponse.json(
    {
      supplier,
      purchaseOrders,
      bills,
      payments,
      products,
      receipts,
      returns,
      classifications,
      contactPersons,
      media,
      qrCodes,
      statusHistory,
      factory,
      timeline,
      riskProfile,
      riskItems,
      negotiations,
      negotiationIntel,
      risk,
      sourcingProfile,
      sourcingLinks,
      specializations,
      sourcing,
      callerTier,
      readiness,
    },
    { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=120" } },
  );
}

/* ---------------------------------------------------------------------------
   PATCH /api/suppliers/[id] — edit supplier intelligence (scalar fields).

   Whitelisted, tenant-scoped, Suppliers-module gated. Writes only the
   intelligence/commercial scalars that live on the contacts row. Changing
   strategic_status stamps strategic_status_since and appends an immutable
   supplier_status_history row (operational audit trail). Sensitive
   management-tier reasons are accepted but never returned to public surfaces.
   --------------------------------------------------------------------------- */

const PATCHABLE_FIELDS = new Set<string>([
  "strategic_status",
  "strategic_status_reason",
  "blacklist_reason",
  "supports_oem_branding",
  "supports_packaging_customization",
  "supports_spare_parts",
  "supports_samples",
  "sample_turnaround_days",
  "wecom_support_available",
  "wechat_sales_group_available",
  "wechat_official_account",
  // commercial scalars (reused existing contacts columns)
  "payment_terms",
  "currency",
  "moq",
  "lead_time",
  "incoterms",
]);

const STRATEGIC_STATUSES = new Set([
  "strategic", "preferred", "approved", "trial", "inactive", "blocked", "blacklisted",
]);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Build a whitelisted patch.
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (PATCHABLE_FIELDS.has(k)) patch[k] = v === "" ? null : v;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
  }
  if (
    typeof patch.strategic_status === "string" &&
    patch.strategic_status &&
    !STRATEGIC_STATUSES.has(patch.strategic_status)
  ) {
    return NextResponse.json({ error: "Invalid strategic_status" }, { status: 400 });
  }

  // Load current supplier (tenant + supplier scoped) for status-change detection.
  const { data: current, error: curErr } = await supabaseServer
    .from("contacts")
    .select("id, strategic_status")
    .eq("id", id)
    .eq("tenant_id", tid)
    .eq("contact_type", "supplier")
    .maybeSingle();
  if (curErr) return NextResponse.json({ error: "Failed to load supplier" }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const statusChanged =
    "strategic_status" in patch && patch.strategic_status !== (current as Row).strategic_status;
  if (statusChanged) patch.strategic_status_since = new Date().toISOString();

  const { error: updErr } = await supabaseServer
    .from("contacts")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tid);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Append an immutable status-history event on transition.
  if (statusChanged && typeof patch.strategic_status === "string" && patch.strategic_status) {
    try {
      await supabaseServer.from("supplier_status_history").insert({
        tenant_id: tid,
        supplier_id: id,
        from_status: (current as Row).strategic_status ?? null,
        to_status: patch.strategic_status,
        reason: typeof patch.strategic_status_reason === "string" ? patch.strategic_status_reason : null,
        changed_by: auth.account_id ?? null,
      });
    } catch {
      /* history is best-effort; the status update already succeeded */
    }
    const toLabel = STRATEGIC_STATUS_LABELS[patch.strategic_status as keyof typeof STRATEGIC_STATUS_LABELS] ?? patch.strategic_status;
    await logSupplierEvent({
      tenant_id: tid, supplier_id: id,
      event_type: "status_changed", event_category: "relationship",
      title: `Strategic status set to ${toLabel}`,
      description: typeof patch.strategic_status_reason === "string" ? patch.strategic_status_reason : null,
      actor_id: auth.account_id ?? null, actor_name: actorName(auth),
      source_module: "suppliers",
      visibility_tier: "internal",
      importance: patch.strategic_status === "blacklisted" || patch.strategic_status === "blocked" ? "high" : "normal",
      metadata: { from: (current as Row).strategic_status ?? null, to: patch.strategic_status },
    });
  }

  return NextResponse.json({ ok: true });
}
