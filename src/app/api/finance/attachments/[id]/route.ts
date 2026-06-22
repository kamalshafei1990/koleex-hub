import "server-only";

/* ===========================================================================
   GET    /api/finance/attachments/[id]   →  single attachment with signed URL
   PATCH  /api/finance/attachments/[id]   →  edit metadata (notes/category/is_primary/tags)
   DELETE /api/finance/attachments/[id]   →  soft-delete (audit-preserving)
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { pathBelongsToTenant } from "@/lib/server/storage-tenant";
import type { AttachmentCategory, AttachmentEntityType, FinanceAttachment } from "@/lib/finance/types";

const BUCKET = "finance-documents";
const SIGNED_VIEW_TTL = 60 * 30;

const VALID_CATEGORIES = new Set<AttachmentCategory>([
  "receipt", "invoice", "shipping_doc", "customs_doc",
  "payment_screenshot", "contract", "other",
]);

function moduleForEntity(t: AttachmentEntityType): string {
  switch (t) {
    case "expense":  return "Expenses";
    default:         return "Finance";
  }
}

async function loadAttachment(id: string, tenantId: string): Promise<FinanceAttachment | null> {
  const { data, error } = await supabaseServer
    .from("finance_attachments")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error || !data) return null;
  return data as FinanceAttachment;
}

/* ---------------------------------------------------------------------------
   GET — single attachment with signed view URL
   --------------------------------------------------------------------------- */

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const att = await loadAttachment(id, auth.tenant_id);
  if (!att || att.deleted_at) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deny = await requireModuleAccess(auth, moduleForEntity(att.entity_type));
  if (deny) return deny;

  /* Phase S.2 — defense-in-depth: even though loadAttachment already
     scoped the row by tenant_id, double-check the storage_path lives
     under the caller's tenant prefix before minting a signed URL.
     A future code path that bypasses loadAttachment can't accidentally
     leak a cross-tenant URL. */
  if (!pathBelongsToTenant(att.storage_path, auth.tenant_id)) {
    console.error("[attachments GET] tenant prefix mismatch", { id, tenant: auth.tenant_id });
    return NextResponse.json({ error: "storage path tenant mismatch" }, { status: 403 });
  }

  const { data: signed } = await supabaseServer.storage
    .from(BUCKET).createSignedUrl(att.storage_path, SIGNED_VIEW_TTL);

  return NextResponse.json({
    attachment: { ...att, signed_url: signed?.signedUrl ?? null },
  });
}

/* ---------------------------------------------------------------------------
   PATCH — edit metadata. Cannot change file/path/tenant/entity.
   --------------------------------------------------------------------------- */

interface PatchBody {
  notes?: string | null;
  category?: AttachmentCategory;
  is_primary?: boolean;
  tags?: string[];
  /* When marking verified the trigger doesn't touch evidence_status,
     so we expose it explicitly. evidence_status lives on the parent
     expense — we update that instead of the attachment. */
  evidence_status?: "missing" | "pending" | "partial" | "verified";
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const att = await loadAttachment(id, auth.tenant_id);
  if (!att || att.deleted_at) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deny = await requireModuleAction(auth, moduleForEntity(att.entity_type), "edit");
  if (deny) return deny;

  const body = (await req.json()) as PatchBody;
  const update: Record<string, unknown> = {};
  if (body.notes !== undefined)     update.notes = body.notes;
  if (body.category)                {
    if (!VALID_CATEGORIES.has(body.category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    update.category = body.category;
  }
  if (body.is_primary !== undefined) update.is_primary = body.is_primary;
  if (body.tags !== undefined)       update.tags = body.tags;

  /* If is_primary was set true, clear it on siblings first. */
  if (body.is_primary === true) {
    await supabaseServer
      .from("finance_attachments")
      .update({ is_primary: false })
      .eq("tenant_id", auth.tenant_id)
      .eq("entity_type", att.entity_type)
      .eq("entity_id", att.entity_id);
  }

  let updated: FinanceAttachment | null = null;
  if (Object.keys(update).length > 0) {
    const { data, error } = await supabaseServer
      .from("finance_attachments")
      .update(update)
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id)
      .select("*")
      .single();
    if (error) {
      console.error("[attachments PATCH]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    updated = data as FinanceAttachment;
  }

  /* Evidence status lives on the parent expense — only the expense
     module is allowed to verify (Phase 2.1 keeps it scoped). */
  if (body.evidence_status && att.entity_type === "expense") {
    await supabaseServer
      .from("finance_expenses")
      .update({ evidence_status: body.evidence_status, updated_at: new Date().toISOString() })
      .eq("id", att.entity_id)
      .eq("tenant_id", auth.tenant_id);
  }

  return NextResponse.json({ attachment: (updated ?? att) });
}

/* ---------------------------------------------------------------------------
   DELETE — soft delete. We don't remove the storage object on the first
   pass; a separate cron sweep can purge soft-deleted attachments older
   than 30 days, preserving an audit window.
   --------------------------------------------------------------------------- */

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const att = await loadAttachment(id, auth.tenant_id);
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (att.deleted_at) return NextResponse.json({ attachment: att }); // idempotent

  const deny = await requireModuleAction(auth, moduleForEntity(att.entity_type), "delete");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("finance_attachments")
    .update({ deleted_at: new Date().toISOString(), deleted_by: auth.account_id })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) {
    console.error("[attachments DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ attachment: data as FinanceAttachment });
}
