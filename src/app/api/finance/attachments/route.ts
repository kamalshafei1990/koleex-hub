import "server-only";

/* ===========================================================================
   POST /api/finance/attachments
     Mints a signed *upload* URL into the finance-documents bucket AND
     creates the finance_attachments row that points at it. The client
     uploads the file directly to Supabase Storage with the signed URL
     — keeps the Next API surface lean and avoids re-streaming large
     files through serverless handlers.

   GET  /api/finance/attachments?entity_type=expense&entity_id=...
     Lists active attachments for an entity, with short-lived signed
     view URLs for image/PDF previews.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type {
  AttachmentCategory,
  AttachmentEntityType,
  FinanceAttachment,
} from "@/lib/finance/types";

const BUCKET = "finance-documents";
const SIGNED_VIEW_TTL = 60 * 30;      // 30 min — enough for a session
const SIGNED_UPLOAD_TTL = 60 * 15;    // 15 min for the client to push the file

const VALID_ENTITY_TYPES = new Set<AttachmentEntityType>([
  "expense", "payment", "order", "supplier", "customer",
]);
const VALID_CATEGORIES = new Set<AttachmentCategory>([
  "receipt", "invoice", "shipping_doc", "customs_doc",
  "payment_screenshot", "contract", "other",
]);
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "image/heic", "image/heif",
]);
const MAX_BYTES = 20 * 1024 * 1024;

/* The module key required to access each entity type. Keeps permissions
   aligned with the existing module-permission system. */
function moduleForEntity(t: AttachmentEntityType): string {
  switch (t) {
    case "expense":  return "Expenses";
    case "payment":  return "Finance";
    case "order":    return "Finance";
    case "supplier": return "Finance";
    case "customer": return "Finance";
  }
}

function safeExtension(fileName: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  return (m?.[1] ?? "bin").toLowerCase().slice(0, 6);
}

/* ---------------------------------------------------------------------------
   POST  —  create attachment + return signed upload URL
   --------------------------------------------------------------------------- */

interface CreateBody {
  entity_type: AttachmentEntityType;
  entity_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_hash?: string;       // SHA-256 hex, optional (used for dup detection)
  category?: AttachmentCategory;
  notes?: string;
  tags?: string[];
  is_primary?: boolean;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as CreateBody;

  /* ── Validate inputs ─────────────────────────────────────────── */
  if (!body || !body.entity_type || !body.entity_id || !body.file_name || !body.file_type || !body.file_size) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!VALID_ENTITY_TYPES.has(body.entity_type)) {
    return NextResponse.json({ error: "Invalid entity_type" }, { status: 400 });
  }
  if (body.category && !VALID_CATEGORIES.has(body.category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(body.file_type)) {
    return NextResponse.json({ error: `File type ${body.file_type} not allowed` }, { status: 400 });
  }
  if (body.file_size > MAX_BYTES) {
    return NextResponse.json({ error: `File exceeds ${MAX_BYTES} bytes` }, { status: 400 });
  }

  /* Module permission gate. */
  const deny = await requireModuleAccess(auth, moduleForEntity(body.entity_type));
  if (deny) return deny;

  /* ── Entity ownership check ─────────────────────────────────── */
  /* For expense, payment, and order we verify the row exists and
     belongs to the caller's tenant. Suppliers/customers are looser
     because they're shared records — the module-permission gate is
     sufficient there. */
  if (body.entity_type === "expense") {
    const { data } = await supabaseServer.from("finance_expenses")
      .select("id, tenant_id").eq("id", body.entity_id).maybeSingle();
    if (!data || data.tenant_id !== auth.tenant_id) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
  } else if (body.entity_type === "payment") {
    const { data } = await supabaseServer.from("finance_payments")
      .select("id, tenant_id").eq("id", body.entity_id).maybeSingle();
    if (!data || data.tenant_id !== auth.tenant_id) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
  } else if (body.entity_type === "order") {
    const { data } = await supabaseServer.from("finance_orders")
      .select("id, tenant_id").eq("id", body.entity_id).maybeSingle();
    if (!data || data.tenant_id !== auth.tenant_id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
  }

  /* ── Duplicate detection — calm warning, do not block ──────── */
  let duplicate: { id: string; file_name: string; uploaded_at: string } | null = null;
  if (body.file_hash) {
    const { data } = await supabaseServer
      .from("finance_attachments")
      .select("id, file_name, uploaded_at, entity_type, entity_id")
      .eq("tenant_id", auth.tenant_id)
      .eq("file_hash", body.file_hash)
      .is("deleted_at", null)
      .limit(1);
    if (data && data.length > 0) {
      duplicate = {
        id: data[0].id as string,
        file_name: data[0].file_name as string,
        uploaded_at: data[0].uploaded_at as string,
      };
    }
  }

  /* ── Path + signed upload URL ───────────────────────────────── */
  const attachmentId = crypto.randomUUID();
  const ext = safeExtension(body.file_name);
  const storagePath = `${auth.tenant_id}/${body.entity_type}/${body.entity_id}/${attachmentId}.${ext}`;

  const { data: signed, error: signErr } = await supabaseServer.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);
  if (signErr || !signed) {
    console.error("[attachments POST signed upload]", signErr?.message);
    return NextResponse.json({ error: "Failed to mint upload URL" }, { status: 500 });
  }

  /* Insert row pre-upload so we have a stable id. The client confirms
     completion via PATCH (handled below) — but to keep the flow
     one-step we accept that the file may be missing for a short
     window. The cron-clean approach can sweep orphaned rows older
     than 24 h later. */
  const { data: inserted, error: insErr } = await supabaseServer
    .from("finance_attachments")
    .insert({
      id: attachmentId,
      tenant_id: auth.tenant_id,
      entity_type: body.entity_type,
      entity_id: body.entity_id,
      file_name: body.file_name,
      file_type: body.file_type,
      file_size: body.file_size,
      storage_path: storagePath,
      file_hash: body.file_hash ?? null,
      category: body.category ?? "receipt",
      notes: body.notes ?? null,
      tags: body.tags ?? [],
      is_primary: body.is_primary ?? false,
      uploaded_by: auth.account_id,
    })
    .select("*")
    .single();
  if (insErr || !inserted) {
    console.error("[attachments POST insert]", insErr?.message);
    return NextResponse.json({ error: "Failed to record attachment" }, { status: 500 });
  }

  return NextResponse.json({
    attachment: inserted as FinanceAttachment,
    upload: {
      bucket: BUCKET,
      path: storagePath,
      signed_url: signed.signedUrl,
      token: signed.token,
      expires_in: SIGNED_UPLOAD_TTL,
    },
    duplicate,                  // null when no match
  });
}

/* ---------------------------------------------------------------------------
   GET — list attachments for an entity
   --------------------------------------------------------------------------- */

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entity_type") as AttachmentEntityType | null;
  const entityId = url.searchParams.get("entity_id");

  if (!entityType || !VALID_ENTITY_TYPES.has(entityType)) {
    return NextResponse.json({ error: "entity_type required" }, { status: 400 });
  }
  if (!entityId) {
    return NextResponse.json({ error: "entity_id required" }, { status: 400 });
  }

  const deny = await requireModuleAccess(auth, moduleForEntity(entityType));
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("finance_attachments")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });
  if (error) {
    console.error("[attachments GET]", error.message);
    return NextResponse.json({ error: "Failed to load attachments" }, { status: 500 });
  }

  /* Mint short-lived signed URLs in batch for previews. */
  const rows = (data ?? []) as FinanceAttachment[];
  const paths = rows.map((r) => r.storage_path);
  let signedUrls: Map<string, string> = new Map();
  if (paths.length > 0) {
    const { data: signed } = await supabaseServer.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGNED_VIEW_TTL);
    if (signed) {
      signedUrls = new Map(signed.map((s) => [s.path ?? "", s.signedUrl ?? ""]));
    }
  }
  const out = rows.map((r) => ({ ...r, signed_url: signedUrls.get(r.storage_path) ?? null }));
  return NextResponse.json({ attachments: out });
}
