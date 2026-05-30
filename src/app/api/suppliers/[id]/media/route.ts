import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/suppliers/[id]/media — register a governed evidence asset.

   The file is uploaded first via /api/storage/upload (public `media` bucket
   for non-sensitive assets, private `finance-documents` for sensitive ones);
   this route records the governed metadata row in supplier_media. Whitelisted,
   tenant + supplier scoped, Suppliers-module gated, blocked while viewing-as.
   QR codes are NOT created here (see /qr).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import {
  buildMediaPatch, validateMediaPatch, MEDIA_CATEGORIES,
} from "@/lib/suppliers/media-fields";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
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

  const fileUrl = typeof body.file_url === "string" ? body.file_url.trim() : "";
  if (!fileUrl) return NextResponse.json({ error: "file_url is required" }, { status: 400 });
  const category = typeof body.category === "string" ? body.category : "";
  if (!MEDIA_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid or missing category" }, { status: 400 });
  }

  const meta = buildMediaPatch(body);
  const verr = validateMediaPatch(meta);
  if (verr) return NextResponse.json({ error: verr }, { status: 400 });

  // Verify the supplier belongs to this tenant.
  const { data: sup } = await supabaseServer
    .from("contacts")
    .select("id").eq("id", id).eq("tenant_id", tid).eq("contact_type", "supplier").maybeSingle();
  if (!sup) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  // Optional linkage checks (tenant + supplier scoped).
  let contactId: string | null = null;
  if (typeof body.contact_id === "string" && body.contact_id) {
    const { data: cp } = await supabaseServer
      .from("supplier_contact_persons")
      .select("id").eq("id", body.contact_id).eq("tenant_id", tid).eq("supplier_id", id).maybeSingle();
    if (!cp) return NextResponse.json({ error: "Linked contact not found" }, { status: 400 });
    contactId = body.contact_id;
  }
  let productId: string | null = null;
  if (typeof body.product_id === "string" && body.product_id) {
    const { data: pr } = await supabaseServer
      .from("products")
      .select("id").eq("id", body.product_id).eq("tenant_id", tid).maybeSingle();
    if (!pr) return NextResponse.json({ error: "Linked product not found" }, { status: 400 });
    productId = body.product_id;
  }

  const mediaClass = typeof body.media_class === "string" && body.media_class ? body.media_class : "document";

  const { data, error } = await supabaseServer
    .from("supplier_media")
    .insert({
      tenant_id: tid,
      supplier_id: id,
      contact_id: contactId,
      product_id: productId,
      media_class: mediaClass,
      category,
      title: meta.title ?? null,
      description: meta.description ?? null,
      visibility: typeof body.visibility === "string" && body.visibility ? body.visibility : "internal",
      lifecycle_status: typeof body.lifecycle_status === "string" && body.lifecycle_status ? body.lifecycle_status : "active",
      storage_bucket: typeof body.storage_bucket === "string" ? body.storage_bucket : null,
      storage_path: typeof body.storage_path === "string" ? body.storage_path : null,
      file_url: fileUrl,
      preview_url: typeof body.preview_url === "string" ? body.preview_url : null,
      file_name: typeof body.file_name === "string" ? body.file_name : null,
      mime_type: typeof body.mime_type === "string" ? body.mime_type : null,
      file_size: typeof body.file_size === "number" ? body.file_size : null,
      file_ext: typeof body.file_ext === "string" ? body.file_ext : null,
      language: meta.language ?? null,
      doc_number: meta.doc_number ?? null,
      issuer: meta.issuer ?? null,
      issued_date: meta.issued_date ?? null,
      expiry_date: meta.expiry_date ?? null,
      cert_type: meta.cert_type ?? null,
      markets_covered: Array.isArray(meta.markets_covered) ? meta.markets_covered : [],
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      is_downloadable: body.is_downloadable === false ? false : true,
      uploaded_by: auth.account_id ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
